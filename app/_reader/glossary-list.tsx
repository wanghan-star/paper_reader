"use client";
import { useMemo, useState } from "react";
import { BookMarked, LoaderCircle, MessageSquareText, RefreshCw, Search, Sparkles } from "lucide-react";
import RichText from "../rich-text";
import type { Glossary, GlossaryEntry } from "@/lib/glossary";

export default function GlossaryList({ glossary, busy, onGenerate, onJump, onAsk }: {
  glossary: Glossary; busy: boolean; onGenerate: () => void; onJump: (entry: GlossaryEntry) => void; onAsk: (entry: GlossaryEntry) => void;
}) {
  const [query, setQuery] = useState(""), [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? glossary.entries.filter(e => `${e.term} ${e.zh} ${e.definition}`.toLowerCase().includes(q)) : glossary.entries;
  }, [glossary.entries, query]);

  if (glossary.status === "loading" && !glossary.entries.length) return <div className="glossary-empty"><LoaderCircle size={18} className="spin"/><p>AI 正在通读全文，整理术语和缩写…</p></div>;
  if (!glossary.entries.length) return <div className="glossary-empty">
    <BookMarked size={22}/>
    <p>{glossary.status === "failed" ? "上次没有生成成功，可以再试一次。" : "把这篇论文的缩写和关键术语整理成表：中文译名、一句话解释、首次出现的位置。"}</p>
    <button className="glossary-generate" disabled={busy} onClick={onGenerate}><Sparkles size={14}/>生成术语表</button>
    <small>生成后，正文里的术语会带虚线，悬停即可查看；之后翻译的页面会统一使用这些译名。</small>
  </div>;
  return <div className="glossary">
    <div className="glossary-search"><Search size={13}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`在 ${glossary.entries.length} 个术语中查找`} aria-label="查找术语"/>
      <button title="重新整理术语表" aria-label="重新整理术语表" disabled={busy || glossary.status === "loading"} onClick={onGenerate}>{glossary.status === "loading" ? <LoaderCircle size={13} className="spin"/> : <RefreshCw size={13}/>}</button>
    </div>
    <ul>{shown.map(entry => <li key={entry.term} className={open === entry.term ? "open" : ""}>
      <button className="glossary-term" aria-expanded={open === entry.term} onClick={() => setOpen(open === entry.term ? null : entry.term)}>
        <strong><RichText>{entry.term}</RichText></strong><span>{entry.zh}</span>
      </button>
      {open === entry.term && <div className="glossary-detail">
        {entry.definition && <RichText>{entry.definition}</RichText>}
        <div><button onClick={() => onJump(entry)}>首次出现 · 第 {entry.page} 页</button><button disabled={busy} onClick={() => onAsk(entry)}><MessageSquareText size={12}/>让 AI 讲讲</button></div>
      </div>}
    </li>)}
    {!shown.length && <li className="glossary-none">没有匹配“{query}”的术语</li>}</ul>
  </div>;
}
