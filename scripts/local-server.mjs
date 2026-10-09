import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {codexStatus,codexModels,JobQueue,validateTask} from './codex-bridge.mjs';
import {closeChatServer} from './codex-chat.mjs';
import {stopOwnedProcess} from './codex-discovery.mjs';

const app=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtime=path.join(app,'.sites-runtime');fs.mkdirSync(runtime,{recursive:true});
const port=Number(process.env.PAPERLEAF_PORT||4399),backendPort=Number(process.env.PAPERLEAF_WORKER_PORT||4401),origin=`http://127.0.0.1:${port}`;
if(![port,backendPort].every(p=>Number.isInteger(p)&&p>=1024&&p<=65535)||port===backendPort)throw new Error('Invalid local ports');
const installation=createHash('sha256').update(app).digest('hex').slice(0,12);
const queue=new JobQueue();
const out=fs.openSync(path.join(runtime,'worker.stdout.log'),'a'),err=fs.openSync(path.join(runtime,'worker.stderr.log'),'a');
const worker=spawn(process.execPath,[path.join(app,'node_modules','wrangler','bin','wrangler.js'),'dev','--config',path.join(app,'dist','server','wrangler.json'),'--local','--persist-to',path.join(app,'.wrangler','state'),'--ip','127.0.0.1','--port',String(backendPort),'--inspector-port','0'],{cwd:app,windowsHide:true,stdio:['ignore',out,err],env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_WRITE_LOGS:'false',WRANGLER_REGISTRY_PATH:path.join(runtime,'registry'),MINIFLARE_REGISTRY_PATH:path.join(runtime,'miniflare')}});
fs.closeSync(out);fs.closeSync(err);
let stopping=false;
worker.on('error',()=>{console.error('Unable to start local reader worker.');process.exitCode=1;shutdown();});
worker.on('exit',()=>{if(!stopping){process.exitCode=1;shutdown();}});
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
let statusCache=null,statusTime=0;
let modelCache=null,modelTime=0,modelRequest=null;
const server=http.createServer(async(req,res)=>{
  const host=req.headers.host;
  if(host!==`127.0.0.1:${port}`){json(res,403,{error:'请从本机桌面快捷方式打开知页。'});return;}
  if(req.headers.origin&&req.headers.origin!==origin){json(res,403,{error:'不允许跨来源请求。'});return;}
  if(req.headers['sec-fetch-site']==='cross-site'){json(res,403,{error:'不允许跨来源请求。'});return;}
  const url=new URL(req.url,origin);
  if(url.pathname==='/api/health'&&req.method==='GET'){
    try{const response=await fetch(`http://127.0.0.1:${backendPort}/api/health`,{signal:AbortSignal.timeout(2500)});const data=await response.json();json(res,response.status,{...data,bridge:'codex-v2',installation});}catch{json(res,503,{error:'知页正在启动。'});}return;
  }
  if(url.pathname.startsWith('/api/codex/')){
    try{
      if(url.pathname==='/api/codex/models'&&req.method==='GET'){
        if(!modelCache||Date.now()-modelTime>5*60*1000||url.searchParams.has('refresh')){modelRequest??=codexModels().finally(()=>modelRequest=null);modelCache=await modelRequest;modelTime=Date.now();}json(res,200,modelCache);return;
      }
      if(url.pathname==='/api/codex/status'&&req.method==='GET'){
        if(!statusCache||Date.now()-statusTime>30000||url.searchParams.has('refresh')){statusCache=await codexStatus();statusTime=Date.now();}
        json(res,200,statusCache);return;
      }
      if(url.pathname==='/api/codex/jobs'&&req.method==='POST'){
        if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'请求必须为 JSON。'});return;}
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>7*1024*1024){json(res,413,{error:'请求过大，请缩小选区。'});return;}chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{json(res,400,{error:'请求格式无效。'});return;}
        json(res,202,queue.create(validateTask(body)));return;
      }
      const match=/^\/api\/codex\/jobs\/([a-f0-9-]{36})$/.exec(url.pathname);
      if(match&&['GET','DELETE'].includes(req.method)){
        const result=req.method==='DELETE'?queue.cancel(match[1]):queue.view(match[1]);
        json(res,result?200:404,result||{error:'任务已过期，请重新发送。'});return;
      }
      json(res,404,{error:'Codex 接口不存在。'});
    }catch(e){json(res,400,{error:e.message||'Codex 请求失败。'});}
    return;
  }
  // Validate the local origin before forwarding frontend requests.
  const headers={...req.headers,host:`127.0.0.1:${backendPort}`};
  if(headers.origin)headers.origin=`http://127.0.0.1:${backendPort}`;
  const proxy=http.request({hostname:'127.0.0.1',port:backendPort,path:req.url,method:req.method,headers},upstream=>{
    res.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(res);
  });
  proxy.on('error',()=>{if(!res.headersSent)json(res,503,{error:'知页正在启动，请稍后刷新。'});else res.destroy();});
  res.on('close',()=>{if(!res.writableEnded)proxy.destroy();});req.pipe(proxy);
});
server.headersTimeout=15000;server.requestTimeout=120000;
server.on('error',()=>{console.error(`Unable to listen on local port ${port}.`);process.exitCode=1;shutdown();});
server.listen(port,'127.0.0.1');
function shutdown(){if(stopping)return;stopping=true;queue.close();closeChatServer();server.close();stopOwnedProcess(worker);setTimeout(()=>process.exit(process.exitCode||0),1000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
