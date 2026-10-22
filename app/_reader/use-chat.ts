"use client";
import { useRef, useState } from "react";
import { callCodex } from "@/lib/codex-client";
import { instantVisual } from "@/lib/lesson-preview";
import type { Lesson } from "@/lib/lesson";
import type { StoredMessage } from "@/lib/records";
import type { Paper } from "./use-paper";
import { questionContext } from "@/lib/retrieval";

export type Message = StoredMessage & { visual?: Lesson["visual"]; streaming?: boolean; instant?: boolean };
export type Attachment = { type: "image" | "text"; value: string; page: number; context: string };

const ASK_FOR_GUIDES = /(?:标出|找出|列出|看看|告诉我)[^。！？\n]{0,8}难点|难点[^。！？\n]{0,6}(?:在哪|是什么|有哪些)|哪些[^。！？\n]{0,6}难点/;

/** The conversation with the reading assistant. */
export function useChat(paper: Paper, { teaching, modelFor, requireLogin, openAssistant, onAsk, onGuideRequest, focusInput }: {
  teaching: boolean; modelFor: (image: boolean) => string; requireLogin: () => boolean; openAssistant: () => void;
  onAsk: () => void; onGuideRequest: () => void; focusInput: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]), [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false), [attachment, setAttachment] = useState<Attachment | null>(null);
  const controllerRef = useRef<AbortController | null>(null), messageId = useRef(0);
  const { pages, epoch } = paper;

  /**
   * What the assistant reads alongside the question, unless the caller supplies its own: the page the question
   * is about, plus passages from anywhere in the paper that match it.
   */
  const contextFor = (q: string, page?: number) => questionContext(pages, page ? [page - 1] : paper.visible, q);

  const ask = async (override?: string, sourcePage?: number, contextOverride?: string) => {
    if (busy || paper.loading) return;
    const q = (override || question).trim() || (attachment?.type === "text" ? "请用通俗中文解释这段文字，说明关键术语，必要时举例。" : attachment?.type === "image" ? "请详细解释这张图的含义，以及它与论文的关系。" : "");
    if (!q) return;
    if (!override && !attachment && ASK_FOR_GUIDES.test(q)) { setQuestion(""); onGuideRequest(); return; }
    if (!requireLogin()) return;
    const selected = sourcePage ? null : attachment, usedPage = selected?.page || sourcePage || paper.page;
    const combined = selected?.type === "text" ? `${q}\n\n选中文字：\n${selected.value}` : q;
    const user: Message = { id: ++messageId.current, role: "user", content: combined, page: usedPage, image: selected?.type === "image" ? selected.value : undefined };
    // The marker lets the tutor see that a check question is already waiting for an answer.
    const history = messages.filter(m => !m.error).map(m => ({ role: m.role, content: m.content + (m.lesson?.quiz ? `\n[已附检查题：${m.lesson.quiz.question}]` : "") }));
    onAsk();
    const replyId = ++messageId.current, quickVisual = teaching ? instantVisual(q) : undefined;
    setMessages(prev => [...prev, user, { id: replyId, role: "assistant", content: "", page: usedPage, streaming: true, visual: quickVisual, instant: !!quickVisual }]);
    setQuestion(""); setAttachment(null); setBusy(true); openAssistant();
    const controller = new AbortController(); controllerRef.current = controller; const version = epoch.current;
    const update = (id: number, change: (m: Message) => Message) => setMessages(prev => prev.map(m => m.id === id ? change(m) : m));
    try {
      const found = contextOverride ? null : contextFor(combined, selected?.page || sourcePage);
      if (found?.sources.length) update(replyId, m => ({ ...m, sources: found.sources }));
      const payload = { question: combined, title: paper.title, page: usedPage, context: contextOverride || found!.context, image: user.image, history, teaching };
      const result = await callCodex("chat", payload, modelFor(!!user.image), controller.signal, p => {
        if (version === epoch.current) update(replyId, m => ({ ...m, content: p.content || "", visual: p.visual || m.visual, instant: p.visual ? false : m.instant }));
      });
      if (version !== epoch.current) return;
      update(replyId, m => ({ ...m, content: result.content, lesson: result.lesson, visual: undefined, streaming: false }));
    } catch (e) {
      if (version !== epoch.current) return;
      const stopped = (e as Error).name === "AbortError";
      update(replyId, m => ({ ...m, content: stopped && m.content ? m.content + "\n\n*回答已停止。*" : stopped ? "回答已停止，可以重新提问。" : (e as Error).message || "回答失败，请重试。", visual: undefined, streaming: false, error: true }));
      setAttachment(selected); setQuestion(q);
    } finally { if (version === epoch.current) { setBusy(false); controllerRef.current = null; } }
  };

  const askRoute = () => void ask("请根据各页标题和开头内容，告诉我这篇论文要解决什么问题、核心方法是什么，并给我一条阅读路线：先读哪里、哪些部分最难、读每一部分时要带着什么问题。", undefined,
    `论文各页标题：\n${pages.map((p, i) => `${i + 1}. ${p.heading}`).join("\n").slice(0, 3000)}\n\n论文开头：\n${pages.slice(0, 3).map(p => p.text).join("\n\n").slice(0, 12000)}`);

  const last = messages.at(-1);
  const followUps: [string, string][] = !last || last.role !== "assistant" || last.streaming || last.error || busy ? [] : [
    ["讲得再简单一点", "请把刚才的内容讲得再简单一点，用一个生活中的类比。"],
    ["举个具体例子", "请针对刚才的内容举一个带具体数字的小例子，一步一步算给我看。"],
    ...(teaching && !last.lesson?.visual ? [["画成图解", "请把刚才讲的内容画成流程图或机理图。"] as [string, string]] : []),
    ...(teaching && !last.lesson?.quiz ? [["考考我", "出一道题检查我是否理解刚才的内容。"] as [string, string]] : []),
  ];

  const attachText = (text: string, page = paper.page) => {
    setAttachment({ type: "text", value: text, page, context: pages[page - 1]?.text || "" });
    openAssistant(); window.getSelection()?.removeAllRanges(); focusInput();
  };
  const attachImage = (image: string, page = paper.page) => {
    setAttachment({ type: "image", value: image, page, context: pages[page - 1]?.text || "" }); openAssistant(); focusInput();
  };
  const stop = () => controllerRef.current?.abort();
  const reset = () => { controllerRef.current?.abort(); setBusy(false); setAttachment(null); };
  const restore = (saved: StoredMessage[]) => { messageId.current = saved.reduce((max, m) => Math.max(max, m.id), 0); setMessages(saved); };

  return { messages, question, setQuestion, busy, attachment, setAttachment, ask, askRoute, followUps, attachText, attachImage, stop, reset, restore, last };
}
export type Chat = ReturnType<typeof useChat>;
