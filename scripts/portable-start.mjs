import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const app=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const run=(args)=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{cwd:app,stdio:'inherit',windowsHide:true});p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error('步骤失败，请查看上面的错误信息。')));});
try{
  const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||major===22&&minor<13)throw new Error('请先安装 Node.js 22.13 或更新版本，再重新打开知页。');
  if(!fs.existsSync(path.join(app,'node_modules','wrangler','bin','wrangler.js'))){
    console.log('首次运行：正在为这台电脑安装知页依赖，请保持联网…');
    const candidates=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js'),path.resolve(path.dirname(fs.realpathSync(process.execPath)),'../lib/node_modules/npm/bin/npm-cli.js')];
    const npm=candidates.find(p=>p&&fs.existsSync(p));if(!npm)throw new Error('没有找到 npm。请安装包含 npm 的 Node.js，或在本文件夹运行 npm ci --include=dev --include=optional。');
    await run([npm,'ci','--include=dev','--include=optional','--no-audit','--no-fund']);
  }
  if(!fs.existsSync(path.join(app,'dist','server','wrangler.json'))){console.log('正在生成知页页面…');await run([path.join(app,'scripts','prepare-assets.mjs')]);await run([path.join(app,'scripts','run-framework.mjs'),'build']);}
  await run([path.join(app,'scripts','desktop-launch.mjs')]);console.log('知页已打开，下次双击启动即可。');
}catch(e){console.error(e.message);process.exitCode=1;}
