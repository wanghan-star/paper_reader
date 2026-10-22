"use client";
import { useRef, useState } from "react";
import { callCodex } from "@/lib/codex-client";
import { guideParagraphs, type GuideState } from "@/lib/guide";
import type { Paper } from "./use-paper";

/** Difficult spots of a page, produced only when the reader asks for them. */
export function useGuides(paper: Paper, { model, notify, requireLogin, openAssistant }: {
  model: string; notify: (message: string, error?: boolean) => void; requireLogin: () => boolean; openAssistant: () => void;
}) {
  const [guides, setGuides] = useState<Record<number, GuideState>>({});
  const [open, setOpen] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);
  const { pages, epoch } = paper;

  const run = async (index: number) => {
    if (controllerRef.current || !pages[index]) return;
    const paragraphs = guideParagraphs(pages[index]);
    if (!paragraphs.length) { setGuides(prev => ({ ...prev, [index]: { status: "done", points: [] } })); return; }
    const controller = new AbortController(); controllerRef.current = controller; const version = epoch.current;
    setGuides(prev => ({ ...prev, [index]: { status: "loading", points: [] } }));
    try {
      const result = await callCodex("guide", { paragraphs, title: paper.title, page: index + 1 }, model, controller.signal);
      if (version === epoch.current) setGuides(prev => ({ ...prev, [index]: { status: "done", points: result.points || [] } }));
    } catch (e) {
      if (version === epoch.current) setGuides(prev => {
        const next = { ...prev };
        if ((e as Error).name === "AbortError") delete next[index]; else next[index] = { status: "failed", points: [] };
        return next;
      });
    } finally { if (controllerRef.current === controller) controllerRef.current = null; }
  };

  const request = async (busy = false) => {
    if (controllerRef.current || busy || paper.loading) return; if (!requireLogin()) return;
    const targets = paper.visible.filter(i => pages[i] && !pages[i].needsVision && pages[i].sentences.length > 0);
    if (!targets.length) { notify("这一页还没有识别出正文，先翻译或识别后再找难点。", true); return; }
    openAssistant(); setOpen(true); const version = epoch.current;
    for (const index of targets) { if (version !== epoch.current) return; if (guides[index]?.status !== "done") await run(index); }
  };

  /** A page recognised again gets new paragraph ids, so its markers no longer match. */
  const forget = (index: number) => { controllerRef.current?.abort(); setGuides(prev => { const next = { ...prev }; delete next[index]; return next; }); };
  const abort = () => controllerRef.current?.abort();
  const restore = (saved: Record<number, GuideState>) => { setGuides(saved); setOpen(true); };
  return { guides, open, setOpen, request, forget, abort, restore };
}
