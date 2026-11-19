import {analyzePattern} from '../../pattern-analysis';
import { z } from 'zod';
import {firebaseIdentity, firestoreReportsUrl, firestoreFetch, firebaseError} from '../../firebase-server';
import { detection, expeditionVersion, legacyExpeditionVersion, sweepExpeditionVersion, isExpedition, stepResult, testFrequencies, relativeSteps, frequencies, levels, protocolVersion, responseWindowMs } from '../../screening';

const pilotTrial = z.object({
  ear: z.union([z.literal(0), z.literal(1)]),
  freq: z.number(),
  level: z.number(),
  kind: z.enum(['tone', 'silent']),
  heard: z.boolean(),
  responseMs: z.number().int().min(0).max(responseWindowMs).nullable(),
  interrupted: z.boolean().optional(),
  noiseDbfs: z.number().min(-100).max(12).nullable().optional(),
});
const pilotReport = z.object({
  id: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  date: z.string().datetime(),
  name: z.string().min(1).max(60),
  age: z.number().int().min(18).max(120).optional(),
  answers: z.array(z.string().max(200)).max(3),
  protocol: z.enum([protocolVersion, legacyExpeditionVersion, sweepExpeditionVersion, expeditionVersion]),
  noiseMonitored: z.boolean().optional(),
  status: z.enum(['complete', 'incomplete']),
  trials: z.array(pilotTrial).max(1000),
}).refine(report => {
  if (isExpedition(report.protocol)) {
    const attempts = new Map<string, z.infer<typeof pilotTrial>[]>();
    for (const trial of report.trials) {
      if (trial.heard !== (trial.responseMs !== null)) return false;
      if (trial.kind === 'silent') {
        if (trial.freq !== 0 || trial.level !== 0) return false;
      } else {
        if (!testFrequencies.some(freq => freq === trial.freq) || !relativeSteps.includes(trial.level)) return false;
        if (report.protocol === legacyExpeditionVersion && trial.level > 90) return false;
        if (report.protocol !== legacyExpeditionVersion && !trial.interrupted) {
          const key = [trial.ear, trial.freq, trial.level].join(':');
          const previous = attempts.get(key) ?? [];
          if (previous.length && stepResult(previous) !== null) return false;
          attempts.set(key, [...previous, trial]);
        }
      }
    }
    return report.status === 'incomplete' || [0, 1].every(ear => testFrequencies.every(freq =>
      detection(report.trials, ear, freq, report.protocol).status !== 'pending'));
  }
  const counts = new Map<string, number>();
  let previousEar = 0;
  for (const trial of report.trials) {
    if (trial.ear < previousEar || trial.heard !== (trial.responseMs !== null)) return false;
    previousEar = trial.ear;
    if (trial.kind === 'silent') {
      if (trial.freq !== 0 || trial.level !== 0) return false;
    } else if (!frequencies.some(freq => freq === trial.freq) || !levels.some(level => level === trial.level)) {
      return false;
    }
    if (trial.interrupted) continue;
    const key = [trial.ear, trial.freq, trial.level].join(':');
    const count = (counts.get(key) ?? 0) + 1;
    if (count > 2) return false;
    counts.set(key, count);
  }
  return report.status === 'incomplete' || (counts.size === 14 && [...counts.values()].every(count => count === 2));
});

export async function GET(req:Request) {
  try{
    const {uid,token}=await firebaseIdentity(req);
    const rows:unknown[]=[];
    let pageToken='';
    // Follow pages so existing history is not silently truncated.
    do{
      const query=new URLSearchParams({pageSize:'100',orderBy:'createdAt desc'});
      if(pageToken)query.set('pageToken',pageToken);
      const response=await firestoreFetch(`${firestoreReportsUrl(uid)}?${query}`,token);
      const data=await response.json() as {documents?:{fields:{payload:{stringValue:string}}}[];nextPageToken?:string};
      for(const document of data.documents??[]){
        const parsed=pilotReport.safeParse(JSON.parse(document.fields.payload.stringValue));
        if(parsed.success)rows.push({...parsed.data,analysis:analyzePattern(parsed.data)});
      }
      pageToken=data.nextPageToken??'';
    }while(pageToken);
    return Response.json(rows,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return firebaseError(error);}
}

export async function POST(req:Request) {
  try{
    const {uid,token}=await firebaseIdentity(req);
    if(Number(req.headers.get('content-length'))>200000)return Response.json({error:'Report is too large'},{status:413});
    const text=await req.text();
    if(text.length>200000)return Response.json({error:'Report is too large'},{status:413});
    const parsed=pilotReport.safeParse(JSON.parse(text));
    if(!parsed.success)return Response.json({error:'Invalid screening report'},{status:400});
    const report={...parsed.data,analysis:analyzePattern(parsed.data)};
    const response=await firestoreFetch(`${firestoreReportsUrl(uid)}?documentId=${encodeURIComponent(report.id)}`,token,{
      method:'POST',body:JSON.stringify({fields:{
        ownerId:{stringValue:uid},
        reportId:{stringValue:report.id},
        protocol:{stringValue:report.protocol},
        createdAt:{timestampValue:new Date().toISOString()},
        payload:{stringValue:JSON.stringify(report)},
      }}),
    });
    // Immutable report IDs make network retries idempotent.
    if(response.status===409){
      const existing=await firestoreFetch(`${firestoreReportsUrl(uid)}/${encodeURIComponent(report.id)}`,token);
      const document=await existing.json() as {fields:{payload:{stringValue:string}}};
      const stored=pilotReport.safeParse(JSON.parse(document.fields.payload.stringValue));
      if(!stored.success)throw new Error('Invalid stored report');
      return Response.json({...stored.data,analysis:analyzePattern(stored.data)},{headers:{'Cache-Control':'private, no-store'}});
    }
    return Response.json(report,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    if(error instanceof SyntaxError)return Response.json({error:'Invalid report'},{status:400});
    return firebaseError(error);
  }
}
