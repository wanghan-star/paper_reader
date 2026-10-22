"use client";
import { BookOpen, LoaderCircle, Palette, Plus, Settings2 } from "lucide-react";

export default function Header({ title, page, pageCount, loading, codexReady, onAppearance, onSettings, onUpload }: {
  title: string; page: number; pageCount: number; loading: boolean; codexReady: boolean | null;
  onAppearance: () => void; onSettings: () => void; onUpload: () => void;
}) {
  return <header className="app-header">
    <div className="brand"><div className="brand-mark"><BookOpen size={23}/><span/></div><div><strong>知页<span className="brand-en">Paperleaf</span></strong><small>让理解，多一页。</small></div></div>
    <div className="header-center" title={title}><span className="status-dot"/><span className="header-title">{title}</span><span>第 {page} / {pageCount} 页</span></div>
    <div className="header-actions">
      <button className="btn appearance-trigger" aria-label="阅读与主题设置" onClick={onAppearance}><Palette size={16}/><span>阅读设置</span></button>
      <button aria-label="Codex 设置" className="btn settings-trigger" onClick={onSettings}><Settings2 size={16}/><span>Codex 设置</span>{codexReady && <span className="connected-dot"/>}</button>
      <button className="btn primary upload-trigger" disabled={loading} onClick={onUpload}>{loading ? <LoaderCircle className="spin" size={16}/> : <Plus size={17}/>}<span>{loading ? "正在读取" : "上传论文"}</span></button>
    </div>
  </header>;
}
