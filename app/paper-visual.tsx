"use client";
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import type {PageBox} from '@/lib/page-content';
import {pageCanvas,regionCanvas} from '@/lib/pdf-render';
import {Expand,LoaderCircle,ScanLine,Sparkles,X} from 'lucide-react';

export default function PaperVisual({doc,page,box,label,onExplain}:{doc:PDFDocumentProxy;page:number;box:PageBox;label:string;onExplain:(image:string)=>void}){
  const [image,setImage]=useState(''),[error,setError]=useState(false),[crop,setCrop]=useState(false);
  const [rect,setRect]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  const original=useRef<HTMLCanvasElement|null>(null),start=useRef<{x:number;y:number}|null>(null),dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    let alive=true;setImage('');setError(false);setRect(null);setCrop(false);
    pageCanvas(doc,page).then(source=>{if(!alive)return;const canvas=regionCanvas(source,box);original.current=canvas;setImage(canvas.toDataURL('image/png'));}).catch(()=>{if(alive)setError(true);});
    return()=>{alive=false;original.current=null;};
  },[doc,page,box.x,box.y,box.width,box.height]);
  const point=(e:React.PointerEvent)=>{const r=e.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(r.width,e.clientX-r.left)),y:Math.max(0,Math.min(r.height,e.clientY-r.top))};};
  const finish=(e:React.PointerEvent)=>{
    const from=start.current;start.current=null;if(!from||!original.current)return;
    const to=point(e),bounds=e.currentTarget.getBoundingClientRect();
    const selected={x:Math.min(from.x,to.x),y:Math.min(from.y,to.y),width:Math.abs(to.x-from.x),height:Math.abs(to.y-from.y)};
    if(selected.width<10||selected.height<10){setRect(null);return;}
    const canvas=regionCanvas(original.current,{x:selected.x/bounds.width*1000,y:selected.y/bounds.height*1000,width:selected.width/bounds.width*1000,height:selected.height/bounds.height*1000});
    setRect(selected);onExplain(canvas.toDataURL('image/png'));
  };
  return <figure className="paper-visual" aria-label={`${label} · 原文第 ${page} 页`}>
    <div className="visual-label"><span>{label}</span><small>原文第 {page} 页</small></div>
    <div className="visual-image">
      {image?<img src={image} alt={`${label}，保留原始图像、公式和图内标签`} draggable={false}/>:<div className="visual-loading">{error?'原图加载失败，请查看 PDF 原文':<><LoaderCircle size={17} className="spin"/>正在保留原图…</>}</div>}
      {crop&&image&&<div className="crop-layer" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);start.current=point(e);setRect({...start.current,width:0,height:0});}} onPointerMove={e=>{if(start.current){const p=point(e);setRect({x:Math.min(p.x,start.current.x),y:Math.min(p.y,start.current.y),width:Math.abs(p.x-start.current.x),height:Math.abs(p.y-start.current.y)});}}} onPointerUp={finish} onPointerCancel={()=>{start.current=null;setRect(null);}}>{rect&&<div className="crop-box" style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height}}/>}</div>}
    </div>
    <div className="visual-tools"><button disabled={!image} onClick={()=>onExplain(image)}><Sparkles size={14}/>解释{label.includes('公式')?'公式':'这张图'}</button><button disabled={!image} aria-pressed={crop} onClick={()=>{setCrop(v=>!v);setRect(null);}}><ScanLine size={14}/>{crop?'取消框选':'框选细节'}</button><button disabled={!image} onClick={()=>dialog.current?.showModal()}><Expand size={14}/>放大原图</button></div>
    {crop&&<p className="visual-hint">在图片上拖动框选，选中的区域会进入阅读助手。</p>}
    <dialog ref={dialog} className="visual-dialog" onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close();}}><div><button className="icon-btn" aria-label="关闭放大原图" onClick={()=>dialog.current?.close()}><X size={22}/></button><p>{label} · 原文第 {page} 页</p>{image&&<img src={image} alt={`${label}放大原图`}/>}</div></dialog>
  </figure>;
}
