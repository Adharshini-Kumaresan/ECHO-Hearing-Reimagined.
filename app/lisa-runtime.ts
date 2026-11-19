export type LisaPrompt={role:'system'|'user'|'assistant';content:string}[];
export type LisaEngine={generate:(messages:LisaPrompt,delta:(text:string)=>void)=>Promise<void>;interrupt:()=>void};
export async function loadLisa(progress:(value:number,text:string)=>void,registerWorker:(worker:Worker)=>void):Promise<{engine:LisaEngine;mode:string}>{
  const gpu=(navigator as Navigator & {gpu?:{requestAdapter:()=>Promise<{features:ReadonlySet<string>}|null>}}).gpu;
  let adapter:null|{features:ReadonlySet<string>}=null;
  try{adapter=await gpu?.requestAdapter()??null;}catch{/* Use CPU if GPU discovery fails. */}
  if(adapter){
    const {CreateWebWorkerMLCEngine}=await import('@mlc-ai/web-llm');
    const worker=new Worker('/ai/lisa-gpu.js',{type:'module'});registerWorker(worker);
    try{
      const model=adapter.features.has('shader-f16')?'Qwen3-0.6B-q4f16_1-MLC':'Qwen3-0.6B-q4f32_1-MLC';
      const loaded=await CreateWebWorkerMLCEngine(worker,model,{initProgressCallback:info=>progress(info.progress,info.text)},{context_window_size:4096});
      return {mode:'GPU · Qwen3 0.6B',engine:{interrupt:()=>loaded.interruptGenerate(),generate:async(messages,delta)=>{
        const chunks=await loaded.chat.completions.create({messages,stream:true,max_tokens:220,temperature:.3,extra_body:{enable_thinking:false}});
        for await(const chunk of chunks)delta(chunk.choices[0]?.delta.content??'');
      }}};
    }catch{worker.terminate();progress(0,'GPU loading failed. Trying CPU mode…');}
  }
  const worker=new Worker('/ai/lisa-cpu.js',{type:'module'});registerWorker(worker);
  let nextId=0;
  const pending=new Map<number,{resolve:()=>void;reject:(error:Error)=>void;delta?:(text:string)=>void}>();
  worker.onerror=()=>{for(const task of pending.values())task.reject(new Error('Local AI worker stopped'));pending.clear();};
  worker.onmessage=(event:MessageEvent<{type:string;id:number;value?:number;text?:string}>)=>{
    const message=event.data;
    if(message.type==='progress'){progress(message.value??0,message.text??'Preparing CPU model…');return;}
    const task=pending.get(message.id);if(!task)return;
    if(message.type==='delta')task.delta?.(message.text??'');
    else{pending.delete(message.id);if(message.type==='error')task.reject(new Error(message.text??'Local model failed'));else task.resolve();}
  };
  const request=(type:string,data:object={},delta?:(text:string)=>void)=>new Promise<void>((resolve,reject)=>{
    const id=++nextId;pending.set(id,{resolve,reject,delta});worker.postMessage({type,id,...data});
  });
  await request('load');
  return {mode:'CPU · Qwen2.5 0.5B',engine:{interrupt:()=>worker.postMessage({type:'stop'}),generate:(messages,delta)=>request('generate',{messages},delta)}};
}
