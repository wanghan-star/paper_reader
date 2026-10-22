import type { PaperPage } from "./paper";
import type { Lesson } from "./lesson";
import type { GuideState } from "./guide";

export type RecordSummary={id:string;title:string;filename:string;pageCount:number;total:number;translated:number;messages:number;updated:number};
export type StoredMessage={id:number;role:"user"|"assistant";content:string;page:number;image?:string;error?:boolean;lesson?:Lesson;sources?:number[]};
/** Messages as kept in a record: unfinished answers wait until they complete, very large screenshots are dropped. */
export const storedMessages=(messages:(StoredMessage&{streaming?:boolean})[]):StoredMessage[]=>messages.filter(m=>!m.streaming).map(m=>({id:m.id,role:m.role,content:m.content,page:m.page,...(m.image&&m.image.length<=600000?{image:m.image}:{}),...(m.error?{error:true}:{}),...(m.lesson?{lesson:m.lesson}:{}),...(m.sources?.length?{sources:m.sources}:{})}));
export type PaperRecord={title:string;filename:string;page:number;pages:PaperPage[];messages:StoredMessage[];guides:Record<number,GuideState>};

/** The same PDF always maps to the same record, whatever the file is called. */
export async function hashBytes(bytes:Uint8Array):Promise<string>{
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes as BufferSource));
  return Array.from(digest.slice(0,16),b=>b.toString(16).padStart(2,"0")).join("");
}
async function check(response:Response){
  if(response.ok)return response;
  let message="阅读记录服务未连接，请从桌面快捷方式重新打开知页。";
  try{message=(await response.json() as {error?:string}).error||message;}catch{/* keep the default */}
  throw new Error(message);
}
export const listRecords=async()=>(await (await check(await fetch("/api/records",{cache:"no-store"}))).json() as {records:RecordSummary[]}).records;
export async function readRecord(id:string):Promise<PaperRecord|null>{
  const response=await fetch(`/api/records/${id}`,{cache:"no-store"});
  return response.status===404?null:await (await check(response)).json() as PaperRecord;
}
export const saveRecord=async(id:string,record:PaperRecord)=>await (await check(await fetch(`/api/records/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(record)}))).json() as RecordSummary;
export const savePdf=async(id:string,file:Blob)=>{await check(await fetch(`/api/records/${id}/pdf`,{method:"PUT",headers:{"Content-Type":"application/pdf"},body:file}));};
export const fetchPdf=async(id:string)=>new Uint8Array(await (await check(await fetch(`/api/records/${id}/pdf`,{cache:"no-store"}))).arrayBuffer());
export const deleteRecord=async(id:string)=>{await check(await fetch(`/api/records/${id}`,{method:"DELETE"}));};
