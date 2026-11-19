// Live integration check with disposable synthetic accounts and screening data.
// Run after bundling app/api/reports/route.ts to the module passed as argv[2].
// Credentials stay in process memory and are never printed or written to disk.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const originalFetch=globalThis.fetch;
globalThis.fetch=(input,init={})=>originalFetch(input,{...init,signal:init.signal??AbortSignal.timeout(15000)});
const route=await import(pathToFileURL(process.argv[2]).href);
const config=await readFile('app/firebase-config.ts','utf8');
const apiKey=config.match(/apiKey: '([^']+)'/)[1];
const project=config.match(/projectId: '([^']+)'/)[1];
const accounts=[];const documents=[];let checks=0;
async function authCall(action,body){
  const res=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok)throw new Error(`Firebase Auth ${action} returned ${res.status}`);
  return res.json();
}
async function user(){
  const email=`echo-qa-${randomUUID()}@example.invalid`;
  const password=`QA-${randomUUID()}-Aa1!`;
  const account=await authCall('signUp',{email,password,returnSecureToken:true});
  accounts.push(account);
  const signedIn=await authCall('signInWithPassword',{email,password,returnSecureToken:true});
  assert.equal(signedIn.localId,account.localId);checks++;
  return signedIn;
}
function request(account,body){return new Request('https://echo.test/api/reports',{method:body?'POST':'GET',headers:account?{Authorization:`Bearer ${account.idToken}`}:{},...(body?{body:JSON.stringify(body)}:{})});}
function url(uid,id=''){return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}/reports${id?`/${id}`:''}`;}
async function direct(account,target,init={}){return fetch(target,{...init,headers:{'Content-Type':'application/json',...(account?{Authorization:`Bearer ${account.idToken}`}:{})}});}
async function status(response,expected){assert.equal(response.status,expected);checks++;return response;}
try{
  const alice=await user(),bob=await user();
  await status(await route.GET(request(null)),401);
  const report={id:`qa-${randomUUID()}`,date:new Date().toISOString(),name:'Synthetic QA',age:25,answers:['Test only'],protocol:'echo-expedition-v2',status:'incomplete',noiseMonitored:false,trials:[]};
  const saved=await status(await route.POST(request(alice,report)),200);
  const savedBody=await saved.json();
  assert.equal(savedBody.analysis.status,'unavailable');checks++;
  documents.push({account:alice,id:report.id});
  const history=await status(await route.GET(request(alice)),200);
  assert.equal((await history.json()).some(r=>r.id===report.id),true);checks++;
  await status(await route.POST(request(alice,report)),200);
  const other=await route.GET(request(bob));
  assert.deepEqual(await other.json(),[]);checks++;
  await status(await direct(null,url(alice.localId,report.id)),403);
  await status(await direct(null,url(alice.localId)),403);
  await status(await direct(bob,url(alice.localId,report.id)),403);
  await status(await direct(bob,url(alice.localId)),403);
  await status(await direct(bob,url(alice.localId,report.id),{method:'DELETE'}),403);
  const original=await (await direct(alice,url(alice.localId,report.id))).json();
  await status(await direct(alice,url(alice.localId,report.id),{method:'PATCH',body:JSON.stringify(original)}),403);
  const invalid={fields:{...original.fields,ownerId:{stringValue:bob.localId}}};
  await status(await direct(alice,`${url(alice.localId)}?documentId=qa-invalid-owner`,{method:'POST',body:JSON.stringify(invalid)}),403);
  const badId='qa-invalid-shape';
  const extra={fields:{...original.fields,reportId:{stringValue:badId},admin:{booleanValue:true}}};
  await status(await direct(alice,`${url(alice.localId)}?documentId=${badId}`,{method:'POST',body:JSON.stringify(extra)}),403);
  await status(await route.POST(request(alice,{...report,id:'../escape'})),400);
  await status(await route.POST(request(alice,{...report,id:'qa-bad',status:'complete'})),400);
  console.log(`PASS: ${checks} Firebase integration checks (sign-up/login, report persistence/retry, model analysis, private history, denied public/cross-account access, immutable reports, invalid schema).`);
}finally{
  for(const {account,id} of documents)await status(await direct(account,url(account.localId,id),{method:'DELETE'}),200);
  for(const account of accounts)await authCall('delete',{idToken:account.idToken});
  console.log('Disposable QA accounts and reports removed.');
}
