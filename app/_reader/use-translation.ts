"use client";
import { useRef, useState } from "react";
import { translationBatches } from "@/lib/paper";
import { pageFromBlocks } from "@/lib/page-content";
import { callCodex } from "@/lib/codex-client";
import { pageImage } from "./pdf";
import type { Paper } from "./use-paper";

// Account, model and connection problems affect every page, so they stop the run at once.
const FATAL = /额度|登录|未检测到|模型|本地服务|连接/;

/** Page recognition and translation, up to three pages at a time, pages on screen first. */
export function useTranslation(paper: Paper, { model, glossary, notify, requireLogin, onRecognized }: {
  model: string; glossary: { term: string; zh: string }[]; notify: (message: string, error?: boolean) => void; requireLogin: () => boolean; onRecognized: (index: number) => void;
}) {
  const [status, setStatus] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const { pages, setPages, epoch } = paper;

  const translate = async (all = false, forceOCR = false, focusPage = paper.page) => {
    if (paper.loading || status) return; if (!requireLogin()) return;
    const pdf = paper.docRef.current; if (!pdf) { notify("PDF 仍在加载，请稍后再试。", true); return; }
    const controller = new AbortController(); controllerRef.current = controller; const version = epoch.current;
    const single = forceOCR || paper.continuous || paper.tab === "pdf";
    const anchor = single ? focusPage - 1 : paper.shown[0];
    // Pages on screen first, then onwards from where the reader is, then the pages before it.
    const rank = (i: number) => !single && paper.shown.includes(i) ? -1 : i >= anchor ? i - anchor : pages.length + i;
    const targets = all ? pages.map((_, i) => i).sort((a, b) => rank(a) - rank(b)) : single ? [focusPage - 1] : paper.shown;
    paper.setTab("bilingual"); setStatus("正在准备翻译…");
    const failedPages: number[] = [], queue = [...targets], active = new Map<number, string>();
    let finished = 0, fatal: Error | null = null;
    const report = () => {
      if (epoch.current !== version) return;
      const working = [...active].sort((x, y) => x[0] - y[0]).map(([i, state]) => `第 ${i + 1} 页${state}`).join("，");
      setStatus(`${targets.length > 1 ? `已完成 ${finished}/${targets.length} 页 · ` : ""}${working || "正在收尾…"}`);
    };
    const processPage = async (index: number) => {
      let p = pages[index];
      if ((forceOCR && index === focusPage - 1) || p.needsVision || p.text.replace(/\s/g, "").length < 35) {
        active.set(index, "识别正文、公式与图表"); report();
        const image = await pageImage(pdf, index + 1); controller.signal.throwIfAborted();
        let result: Awaited<ReturnType<typeof callCodex>> | undefined;
        for (let attempt = 0; attempt < 2 && !result?.blocks; attempt++) {
          if (attempt) { active.set(index, "识别未完成，正在重试"); report(); }
          try { result = await callCodex("layout", { image, context: p.text, page: index + 1 }, model, controller.signal); }
          catch (e) { if ((e as Error).name === "AbortError" || FATAL.test((e as Error).message)) throw e; }
          if (epoch.current !== version) return;
        }
        if (!result?.blocks) throw new Error(`第 ${index + 1} 页识别未完成，原页已保留，请重新识别。`);
        p = pageFromBlocks(result.blocks, p);
        setPages(prev => prev.map((value, i) => i === index ? p : value));
        onRecognized(index);
      }
      const batches = translationBatches(p.sentences);
      for (let b = 0; b < batches.length; b++) {
        const state = `翻译 ${b + 1}/${batches.length} 批`; active.set(index, state); report();
        const apply = (rows: { id: number; zh: string }[]) => {
          if (epoch.current !== version) return;
          const lookup = new Map(rows.map(r => [r.id, r.zh]));
          setPages(prev => prev.map((value, i) => i === index ? { ...value, sentences: value.sentences.map(s => lookup.has(s.id) ? { ...s, zh: lookup.get(s.id) } : s) } : value));
        };
        const result = await callCodex("translate", { sentences: batches[b].map(({ id, en }) => ({ id, en })), glossary: glossary.slice(0, 60).map(({ term, zh }) => ({ term, zh })) }, model, controller.signal, progress => {
          if (epoch.current !== version || !progress.translation) return;
          const { translations, completed, total, retrying } = progress.translation;
          apply(translations); active.set(index, `${state} · ${completed}/${total} 句${retrying ? " · 自动补译" : ""}`); report();
        });
        if (epoch.current !== version) return;
        apply(result.translations);
      }
    };
    // Up to three pages are in flight at once; the local service runs their Codex sessions side by side.
    const worker = async () => {
      while (queue.length && !controller.signal.aborted) {
        const index = queue.shift()!;
        try { await processPage(index); }
        catch (e) {
          const error = e as Error;
          if (error.name === "AbortError") { if (!fatal) break; }
          // One bad page is skipped in a longer run; anything else, or a lone page, stops everything.
          else if (targets.length > 1 && !FATAL.test(error.message)) failedPages.push(index + 1);
          else if (!fatal) { fatal = error; controller.abort(); }
        }
        finally { active.delete(index); finished++; report(); }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker));
      if (epoch.current !== version) return;
      if (fatal) throw fatal;
      controller.signal.throwIfAborted();
      failedPages.sort((x, y) => x - y);
      if (failedPages.length) notify(`其余页面已完成；第 ${failedPages.join("、")} 页识别未完成，原页已保留，可在该页点击重新识别。`, true);
      else notify(all ? "全文翻译完成，可以慢慢读了。" : "当前页翻译完成。");
    } catch (e) { if ((e as Error).name === "AbortError") notify("翻译已停止，完成的内容已保留。"); else notify((e as Error).message, true); }
    finally { if (version === epoch.current) { setStatus(""); controllerRef.current = null; } }
  };

  const stop = () => controllerRef.current?.abort();
  /** Opening another paper ends work for the current one. */
  const reset = () => { controllerRef.current?.abort(); setStatus(""); };
  return { status, translate, stop, reset };
}
