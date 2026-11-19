import {env,pipeline,TextStreamer,InterruptableStoppingCriteria,type TextGenerationPipeline} from '@huggingface/transformers';
env.allowLocalModels=false;
// Single-threaded WASM works without cross-origin isolation, including private Sites.
if(env.backends.onnx.wasm)env.backends.onnx.wasm.numThreads=1;
let generator:TextGenerationPipeline|null=null;
let busy=false;
const stopping=new InterruptableStoppingCriteria();
self.onmessage=async(event:MessageEvent<{type:string;id:number;messages?:{role:string;content:string}[]}>)=>{
  const {type,id,messages}=event.data;
  if(type==='stop'){stopping.interrupt();return;}
  if(busy){self.postMessage({type:'error',id,text:'Lisa is still working on the previous request.'});return;}
  busy=true;
  try{
    if(type==='load'){
      self.postMessage({type:'progress',value:0,text:'Preparing CPU mode. The first model download can take a few minutes.'});
      generator=await pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{
        device:'wasm',dtype:'q4',progress_callback:info=>{
          if(info.status==='progress'&&info.file?.endsWith('.onnx'))self.postMessage({type:'progress',value:info.progress/100*.9,text:`Downloading model · ${Math.round(info.progress)}%`});
          else if(info.status==='done'&&info.file?.endsWith('.onnx'))self.postMessage({type:'progress',value:.95,text:'Download complete. Preparing model in device memory…'});
        },
      });
    }else if(type==='generate'){
      if(!generator||!messages)throw new Error('Load Lisa before asking a question.');
      stopping.reset();
      const streamer=new TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:text=>self.postMessage({type:'delta',id,text})});
      await generator(messages,{max_new_tokens:180,do_sample:false,return_full_text:false,streamer,stopping_criteria:stopping});
    }
    self.postMessage({type:'done',id});
  }catch(error){self.postMessage({type:'error',id,text:error instanceof Error?error.message:'Local AI failed.'});}
  finally{busy=false;}
};
