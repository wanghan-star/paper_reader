"use client";
import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import type { Settings } from "@/lib/paper";
import { callCodex } from "@/lib/codex-client";
type Model={id:string;name:string;image:boolean;isDefault?:boolean};
export default function SettingsDialog({settings,onSave,onClose,onStatus}:{settings:Settings;onSave:(s:Settings)=>void;onClose:()=>void;onStatus:(ready:boolean)=>void}){
  const [draft,setDraft]=useState(settings),[testing,setTesting]=useState(false),[status,setStatus]=useState(""),[good,setGood]=useState(false);
  const [localStatus,setLocalStatus]=useState("正在检查本机 Codex…"),[models,setModels]=useState<Model[]>([]),[modelsLoading,setModelsLoading]=useState(false),[modelsError,setModelsError]=useState("");
  const modal=useRef<HTMLDivElement>(null),controller=useRef<AbortController|null>(null);
  const loadModels=async(refresh=false)=>{setModelsLoading(true);setModelsError("");try{const r=await fetch(`/api/codex/models${refresh?"?refresh=1":""}`,{signal:AbortSignal.timeout(25000)});const data=await r.json() as {models?:Model[];error?:string};if(!r.ok||!data.models?.length)throw new Error(data.error||"请从桌面启动知页后刷新模型列表。");setModels(data.models);const supported=data.models.filter(m=>m.image);setDraft(d=>supported.some(m=>m.id===d.codexModel)?d:{...d,codexModel:(supported.find(m=>m.isDefault)||supported[0])?.id||d.codexModel});}catch(e){setModelsError((e as Error).message||"模型列表加载失败，请刷新。");}finally{setModelsLoading(false);}};
  const [detecting,setDetecting]=useState(false);
  const detect=async()=>{setDetecting(true);setLocalStatus("正在重新检测这台电脑的 Codex…");try{const r=await fetch("/api/codex/status?refresh=1",{signal:AbortSignal.timeout(25000)});const data=await r.json() as {available:boolean;message:string};if(!r.ok)throw new Error();setLocalStatus(data.message);onStatus(data.available);if(data.available)await loadModels(true);}catch{setLocalStatus("请从桌面快捷方式启动知页，以连接本地 Codex。");onStatus(false);}finally{setDetecting(false);}};
  useEffect(()=>{void detect();},[]);
  useEffect(()=>{const prev=document.activeElement as HTMLElement;modal.current?.querySelector<HTMLButtonElement>("button")?.focus();const fn=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();if(e.key==="Tab"){const list=modal.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select');if(!list?.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener("keydown",fn);return()=>{controller.current?.abort();document.removeEventListener("keydown",fn);prev?.focus();};},[onClose]);
  const update=(value:Partial<Settings>)=>{setDraft(p=>({...p,...value}));setStatus("");};
  const test=async()=>{setTesting(true);setStatus("");controller.current=new AbortController();try{await callCodex("test",{},draft.codexModel,controller.current.signal);setGood(true);setStatus("连接成功，可以开始阅读了。");}catch(e){if((e as Error).name!=="AbortError"){setGood(false);setStatus((e as Error).message||"连接失败，请检查本机登录和网络。");}}finally{setTesting(false);}};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="settings-modal" ref={modal} role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div className="modal-title"><div className="modal-symbol"><SlidersHorizontal size={22}/></div><button className="icon-btn" aria-label="关闭设置" onClick={onClose}><X size={20}/></button></div>
    <h2 id="settings-title">让 Codex 陪你读论文</h2><p className="modal-intro">使用这台电脑已登录的 Codex，直接开始阅读。</p>
    <div className="codex-note"><span className="codex-symbol">✦</span><div><strong>本地 Codex</strong><p>{localStatus}</p><button className="text-button" disabled={detecting||testing} onClick={()=>void detect()}>{detecting?"检测中…":"重新检测本机"}</button></div></div>
    <label className="field-label" htmlFor="codex-model">选择模型<button type="button" className="model-refresh" onClick={()=>void loadModels(true)} disabled={modelsLoading}>{modelsLoading?"加载中…":"刷新列表"}</button></label><select id="codex-model" value={draft.codexModel} disabled={modelsLoading||testing} onChange={e=>update({codexModel:e.target.value})}>{!models.some(m=>m.id===draft.codexModel)&&<option value={draft.codexModel}>{draft.codexModel} · 当前设置</option>}{models.map(m=><option key={m.id} value={m.id} disabled={!m.image}>{m.name}{m.image?"":" · 不支持图片"}</option>)}</select><p className="field-hint">模型列表由本机 Codex 提供，用于翻译、解释文字和识别图片。</p>{modelsError&&<p className="error-inline" role="status">{modelsError}</p>}
    <label className="check-label auto-translate"><input type="checkbox" checked={draft.autoTranslate} onChange={e=>update({autoTranslate:e.target.checked})}/><span>上传后自动翻译全文<small>逐页返回中文与英文，可以随时停止。</small></span></label>
    <label className="check-label auto-translate"><input type="checkbox" checked={draft.teaching} onChange={e=>update({teaching:e.target.checked})}/><span>教学模式：动图讲解 + 理解检查<small>解释概念时展示动态示意，再问一个问题检查你的理解。</small></span></label>
    <p className="field-hint">网页使用独立的本地 Codex 会话，回答直接显示在知页，使用已登录账户的额度。</p>
    <div className="privacy-note"><ShieldCheck size={17}/><p>PDF 在本机解析，所需文字和截图发送给 Codex。临时截图处理后清理，任务结果在本地内存中保留最多 30 分钟。</p></div>
    {status&&<p role="status" className={good?"connection-good":"error-inline"}>{good&&<Check size={14}/>} {status}</p>}
    <div className="modal-footer"><button className="btn secondary" onClick={()=>void test()} disabled={testing||!draft.codexModel}>{testing?<LoaderCircle size={15} className="spin"/>:<Sparkles size={15}/>}测试连接</button><button className="btn primary" disabled={testing||!draft.codexModel} onClick={()=>{onSave(draft);onClose();}}>保存设置<Check size={15}/></button></div>
  </div></div>;
}
