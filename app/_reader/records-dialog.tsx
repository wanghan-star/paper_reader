"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, HardDrive, Trash2, X } from "lucide-react";
import { formatBytes, type RecordSummary } from "@/lib/records";

const when = (t: number) => {
  const days = Math.floor((Date.now() - t) / 86400000);
  return days < 1 ? "今天" : days < 2 ? "昨天" : days < 30 ? `${days} 天前` : new Date(t).toLocaleDateString("zh-CN");
};

/** Where reading records take space, and freeing it: PDF copies alone, or whole records. */
export default function RecordsDialog({ records, currentId, folder, onClose, onRelease, onRemove, onReveal, onOpen }: {
  records: RecordSummary[]; currentId: string | null; folder: string; onClose: () => void;
  onRelease: (ids: string[]) => Promise<void>; onRemove: (ids: string[]) => Promise<void>; onReveal: () => void; onOpen: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set()), [sort, setSort] = useState<"size" | "recent">("size"), [working, setWorking] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; modal.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keys = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", keys); return () => { document.removeEventListener("keydown", keys); previous?.focus(); };
  }, [onClose]);
  const rows = useMemo(() => [...records].sort((a, b) => sort === "size" ? (b.pdfBytes || 0) + (b.dataBytes || 0) - (a.pdfBytes || 0) - (a.dataBytes || 0) : b.updated - a.updated), [records, sort]);
  const totals = records.reduce((t, r) => ({ pdf: t.pdf + (r.pdfBytes || 0), data: t.data + (r.dataBytes || 0) }), { pdf: 0, data: 0 });
  const chosen = rows.filter(r => selected.has(r.id)), freeable = chosen.reduce((n, r) => n + (r.id === currentId ? 0 : r.pdfBytes || 0), 0);
  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const run = async (work: () => Promise<void>) => { setWorking(true); try { await work(); setSelected(new Set()); } finally { setWorking(false); } };

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="settings-modal records-modal" role="dialog" aria-modal="true" aria-labelledby="records-title" ref={modal}>
      <div className="modal-title"><div className="modal-symbol"><HardDrive size={22}/></div><button className="icon-btn" aria-label="关闭阅读记录管理" onClick={onClose}><X size={20}/></button></div>
      <h2 id="records-title">阅读记录占用的空间</h2>
      <p className="modal-intro">共 {records.length} 篇，占用 {formatBytes(totals.pdf + totals.data)}：PDF 副本 {formatBytes(totals.pdf)}，译文与对话 {formatBytes(totals.data)}。释放 PDF 副本会保留译文和对话，以后重新上传同一份 PDF 即可恢复。</p>
      <div className="records-toolbar">
        <div className="segmented compact"><button className={sort === "size" ? "selected" : ""} onClick={() => setSort("size")}>按大小</button><button className={sort === "recent" ? "selected" : ""} onClick={() => setSort("recent")}>按最近使用</button></div>
        <button className="text-button" onClick={onReveal} title={folder}><FolderOpen size={14}/>打开所在文件夹</button>
      </div>
      <ul className="records-list">{rows.map(r => <li key={r.id} className={selected.has(r.id) ? "selected" : ""}>
        <label><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`选择《${r.title}》`}/>
          <span className="records-name"><strong title={r.title}>{r.title}</strong><small>{r.pageCount} 页 · 译 {r.total ? Math.round(r.translated / r.total * 100) : 0}%{r.messages ? ` · ${r.messages} 条对话` : ""}{r.terms ? ` · ${r.terms} 个术语` : ""} · {when(r.updated)}{r.id === currentId ? " · 正在阅读" : ""}</small></span>
        </label>
        <span className="records-size">{r.pdfBytes ? <>{formatBytes(r.pdfBytes)}<small>PDF</small></> : <small className="released">PDF 已释放</small>}</span>
        <span className="records-size">{formatBytes(r.dataBytes)}<small>记录</small></span>
        <button className="text-button" disabled={r.id === currentId || !r.pdfBytes} onClick={() => { onOpen(r.id); onClose(); }}>打开</button>
      </li>)}</ul>
      <div className="modal-footer records-footer">
        <span>{chosen.length ? `已选 ${chosen.length} 篇` : "勾选要处理的记录"}</span>
        <button className="btn secondary" disabled={working || !freeable} onClick={() => void run(() => onRelease(chosen.map(r => r.id)))}>释放 PDF 副本{freeable ? `（${formatBytes(freeable)}）` : ""}</button>
        <button className="btn danger" disabled={working || !chosen.length} onClick={() => { if (window.confirm(`永久删除这 ${chosen.length} 篇论文的阅读记录？\n译文、对话、术语表和 PDF 副本都会被删除，无法恢复。`)) void run(() => onRemove(chosen.map(r => r.id))); }}><Trash2 size={14}/>删除记录</button>
      </div>
    </div>
  </div>;
}
