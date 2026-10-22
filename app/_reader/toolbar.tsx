"use client";
import { ArrowDownToLine, ChevronDown, FileText, Languages, LoaderCircle, Menu, MessageSquareText, Minus, PanelLeftClose, PanelLeftOpen, Plus, Sparkles, Square } from "lucide-react";
import type { Settings } from "@/lib/paper";
import type { Paper } from "./use-paper";

export default function Toolbar({ paper, settings, saveSettings, navCollapsed, onToggleNav, onOpenNav, onToggleAssistant, onExport, translation, onTranslate, onStop }: {
  paper: Paper; settings: Settings; saveSettings: (s: Settings, message?: string) => void; navCollapsed: boolean; onToggleNav: () => void; onOpenNav: () => void;
  onToggleAssistant: () => void; onExport: () => void; translation: string; onTranslate: (all: boolean, forceOCR?: boolean) => void; onStop: () => void;
}) {
  const { tab, setTab, continuous, zoom, setZoom, isDemo, loading } = paper;
  const pick = (all: boolean, forceOCR = false) => (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.closest("details")?.removeAttribute("open"); onTranslate(all, forceOCR); };
  return <>
    <div className="reader-toolbar">
      <button className="icon-btn mobile-only" aria-label="打开论文目录" onClick={onOpenNav}><Menu size={19}/></button>
      <button className="icon-btn nav-collapse" aria-pressed={navCollapsed} aria-label={navCollapsed ? "展开论文目录" : "收起论文目录"} title={navCollapsed ? "展开论文目录" : "收起目录，专注阅读"} onClick={onToggleNav}>{navCollapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button>
      <div className="segmented">
        <button className={tab === "bilingual" ? "selected" : ""} onClick={() => setTab("bilingual")}><Languages size={15}/>中英对照</button>
        <button className={tab === "pdf" ? "selected" : ""} onClick={() => setTab("pdf")}><FileText size={14}/>PDF 原文</button>
      </div>
      <div className="toolbar-right">
        <div className="segmented reading-mode-switch" aria-label="阅读模式">
          <button aria-pressed={!continuous} className={!continuous ? "selected" : ""} onClick={() => saveSettings({ ...settings, readingMode: "paged" }, "已切换翻页阅读")} title="翻页模式">翻页</button>
          <button aria-pressed={continuous} className={continuous ? "selected" : ""} onClick={() => saveSettings({ ...settings, readingMode: "scroll" }, "已切换连续滑动")} title="连续滑动模式">滑动</button>
        </div>
        <div className="zoom-controls"><button aria-label="缩小" disabled={zoom <= 75} onClick={() => setZoom(z => Math.max(75, z - 10))}><Minus size={13}/></button><span>{zoom}%</span><button aria-label="放大" disabled={zoom >= 150} onClick={() => setZoom(z => Math.min(150, z + 10))}><Plus size={13}/></button></div>
        <span className="toolbar-divider"/>
        <button className="icon-btn" onClick={onExport} title="导出中英对照" aria-label="导出中英对照"><ArrowDownToLine size={17}/></button>
        <button className="icon-btn assistant-toggle" aria-label="打开 AI 阅读助手" onClick={onToggleAssistant}><MessageSquareText size={18}/></button>
      </div>
    </div>
    <div className="document-action-bar">
      <div>{isDemo ? <span className="demo-tag">体验示例</span> : <span className="file-tag">PDF</span>}<span>{isDemo ? "上传你的论文，开启真正的阅读" : "中文在上 · 英文在下 · 图表保留"}</span></div>
      <div className="translation-actions">{translation
        ? <button className="text-button" onClick={onStop}><Square size={12}/>停止翻译</button>
        : <><button className="text-button" disabled={loading} onClick={() => onTranslate(false)}><Sparkles size={13}/>翻译当前页</button>
          <details className="translation-menu"><summary aria-label="更多翻译选项"><ChevronDown size={15}/></summary><div><button onClick={pick(true)}>翻译全文</button><button onClick={pick(false, true)}>视觉识别并翻译此页</button></div></details></>}
      </div>
    </div>
    {translation && <div className="translation-status" role="status"><LoaderCircle size={14} className="spin"/>{translation}</div>}
  </>;
}
