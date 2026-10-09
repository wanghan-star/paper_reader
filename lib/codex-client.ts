import type { Lesson } from "./lesson";
type Result={content:string;translations:{id:number;zh:string}[];lesson?:Lesson};
type Job={id:string;status:string;error?:string;result?:Result;partial?:string;visual?:Lesson["visual"]};
async function read(response:Response){
  let body:Job;try{body=await response.json() as Job;}catch{throw new Error('Codex 本地服务未连接，请从桌面快捷方式重新打开知页。');}
  if(!response.ok)throw new Error(body.error||'Codex 本地服务未连接，请从桌面启动知页。');return body;
}
export async function callCodex(task:string,payload:Record<string,unknown>,model:string,signal:AbortSignal,onProgress?:(p:{content?:string;visual?:Lesson["visual"]})=>void):Promise<Result>{
  signal.throwIfAborted();
  let job:Job|undefined;let cancelSent=false;
  const cancel=()=>{if(job?.id&&!cancelSent){cancelSent=true;void fetch(`/api/codex/jobs/${job.id}`,{method:'DELETE',keepalive:true}).catch(()=>{});}};
  // Keep submission alive long enough to obtain an id, so cancellation also stops queued work.
  const onAbort=()=>cancel();signal.addEventListener('abort',onAbort,{once:true});
  try{
    job=await read(await fetch('/api/codex/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task,config:{codexModel:model},...payload}),signal:AbortSignal.timeout(20000)}));
    if(signal.aborted){cancel();signal.throwIfAborted();}
    const deadline=Date.now()+30*60*1000;
    while(true){
      signal.throwIfAborted();
      if(job.partial||job.visual)onProgress?.({content:job.partial,visual:job.visual});
      if(job.status==='completed'&&job.result)return job.result;
      if(job.status==='failed')throw new Error(job.error||'Codex 处理失败，请重试。');
      if(job.status==='cancelled')throw new DOMException('已停止','AbortError');
      if(Date.now()>deadline){cancel();throw new Error('Codex 等待时间过长，请稍后重试。');}
      await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('已停止','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},task==='chat'?300:750);signal.addEventListener('abort',abort,{once:true});});
      job=await read(await fetch(`/api/codex/jobs/${job.id}`,{signal,cache:'no-store'}));
    }
  }catch(e){if(signal.aborted){cancel();throw new DOMException('已停止','AbortError');}throw e;}
  finally{signal.removeEventListener('abort',onAbort);}
}
