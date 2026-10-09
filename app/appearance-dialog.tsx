"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Palette, X } from "lucide-react";
import type { Settings, Theme } from "@/lib/paper";
import { colorInk } from "@/lib/reading";
const themes:{id:Theme;name:string;color:string;ink:string}[]=[{id:"forest",name:"纸白 · 森林",color:"#fffefa",ink:"#345b48"},{id:"sepia",name:"暖杏 · 护眼",color:"#faf0de",ink:"#805b38"},{id:"mist",name:"雾蓝 · 清晨",color:"#eef4fa",ink:"#395e80"},{id:"night",name:"深夜 · 暗色",color:"#202723",ink:"#c1d4ba"}];
export default function AppearanceDialog({settings,onSave,onClose}:{settings:Settings;onSave:(s:Settings)=>void;onClose:()=>void}){
  const [draft,setDraft]=useState(settings);const modal=useRef<HTMLDivElement>(null);
  useEffect(()=>{const prev=document.activeElement as HTMLElement;modal.current?.querySelector<HTMLButtonElement>("button")?.focus();const fn=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();if(e.key==="Tab"){const list=modal.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select');if(!list?.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener("keydown",fn);return()=>{document.removeEventListener("keydown",fn);prev?.focus();};},[onClose]);
  const selected=themes.find(t=>t.id===draft.theme);const preview=draft.theme==="custom"?draft.background:selected?.color||"#fffefa";
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="settings-modal appearance-modal" role="dialog" aria-modal="true" aria-labelledby="appearance-title" ref={modal}>
    <div className="modal-title"><div className="modal-symbol"><Palette size={22}/></div><button className="icon-btn" aria-label="关闭阅读设置" onClick={onClose}><X size={20}/></button></div>
    <h2 id="appearance-title">让阅读，更合你的心意</h2><p className="modal-intro">喜欢的背景，适合的节奏。下次打开也会记得。</p>
    <span className="field-label">背景主题</span><div className="theme-options">{themes.map(t=><button key={t.id} type="button" aria-pressed={draft.theme===t.id} className={draft.theme===t.id?"active":""} onClick={()=>setDraft(p=>({...p,theme:t.id}))}><span style={{background:t.color,color:t.ink}}>Aa{draft.theme===t.id&&<Check size={15}/>}</span><small>{t.name}</small></button>)}</div>
    <div className="custom-background"><label htmlFor="custom-color">自定义纸张颜色</label><input id="custom-color" type="color" value={draft.background} onChange={e=>setDraft(p=>({...p,theme:"custom",background:e.target.value}))}/><span>{draft.theme==="custom"?draft.background:"点击色块选择"}</span></div>
    <div className="theme-preview" style={{background:preview,color:draft.theme==="custom"?colorInk(preview):selected?.ink}}><span>READ AT YOUR OWN PACE</span><strong>每一个疑问，都值得停留。</strong><p>Every question is worth a pause.</p></div>
    <div className="model-fields"><div><label className="field-label" htmlFor="reading-mode">阅读方式</label><select id="reading-mode" value={draft.readingMode} onChange={e=>setDraft(p=>({...p,readingMode:e.target.value as Settings["readingMode"]}))}><option value="paged">翻页阅读</option><option value="scroll">连续滑动</option></select></div><div><label className="field-label" htmlFor="reading-span">每个阅读页的内容量</label><select id="reading-span" value={draft.readingSpan} onChange={e=>setDraft(p=>({...p,readingSpan:Number(e.target.value)}))}>{[1,2,3,4].map(n=><option value={n} key={n}>{n} 页 PDF 原文{n===2?" · 推荐":""}</option>)}</select></div></div>
    <label className="field-label" htmlFor="reading-font">阅读字号</label><select id="reading-font" value={draft.textSize} onChange={e=>setDraft(p=>({...p,textSize:Number(e.target.value)}))}>{[14,16,18,20,22,24].map(n=><option key={n} value={n}>{n} px{n===18?" · 舒适默认":""}</option>)}</select>
    <p className="field-hint">翻页模式会合并以上数量的原文页；连续滑动可直接往下阅读整篇论文。PDF 原文仍保留原始页码。</p>
    <label className="check-label auto-translate"><input type="checkbox" checked={draft.compact} onChange={e=>setDraft(p=>({...p,compact:e.target.checked}))}/><span>紧凑排版，多读一些<small>减少段间空白和行距，仍保留逐句中英对照。</small></span></label>
    <div className="modal-footer"><button className="btn secondary" onClick={onClose}>取消</button><button className="btn primary" onClick={()=>{onSave(draft);onClose();}}>保存阅读偏好<Check size={15}/></button></div>
  </div></div>;
}
