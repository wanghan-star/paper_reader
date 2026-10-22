"use client";
import type { ReactNode, RefObject } from "react";
import { ArrowUp, ArrowUpRight, BookOpen, ChevronDown, Languages, Plus, ScanLine, Sparkles, Square, X } from "lucide-react";
import RichText from "../rich-text";
import LessonView from "../lesson-view";
import type { Settings } from "@/lib/paper";
import type { CodexModel } from "./use-settings";
import type { Chat } from "./use-chat";

const STARTERS = ["用通俗语言解释这一页", "这一页的核心概念是什么？", "帮我梳理这里的推理过程"];

function Welcome({ chat, onTip, onGuides }: { chat: Chat; onTip: (tab: "pdf" | "bilingual", hint: string) => void; onGuides: () => void }) {
  return <div className="assistant-welcome">
    <div className="assistant-art"><div className="art-orbit"/><BookOpen size={34}/><span><Sparkles size={14}/></span></div>
    <h2>一起，把论文读明白。</h2>
    <p>复杂的概念，陌生的公式，<br/>或是一张看不懂的图。<br/>把疑问交给我。</p>
    <div className="assistant-tips">
      <button onClick={() => onTip("pdf", "点击“框选图表”，在原文上按住并拖动即可。")}><span className="tip-icon"><ScanLine size={16}/></span><div><strong>圈起图表，读懂细节</strong><small>在 PDF 原文上拖动框选</small></div><ArrowUpRight size={13}/></button>
      <button onClick={() => onTip("bilingual", "拖动选中文字后点击“解释这段”，或点击句子旁的提问图标。")}><span className="tip-icon"><Languages size={16}/></span><div><strong>选中文字，拆解难点</strong><small>术语、句子和公式都可以问</small></div><ArrowUpRight size={13}/></button>
    </div>
    <span className="suggestions-label">可以从这些问题开始</span>
    <div className="suggestions">
      <button onClick={chat.askRoute}>先给我这篇论文的阅读路线<Plus size={13}/></button>
      <button onClick={onGuides}>找出这一页的难点，考考我<Plus size={13}/></button>
      {STARTERS.map(q => <button key={q} onClick={() => void chat.ask(q)}>{q}<Plus size={13}/></button>)}
    </div>
  </div>;
}

function Messages({ chat, onPage }: { chat: Chat; onPage: (page: number) => void }) {
  return <div className="messages">
    {chat.messages.map(m => <div key={m.id} className={`message ${m.role} ${m.error ? "failed" : ""}`}>
      <div className="message-label">{m.role === "assistant" ? <><Sparkles size={12}/>Codex · 知页</> : <>你</>}<span>第 {m.page} 页</span></div>
      {m.image && <img src={m.image} alt={`第 ${m.page} 页圈选区域`}/>}
      <div className="message-content"><RichText streaming={m.streaming} onPage={m.role === "assistant" ? onPage : undefined}>{m.content}</RichText></div>
      {m.role === "assistant" && m.sources && m.sources.length > 0 && <div className="message-sources"><span>也参考了全文</span>{m.sources.map(n => <button key={n} onClick={() => onPage(n)}>第 {n} 页</button>)}</div>}
      {m.visual && !m.lesson && <LessonView preview previewNote={m.instant ? "即时演示预览 · Codex 正在结合论文补充讲解…" : undefined} lesson={{ visual: m.visual }} busy={chat.busy} onAsk={q => void chat.ask(q, m.page)}/>}
      {m.lesson && (m.lesson.visual || m.lesson.quiz) && <LessonView lesson={m.lesson} busy={chat.busy} onAsk={q => void chat.ask(q, m.page)}/>}
    </div>)}
    {chat.followUps.length > 0 && <div className="follow-ups" aria-label="继续追问">{chat.followUps.map(([label, q]) => <button key={label} onClick={() => void chat.ask(q, chat.last!.page)}>{label}</button>)}</div>}
  </div>;
}

