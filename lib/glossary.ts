import type { PaperPage } from "./paper";

export type GlossaryEntry = { term: string; zh: string; definition: string; page: number };
export type Glossary = { status: "idle" | "loading" | "done" | "failed"; entries: GlossaryEntry[] };

const COMMON = new Set(["IEEE", "USA", "PDF", "DOI", "CMOS", "AND", "THE", "FOR", "ALL", "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII"]);

/**
 * Likely terms, counted across the paper: acronyms used at least twice, and phrases defined as
 * "Long Name (ABBR)". The model picks and explains the ones that matter.
 */
export function candidates(pages: PaperPage[]): string[] {
  const text = pages.map(p => p.sentences.map(s => s.en).join("\n")).join("\n");
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/\b[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9-]*\b/g)) {
    const word = m[0].replace(/-$/, ""); if (word.length < 2 || word.length > 14 || COMMON.has(word) || /^\d/.test(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  const defined = new Set<string>();
  for (const m of text.matchAll(/((?:[A-Za-z][A-Za-z-]+\s){1,6}[A-Za-z][A-Za-z-]+)\s\(([A-Z][A-Za-z0-9-]{1,12})\)/g)) defined.add(`${m[1].trim()} (${m[2]})`);
  const acronyms = [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 70).map(([w, n]) => `${w}(${n})`);
  return [...defined].slice(0, 40).concat(acronyms).slice(0, 110);
}

/** Text the model reads to explain the terms: the opening pages and every figure caption. */
export function glossarySource(pages: PaperPage[], budget = 18000): string {
  const captions = pages.flatMap((p, i) => p.sentences.filter(s => s.kind === "figure" || s.kind === "table").map(s => `（第 ${i + 1} 页）${s.en}`)).join("\n").slice(0, 5000);
  const opening = pages.slice(0, 3).map(p => p.sentences.filter(s => s.kind !== "figure" && s.kind !== "table").map(s => s.en).join("\n")).join("\n\n");
  return (opening.slice(0, budget - captions.length) + "\n\n图表说明：\n" + captions).trim();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A whole-word, case-sensitive pattern for an acronym and a case-insensitive one for a phrase. */
export function termPattern(term: string): RegExp | null {
  const clean = term.replace(/\$/g, "").trim(); if (clean.length < 2) return null;
  const acronym = /^[A-Z0-9-]+[a-z]?$/.test(clean) && /[A-Z]/.test(clean);
  // "MTJ" and "MTJs" are the same term, whichever form the glossary lists.
  const stem = acronym ? clean.replace(/(?<=[A-Z0-9])s$/, "") : clean;
  return new RegExp(`(?<![A-Za-z0-9])${escape(stem)}${acronym ? "s?" : ""}(?![A-Za-z0-9])`, acronym ? "g" : "gi");
}
/** The first page where a term appears, for "jump to where it is introduced". */
export function firstPage(pages: PaperPage[], term: string): number {
  const pattern = termPattern(term); if (!pattern) return 1;
  const index = pages.findIndex(p => p.sentences.some(s => { pattern.lastIndex = 0; return pattern.test(s.en); }));
  return index < 0 ? 1 : index + 1;
}
