import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';

async function isFile(file){try{return (await fs.stat(file)).isFile();}catch{return false;}}
async function commandPaths(name){return new Promise(resolve=>{let output='';const child=spawn(process.platform==='win32'?'where.exe':'which',[name],{windowsHide:true,stdio:['ignore','pipe','ignore']});const timer=setTimeout(()=>{child.kill();resolve([]);},3000);child.stdout.on('data',c=>output+=c);child.on('error',()=>{clearTimeout(timer);resolve([]);});child.on('close',()=>{clearTimeout(timer);resolve(output.trim().split(/\r?\n/).filter(Boolean));});});}
async function windowsPackages(){return new Promise(resolve=>{let output='';const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-AppxPackage | Where-Object { $_.Name -match 'Codex' } | Select-Object -ExpandProperty InstallLocation"],{windowsHide:true,stdio:['ignore','pipe','ignore']});const timer=setTimeout(()=>{child.kill();resolve([]);},4000);child.stdout.on('data',c=>output+=c);child.on('error',()=>{clearTimeout(timer);resolve([]);});child.on('close',()=>{clearTimeout(timer);resolve(output.trim().split(/\r?\n/).filter(Boolean));});});}
export async function discoverCodex(){
  const home=os.homedir(),local=process.env.LOCALAPPDATA||path.join(home,'AppData','Local');
  const candidates=[process.env.PAPERLEAF_CODEX_PATH,process.env.CODEX_CLI_PATH];
  if(process.platform==='win32'){
    const roots=[path.join(local,'OpenAI','CodexRepair','runtime'),path.join(local,'OpenAI','Codex','runtime')];
    for(const root of roots)try{for(const name of (await fs.readdir(root)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})))candidates.push(path.join(root,name,'codex.exe'),path.join(root,name,'resources','codex.exe'));}catch{}
    candidates.push(path.join(local,'Programs','Codex','resources','codex.exe'),path.join(local,'Programs','Codex','codex.exe'));
  }else{
    candidates.push('/Applications/Codex.app/Contents/Resources/codex',path.join(home,'Applications','Codex.app','Contents','Resources','codex'),'/usr/local/bin/codex','/opt/homebrew/bin/codex',path.join(home,'.local','bin','codex'));
  }
  candidates.push(...await commandPaths('codex'));
  for(const file of candidates.filter(Boolean)){
    if(!await isFile(file))continue;
    if(/\.(?:cmd|bat|ps1)$/i.test(file)){
      // Use the installed npm entry directly, without a shell or a command-string wrapper.
      const entry=path.join(path.dirname(file),'node_modules','@openai','codex','bin','codex.js');
      if(await isFile(entry))return {command:process.execPath,prefix:[entry],path:entry,platform:process.platform};
      continue;
    }
    if(/\.(?:mjs|cjs|js)$/i.test(file))return {command:process.execPath,prefix:[file],path:file,platform:process.platform};
    return {command:file,prefix:[],path:file,platform:process.platform};
  }
  if(process.platform==='win32')for(const root of await windowsPackages())for(const file of [path.join(root,'app','resources','codex.exe'),path.join(root,'resources','codex.exe'),path.join(root,'codex.exe')])if(await isFile(file))return {command:file,prefix:[],path:file,platform:process.platform};
  return null;
}
export function spawnCodex(installation,args,options){
  if(!installation)throw new Error('未检测到本机 Codex，请安装并登录 Codex 后重新检测。');
  return spawn(installation.command,[...installation.prefix,...args],{...options,windowsHide:true});
}
export function stopOwnedProcess(child){
  if(!child?.pid||child.exitCode!==null)return;
  if(process.platform==='win32'){const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>child.kill());}
  else child.kill('SIGTERM');
}

export async function codexEnvironment(){
  const env={...process.env};
  if(process.platform!=='win32'||env.HTTPS_PROXY||env.https_proxy)return env;
  // Windows desktop apps use the system proxy; CLI networking needs its environment equivalent.
  const registry=await new Promise(resolve=>{
    let output='';const p=spawn('reg.exe',['query','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],{windowsHide:true,stdio:['ignore','pipe','ignore']});
    const timer=setTimeout(()=>{p.kill();resolve('');},3000);
    p.stdout.on('data',c=>{output+=c.toString();});p.on('error',()=>{clearTimeout(timer);resolve('');});p.on('close',()=>{clearTimeout(timer);resolve(output);});
  });
  if(!/ProxyEnable\s+REG_DWORD\s+0x1\b/.test(registry))return env;
  const value=/ProxyServer\s+REG_SZ\s+([^\r\n]+)/.exec(registry)?.[1].trim();
  const proxy=value?.split(';').find(v=>v.startsWith('https='))?.slice(6)||value;
  if(proxy&&/^(?:127\.0\.0\.1|localhost):\d{1,5}$/.test(proxy)){env.HTTPS_PROXY='http://'+proxy;if(!env.HTTP_PROXY&&!env.http_proxy)env.HTTP_PROXY=env.HTTPS_PROXY;}
  return env;
}