function Composer({ chat, settings, saveSettings, models, loading, inputRef }: {
  chat: Chat; settings: Settings; saveSettings: (s: Settings, message?: string) => void; models: CodexModel[]; loading: boolean; inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const { attachment, busy } = chat;
  return <div className="chat-bottom">
    <div className="teaching-toggle">
      <span title="开启后，AI 讲到难处时自行决定是否出检查题；流程或机理确实复杂时才画流程图、机理图"><Sparkles size={12}/>导师模式 · 复杂处才画图与提问</span>
      <button type="button" role="switch" aria-label="教学模式" aria-checked={settings.teaching} disabled={busy} onClick={() => saveSettings({ ...settings, teaching: !settings.teaching }, settings.teaching ? "已切换普通问答" : "已开启导师模式：图解与练习由 AI 按内容复杂程度决定")}><i/></button>
    </div>
    {attachment && <div className="attachment">
      <button className="attachment-remove" onClick={() => chat.setAttachment(null)} aria-label="移除选中内容"><X size={12}/></button>
      {attachment.type === "image" ? <img src={attachment.value} alt="准备提问的圈选区域"/> : <span className="attachment-text">“{attachment.value.slice(0, 170)}{attachment.value.length > 170 ? "…" : ""}”</span>}
      <div><span>{attachment.type === "image" ? "已圈选图片" : "已选中文字"} · 第 {attachment.page} 页</span><button onClick={() => void chat.ask()} disabled={busy} className="text-button"><Sparkles size={12}/>解释{attachment.type === "image" ? "这张图" : "这段"}</button></div>
    </div>}
    <form className="question-box" onSubmit={e => { e.preventDefault(); void chat.ask(); }}>
      <textarea ref={inputRef} value={chat.question} maxLength={4000} onChange={e => chat.setQuestion(e.target.value)} placeholder={attachment ? "有什么想了解的？也可以直接发送…" : "关于这篇论文，你想了解什么？"} aria-label="向阅读助手提问" rows={2}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void chat.ask(); } }}/>
      <div>
        <label className="chat-model" title="回答问题使用的模型；识别和翻译仍使用 Codex 设置中的模型"><span className="status-dot"/>
          <select aria-label="问答模型" value={settings.chatModel && models.some(m => m.id === settings.chatModel) ? settings.chatModel : ""} disabled={busy} onChange={e => saveSettings({ ...settings, chatModel: e.target.value }, e.target.value ? `问答改用 ${e.target.value}` : "问答跟随 Codex 设置的模型")}>
            <option value="">{settings.codexModel}（与识别相同）</option>
            {models.filter(m => m.id !== settings.codexModel).map(m => <option key={m.id} value={m.id}>{m.name || m.id}{m.image ? "" : "（不支持图片）"}</option>)}
          </select><ChevronDown size={12}/>
        </label>
        {busy ? <button type="button" className="send-button" aria-label="停止回答" onClick={chat.stop}><Square size={13}/></button>
          : <button type="submit" className="send-button" disabled={(!chat.question.trim() && !attachment) || loading} aria-label="发送问题"><ArrowUp size={17}/></button>}
      </div>
    </form>
    <p className="ai-note">AI 回答仅供辅助理解，请结合原文核对。</p>
  </div>;
}

export default function AssistantPanel({ open, onClose, onResize, onResetWidth, guidePanel, chat, chatEnd, onTip, onGuides, onPage, ...composer }: {
  onPage: (page: number) => void; open: boolean; onClose: () => void; onResize: (e: React.PointerEvent<HTMLDivElement>) => void; onResetWidth: () => void; guidePanel: ReactNode;
  chat: Chat; chatEnd: RefObject<HTMLDivElement | null>; onTip: (tab: "pdf" | "bilingual", hint: string) => void; onGuides: () => void;
  settings: Settings; saveSettings: (s: Settings, message?: string) => void; models: CodexModel[]; loading: boolean; inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return <aside className={`assistant-panel ${open ? "open" : ""}`}>
    <div className="assistant-resizer" role="separator" aria-orientation="vertical" aria-label="拖动调整助手宽度" title="拖动调整宽度，双击恢复默认" onPointerDown={onResize} onDoubleClick={onResetWidth}/>
    <div className="assistant-header"><div><Sparkles size={17}/><strong>AI 阅读助手</strong></div><button className="icon-btn assistant-close" aria-label="关闭阅读助手" onClick={onClose}><X size={17}/></button><span className="assistant-label">随时问，慢慢懂</span></div>
    {guidePanel}
    <div className="chat-scroll">
      {chat.messages.length ? <Messages chat={chat} onPage={onPage}/> : <Welcome chat={chat} onTip={onTip} onGuides={onGuides}/>}
      {chat.busy && <div className="thinking" role="status"><Sparkles size={14}/><span>正在结合论文思考</span><i/><i/><i/></div>}
      <div ref={chatEnd}/>
    </div>
    <Composer chat={chat} {...composer}/>
  </aside>;
}
