"use client";
import { ArrowUpRight, Check, CircleHelp, CornerUpLeft, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import RichText from "../rich-text";

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

export type ReturnPoint = { page: number; tab: "bilingual" | "pdf"; scroll: number; label: string };
/** After following a figure or equation link, a way back to where the reader was. */
export function ReturnPill({ point, onReturn, onDismiss }: { point: ReturnPoint; onReturn: () => void; onDismiss: () => void }) {
  return <div className="return-pill" role="status">
    <button onClick={onReturn}><CornerUpLeft size={14}/>返回刚才的位置 · 第 {point.page} 页</button>
    <button className="return-dismiss" aria-label="不用返回" onClick={onDismiss}><X size={13}/></button>
  </div>;
}

export type CiteCard = { number: string; text: string; x: number; y: number };
/** A reference entry shown next to the citation that was clicked. */
export function CitationCard({ card, onClose, onOpen }: { card: CiteCard; onClose: () => void; onOpen: () => void }) {
  return <div className="cite-card" role="dialog" aria-label={`参考文献 [${card.number}]`} style={{ left: card.x, top: card.y }}>
    <div className="cite-card-head"><strong>参考文献 [{card.number}]</strong><button aria-label="关闭" onClick={onClose}><X size={13}/></button></div>
    <RichText>{card.text.replace(/^\s*\[\d+\]\s*/, "")}</RichText>
    <button className="cite-open" onClick={onOpen}>在参考文献列表中查看<ArrowUpRight size={12}/></button>
  </div>;
}
