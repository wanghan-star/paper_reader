"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { LoaderCircle, ScanLine, MousePointer2, X } from "lucide-react";

export default function PdfViewer({doc,page,onCrop,onText,zoom}: {doc:PDFDocumentProxy;page:number;zoom:number;onCrop:(image:string)=>void;onText:(text:string)=>void}) {
  const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),layer=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(600),[loading,setLoading]=useState(true),[error,setError]=useState(""),[crop,setCrop]=useState(false);
  const [rect,setRect]=useState<{x:number;y:number;w:number;h:number}|null>(null);
  const start=useRef<{x:number;y:number}|null>(null);
  useEffect(()=>{const el=host.current;if(!el)return;const ob=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));ob.observe(el);return()=>ob.disconnect();},[]);
  useEffect(()=>{
    let disposed=false;let task:{cancel:()=>void}|undefined;let textTask:{cancel:()=>void}|undefined;
    setLoading(true);setError("");setRect(null);
    (async()=>{
      const pdfPage=await doc.getPage(page);if(disposed)return;
      const v=pdfPage.getViewport({scale:1});const cssScale=width/v.width*(zoom/100);
      const viewport=pdfPage.getViewport({scale:cssScale});const ratio=Math.min(window.devicePixelRatio||1,2);
      const el=canvas.current, textEl=layer.current;if(!el||!textEl)return;
      el.width=Math.round(viewport.width*ratio);el.height=Math.round(viewport.height*ratio);el.style.width=`${viewport.width}px`;el.style.height=`${viewport.height}px`;
      const context=el.getContext("2d");if(!context)throw new Error("浏览器无法绘制 PDF。");
      task=pdfPage.render({canvas:el,canvasContext:context,viewport,transform:[ratio,0,0,ratio,0,0]});
      await (task as unknown as {promise:Promise<void>}).promise;if(disposed)return;
      textEl.replaceChildren();textEl.style.width=`${viewport.width}px`;textEl.style.height=`${viewport.height}px`;textEl.style.setProperty("--scale-factor",String(cssScale));textEl.style.setProperty("--total-scale-factor",String(cssScale));
      const {TextLayer}=await import("pdfjs-dist");if(disposed)return;
      textTask=new TextLayer({textContentSource:await pdfPage.getTextContent(),container:textEl,viewport});
      await (textTask as unknown as {render:()=>Promise<void>}).render();if(!disposed)setLoading(false);
    })().catch(e=>{if(!disposed && e.name!=="RenderingCancelledException"){setError("PDF 页面渲染失败，请切换页面后重试。");setLoading(false);}});
    return()=>{disposed=true;task?.cancel();textTask?.cancel();};
  },[doc,page,width,zoom]);
  const point=(e:React.PointerEvent)=>{const bounds=e.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(bounds.width,e.clientX-bounds.left)),y:Math.max(0,Math.min(bounds.height,e.clientY-bounds.top))};};
  const finish=(e:React.PointerEvent)=>{
    if(!start.current)return;const p=point(e);const r={x:Math.min(p.x,start.current.x),y:Math.min(p.y,start.current.y),w:Math.abs(p.x-start.current.x),h:Math.abs(p.y-start.current.y)};start.current=null;
    if(r.w<12||r.h<12){setRect(null);return;}
    const original=canvas.current;if(!original)return;const scale=original.width/original.getBoundingClientRect().width;
    const result=document.createElement("canvas");const ratio=Math.min(1,1500/Math.max(r.w*scale,r.h*scale));result.width=Math.round(r.w*scale*ratio);result.height=Math.round(r.h*scale*ratio);
    result.getContext("2d")?.drawImage(original,r.x*scale,r.y*scale,r.w*scale,r.h*scale,0,0,result.width,result.height);
    setRect(r);onCrop(result.toDataURL("image/jpeg",.9));
  };
  return <div className="pdf-viewer" ref={host}>
    <div className="pdf-tools"><div className="segmented compact"><button className={!crop?"selected":""} onClick={()=>{setCrop(false);setRect(null);}}><MousePointer2 size={14}/> 选中文字</button><button className={crop?"selected":""} onClick={()=>setCrop(true)}><ScanLine size={14}/> 框选图表</button></div><span>{crop?"按住并拖动，圈出想了解的部分":"选中原文后，点击浮动的解释按钮"}</span></div>
    <div className="pdf-scroll"><div className="pdf-sheet" style={{width:width*(zoom/100)}}>
      <canvas ref={canvas}/><div ref={layer} className="textLayer" style={{pointerEvents:crop?"none":"auto"}}/>
      {crop && <div className="crop-layer" onPointerDown={e=>{if(loading)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);start.current=point(e);setRect({...start.current,w:0,h:0});}} onPointerMove={e=>{if(start.current){const p=point(e);setRect({x:Math.min(p.x,start.current.x),y:Math.min(p.y,start.current.y),w:Math.abs(p.x-start.current.x),h:Math.abs(p.y-start.current.y)});}}} onPointerUp={finish} onPointerCancel={()=>{start.current=null;setRect(null);}}>{rect&&<div className="crop-box" style={{left:rect.x,top:rect.y,width:rect.w,height:rect.h}}><span>选中区域</span></div>}</div>}
      {loading&&<div className="pdf-loading"><LoaderCircle size={22} className="spin"/> 正在渲染页面</div>}
    </div></div>
    {rect&&<button className="crop-clear" onClick={()=>setRect(null)}><X size={13}/>清除框选</button>}
    {error&&<p className="error-inline" role="alert">{error}</p>}
  </div>;
}

