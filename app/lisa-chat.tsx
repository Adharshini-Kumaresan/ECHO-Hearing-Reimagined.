'use client';
import {lockPageScroll} from './page-scroll-lock';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight, X, Square, Download, RotateCcw, Cpu, ShieldCheck} from 'lucide-react';
import type {LisaEngine,LisaPrompt} from './lisa-runtime';
import {cleanLisaOutput,lisaSystemPrompt,retrieveLisaContext,screeningScopeNote} from './lisa-knowledge';
type Message={role:'user'|'assistant';content:string;kind?:'scope';sources?:{title:string;url:string}[]};
export function LisaChat({open,onClose,reportContext,accountKey}:{open:boolean;onClose:()=>void;reportContext:string;accountKey:string|null}){
  const [state,setState]=useState<'idle'|'loading'|'ready'|'error'>('idle'),[progress,setProgress]=useState(0),[status,setStatus]=useState(''),[error,setError]=useState('');
  const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[includeReport,setIncludeReport]=useState(false);
  const [mode,setMode]=useState('');
  const loadId=useRef(0);
  const engine=useRef<LisaEngine|null>(null),worker=useRef<Worker|null>(null),epoch=useRef(0),scroll=useRef<HTMLDivElement|null>(null),active=useRef(false),panel=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(!open){if(active.current)engine.current?.interrupt();return;}const unlock=lockPageScroll();const previous=document.activeElement as HTMLElement|null;panel.current?.querySelector<HTMLButtonElement>('button')?.focus();function key(e:KeyboardEvent){if(e.key==='Escape')onClose();if(e.key==='Tab'){const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]')??[]);const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}window.addEventListener('keydown',key);return()=>{unlock();window.removeEventListener('keydown',key);previous?.focus();}},[open]);
  useEffect(()=>()=>{epoch.current++;loadId.current++;worker.current?.terminate();},[]);
  useEffect(()=>{epoch.current++;engine.current?.interrupt();setMessages([]);setInput('');setBusy(false);active.current=false;setIncludeReport(false)},[accountKey]);
  useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'})},[messages,busy,open]);
  async function load(){
    if(state==='loading')return;
    setState('loading');setError('');setStatus('Checking your device…');setProgress(0);
    const attempt=++loadId.current;
    try{
      const {loadLisa}=await import('./lisa-runtime');
      const loaded=await loadLisa((value,text)=>{if(loadId.current===attempt){setProgress(Math.max(0,Math.min(1,value)));setStatus(text)}},liveWorker=>{if(loadId.current===attempt){worker.current?.terminate();worker.current=liveWorker;}else liveWorker.terminate()});
      if(loadId.current!==attempt)return;
      engine.current=loaded.engine;setMode(loaded.mode);setState('ready');setStatus('Local AI ready');
    }catch(error){if(loadId.current!==attempt)return;console.warn('Lisa model loading failed:',error);worker.current?.terminate();worker.current=null;engine.current=null;setState('error');setError('Lisa could not load. Check your connection and available device memory, then retry. Model files download from Hugging Face; browser runtimes load from MLC or the ONNX CDN.');}
  }
  function cancelLoad(){loadId.current++;worker.current?.terminate();worker.current=null;engine.current=null;setState('idle');setStatus('');}
  async function ask(value=input){
    const text=value.trim();
    if(!text||!engine.current||state!=='ready'||active.current)return;
    const scope=screeningScopeNote(text);
    if(scope){setInput('');setMessages(previous=>[...previous,{role:'user',content:text},{role:'assistant',content:scope,kind:'scope'}]);return;}
    const run=++epoch.current;active.current=true;setBusy(true);setInput('');setError('');
    const previousQuestion=[...messages].reverse().find(message=>message.role==='user')?.content??'';
    const references=retrieveLisaContext(`${previousQuestion} ${text}`);
    const history=[...messages,{role:'user' as const,content:text}];
    setMessages([...history,{role:'assistant',content:'',sources:references.filter(r=>r.url).map(r=>({title:r.title,url:r.url}))}]);
    const context=references.map(r=>`${r.title}: ${r.text}`).join('\n');
    const system=`${lisaSystemPrompt}\nREFERENCE NOTES:\n${context}\n${includeReport&&reportContext?`OPTIONAL SESSION DATA (not a diagnosis): ${reportContext}`:'No session report was shared.'}`;
    const prompt:LisaPrompt=[{role:'system',content:system},...history.slice(-3).map(m=>({role:m.role,content:m.content.slice(0,1200)}))];
    // Keep history starting with a user turn and leave room for a response.
    if(prompt[1]?.role==='assistant')prompt.splice(1,1);
    try{
      let output='';
      await engine.current.generate(prompt,text=>{
        if(epoch.current!==run)return;
        output+=text;
        const visible=cleanLisaOutput(output);
        setMessages(previous=>previous.map((m,i)=>i===previous.length-1?{...m,content:visible}:m));
      });
      if(epoch.current===run&&!cleanLisaOutput(output))setError('No answer was generated. Try a shorter question.');
    }catch{if(epoch.current===run)setError('The local model stopped. Retry your question or reload Lisa.');}
    finally{if(epoch.current===run){setBusy(false);active.current=false;}}
  }
  function clear(){epoch.current++;engine.current?.interrupt();setMessages([]);setBusy(false);active.current=false;setError('');}
  return <>{open&&<div className="lisa-backdrop" onClick={onClose}/>}<aside className={'lisa-real '+(open?'is-open':'')} role="dialog" aria-modal={open?true:undefined} ref={panel} aria-label="Lisa AI companion" aria-hidden={!open} inert={!open}>
    <div className="lisa-real-head"><span className="lisa-eyes">••</span><div><strong>LISA’S ALL EARS.</strong><p>{state==='ready'?mode.toUpperCase():'YOUR HEARING COMPANION'}</p></div><button onClick={onClose} aria-label="Close Lisa"><X/></button></div>
    <div className="lisa-real-body" ref={scroll}>
      <div className="lisa-welcome"><span>HELLO, YOU.</span><h3>Let’s talk<br/>about <i>hearing.</i></h3><p>Ask a real question. Get a generated answer. Your conversation stays in this tab.</p></div>
      {state!=='ready'&&<div className="local-ai-card"><Cpu size={24}/><strong>REAL AI. NO API BILL.</strong><p>Lisa runs a small open model on your device. First use downloads several hundred MB and uses WebGPU when available, with a slower CPU fallback. Your messages are not sent to an AI provider.</p>{state==='loading'?<><progress max={1} value={progress}/><p role="status">{Math.round(progress*100)}% · {status}</p><button onClick={cancelLoad}>Cancel download</button></>:<button className="primary" onClick={()=>void load()}><Download size={17}/>{state==='error'?'Try loading again':'Load free AI'}</button>}</div>}
      {error&&<p role="alert" className="lisa-error">{error}</p>}
      {messages.map((message,i)=><div key={i} className={'lisa-real-message '+message.role}><span>{message.role==='user'?'YOU':message.kind==='scope'?'ECHO · SCREENING LIMIT':'LISA · AI GENERATED'}</span><p>{message.content||'Thinking…'}</p>{message.sources?.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">Reference notes: {source.title} ↗</a>)}</div>)}
      {state==='ready'&&!messages.length&&<div className="lisa-prompts">{['How does the game test my hearing?','How can I protect my hearing?','What does my report mean?'].map(text=><button onClick={()=>void ask(text)} key={text}>{text}<ArrowUpRight size={17}/></button>)}</div>}
    </div>
    <div className="lisa-real-bottom">{reportContext&&<label className="share-report"><input type="checkbox" checked={includeReport} onChange={e=>setIncludeReport(e.target.checked)}/> Include this report’s response summary</label>}
      <form onSubmit={e=>{e.preventDefault();void ask()}}><input aria-label="Message Lisa" placeholder={state==='ready'?'What’s on your mind?':'Load Lisa to start chatting'} maxLength={1200} value={input} disabled={state!=='ready'||busy} onChange={e=>setInput(e.target.value)}/>{busy?<button type="button" onClick={()=>engine.current?.interrupt()} aria-label="Stop generating"><Square size={17}/></button>:<button disabled={state!=='ready'||!input.trim()} aria-label="Send message"><ArrowUpRight/></button>}</form>
      <div className="lisa-footnote"><span><ShieldCheck size={13}/> AI can make mistakes. Education, not diagnosis.</span><button onClick={clear} aria-label="Clear conversation"><RotateCcw size={15}/></button></div>
      <p className="urgent-note">Sudden hearing loss? Seek medical care immediately. <a href="https://www.nidcd.nih.gov/health/sudden-deafness" target="_blank" rel="noreferrer">NIDCD ↗</a></p>
    </div>
  </aside></>;
}
