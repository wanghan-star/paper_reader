"use client";
import { useState } from "react";
import { Check, ChevronRight, FileText, HardDrive, History, Leaf, Trash2, X } from "lucide-react";
import { formatBytes } from "@/lib/records";
import { pageLabel } from "@/lib/paper";
import type { GlossaryEntry } from "@/lib/glossary";
import GlossaryList from "./glossary-list";
import type { GlossaryState } from "./use-glossary";
import type { Paper } from "./use-paper";
import type { Library } from "./use-library";

export default function Sidebar({ paper, library, glossary, busy, onTerm, onAskTerm, onManage, open, onClose, codexReady, model, onSettings }: {
  paper: Paper; library: Library; glossary: GlossaryState; busy: boolean; onTerm: (entry: GlossaryEntry) => void; onAskTerm: (entry: GlossaryEntry) => void; onManage: () => void;
  open: boolean; onClose: () => void; codexReady: boolean | null; model: string; onSettings: () => void;
}) {
  const [view, setView] = useState<"pages" | "terms">("pages");
  const { pages, page, isDemo, filename, progress, loading } = paper, { records, recordId, saveState } = library;
  const saveNote = isDemo ? "示例已预置译文，可直接体验" : !recordId ? "记录服务未连接，刷新后不会保留" : saveState === "failed" ? "保存失败，稍后会再试" : saveState === "saving" ? "正在保存译文和对话…" : "译文和对话已自动保存";
  return <aside className={`sidebar ${open ? "open" : ""}`}>
    <div className="sidebar-top"><span className="eyebrow">我的阅读</span><button className="icon-btn mobile-only" onClick={onClose} aria-label="关闭目录"><X size={17}/></button></div>
    <div className="document-card"><div className="document-icon"><FileText size={19}/></div><div><strong title={filename}>{filename.replace(/\.pdf$/i, "")}</strong><span>{pages.length} 页 <i/> {isDemo ? "示例论文" : "PDF 文档"}</span></div></div>
    {records.length > 0 && <details className="recent-records">
      <summary><History size={14}/>最近阅读<span>{records.length}</span></summary>
      <ul>{records.slice(0, 30).map(r => <li key={r.id} className={r.id === recordId ? "active" : ""}>
        <button className="recent-open" disabled={loading || r.id === recordId} onClick={() => void library.openRecord(r.id)} title={r.title}><strong>{r.title}</strong><small>{r.pageCount} 页 · 译 {r.total ? Math.round(r.translated / r.total * 100) : 0}%{r.messages ? ` · ${r.messages} 条对话` : ""}</small></button>
        <button className="recent-delete" aria-label={`删除《${r.title}》的阅读记录`} title="删除这条记录" onClick={() => void library.removeRecord(r)}><Trash2 size={13}/></button>
      </li>)}</ul>
      <button className="recent-manage" onClick={onManage}><HardDrive size={13}/>管理空间 · 共 {formatBytes(records.reduce((n, r) => n + (r.pdfBytes || 0) + (r.dataBytes || 0), 0))}</button>
    </details>}
    <div className="sidebar-tabs segmented" role="tablist" aria-label="目录与术语">
      <button role="tab" aria-selected={view === "pages"} className={view === "pages" ? "selected" : ""} onClick={() => setView("pages")}>论文目录<span>{pages.length}</span></button>
      <button role="tab" aria-selected={view === "terms"} className={view === "terms" ? "selected" : ""} onClick={() => setView("terms")}>术语表{glossary.glossary.entries.length > 0 && <span>{glossary.glossary.entries.length}</span>}</button>
    </div>
    {view === "terms" ? <GlossaryList glossary={glossary.glossary} busy={busy || paper.isDemo} onGenerate={() => void glossary.generate()} onJump={entry => { onTerm(entry); onClose(); }} onAsk={onAskTerm}/> : <nav className="page-nav" aria-label="论文页面">{pages.map((p, index) => <button key={index} className={page === index + 1 ? "active" : ""} onClick={() => { paper.goToPage(index + 1); onClose(); }} aria-current={page === index + 1 ? "page" : undefined}>
      <span className="page-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="page-heading" title={pageLabel(p, index)}>{pageLabel(p, index)}</span>
      {p.sentences.length > 0 && p.sentences.every(s => s.zh) ? <Check size={12}/> : <span className="page-number">{index + 1}</span>}
    </button>)}</nav>}
    <div className="reading-progress"><div><span>翻译进度</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div><small>{saveNote}</small></div>
    <div className="sidebar-bottom">
      <div className="reading-tip"><Leaf size={19}/><p>不必一次读懂。<br/>每一个疑问，都值得停留。</p></div>
      <button onClick={onSettings} className="model-status"><span className={`status-dot ${codexReady ? "on" : ""}`}/><div><span>{codexReady ? "本地 Codex" : "连接 Codex"}</span><small>{model}</small></div><ChevronRight size={14}/></button>
    </div>
  </aside>;
}
