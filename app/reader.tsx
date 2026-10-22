"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { colorInk } from "@/lib/reading";
import { answerPointPrompt, explainPointPrompt } from "@/lib/guide";
import SettingsDialog from "./settings-dialog";
import AppearanceDialog from "./appearance-dialog";
import ReadingPages from "./reading-pages";
import GuidePanel from "./guide-panel";
import StartupSplash from "./startup-splash";
import { useLinkedHighlight } from "./linked-highlight";
import { useSettings } from "./_reader/use-settings";
import { usePaper } from "./_reader/use-paper";
import { useTranslation } from "./_reader/use-translation";
import { useGuides } from "./_reader/use-guides";
import { useChat } from "./_reader/use-chat";
import { useLibrary } from "./_reader/use-library";
import Header from "./_reader/header";
import Sidebar from "./_reader/sidebar";
import Toolbar from "./_reader/toolbar";
import AssistantPanel from "./_reader/assistant-panel";
import { DropOverlay, LoadingBar, SelectionPopup, ToastView, type Selection, type Toast } from "./_reader/overlays";

export default function Reader() {
  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  const [settingsOpen, setSettingsOpen] = useState(false), [appearanceOpen, setAppearanceOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false), [navOpen, setNavOpen] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null), [dragging, setDragging] = useState(false);
  // Launched from the desktop icon: keep the opening animation until the last paper is back on screen.
  const [intro, setIntro] = useState<"off" | "on" | "leaving">("off"), introStart = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null), chatEnd = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null), scrollFrame = useRef(0);

  const closeSettings = useCallback(() => setSettingsOpen(false), []), closeAppearance = useCallback(() => setAppearanceOpen(false), []);
  const prefs = useSettings(notify), { settings } = prefs;
  const paper = usePaper(settings), { pages, page, tab, continuous, shown, reader } = paper;
  useLinkedHighlight(reader);
  const requireLogin = () => { if (prefs.codexReady !== false) return true; setSettingsOpen(true); notify("请先登录本机 Codex，并测试连接。", true); return false; };
  const openAssistant = () => setAssistantOpen(true);

  const guides = useGuides(paper, { model: prefs.chatModel, notify, requireLogin, openAssistant });
  const translation = useTranslation(paper, { model: settings.codexModel, notify, requireLogin, onRecognized: guides.forget });
  const chat = useChat(paper, {
    teaching: settings.teaching, modelFor: prefs.modelFor, requireLogin, openAssistant,
    onAsk: () => { guides.abort(); guides.setOpen(false); }, onGuideRequest: () => void guides.request(), focusInput: () => input.current?.focus(),
  });
  const library = useLibrary(paper, {
    notify, autoTranslate: settings.autoTranslate, translateAll: () => void translation.translate(true),
    onSwitch: () => { translation.reset(); chat.reset(); guides.abort(); },
    onShow: record => { chat.restore(record.messages); guides.restore(record.guides || {}); setSelection(null); setNavOpen(false); },
    messages: chat.messages, guides: guides.guides,
  });

  useEffect(() => {
    try {
      const url = new URL(location.href);
      if (url.searchParams.has("launch")) { introStart.current = Date.now(); setIntro("on"); url.searchParams.delete("launch"); history.replaceState(null, "", url.pathname + url.search + url.hash); }
    } catch { /* plain start */ }
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelection(null); setNavOpen(false); setAssistantOpen(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") { e.preventDefault(); setSettingsOpen(true); }
    };
    window.addEventListener("keydown", keys);
    return () => { window.removeEventListener("keydown", keys); cancelAnimationFrame(scrollFrame.current); };
  }, []);
  useEffect(() => {
    if (intro !== "on" || !library.booted || !paper.doc || paper.loading) return;
    const timer = setTimeout(() => { setIntro("leaving"); setTimeout(() => setIntro("off"), 600); }, Math.max(250, 1800 - (Date.now() - introStart.current)));
    return () => clearTimeout(timer);
  }, [intro, library.booted, paper.doc, paper.loading]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 6000); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { if (!continuous) reader.current?.scrollTo({ top: 0 }); setSelection(null); }, [page, tab, continuous, settings.readingSpan, reader]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (continuous) paper.scrollToPage(page); }, [tab, continuous]);
  useEffect(() => { if (!chat.messages.length && !chat.busy) return; chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chat.messages, chat.busy]);

  const onReadingScroll = () => {
    setSelection(null); if (!continuous || scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0; const el = reader.current; if (!el) return;
      const top = el.getBoundingClientRect().top + 90;
      const found = Array.from(el.querySelectorAll<HTMLElement>("[data-paper-page]")).find(section => { const box = section.getBoundingClientRect(); return box.top <= top && box.bottom > top; });
      if (found) paper.setPage(Number(found.dataset.paperPage));
    });
  };
  const selectText = () => {
    const selected = window.getSelection(), text = selected?.toString().trim();
    if (!text || !selected?.rangeCount || text.length < 2) { setSelection(null); return; }
    if (!reader.current?.contains(selected.anchorNode)) return;
    const rect = selected.getRangeAt(0).getBoundingClientRect();
    const anchor = selected.anchorNode instanceof Element ? selected.anchorNode : selected.anchorNode?.parentElement;
    const selectedPage = Number(anchor?.closest("[data-paper-page]")?.getAttribute("data-paper-page")) || page;
    setSelection({ page: selectedPage, text: text.slice(0, 6000), x: Math.max(90, Math.min(window.innerWidth - 110, rect.left + rect.width / 2)), y: Math.max(88, Math.min(window.innerHeight - 60, rect.bottom + 8)) });
  };
  const attachText = (text: string, sourcePage = page) => { chat.attachText(text, sourcePage); setSelection(null); };
  const exportTranslation = () => {
    const content = `# ${paper.title}\n\n` + pages.map((p, i) => `## 第 ${i + 1} 页\n\n` + p.sentences.map(s => `${s.zh || "[尚未翻译]"}\n\n${s.en}`).join("\n\n")).join("\n\n---\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = paper.filename.replace(/\.pdf$/i, "") + "-中英对照.md"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify("中英对照已导出。");
  };
  const pointSentence = (id: number, n: number) => pages[n - 1]?.sentences.find(v => v.id === id);
  const busy = !!translation.status || paper.loading;
  const pageProps = { pages, indexes: shown, continuous, doc: paper.doc, zoom: paper.zoom, isDemo: paper.isDemo, attachText, attachImage: chat.attachImage, onOriginal: paper.showOriginal, busy };
  const dark = settings.theme === "night" || (settings.theme === "custom" && colorInk(settings.background) === "#edf2eb");
  const style = { "--reading-size": `${settings.textSize}px`, "--assistant-width": `${prefs.assistantWidth}px`, ...(settings.theme === "custom" ? { "--paper": settings.background, "--ink": colorInk(settings.background) } : {}) } as CSSProperties;

  return <div className={`app-shell ${settings.compact ? "compact-reading" : ""} ${prefs.navCollapsed ? "nav-collapsed" : ""}`} data-theme={settings.theme} data-dark={dark} style={style}
    onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes("Files")) setDragging(true); }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
    onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) void library.upload(file); }}>
    <Header title={paper.title} page={page} pageCount={pages.length} loading={paper.loading} codexReady={prefs.codexReady} onAppearance={() => setAppearanceOpen(true)} onSettings={() => setSettingsOpen(true)} onUpload={() => fileInput.current?.click()}/>
    <input type="file" ref={fileInput} accept="application/pdf,.pdf" className="sr-only" aria-label="上传论文 PDF" onChange={e => { const file = e.target.files?.[0]; if (file) void library.upload(file)?.finally(() => { if (fileInput.current) fileInput.current.value = ""; }); }}/>
    <div className="workspace">
      {navOpen && <button className="panel-shade nav-shade" aria-label="关闭论文目录" onClick={() => setNavOpen(false)}/>}
      <Sidebar paper={paper} library={library} open={navOpen} onClose={() => setNavOpen(false)} codexReady={prefs.codexReady} model={settings.codexModel} onSettings={() => setSettingsOpen(true)}/>
      <main className="reader-main">
        <Toolbar paper={paper} settings={settings} saveSettings={prefs.saveSettings} navCollapsed={prefs.navCollapsed} onToggleNav={prefs.toggleNav} onOpenNav={() => setNavOpen(true)}
          onToggleAssistant={() => setAssistantOpen(v => !v)} onExport={exportTranslation} translation={translation.status} onTranslate={(all, forceOCR) => void translation.translate(all, forceOCR)} onStop={translation.stop}/>
        <div className="reader-scroll" ref={reader} onMouseUp={selectText} onTouchEnd={() => setTimeout(selectText, 100)} onScroll={onReadingScroll}>
          {tab === "bilingual" ? <article className="paper-article" style={{ fontSize: `${settings.textSize * paper.zoom / 100}px` }}>
            <div className="paper-kicker"><span>{paper.isDemo ? "PAPERLEAF READING SAMPLE" : "YOUR READING SPACE"}</span><span>{continuous ? "连续阅读" : `原文 ${shown[0] + 1}–${shown.at(-1)! + 1} 页`}</span></div>
            {(continuous || paper.groupStart === 1) && <>
              <h1 className={paper.title.length > 90 ? "long-title" : undefined}>{paper.title}</h1>
              {paper.isDemo && <p className="paper-subtitle">{paper.subtitle}</p>}
              <div className="paper-meta"><span><FileText size={12}/>{paper.isDemo ? "原创阅读示例" : "上传的论文"}</span><span>{continuous ? "逐页向下阅读" : `每个阅读页合并 ${settings.readingSpan} 页原文`}</span></div>
              <div className="paper-rule"/>
            </>}
            <ReadingPages {...pageProps} pdf={false} onOCR={n => { paper.goToPage(n); void translation.translate(false, true, n); }}/>
          </article> : <ReadingPages {...pageProps} pdf={true} onOCR={n => void translation.translate(false, true, n)}/>}
        </div>
        <footer className="reader-footer">
          <span><span className="status-dot"/> {paper.isDemo ? "示例阅读" : "文件在本机解析"}</span>
          <div className="page-controls">
            <button className="icon-btn" disabled={paper.groupStart === 1 || paper.loading} aria-label="上一页" onClick={() => paper.goToPage(Math.max(1, paper.groupStart - paper.step))}><ChevronLeft size={17}/></button>
            <label><input aria-label="当前页码" type="number" min="1" max={pages.length} value={page} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= pages.length) paper.goToPage(n); }}/><span>/ {pages.length} 原文页</span></label>
            <button className="icon-btn" disabled={paper.lastGroup || paper.loading} aria-label="下一页" onClick={() => paper.goToPage(Math.min(pages.length, paper.groupStart + paper.step))}><ChevronRight size={17}/></button>
          </div>
          <span className="footer-hint">选中文字，随时提问</span>
        </footer>
      </main>
      {assistantOpen && <button className="panel-shade assistant-shade" aria-label="关闭阅读助手" onClick={() => setAssistantOpen(false)}/>}
      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} onResize={prefs.resizeAssistant} onResetWidth={prefs.resetAssistantWidth} chat={chat} chatEnd={chatEnd}
        onTip={(next, hint) => { paper.setTab(next); notify(hint); }} onGuides={() => void guides.request(chat.busy)}
        settings={settings} saveSettings={prefs.saveSettings} models={prefs.models} loading={paper.loading} inputRef={input}
        guidePanel={<GuidePanel indexes={paper.visible} guides={guides.guides} open={guides.open} onToggle={guides.setOpen} busy={chat.busy || paper.loading} onRetry={() => void guides.request(chat.busy)}
          onLocate={(p, n) => { setAssistantOpen(false); paper.locate(n, p.id); }}
          onExplain={(p, n) => { const v = pointSentence(p.id, n); if (v) void chat.ask(explainPointPrompt(p, v), n); }}
          onAnswer={(p, n, words) => { const v = pointSentence(p.id, n); if (v) void chat.ask(answerPointPrompt(p, v, words), n); }}/>}/>
    </div>
    {selection && <SelectionPopup selection={selection} onExplain={() => attachText(selection.text, selection.page)}/>}
    {toast && <ToastView toast={toast} onClose={() => setToast(null)}/>}
    {dragging && <DropOverlay/>}
    {paper.loading && <LoadingBar/>}
    {intro !== "off" && <StartupSplash leaving={intro === "leaving"} status={library.booted ? "准备好了" : library.records.length ? "正在恢复上次的阅读…" : "正在打开阅读空间…"}/>}
    {appearanceOpen && <AppearanceDialog settings={settings} onSave={s => prefs.saveSettings(s, "阅读偏好已保存")} onClose={closeAppearance}/>}
    {settingsOpen && <SettingsDialog settings={settings} onSave={prefs.saveSettings} onStatus={prefs.setCodexReady} onClose={closeSettings}/>}
  </div>;
}
