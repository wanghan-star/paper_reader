"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, MessageSquareText, ScanLine, Sparkles } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PaperPage,Sentence } from "@/lib/paper";
import RichText from "./rich-text";
import PdfViewer from "./pdf-viewer";
import PaperVisual from './paper-visual';
import {katexMacros,normalizeMath} from '@/lib/math';
import katex from 'katex';

function LazySection({children,index,enabled,estimate}:{children:ReactNode;index:number;enabled:boolean;estimate:number}){
  const element=useRef<HTMLElement>(null);const [near,setNear]=useState(!enabled),[height,setHeight]=useState(estimate);
  useEffect(()=>{if(!enabled){setNear(true);return;}const el=element.current;if(!el)return;const observer=new IntersectionObserver(([entry])=>setNear(entry.isIntersecting),{root:el.closest(".reader-scroll"),rootMargin:"1200px 0px"});observer.observe(el);return()=>observer.disconnect();},[enabled]);
  useEffect(()=>{if(!near||!element.current)return;const observer=new ResizeObserver(([entry])=>{if(entry.contentRect.height>0)setHeight(entry.contentRect.height);});observer.observe(element.current);return()=>observer.disconnect();},[near]);
  return <section className="reading-section" data-paper-page={index+1} ref={element} style={near?undefined:{height}}>{near?children:<div className="page-placeholder">第 {index+1} 页</div>}</section>;
}

function Reveal({title,children,className}:{title:string;children:ReactNode;className:string}){
  const [open,setOpen]=useState(false);
  return <details className={className} onToggle={e=>setOpen(e.currentTarget.open)}><summary>{title}</summary>{open&&children}</details>;
}

function ContentBlock({sentence:s,index,doc,attachText,attachImage}:{sentence:Sentence;index:number;doc:PDFDocumentProxy|null;attachText:(text:string,page:number)=>void;attachImage:(image:string,page:number)=>void}){
  const visual=doc&&s.box?<PaperVisual doc={doc} page={index+1} box={s.box} label={s.kind==='equation'?'公式原图':s.kind==='table'?'论文表格':s.kind==='figure'?'论文图表':'含公式段落原图'} onExplain={image=>attachImage(image,index+1)}/>:null;
  if(s.kind==='equation'){
    const normalized=normalizeMath(s.en),formula=normalized.includes('$')?normalized:`$$${normalized}$$`;
    // A formula the renderer cannot typeset is shown as its original image rather than as an error message.
    let broken=false;if(!s.uncertain&&visual){try{katex.renderToString(formula.replace(/^\s*\$\$?|\$\$?\s*$/g,''),{displayMode:true,throwOnError:true,strict:false,trust:false,maxExpand:1000,macros:{...katexMacros}});}catch{broken=true;}}
    return <div className="paper-equation" data-block={s.id}><div className="equation-tools"><span>公式 · 保留数学表达式</span>{!s.uncertain&&<button onClick={()=>attachText(`请结合论文逐步解释公式：${s.en}`,index+1)}><MessageSquareText size={14}/>解释公式</button>}</div>{s.uncertain?visual:broken?<>{visual}<p className="visual-hint">这条公式无法可靠排版，已显示论文原图。</p></>:<><RichText>{formula}</RichText>{visual&&<Reveal title="核对公式原图" className="formula-original">{visual}</Reveal>}</>}</div>;
  }
  if(s.uncertain&&visual)return <>{visual}<p className="visual-hint">这一处字迹尚未确认，已保留原图，可框选后提问。</p></>;
  const imageBlock=s.kind==='figure'||s.kind==='table';
  return <>{imageBlock&&visual}<div data-block={s.id} className={`sentence-pair ${s.heading?"heading-pair":""} ${imageBlock?"caption-pair":""}`}>
    <div className={`sentence-zh ${!s.zh?"untranslated":""}`}><span className="language-mark">中</span><div>{s.zh?<RichText>{s.zh}</RichText>:<span>待翻译<span className="untranslated-hint"> · 点击上方翻译按钮</span></span>}</div></div>
    <div className="sentence-en"><span className="language-mark">EN</span><div><RichText>{s.en}</RichText></div><button className="sentence-help" aria-label={`解释第 ${s.id+1} 段 · 原文第 ${index+1} 页`} title="解释这段文字" onClick={()=>attachText(s.en,index+1)}><MessageSquareText size={14}/></button></div>
    {!imageBlock&&visual&&<Reveal title="核对本段公式原图" className="formula-original">{visual}</Reveal>}
  </div></>;
}

export default function ReadingPages({pages,indexes,continuous,pdf,doc,zoom,isDemo,attachText,attachImage,onOriginal,onOCR,busy}:{pages:PaperPage[];indexes:number[];continuous:boolean;pdf:boolean;doc:PDFDocumentProxy|null;zoom:number;isDemo:boolean;attachText:(text:string,page:number)=>void;attachImage:(image:string,page:number)=>void;onOriginal:(page:number)=>void;onOCR:(page:number)=>void;busy:boolean}){
  return <>{indexes.map(index=><LazySection key={index} index={index} enabled={continuous} estimate={pdf?1050:Math.max(750,pages[index].sentences.length*95)}>
    {pdf?doc?<PdfViewer doc={doc} page={index+1} zoom={zoom} onCrop={image=>attachImage(image,index+1)} onText={text=>attachText(text,index+1)}/>:<p className="page-placeholder">正在加载 PDF…</p>:<>
      <div className="source-page-label"><span>原文第 {index+1} 页</span><i/></div>
      {pages[index].needsVision?<><div className="page-recognition"><h2>原页已保留 · 正文、公式和图表</h2><p>识别会保留图表、完整段落和公式的上下标。{busy?'正在处理，请稍候。':'点击翻译，生成中英对照。'}</p><button className="btn primary" disabled={busy} onClick={()=>onOCR(index+1)}><Sparkles size={15}/>识别正文、公式和图表</button></div>{doc&&<PdfViewer doc={doc} page={index+1} zoom={100} onCrop={image=>attachImage(image,index+1)} onText={text=>attachText(text,index+1)}/>}</>:!pages[index].sentences.length?<div className="ocr-empty"><ScanLine size={28}/><h2>这一页没有可识别的正文</h2><p>原始页面仍可查看，也可以框选提问。</p><button className="btn primary" disabled={busy} onClick={()=>onOCR(index+1)}><Sparkles size={15}/>重新识别此页</button><button className="text-button" onClick={()=>onOriginal(index+1)}>查看 PDF 原文<ArrowUpRight size={14}/></button></div>:pages[index].sentences.map(s=><ContentBlock key={s.id} sentence={s} index={index} doc={doc} attachText={attachText} attachImage={attachImage}/>)}
      {!isDemo&&!pages[index].needsVision&&doc&&<Reveal title="核对这一页完整原文" className="original-page-details"><PdfViewer doc={doc} page={index+1} zoom={100} onCrop={image=>attachImage(image,index+1)} onText={text=>attachText(text,index+1)}/></Reveal>}
      {isDemo&&index===1&&<div className="attention-formula"><RichText>{"$$\\operatorname{Attention}(Q,K,V)=\\operatorname{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$"}</RichText><button className="text-button" onClick={()=>attachText("请逐步解释注意力公式 Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) V，以及每个符号。",index+1)}>解释这个公式<ArrowUpRight size={13}/></button></div>}
      <button className="original-link" onClick={()=>onOriginal(index+1)}><ScanLine size={14}/>打开这一页原文，框选图表提问<ArrowUpRight size={13}/></button>
    </>}
  </LazySection>)}</>;
}
