"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, MessageSquareText, ScanLine, Sparkles } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PaperPage } from "@/lib/paper";
import RichText from "./rich-text";
import PdfViewer from "./pdf-viewer";

function LazySection({children,index,enabled,estimate}:{children:ReactNode;index:number;enabled:boolean;estimate:number}){
  const element=useRef<HTMLElement>(null);const [near,setNear]=useState(!enabled),[height,setHeight]=useState(estimate);
  useEffect(()=>{if(!enabled){setNear(true);return;}const el=element.current;if(!el)return;const observer=new IntersectionObserver(([entry])=>setNear(entry.isIntersecting),{root:el.closest(".reader-scroll"),rootMargin:"1200px 0px"});observer.observe(el);return()=>observer.disconnect();},[enabled]);
  useEffect(()=>{if(!near||!element.current)return;const observer=new ResizeObserver(([entry])=>{if(entry.contentRect.height>0)setHeight(entry.contentRect.height);});observer.observe(element.current);return()=>observer.disconnect();},[near]);
  return <section className="reading-section" data-paper-page={index+1} ref={element} style={near?undefined:{height}}>{near?children:<div className="page-placeholder">第 {index+1} 页</div>}</section>;
}

export default function ReadingPages({pages,indexes,continuous,pdf,doc,zoom,isDemo,attachText,attachImage,onOriginal,onOCR,busy}:{pages:PaperPage[];indexes:number[];continuous:boolean;pdf:boolean;doc:PDFDocumentProxy|null;zoom:number;isDemo:boolean;attachText:(text:string,page:number)=>void;attachImage:(image:string,page:number)=>void;onOriginal:(page:number)=>void;onOCR:(page:number)=>void;busy:boolean}){
  return <>{indexes.map(index=><LazySection key={index} index={index} enabled={continuous} estimate={pdf?1050:Math.max(750,pages[index].sentences.length*95)}>
    {pdf?doc?<PdfViewer doc={doc} page={index+1} zoom={zoom} onCrop={image=>attachImage(image,index+1)} onText={text=>attachText(text,index+1)}/>:<p className="page-placeholder">正在加载 PDF…</p>:<>
      <div className="source-page-label"><span>原文第 {index+1} 页</span><i/></div>
      {!pages[index].sentences.length?<div className="ocr-empty"><ScanLine size={28}/><h2>这一页，需要视觉识别</h2><p>扫描文字可以识别后翻译，也可以打开原文圈选提问。</p><button className="btn primary" disabled={busy} onClick={()=>onOCR(index+1)}><Sparkles size={15}/>识别并翻译</button><button className="text-button" onClick={()=>onOriginal(index+1)}>查看 PDF 原文<ArrowUpRight size={14}/></button></div>:pages[index].sentences.map(s=><div key={s.id} className={`sentence-pair ${s.heading?"heading-pair":""}`}>
        <div className={`sentence-zh ${!s.zh?"untranslated":""}`}><span className="language-mark">中</span><div>{s.zh?<RichText>{s.zh}</RichText>:<span>待翻译<span className="untranslated-hint"> · 点击上方翻译按钮</span></span>}</div></div>
        <div className="sentence-en"><span className="language-mark">EN</span><div><RichText>{s.en}</RichText></div><button className="sentence-help" aria-label={`解释第 ${s.id+1} 段 · 原文第 ${index+1} 页`} title="解释这段文字" onClick={()=>attachText(s.en,index+1)}><MessageSquareText size={14}/></button></div>
      </div>)}
      {isDemo&&index===1&&<div className="attention-formula"><RichText>{"$$\\operatorname{Attention}(Q,K,V)=\\operatorname{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$"}</RichText><button className="text-button" onClick={()=>attachText("请逐步解释注意力公式 Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) V，以及每个符号。",index+1)}>解释这个公式<ArrowUpRight size={13}/></button></div>}
      <button className="original-link" onClick={()=>onOriginal(index+1)}><ScanLine size={14}/>打开这一页原文，框选图表提问<ArrowUpRight size={13}/></button>
    </>}
  </LazySection>)}</>;
}
