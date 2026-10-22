"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { termPattern, type GlossaryEntry } from "@/lib/glossary";

const NAME = "glossary-term";
type Mark = { range: Range; entry: GlossaryEntry };

/**
 * Dotted underlines under glossary terms in the bilingual text, and a card with the translation and
 * explanation while the pointer rests on one. Uses CSS highlights, so the rendered paper is not touched.
 */
export default function GlossaryHighlight({ container, entries, version }: { container: RefObject<HTMLElement | null>; entries: GlossaryEntry[]; version: string }) {
  const marks = useRef<Mark[]>([]);
  const [card, setCard] = useState<{ entry: GlossaryEntry; x: number; y: number } | null>(null);

  useEffect(() => {
    const root = container.current;
    if (!root || typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined") return;
    // Longer terms first, so "VCMA-MTJ" is marked as one term rather than also as "VCMA".
    const english = (entries.map(entry => ({ entry, pattern: termPattern(entry.term) })).filter(t => t.pattern) as { entry: GlossaryEntry; pattern: RegExp }[])
      .sort((a, b) => b.entry.term.length - a.entry.term.length);
    const chinese = entries.filter(e => e.zh.length >= 2 && /[一-鿿]/.test(e.zh)).sort((a, b) => b.zh.length - a.zh.length);
    let timer = 0;
    const scan = () => {
      const found: Mark[] = [];
      for (const block of root.querySelectorAll<HTMLElement>(".sentence-en > div, .sentence-zh > div")) {
        const zh = block.parentElement?.classList.contains("sentence-zh");
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
          if (node.parentElement?.closest(".katex")) continue;
          const taken: [number, number][] = [];
          const add = (start: number, end: number, entry: GlossaryEntry) => {
            if (taken.some(([a, b]) => start < b && end > a)) return;
            taken.push([start, end]); const range = new Range(); range.setStart(node!, start); range.setEnd(node!, end); found.push({ range, entry });
          };
          if (zh) for (const entry of chinese) { let at = node.data.indexOf(entry.zh); while (at >= 0) { add(at, at + entry.zh.length, entry); at = node.data.indexOf(entry.zh, at + entry.zh.length); } }
          else for (const { entry, pattern } of english) { pattern.lastIndex = 0; for (const m of node.data.matchAll(pattern)) add(m.index!, m.index! + m[0].length, entry); }
        }
      }
      marks.current = found;
      if (found.length) CSS.highlights.set(NAME, new Highlight(...found.map(m => m.range))); else CSS.highlights.delete(NAME);
    };
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(scan, 150); };
    schedule();
    // Pages render lazily while scrolling, so look again whenever the reading view changes.
    const observer = new MutationObserver(schedule); observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); window.clearTimeout(timer); CSS.highlights.delete(NAME); marks.current = []; };
  }, [container, entries, version]);

  useEffect(() => {
    const root = container.current; if (!root || !entries.length) return;
    let frame = 0;
    const move = (e: MouseEvent) => {
      if (frame) return;
      frame = window.setTimeout(() => {
        frame = 0;
        const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
        const at = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
        const node = at?.offsetNode ?? document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startContainer, offset = at?.offset ?? document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startOffset ?? 0;
        const hit = node && marks.current.find(m => m.range.startContainer === node && offset >= m.range.startOffset && offset <= m.range.endOffset);
        setCard(hit ? { entry: hit.entry, x: Math.min(window.innerWidth - 300, e.clientX + 12), y: e.clientY + 18 } : null);
      }, 40);
    };
    const leave = () => setCard(null);
    root.addEventListener("mousemove", move); root.addEventListener("mouseleave", leave); root.addEventListener("scroll", leave);
    return () => { root.removeEventListener("mousemove", move); root.removeEventListener("mouseleave", leave); root.removeEventListener("scroll", leave); window.clearTimeout(frame); };
  }, [container, entries]);

  if (!card) return null;
  return <div className="glossary-card" style={{ left: card.x, top: Math.min(card.y, window.innerHeight - 140) }} role="tooltip">
    <strong>{card.entry.term.replace(/\$/g, "")}</strong><span>{card.entry.zh}</span>
    {card.entry.definition && <p>{card.entry.definition.replace(/\$/g, "")}</p>}
  </div>;
}
