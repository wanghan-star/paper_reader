import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const app=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const installation=createHash('sha256').update(app).digest('hex').slice(0,12);
const runtime=path.join(app,'.sites-runtime');fs.mkdirSync(runtime,{recursive:true});
let port=4399,origin='http://127.0.0.1:4399';
const readOrigin=()=>{try{const saved=JSON.parse(fs.readFileSync(path.join(runtime,'desktop-origin.json'),'utf8'));if(Number.isInteger(saved.port)&&saved.port>=1024&&saved.port<=65535){port=saved.port;origin=`http://127.0.0.1:${port}`;}}catch{}};readOrigin();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ready=async()=>{try{const r=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1500)});const data=await r.json();return data.app==='zhiye'&&data.bridge==='codex-v2'&&data.installation===installation;}catch{return false;}};
// `?launch` plays the opening animation; while the service is still starting it serves the same animation.
const open=()=>{const command=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';const browser=spawn(command,[origin+'/?launch'],{detached:true,stdio:'ignore',windowsHide:true});browser.on('error',()=>console.log('请打开 '+origin));browser.unref();};
const freePort=preferred=>new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',error=>{if(error.code==='EADDRINUSE'&&preferred)freePort(0).then(resolve,reject);else reject(error);});probe.listen(preferred,'127.0.0.1',()=>{const found=probe.address().port;probe.close(()=>resolve(found));});});
const lockPath=path.join(runtime,'desktop-launch.lock');let ownsLock=false;
try{
  if(await ready()){open();process.exit(0);}
  for(let i=0;i<65;i++){
    try{const handle=fs.openSync(lockPath,'wx');fs.writeFileSync(handle,String(Date.now()));fs.closeSync(handle);ownsLock=true;break;}
    catch(e){if(e.code!=='EEXIST')throw e;if(await ready()){open();process.exit(0);}if(Date.now()-fs.statSync(lockPath).mtimeMs>90000){fs.unlinkSync(lockPath);continue;}await sleep(750);readOrigin();}
  }
  if(!ownsLock)throw new Error('Another instance is still starting. Please retry shortly.');
  if(!await ready()){
    if(!fs.existsSync(path.join(app,'dist','server','wrangler.json')))throw new Error('Built application files are missing. Run the Start launcher first.');
    port=await freePort(port);let backendPort=await freePort(4401);if(backendPort===port)backendPort=await freePort(0);origin=`http://127.0.0.1:${port}`;
    fs.writeFileSync(path.join(runtime,'desktop-origin.json'),JSON.stringify({port}));
    const out=fs.openSync(path.join(runtime,'desktop.stdout.log'),'a'),err=fs.openSync(path.join(runtime,'desktop.stderr.log'),'a');
    const server=spawn(process.execPath,[path.join(app,'scripts','local-server.mjs')],{cwd:app,detached:true,windowsHide:true,stdio:['ignore',out,err],env:{...process.env,PAPERLEAF_PORT:String(port),PAPERLEAF_WORKER_PORT:String(backendPort),WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_WRITE_LOGS:'false',WRANGLER_REGISTRY_PATH:path.join(runtime,'registry'),MINIFLARE_REGISTRY_PATH:path.join(runtime,'miniflare')}});
    fs.closeSync(out);fs.closeSync(err);server.on('error',e=>fs.appendFileSync(path.join(runtime,'desktop.stderr.log'),e.message+'\n'));server.unref();fs.writeFileSync(path.join(runtime,'desktop.pid'),String(server.pid));
    const answering=async()=>{try{await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)});return true;}catch{return false;}};
    let opened=false,started=false;
    for(let i=0;i<120;i++){await sleep(i<20?250:700);if(!opened&&await answering()){open();opened=true;}if(await ready()){started=true;break;}}
    if(!started)throw new Error('The local reader could not start. See .sites-runtime/desktop.stderr.log for details.');
    if(!opened)open();
  }else open();
}catch(e){console.error(e.message);fs.appendFileSync(path.join(runtime,'launcher-error.log'),new Date().toISOString()+' '+e.message+'\n');process.exitCode=1;}
finally{if(ownsLock&&fs.existsSync(lockPath))fs.unlinkSync(lockPath);}
