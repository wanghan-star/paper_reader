"use client";
import { useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import demo from "@/lib/demo.json";
import type { PaperPage, Settings } from "@/lib/paper";
import { readingIndexes } from "@/lib/reading";

const samplePages: PaperPage[] = demo.pages.map(p => ({ ...p, text: p.sentences.map(s => s.en).join("\n") }));

/**
 * The open paper and where the reader is in it. `epoch` changes whenever another paper is opened,
 * so late results of work started for the previous paper can be recognised and dropped.
 */
export function usePaper(settings: Settings) {
  const [pages, setPages] = useState<PaperPage[]>(samplePages), [page, setPage] = useState(1);
  const [isDemo, setDemo] = useState(true), [title, setTitle] = useState(demo.title), [filename, setFilename] = useState("transformer-reading-sample.pdf");
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null), [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"bilingual" | "pdf">("bilingual"), [zoom, setZoom] = useState(100);
  const docRef = useRef<PDFDocumentProxy | null>(null), epoch = useRef(0), reader = useRef<HTMLDivElement>(null);

  const continuous = settings.readingMode === "scroll";
  const shown = readingIndexes(pages.length, page, settings.readingMode, settings.readingSpan, tab === "pdf");
  const step = tab === "bilingual" && !continuous ? settings.readingSpan : 1;
  const groupStart = Math.floor((page - 1) / step) * step + 1;
  const lastGroup = groupStart + step > pages.length;
  /** The pages on screen: the current group when paging, the current page when scrolling. */
  const visible = tab === "bilingual" && !continuous ? shown : [page - 1];

  const scrollToPage = (n: number) => requestAnimationFrame(() => reader.current?.querySelector<HTMLElement>(`[data-paper-page="${n}"]`)?.scrollIntoView({ block: "start" }));
  const goToPage = (n: number) => { setPage(n); if (continuous) scrollToPage(n); };
  const showOriginal = (n: number) => { setPage(n); setTab("pdf"); };
  /** Bring a block of the bilingual view into view and flash it. */
  const locate = (n: number, id: number | string) => {
    const find = () => reader.current?.querySelector<HTMLElement>(`[data-paper-page="${n}"] [data-block="${id}"]`);
    const flash = (el: HTMLElement) => {
      // A figure's caption sits under its image: bring the image into view and flash both.
      const image = el.previousElementSibling?.matches("figure.paper-visual") ? el.previousElementSibling as HTMLElement : null;
      (image ?? el).scrollIntoView({ block: image ? "start" : "center", behavior: "smooth" });
      for (const part of image ? [image, el] : [el]) { part.classList.remove("block-flash"); void part.offsetWidth; part.classList.add("block-flash"); }
    };
    const el = find(); if (el) { flash(el); return true; }
    // The page may not be on screen yet: switch to it, then look again once it has rendered.
    setTab("bilingual"); goToPage(n);
    let tries = 0; const retry = () => { const found = find(); if (found) flash(found); else if (++tries < 20) setTimeout(retry, 120); };
    setTimeout(retry, 120); return false;
  };

  /** Bring the first block on a page that mentions a term into view. */
  const locateText = (n: number, term: string) => {
    const word = term.replace(/\$/g, "").trim().toLowerCase();
    const id = pages[n - 1]?.sentences.find(s => s.en.toLowerCase().includes(word))?.id;
    locate(n, id ?? 0);
  };

  const totalSentences = pages.reduce((sum, p) => sum + p.sentences.length, 0), translated = pages.reduce((sum, p) => sum + p.sentences.filter(s => s.zh).length, 0);
  const progress = totalSentences ? Math.round(translated / totalSentences * 100) : 0;

  return {
    pages, setPages, page, setPage, isDemo, setDemo, title, setTitle, filename, setFilename, doc, setDoc, loading, setLoading,
    tab, setTab, zoom, setZoom, docRef, epoch, reader, continuous, shown, step, groupStart, lastGroup, visible,
    goToPage, scrollToPage, showOriginal, locate, locateText, progress, subtitle: demo.subtitle,
  };
}
export type Paper = ReturnType<typeof usePaper>;
