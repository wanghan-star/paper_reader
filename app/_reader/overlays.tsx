"use client";
import { ArrowUpRight, Check, CircleHelp, LoaderCircle, Sparkles, Upload, X } from "lucide-react";

export type Toast = { message: string; error?: boolean };
export type Selection = { text: string; x: number; y: number; page: number };

export function SelectionPopup({ selection, onExplain }: { selection: Selection; onExplain: () => void }) {
  return <div className="selection-popup" style={{ left: selection.x, top: selection.y }}>
    <button onMouseDown={e => e.preventDefault()} onClick={onExplain}><Sparkles size={14}/>解释这段<ArrowUpRight size={13}/></button>
  </div>;
}

export function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return <div className={`toast ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"}>
    {toast.error ? <CircleHelp size={17}/> : <Check size={17}/>}<span>{toast.message}</span><button onClick={onClose} aria-label="关闭提示"><X size={14}/></button>
  </div>;
}

export const DropOverlay = () => <div className="drop-overlay"><div><Upload size={40}/><h2>把论文放在这里</h2><p>PDF · 文字版或扫描版 · 最大 60 MB</p></div></div>;
export const LoadingBar = () => <div className="loading-bar" role="status">正在读取论文并识别页面<LoaderCircle size={14} className="spin"/></div>;
