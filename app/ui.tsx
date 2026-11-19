'use client';
import {useState,useEffect,useRef} from 'react';
import {ArrowUpRight,ArrowRight,Headphones,Sparkles,Volume2,Play,Check,ChevronLeft,MessageCircle,X,Download,LayoutDashboard,LogOut,Orbit,ShieldCheck,AudioLines,Pause} from 'lucide-react';
import {frequencies, levels, detection, stepResult, isExpedition, testFrequencies, expeditionOrder, expeditionVersion, responseWindowMs, summarize, type Trial, type TrialCondition} from './screening';
import {Arena, DetectionChart, type Lane, type Shot} from './expedition';
import {RoomMonitor, roomTooLoud} from './noise';
import {createToneBuffer} from './tone-audio';
import {verifyHeadphones, type RoutedAudioContext} from './headphones';
import {analyzePattern, summarizePlayback, type PatternAnalysis} from './pattern-analysis';
import {onAuthStateChanged, signOut, sendEmailVerification, type User} from 'firebase/auth';
import {echoAuth, reportRequest} from './firebase-client';
import {AuthPanel} from './auth-panel';
import {EchoLanding,EchoNavigation} from './landing';
import {LisaChat} from './lisa-chat';
type Report={id:string;date:string;name:string;age?:number;trials:Trial[];answers:string[];protocol?:string;status?:'complete'|'incomplete';noiseMonitored?:boolean;analysis?:PatternAnalysis};
function Space({game=false,pulse=0}:{game?:boolean;pulse?:number}){return <div className={'space '+(game?'game-space':'')}><div className="starfield"/>{Array.from({length:28},(_,i)=><i className="star" key={i} style={{left:`${(i*37+7)%100}%`,top:`${(i*19+3)%100}%`,animationDelay:`${i%5}s`}}/>)}<div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="planet"><span/><span/><span/></div><div className="little-planet"/><div className="moon"/><div className="ship" key={pulse}><svg viewBox="0 0 180 220" aria-label="Echo spacecraft"><defs><linearGradient id="hull" x2="1" y2="1"><stop stopColor="#fcf6ff"/><stop offset="1" stopColor="#9d88fa"/></linearGradient></defs><path d="M62 150 L45 202 L90 183 L135 202 L117 150" fill="#8972da"/><path d="M77 167 Q90 245 103 167" fill="#ff947a"/><path d="M83 174 Q90 221 97 174" fill="#fff3c0"/><path d="M90 15 Q148 77 122 165 Q90 186 58 165 Q33 77 90 15" fill="url(#hull)"/><path d="M90 15 Q107 36 113 55 L67 55 Q73 33 90 15" fill="#ff9a88"/><circle cx="90" cy="99" r="24" fill="#7461bb"/><circle cx="90" cy="99" r="17" fill="#bde9e1"/><path d="M81 88 Q91 80 102 94" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"/><path d="M60 125 L27 159 L24 184 L62 164 M120 125 L153 159 L156 184 L118 164" fill="#c8b9ff"/></svg></div>{pulse>0&&<div key={'p'+pulse} className="blast"/>}<div className="signal signal-one">✧</div><div className="signal signal-two">✦</div></div>}
function ResponseTable({report}:{report:Report}){
  if(isExpedition(report.protocol))return <DetectionChart trials={report.trials} protocol={report.protocol}/>;
  const summary=summarize(report.trials);
  if(!report.protocol) return <p>Earlier demo session: {summary.toneResponses} responses across {summary.toneTrials} trials.</p>;
  return <>
    <table className="echo-response-table">
      <thead><tr><th scope="col">Frequency</th><th scope="col">Left · A</th><th scope="col">Left · B</th><th scope="col">Right · A</th><th scope="col">Right · B</th></tr></thead>
      <tbody>{frequencies.map(freq=><tr key={freq}><th scope="row">{freq.toLocaleString()} Hz</th>{[0,1].flatMap(ear=>levels.map(level=>{
        const {responses,presented}=summary.cell(ear,freq,level);
        return <td key={ear+'-'+level}>{presented ? responses+'/'+presented : '—'}</td>;
      }))}</tr>)}</tbody>
    </table>
    <p className="muted">A and B are relative playback settings for this session. A dash means the trial was not completed.</p>
  </>;
}
function ModelAnalysis({report}:{report:Report}) {
  const analysis=report.analysis??analyzePattern(report);
  if(!isExpedition(report.protocol))return null;
  const playback=report.protocol===expeditionVersion?summarizePlayback(report):null;
  return <section className="model-analysis" aria-labelledby="model-analysis-heading">
    <div className="model-analysis-title"><Sparkles size={23}/><div><h3 id="model-analysis-heading">{report.protocol===expeditionVersion?'Hearing-check results':'ML curve analysis'}</h3><p>{report.protocol===expeditionVersion?'Relative playback on your device':'Experimental · trained on synthetic curves'}</p></div></div>
    {report.protocol===expeditionVersion&&(playback?<div className="model-ear-grid">{playback.map(ear=><article key={ear.ear}>
      <span>{ear.ear}</span><h4>{ear.label}</h4>
      <p>{ear.count} of {testFrequencies.length} frequencies detected{ear.typical!==null? ` · Median detected step: ${ear.typical}`:''}</p>
    </article>)}</div>:<p role="status">Complete the session with consistent responses to see your playback summary.</p>)}
    {report.protocol===expeditionVersion&&<h4>Experimental ML curve pattern</h4>}
    {analysis.status==='available'?<div className="model-ear-grid">{analysis.ears.map(ear=><article key={ear.ear}>
      <span>{ear.ear==='left'?'Left channel':'Right channel'}</span>
      <h4>{ear.label}</h4>
    </article>)}</div>:<p className="analysis-status" role="status">{analysis.reason}</p>}
    <p>The model describes the shape of the relative response curve. Hearing-loss severity needs validated hearing-level measurements. Determining conductive, sensorineural, or mixed loss also needs an appropriate clinical assessment.</p>
    <details><summary>Model and measurement details</summary><p>Random Forest · {analysis.modelVersion}. Training and testing used synthetic profiles. Performance on patient data has not been established. The model receives six relative detection points per channel; it does not classify from the image pixels or use questionnaire answers.</p><p>Noise monitoring supports trial quality checks. It does not calibrate headphone output, and noise features have not been validated for hearing-loss classification.</p><a href="https://www.asha.org/policy/GL2005-00014/" target="_blank" rel="noreferrer">Audiometry measurement guidance ↗</a></details>
  </section>;
}
export default function Echo(){
const [user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false),[historyLoading,setHistoryLoading]=useState(false),[historyError,setHistoryError]=useState('');
const owner=useRef<string|null>(null);
const authDestination=useRef<'details'|'dashboard'|'result'>('dashboard');
const [saving,setSaving]=useState(false);
const [verificationNote,setVerificationNote]=useState('');
const [view,setView]=useState('home'),[name,setName]=useState(''),[age,setAge]=useState(''),[quiz,setQuiz]=useState(0),[answers,setAnswers]=useState<string[]>([]),[reports,setReports]=useState<Report[]>([]),[report,setReport]=useState<Report|null>(null),[lisa,setLisa]=useState(false),[saveStatus,setSaveStatus]=useState(''),[round,setRound]=useState(0),[running,setRunning]=useState(false);
const [channel,setChannel]=useState(0),[sideChoice,setSideChoice]=useState<number|null>(null),[practice,setPractice]=useState(0),[phase,setPhase]=useState('room'),[prepNote,setPrepNote]=useState(''),[recheck,setRecheck]=useState(false);
const audio=useRef<AudioContext|null>(null),toneSource=useRef<AudioBufferSourceNode|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
const schedule=useRef<ReturnType<typeof expeditionOrder>>([]),pending=useRef<TrialCondition|null>(null),trialsRef=useRef<Trial[]>([]),roundRef=useRef(0),runRef=useRef(false),trialStart=useRef(0),response=useRef<number|null>(null), shotTaken=useRef(false), practiceFirstEar=useRef<Lane>(0),playbackRequest=useRef(0);
const [lane,setLane]=useState<Lane>(0),[shot,setShot]=useState<Shot|null>(null);
const aimedLane=useRef<Lane>(0), shotId=useRef(0);
function steer(next:Lane){
  if(!runRef.current)return;
  aimedLane.current=next;
  setLane(next);
}
const [noiseState,setNoiseState]=useState<'idle'|'checking'|'on'>('idle');
const monitor=useRef<RoomMonitor|null>(null),baseline=useRef<number|null>(null);
const output=useRef<string|null>(null);
const ambient=useRef<number|null>(null), nextCatch=useRef(0);
function releaseMic(){
  monitor.current?.stop();
  monitor.current=null;
  baseline.current=null;
}
async function checkRoom(){
  const request=++playbackRequest.current;
  releaseMic();
  setNoiseState('checking');
  try{
    setPrepNote('');
    const ctx=await readyAudio();
    const live=await RoomMonitor.start(ctx);
    if(request!==playbackRequest.current){live.stop();return;}
    monitor.current=live;
    const values:number[]=[];
    for(let i=0;i<12;i++){
      await new Promise(resolve=>setTimeout(resolve,150));
      if(request!==playbackRequest.current){live.stop();return;}
      if(live.active)values.push(live.level());
    }
    if(values.length<6)throw new Error('Microphone unavailable');
    values.sort((a,b)=>a-b);
    const median=values[Math.floor(values.length/2)];
    if(roomTooLoud(median) || values[values.length-1]-median>12){
      releaseMic();
      setNoiseState('idle');
      setPrepNote('The microphone picked up loud or changing room noise. Move somewhere quieter and try again.');
      return;
    }
    baseline.current=median;
    setNoiseState('on');
    setPhase('output');
    setPrepNote('Room check passed. Connect your headphones and verify the output.');
  }catch{
    if(request!==playbackRequest.current)return;
    releaseMic();
    setNoiseState('idle');
    setPrepNote('Allow microphone access in your browser and retry. The room check is required.');
  }
}
useEffect(()=>onAuthStateChanged(echoAuth(),next=>{
  const previous=owner.current;
  owner.current=next?.uid??null;
  setUser(next);setAuthReady(true);setReports([]);setHistoryError('');setVerificationNote('');
  if(previous&&previous!==next?.uid){setReport(null);setName('');setAnswers([]);setAge('');setView('home');stopTrial();releaseMic();}
  if(next?.displayName)setName(current=>current||next.displayName!.split(' ')[0]);
},()=>{setAuthReady(true);setHistoryError('Account access is unavailable. Please reload.')}),[]);
async function loadReports(current:User){
  setHistoryLoading(true);setHistoryError('');
  try{
    const res=await reportRequest(current);
    const data=await res.json() as Report[];
    if(owner.current===current.uid)setReports(data);
  }catch{if(owner.current===current.uid)setHistoryError('Could not load saved reports. Please retry.');}
  finally{if(owner.current===current.uid)setHistoryLoading(false);}
}
useEffect(()=>{if(user)void loadReports(user);else setHistoryLoading(false)},[user?.uid]);
async function logout(){
  try{await signOut(echoAuth());setView('home');}catch{setHistoryError('Could not sign out. Please try again.');}
}
async function verifyEmail(){
  if(!user)return;
  try{await sendEmailVerification(user);setVerificationNote('Verification email sent. Check your inbox.');}
  catch{setVerificationNote('Could not send right now. Wait a little and retry.');}
}
async function saveReport(value:Report,current:User){
  if(saving)return;
  setSaving(true);setSaveStatus('Saving your report…');
  try{
    const res=await reportRequest(current,{method:'POST',body:JSON.stringify(value)});
    const saved=await res.json() as Report;
    if(owner.current!==current.uid)return;
    setReport(saved);setReports(previous=>[saved,...previous.filter(r=>r.id!==saved.id)]);
    setSaveStatus('Saved privately to your Firebase dashboard');
  }catch{if(owner.current===current.uid)setSaveStatus('Report could not be saved. Retry below or download a copy.');}
  finally{setSaving(false);}
}

useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);releaseMic();audio.current?.close()},[]);
function go(destination:string){
  if((view==='game'||recheck)&&destination!=='game'&&destination!=='result'){void finish('incomplete');return;}
  if(view==='prep'&&destination!=='game'){stopTrial();releaseMic();setNoiseState('idle');}
  if(!user&&['details','quiz','prep','game'].includes(destination)){
    authDestination.current='details';
    destination=authReady?'auth':'checking-account';
  }
  setView(destination);
  window.scrollTo({top:0,behavior:'smooth'});
}
useEffect(()=>{
  if(view==='checking-account'&&authReady)setView(user?'details':'auth');
},[view,authReady,user]);
function openAccount(destination:'dashboard'|'result'){
  authDestination.current=destination;
  go('auth');
}
function completeAuth(current:User){
  if(echoAuth().currentUser?.uid!==current.uid)return;
  setUser(current);
  if(current.displayName)setName(name=>name||current.displayName!.split(' ')[0]);
  const destination=authDestination.current;
  if(destination==='result')setSaveStatus('Signed in. Save this report to your account below.');
  setView(destination);
  window.scrollTo({top:0,behavior:'smooth'});
}
async function readyAudio(){
  const C=window.AudioContext || (window as Window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!C) throw new Error('Browser audio is unavailable.');
  if(!audio.current){
    const ctx=new C();
    audio.current=ctx;
    ctx.addEventListener('sinkchange',()=>{if(runRef.current)interrupt('Audio output changed. Recheck your headphones and room before resuming.');});
    ctx.addEventListener('statechange',()=>{if(ctx.state!=='running'&&runRef.current) interrupt();});
  }
  const ctx=audio.current;
  await ctx.resume();
  if(ctx.state!=='running') throw new Error('Audio is unavailable.');
  return ctx;
}
function stopTone(){
  try { toneSource.current?.stop(); } catch {}
  toneSource.current=null;
}
function tone(ctx:AudioContext,freq:number,ear:0|1,level:number,setup=false){
  if(ctx.state!=='running')throw new Error('Audio playback is suspended.');
  stopTone();
  const source=ctx.createBufferSource();
  source.buffer=createToneBuffer(ctx,freq,ear,level,setup);
  source.connect(ctx.destination);
  source.onended=()=>{
    source.disconnect();
    if(toneSource.current===source)toneSource.current=null;
  };
  source.start();
  toneSource.current=source;
}
function fire(){
  const condition=pending.current;
  const elapsed=Math.round(performance.now()-trialStart.current);
  const lane=aimedLane.current;
  const eligible=condition&&!shotTaken.current&&elapsed>=0&&elapsed<=responseWindowMs;
  const hit=!!eligible&&condition.kind==='tone'&&lane===condition.ear;
  if(runRef.current&&(!condition||!shotTaken.current))setShot({id:++shotId.current,lane,hit});
  if(!eligible)return;
  shotTaken.current=true;
  if(hit||condition.kind==='silent')response.current=elapsed;

}
useEffect(()=>{
  function key(e:KeyboardEvent){
    if(view!=='game'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
    const target=e.target instanceof HTMLElement?e.target:null;
    if(target?.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(e.code==='ArrowLeft'||e.code==='KeyA'||e.code==='ArrowRight'||e.code==='KeyD'){
      e.preventDefault();
      steer(e.code==='ArrowLeft'||e.code==='KeyA'?0:1);
    }
    if(e.code==='Space'&&(!target?.closest('button,a')||target.closest('.steer-button,.pulse-button'))){
      e.preventDefault();
      if(!e.repeat)fire();
    }
  }
  function visibility(){if(document.hidden&&runRef.current) interrupt();}
  function deviceChange(){
    if(runRef.current)interrupt('Audio devices changed. Recheck your headphones and room before resuming.');
    else if(view==='prep'&&output.current!==null){stopTrial();resetPrep();}
  }
  window.addEventListener('keydown',key);
  document.addEventListener('visibilitychange',visibility);
  navigator.mediaDevices?.addEventListener('devicechange',deviceChange);
  return()=>{
    window.removeEventListener('keydown',key);
    document.removeEventListener('visibilitychange',visibility);
    navigator.mediaDevices?.removeEventListener('devicechange',deviceChange);
  };
},[view]);
function resetPrep(){
  setChannel(Math.random()<.5?0:1);
  setSideChoice(null);
  practiceFirstEar.current=Math.random()<.5?0:1;
  setPractice(0);
  output.current=null;
  releaseMic();
  setNoiseState('idle');
  setPhase('room');
  setPrepNote('');
}
async function checkHeadphones(pick:boolean){
  const request=++playbackRequest.current;
  setPrepNote('Checking your audio output…');
  try{
    const ctx=audio.current as RoutedAudioContext;
    const id=await verifyHeadphones(ctx,pick);
    if(request!==playbackRequest.current)return;
    output.current=id;
    setPhase('channel');
    setPrepNote('Headphones detected. Check the left and right channels.');
  }catch(error){
    if(request===playbackRequest.current)setPrepNote(error instanceof Error?error.message:'Could not verify headphones.');
  }
}
async function sample(){
  const request=++playbackRequest.current;
  setSideChoice(null);
  try{
    const ctx=await readyAudio();
    if(request!==playbackRequest.current)return;
    tone(ctx,1000,channel===0?0:1,95,true);
    setSideChoice(channel);
    setPrepNote('Choose the side where you heard the tone. You can replay it if needed.');
  }catch{setPrepNote('Audio could not start. Check your browser and headphones, then retry.');}
}
function identify(side:number){
  if(sideChoice===null)return;
  setSideChoice(null);
  if(side!==sideChoice){resetPrep();setPrepNote('The channel did not match. Check the headphone orientation and turn off mono audio, then retry.');return;}
  if(phase==='channel'){setChannel(1-channel);setPhase('secondChannel');return;}
  setPhase(recheck?'ready':'instructions');
}
async function practise(){
  const request=++playbackRequest.current;
  try{
    const ctx=await readyAudio();
    if(request!==playbackRequest.current)return;
    setPrepNote('');
    setPhase('practising');
    timer.current=setTimeout(()=>{
      const ear=practice===1?(practiceFirstEar.current===0?1:0):practiceFirstEar.current;
      const silent=practice===2;
      pending.current={ear,freq:silent?0:1000,level:silent?0:70,kind:silent?'silent':'tone'};
      response.current=null;
      shotTaken.current=false;
      trialStart.current=performance.now();
      try{
        if(!silent)tone(ctx,1000,ear,95,true);
        else if(ctx.state!=='running')throw new Error('Audio playback is suspended.');
      }catch{
        pending.current=null;
        setPhase('practice');
        setPrepNote('Audio playback was interrupted. Press Start practice to try again.');
        return;
      }
      timer.current=setTimeout(()=>{
        const pressed=response.current!==null;
        pending.current=null;
        const correct=pressed!==silent;
        setPrepNote(correct?'Correct.':silent?'Try again. Wait when there is no tone.':'Try again. Shoot the side where you hear the tone.');
        if(correct&&silent)setPhase('ready');
        else {if(correct)setPractice(practice+1);setPhase('practice');}
      },responseWindowMs);
    },700+Math.random()*600);
  }catch{setPrepNote('Audio could not start. Check your headphones and retry.');}
}
function stopTrial(){
  playbackRequest.current++;
  runRef.current=false;
  setShot(null);
  pending.current=null;
  if(timer.current)clearTimeout(timer.current);
  stopTone();
  setRunning(false);
}
function interrupt(reason='The current trial was discarded. Confirm the same headphones and volume, then redo the channel check.') {
  if(!runRef.current)return;
  if(pending.current){
    trialsRef.current.push({...pending.current,heard:response.current!==null,responseMs:response.current,interrupted:true});
  }
  stopTrial();
  setRecheck(true);
  resetPrep();
  setPrepNote(reason);
  setView('prep');
}
async function launch(){
  if(!user||echoAuth().currentUser?.uid!==user.uid)return;
  const request=++playbackRequest.current;
  try{
    const ctx=await readyAudio();
    if(request!==playbackRequest.current)return;
    if(output.current===null || !monitor.current?.active || baseline.current===null){
      resetPrep();
      setPrepNote('Verify your headphones and room again before starting.');
      return;
    }
    try{
      if(await verifyHeadphones(ctx)!==output.current)throw new Error('Output changed');
    }catch{
      if(request!==playbackRequest.current)return;
      resetPrep();
      setPrepNote('Reconnect and verify your headphones before starting.');
      return;
    }
    if(request!==playbackRequest.current)return;
    if(!recheck){
      schedule.current=expeditionOrder();
      nextCatch.current=5+Math.floor(Math.random()*6);
      trialsRef.current=[];
      roundRef.current=0;
      setRound(0);
      aimedLane.current=0;
      setLane(0);
    }
    setRecheck(false);
    setRunning(true);
    runRef.current=true;
    go('game');
    nextTrial(ctx);
  }catch{setPrepNote('Audio could not start. Check your headphones and retry.');}
}
function nextTrial(ctx:AudioContext){
  if(!runRef.current)return;
  const target=schedule.current[roundRef.current];
  if(!target){void finish('complete');return;}
  const attempts=trialsRef.current.filter(t=>t.kind==='tone'&&!t.interrupted&&
    t.ear===target.ear&&t.freq===target.freq&&t.level===target.level);
  if(detection(trialsRef.current,target.ear,target.freq).status!=='pending'||stepResult(attempts)!==null){
    roundRef.current++;
    nextTrial(ctx);
    return;
  }
  setRound(testFrequencies.indexOf(target.freq));
  const validCount=trialsRef.current.filter(t=>t.kind==='tone'&&!t.interrupted).length;
  const silent=validCount>=nextCatch.current;
  const condition:TrialCondition=silent?{ear:target.ear,freq:0,level:0,kind:'silent'}:target;
  timer.current=setTimeout(()=>{
    if(!runRef.current)return;
    if(document.hidden||ctx.state!=='running'){interrupt();return;}
    const live=monitor.current;
    if(!live?.active){
      releaseMic();
      setNoiseState('idle');
      interrupt('The microphone disconnected. Check the room again before resuming.');
      return;
    }
    ambient.current=live?.level()??null;
    if(ambient.current!==null&&baseline.current!==null&&roomTooLoud(ambient.current,baseline.current)){
      interrupt('The room got louder. Wait for quiet, then recheck your headphones and resume.');
      return;
    }
    pending.current=condition;
    response.current=null;
    shotTaken.current=false;
    trialStart.current=performance.now();
    try{
      if(condition.kind==='tone')tone(ctx,condition.freq,condition.ear,condition.level);
    }catch{
      interrupt('Audio playback was interrupted. Recheck your headphones and room before resuming.');
      return;
    }
    timer.current=setTimeout(()=>{
      if(!runRef.current)return;
      if(!live.active || (baseline.current!==null&&roomTooLoud(live.level(),baseline.current))){
        interrupt('The microphone disconnected or the room got louder. Recheck before resuming.');
        return;
      }
      pending.current=null;
      const trial={...condition,heard:response.current!==null,responseMs:response.current,noiseDbfs:ambient.current};
      trialsRef.current.push(trial);
      if(silent){
        nextCatch.current=validCount+5+Math.floor(Math.random()*6);
      }else if(stepResult([...attempts,trial])===null){
        // Let the other ear take a turn at this step before the retry, if it still has work.
        const index=roundRef.current;
        const other=schedule.current[index+1];
        if(other?.freq===target.freq&&other.level===target.level){
          schedule.current[index]=other;
          schedule.current[index+1]=target;
        }
      }
      nextTrial(ctx);
    },responseWindowMs);
  },700+Math.random()*900);
}
async function finish(status:'complete'|'incomplete'){
  stopTrial();
  setRecheck(false);
  releaseMic();
  setNoiseState('idle');
  const r:Report={
    id:globalThis.crypto?.randomUUID?.()||`echo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date:new Date().toISOString(),name:name.trim().slice(0,60)||'Explorer',age:Number(age),trials:[...trialsRef.current],answers,
    protocol:expeditionVersion,status,
    noiseMonitored:trialsRef.current.some(t=>typeof t.noiseDbfs==='number'),
  };
  r.analysis=analyzePattern(r);
  setReport(r);
  go('result');
  if(!user){setSaveStatus('Sign in to save this report, or download a copy.');return;}
  await saveReport(r,user);
}
const qs=[{q:'How does your hearing feel lately?',options:['No noticeable difficulty','Sometimes I miss words','I often ask people to repeat']},{q:'How much time do you spend with headphones?',options:['Less than an hour a day','1–3 hours a day','More than 3 hours a day']},{q:'Have you noticed any of these?',options:['None of these','Ringing or buzzing','Ear pain or a sudden hearing change']}];
const summary=report?summarize(report.trials):null;
return <div className="echo-sweet-site"><EchoNavigation home={()=>go('home')} start={()=>go('details')} dashboard={()=>go('dashboard')} chat={()=>setLisa(true)} login={()=>openAccount('dashboard')} logout={()=>void logout()} signedIn={!!user} ready={authReady}/>
{view==='home'?<EchoLanding start={()=>go('details')} chat={()=>setLisa(true)} dashboard={()=>go('dashboard')}/>:<main className="app-main"><button className="back" onClick={()=>{if(view==='game'||recheck){void finish('incomplete');return;}stopTrial();go('home')}}><ChevronLeft size={16}/> Back to Echo</button>
{view==='checking-account'&&<p className="flow-card" role="status">Checking your account…</p>}
{view==='auth'&&<AuthPanel key={authDestination.current} forTest={authDestination.current==='details'} onDone={completeAuth}/>}
{view==='details'&&<div className="flow-card"><div className="eyebrow">YOUR SOUND JOURNEY / 01</div><h2>First, a little<br/><em>about you.</em></h2><p>Let’s make this adventure yours.</p><form onSubmit={e=>{e.preventDefault();setQuiz(0);setAnswers([]);go('quiz')}}><label>What should we call you?<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Your first name"/></label><label>Age<input required type="number" min="18" max="120" value={age} onChange={e=>setAge(e.target.value)} placeholder="18+ for this showcase"/></label><div className="demo-note"><ShieldCheck size={20}/><span>This browser pilot records tone responses on your setup. Completed reports save to your account.</span></div><button className="primary">Let’s get to know your ears <ArrowRight size={18}/></button></form></div>}
{view==='quiz'&&<div className="flow-card"><div className="progress"><i style={{width:`${(quiz+1)/3*100}%`}}/></div><div className="eyebrow">A QUICK CHECK-IN / {quiz+1} OF 3</div><h2>{qs[quiz].q}</h2><div className="options">{qs[quiz].options.map((o,i)=><button key={o} onClick={()=>{const a=[...answers,o];setAnswers(a);if(quiz===2){setRecheck(false);resetPrep();go('prep')}else setQuiz(q=>q+1)}}><span>0{i+1}</span>{o}<ArrowUpRight size={18}/></button>)}</div><p className="muted">Your answers provide context. They don’t determine your game results.</p></div>}
    {view==='prep'&&<div className="flow-card">
      <div className="eyebrow">READY FOR LIFTOFF</div><div className="prep-headphones"><Headphones size={68}/></div>
      <h2>{recheck?'Check your setup again.':'Headphones on.'}</h2>
      <p>Use stereo headphones in a quiet space. Set a comfortable volume and keep it steady throughout the session.</p>
      {answers[2]==='Ear pain or a sudden hearing change'&&<div className="notice">If this describes a current symptom, seek professional assessment.</div>}
      <p className="prep-status" role="status">{prepNote}</p>
      {(phase==='channel'||phase==='secondChannel')&&<>
        <h3>{phase==='channel'?'Channel check 1 of 2':'Channel check 2 of 2'}</h3>
        <button className="secondary" onClick={sample}><Volume2 size={18}/> Play sample</button>
        <div className="channel-buttons"><button disabled={sideChoice===null} onClick={()=>identify(0)}>I heard it on the left</button><button disabled={sideChoice===null} onClick={()=>identify(1)}>I heard it on the right</button></div>
      </>}
      {phase==='instructions'&&<div className="options">
        <h3>When should you fire?</h3>
        <button onClick={()=>{setPrepNote('Watch the ships for fun. Wait for the tone before firing.');}}>Whenever an enemy appears</button>
        <button onClick={()=>{setPrepNote('Correct. Shoot the enemy on the side where you hear the tone.');setPhase('practice');}}>When I hear a tone in either ear</button>
        <button onClick={()=>{setPrepNote('A tone in either ear counts.');}}>Only when I hear a tone in both ears</button>
      </div>}
      {(phase==='practice'||phase==='practising')&&<>
        <h3>Practice {practice+1} of 3</h3>
        <p>Shoot the side where you hear the tone. Wait if you hear nothing.</p>
        {phase==='practice'?<button className="primary" onClick={practise}>Start practice <Play size={16}/></button>:<div className="channel-buttons"><button onClick={()=>{aimedLane.current=0;fire();}}>Shoot left</button><button onClick={()=>{aimedLane.current=1;fire();}}>Shoot right</button></div>}
      </>}
      {phase==='room'&&<>
        <h3>Room noise check</h3>
        <p>Allow microphone access for the room check. Microphone audio stays on your device.</p>
        <button className="secondary" disabled={noiseState==='checking'} onClick={checkRoom}>{noiseState==='checking'?'Checking your room…':'Check room noise'}</button>
      </>}
      {phase==='output'&&<>
        <h3>Verify your headphone output</h3>
        <p>Set your headphones as the system output. If your browser offers an output picker, you can select them here.</p>
        <div className="channel-buttons"><button onClick={()=>void checkHeadphones(false)}>Verify current output</button><button onClick={()=>void checkHeadphones(true)}>Choose headphones</button></div>
      </>}
      {phase==='ready'&&<button className="primary" onClick={launch}>{recheck?'Resume screening':'Launch Echo Expedition'} <ArrowUpRight size={18}/></button>}
      {recheck&&<div className="channel-buttons"><button onClick={()=>{releaseMic();setNoiseState('idle');setRecheck(false);resetPrep();}}>My headphones or volume changed · Restart</button><button onClick={()=>void finish('incomplete')}>End session</button></div>}
    </div>}
    {view==='game'&&<div className="game-shell expedition-shell"><Arena shot={shot} lane={lane} steer={steer} paused={!running}/>
      <div className="game-top"><span>✦ ECHO EXPEDITION</span><button onClick={()=>interrupt()}><Pause size={17}/> Pause</button><button onClick={()=>void finish('incomplete')}>End session</button></div>
      <div className="game-info"><span>ROOM MONITOR ON</span><h2>Listen for your signal.</h2><p>Shoot the side where you hear the tone. Wait if you hear nothing.</p></div>
      <div className="game-bottom"><div><span>Level {round+1} <small>/ {testFrequencies.length} · {testFrequencies[round].toLocaleString()} Hz</small></span><div className="progress"><i style={{width:`${round/testFrequencies.length*100}%`}}/></div></div><div className="flight-controls">
        <button className="steer-button" aria-label="Steer left" aria-pressed={lane===0} onClick={()=>steer(0)}>←</button>
        <button className="pulse-button" disabled={!running} onClick={fire}>Fire <Orbit size={21}/></button>
        <button className="steer-button" aria-label="Steer right" aria-pressed={lane===1} onClick={()=>steer(1)}>→</button>
      </div><p><kbd>←</kbd> <kbd>→</kbd> or tap a lane to steer. <kbd>Space</kbd> or Fire to shoot that side.</p></div>
    </div>}
    {view==='result'&&report&&summary&&<>
      <div className="result-heading"><div><div className="eyebrow">ECHO EXPEDITION / {report.status==='incomplete'?'INCOMPLETE':'SESSION REPORT'}</div><h2>Your responses, <em>{report.name}.</em></h2><p>{new Date(report.date).toLocaleDateString()}</p></div><button className="secondary" onClick={()=>window.print()}><Download size={17}/> Download / print report</button></div>
      <div className="report-layout"><div className="chart-card"><div className="card-top"><h3>Responses by ear and frequency</h3><span className="badge">{report.protocol?'BROWSER PILOT':'EARLIER DEMO'}</span></div><ResponseTable report={report}/></div>
      <div className="summary-card"><h3>Session quality</h3><p>{summary.toneResponses} responses across {summary.toneTrials} completed tone trials.</p>
        {report.protocol&&<><p>Responses during silence: {summary.silentResponses} / {summary.silentTrials}.</p>{summary.silentResponses>0&&<p>Some shots were recorded during silence. Repeat the session if you were unsure when to fire.</p>}{report.protocol!==expeditionVersion&&summary.inconsistent&&<p>Responses differed across repeated presentations.</p>}{summary.interruptions>0&&<p>{summary.interruptions} interrupted {summary.interruptions===1?'trial was':'trials were'} discarded.</p>}</>}
        {isExpedition(report.protocol)&&<p>Room noise monitoring {report.noiseMonitored?'recorded relative samples':'was off or unavailable'}.</p>}
        {report.status==='incomplete'&&<p>This session ended before all trials were completed.</p>}
        <div className="notice">This report describes responses on the headphones and device used in this session. Relative playback steps cannot be interpreted as clinical hearing levels.</div>
      </div></div>
      <ModelAnalysis report={report}/>
      <div className="tips-grid"><article><LayoutDashboard/><h3>Saved history</h3><p role="status">{saveStatus}</p>{!reports.some(r=>r.id===report.id)&&(user?<button className="text-button" disabled={saving} onClick={()=>void saveReport(report,user)}>{saving?'Saving…':'Save to my account'} <ArrowRight size={16}/></button>:<button className="text-button" onClick={()=>openAccount('result')}>Sign in to save <ArrowRight size={16}/></button>)}<button className="text-button" onClick={()=>go('dashboard')}>View dashboard <ArrowRight size={16}/></button></article></div>
    </>}
{view==='dashboard'&&<><div className="result-heading"><div><div className="eyebrow">YOUR PERSONAL SOUND SPACE</div><h2>Hello, <em>{name||'explorer'}.</em></h2><p>A home for your sound stories and your next little adventure.</p></div><button className="primary" onClick={()=>go('details')}>New sound journey <ArrowUpRight size={18}/></button></div>{!user?<div className="empty"><div className="lisa-face">••<i/></div><h3>Make yourself at home.</h3><p>Sign in to save your reports privately in Firebase and return to them across devices.</p><button className="primary" disabled={!authReady} onClick={()=>openAccount('dashboard')}>Sign in to Echo <ArrowUpRight size={18}/></button></div>:<><div className="dashboard-stats"><article><span>YOUR JOURNEYS</span><strong>{reports.length.toString().padStart(2,'0')}</strong></article><article><span>YOUR NEXT STEP</span><h3>A moment for your ears.</h3><p>Every journey is a chance to check in.</p></article><article className="lavender"><span>YOUR COMPANION</span><h3>Lisa’s here for you.</h3><button className="text-button" onClick={()=>setLisa(true)}>Ask a question <ArrowUpRight size={16}/></button></article></div><div className="account-note"><ShieldCheck size={20}/><div><strong>{user.email}</strong><p>{user.emailVerified?'Email verified · Private Firebase history':'Verify your email to help protect access to your account.'}</p>{!user.emailVerified&&<button className="text-button" onClick={()=>void verifyEmail()}>Send verification email</button>}{verificationNote&&<p role="status">{verificationNote}</p>}</div></div><h3 className="history-title">Your saved journeys</h3>{historyLoading?<p role="status">Loading your saved journeys…</p>:historyError?<div role="alert"><p>{historyError}</p><button className="text-button" onClick={()=>void loadReports(user)}>Retry loading reports</button></div>:reports.length?reports.map(r=><button className="report-row" key={r.id} onClick={()=>{setReport(r);setSaveStatus('Saved to your dashboard');go('result')}}><span className="report-icon"><AudioLines/></span><div><strong>Echo Expedition</strong><p>{new Date(r.date).toLocaleDateString()} · {r.status==='incomplete'?'Incomplete session':r.protocol?'Browser pilot':'Earlier demo'}</p></div><span>Open report <ArrowUpRight size={18}/></span></button>):<div className="empty"><Orbit size={40}/><h3>Your first discovery is waiting.</h3><p>Complete an expedition and your report will appear here.</p><button className="primary" onClick={()=>go('details')}>Start your first journey <ArrowRight size={18}/></button></div>}</>}</>}
</main>}
<footer><button className="brand" onClick={()=>go('home')}><AudioLines size={26}/>echo<span>✳</span></button><p>A little play. A closer look at your hearing.</p><span>ADHARSHINI K · BROWSER SCREENING PILOT</span></footer><button className="lisa-launch" onClick={()=>setLisa(!lisa)} aria-label="Open Lisa companion"><span>••</span>{!lisa&&<b>Ask Lisa</b>}{lisa&&<X size={18}/>}</button><LisaChat open={lisa} onClose={()=>setLisa(false)} accountKey={user?.uid??null} reportContext={report&&summary?JSON.stringify({status:report.status,protocol:report.protocol,toneResponses:summary.toneResponses,toneTrials:summary.toneTrials,silentResponses:summary.silentResponses,silentTrials:summary.silentTrials,noiseMonitored:report.noiseMonitored,curvePattern:(report.analysis??analyzePattern(report)).ears}):''}/></div>}
