import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';

const ID=/^[a-f0-9]{32}$/;
const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';

/**
 * Reading records kept as plain files next to the app: <id>.json (translation, chat, guide),
 * <id>.meta.json (the line shown in the library) and <id>.pdf (a copy of the paper, so that
 * figures can be drawn again). The id is a hash of the PDF, so the same paper finds its record.
 */
export function createRecordStore(root){
  const file=(id,extension)=>{if(!ID.test(id))throw new Error('阅读记录编号无效。');return path.join(root,id+extension);};
  const write=async(target,data)=>{
    await fs.mkdir(root,{recursive:true});
    // Write beside the target, then rename, so an interrupted save never leaves half a record.
    const temporary=`${target}.${process.pid}.tmp`;await fs.writeFile(temporary,data);await fs.rename(temporary,target);
  };
  return {
    root,
    async list(){
      let names;try{names=await fs.readdir(root);}catch{return [];}
      const rows=[];
      for(const name of names){
        if(!name.endsWith('.meta.json')||!ID.test(name.slice(0,-10)))continue;
        try{rows.push(JSON.parse(await fs.readFile(path.join(root,name),'utf8')));}catch{/* skip an unreadable entry */}
      }
      return rows.sort((a,b)=>b.updated-a.updated);
    },
    async read(id){try{return JSON.parse(await fs.readFile(file(id,'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw new Error('阅读记录已损坏，无法读取。');}},
    async save(id,record){
      if(!record||typeof record!=='object'||!Array.isArray(record.pages)||!record.pages.length||record.pages.length>350)throw new Error('阅读记录内容无效。');
      const pages=record.pages,sentences=pages.flatMap(p=>Array.isArray(p?.sentences)?p.sentences:[]);
      const stored={version:1,title:text(record.title,300),filename:text(record.filename,300),page:Number.isSafeInteger(record.page)?record.page:1,pages,messages:Array.isArray(record.messages)?record.messages.slice(-400):[],guides:record.guides&&typeof record.guides==='object'?record.guides:{},updated:Date.now()};
      const meta={id,title:stored.title,filename:stored.filename,pageCount:pages.length,total:sentences.length,translated:sentences.filter(s=>s?.zh).length,messages:stored.messages.length,updated:stored.updated};
      await write(file(id,'.json'),JSON.stringify(stored));await write(file(id,'.meta.json'),JSON.stringify(meta));
      return meta;
    },
    async savePdf(id,bytes){
      if(!bytes.subarray(0,1024).includes('%PDF-'))throw new Error('文件不是有效的 PDF。');
      await write(file(id,'.pdf'),bytes);
    },
    async openPdf(id){const target=file(id,'.pdf');const {size}=await fs.stat(target);return {size,stream:createReadStream(target)};},
    async remove(id){for(const extension of ['.json','.meta.json','.pdf'])await fs.rm(file(id,extension),{force:true});}
  };
}
