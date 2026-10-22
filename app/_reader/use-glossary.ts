"use client";
import { useRef, useState } from "react";
import { callCodex } from "@/lib/codex-client";
import { candidates, firstPage, glossarySource, type Glossary, type GlossaryEntry } from "@/lib/glossary";
import type { Paper } from "./use-paper";

/** The paper's glossary, made when the reader asks for it and kept with the reading record. */
export function useGlossary(paper: Paper, { model, notify, requireLogin }: { model: string; notify: (message: string, error?: boolean) => void; requireLogin: () => boolean }) {
  const [glossary, setGlossary] = useState<Glossary>({ status: "idle", entries: [] });
  const controllerRef = useRef<AbortController | null>(null);

  const generate = async () => {
    if (controllerRef.current || paper.loading) return; if (!requireLogin()) return;
    const { pages, epoch } = paper;
    if (!pages.some(p => !p.needsVision && p.sentences.length)) { notify("先翻译或识别论文，再整理术语表。", true); return; }
    const controller = new AbortController(); controllerRef.current = controller; const version = epoch.current;
    setGlossary(g => ({ ...g, status: "loading" }));
    try {
      const result = await callCodex("glossary", { title: paper.title, candidates: candidates(pages), context: glossarySource(pages) }, model, controller.signal);
      if (version !== epoch.current) return;
      const entries = (result.terms || []).map(t => ({ ...t, page: firstPage(pages, t.term) }));
      setGlossary({ status: "done", entries });
      notify(entries.length ? `已整理 ${entries.length} 个术语，正文中带虚线的词可以悬停查看。` : "这篇论文没有找到需要单独解释的术语。");
    } catch (e) {
      if (version !== epoch.current) return;
      const stopped = (e as Error).name === "AbortError";
      setGlossary(g => ({ ...g, status: g.entries.length ? "done" : stopped ? "idle" : "failed" }));
      if (!stopped) notify((e as Error).message || "术语表未能生成，请稍后重试。", true);
    } finally { if (controllerRef.current === controller) controllerRef.current = null; }
  };
  const abort = () => controllerRef.current?.abort();
  const restore = (entries?: GlossaryEntry[]) => setGlossary(entries?.length ? { status: "done", entries } : { status: "idle", entries: [] });
  return { glossary, generate, abort, restore };
}
export type GlossaryState = ReturnType<typeof useGlossary>;
