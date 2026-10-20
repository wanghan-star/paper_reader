"use client";
import { useState } from "react";
import { ChevronDown, Lightbulb, LoaderCircle, LocateFixed, MessageSquareText, PenLine, Sparkles } from "lucide-react";
import type { GuidePoint, GuideState } from "@/lib/guide";
import RichText from "./rich-text";

function GuideCard({point,page,busy,onLocate,onExplain,onAnswer}:{point:GuidePoint;page:number;busy:boolean;onLocate:()=>void;onExplain:()=>void;onAnswer:(words:string)=>void}){
  const [writing,setWriting]=useState(false),[words,setWords]=useState("");
  return <li className="guide-point">
    <div className="guide-head"><strong><RichText>{point.title}</RichText></strong><button onClick={onLocate} title="在正文中定位这一段" aria-label={`定位到原文第 ${page} 页的对应段落`}><LocateFixed size={13}/>第 {page} 页</button></div>
    {point.why&&<div className="guide-why"><RichText>{point.why}</RichText></div>}
    <div className="guide-question"><span>读到这里，先想一想</span><RichText>{point.question}</RichText></div>
    {writing&&<textarea aria-label="写下你对这道思考题的理解" rows={3} maxLength={2000} autoFocus value={words} placeholder="用自己的话写几句，不必完整，AI 会指出遗漏和误区…" onChange={e=>setWords(e.target.value)}/>}
    <div className="guide-actions">{writing?<><button className="guide-primary" disabled={busy||!words.trim()} onClick={()=>{onAnswer(words.trim());setWords("");setWriting(false);}}><Sparkles size={13}/>请 AI 看看我的理解</button><button onClick={()=>setWriting(false)}>取消</button></>:<><button className="guide-primary" onClick={()=>setWriting(true)}><PenLine size={13}/>我来回答</button><button disabled={busy} onClick={onExplain}><MessageSquareText size={13}/>直接讲给我听</button></>}</div>
  </li>;
}

// Difficult spots of the pages on screen. They live in the assistant panel so the paper text stays clean.
export default function GuidePanel({indexes,guides,open,onToggle,busy,onRetry,onLocate,onExplain,onAnswer}:{indexes:number[];guides:Record<number,GuideState>;open:boolean;onToggle:(open:boolean)=>void;busy:boolean;onRetry:()=>void;onLocate:(point:GuidePoint,page:number)=>void;onExplain:(point:GuidePoint,page:number)=>void;onAnswer:(point:GuidePoint,page:number,words:string)=>void}){
  const requested=indexes.filter(index=>guides[index]);
  // Nothing is shown until the reader has asked for the difficult spots of a page on screen.
  if(!requested.length)return null;
  const points=requested.flatMap(index=>guides[index].points.map(point=>({point,page:index+1})));
  const loading=requested.some(index=>guides[index].status==="loading"),failed=requested.some(index=>guides[index].status==="failed");
  return <section className={`guide-panel ${open?"open":""}`} aria-label="本页难点">
    <button className="guide-panel-toggle" aria-expanded={open} onClick={()=>onToggle(!open)}><Lightbulb size={14}/><strong>本页难点</strong><span>{loading?<><LoaderCircle size={12} className="spin"/>正在找出难点…</>:points.length?`${points.length} 处，值得停下来想一想`:failed?"未能标出":"这一页没有明显难点"}</span><ChevronDown size={15}/></button>
    {open&&<div className="guide-panel-body">
      {points.length>0&&<ul>{points.map(({point,page})=><GuideCard key={`${page}-${point.id}`} point={point} page={page} busy={busy} onLocate={()=>onLocate(point,page)} onExplain={()=>onExplain(point,page)} onAnswer={words=>onAnswer(point,page,words)}/>)}</ul>}
      {!points.length&&loading&&<p className="guide-empty">AI 正在通读这一页，找出初读时最容易卡住的地方。</p>}
      {!points.length&&!loading&&!failed&&<p className="guide-empty">这一页以叙述为主，没有需要特别停下来的地方。</p>}
      {failed&&!loading&&<button className="guide-request" disabled={busy} onClick={onRetry}><Lightbulb size={13}/>重新找出难点</button>}
    </div>}
  </section>;
}
