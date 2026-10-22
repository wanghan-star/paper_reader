import type { PaperPage } from "./paper";

export type Passage = { page: number; id: number; text: string };

// English words (lower case, plural "s" dropped) and Chinese character pairs, so that a Chinese question
// matches both the Chinese translation and English terms such as "KV cache" or "VCMA".
function terms(text: string): string[] {
  const out: string[] = [];
  for (const word of text.toLowerCase().match(/[a-z][a-z0-9-]{1,}|\d+(?:\.\d+)?/g) || []) out.push(word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word);
  for (const run of text.match(/[一-鿿]+/g) || []) for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
  return out;
}
const STOP = new Set(["the", "and", "for", "with", "that", "this", "are", "from", "was", "were", "which", "can", "its", "their", "has", "have", "been", "also", "than", "such", "into",
  "这个", "什么", "一下", "为什", "么是", "是什", "怎么", "如何", "请问", "这里", "论文", "这篇", "篇论", "解释", "帮我", "我们", "可以", "一个", "的是", "中的", "里的"]);

/** "Fig. 3", "图 3", "Eq. (2)", "公式 2", "Table II", "表 2" in a question, normalised as "fig:3", "eq:2", "table:ii". */
export function references(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?:fig(?:ure)?s?\.?|图)\s*([0-9]+)/gi)) found.add(`fig:${m[1]}`);
  for (const m of text.matchAll(/(?:eqs?\.?|equation|公式|式)\s*\(?\s*([0-9]+)\s*\)?/gi)) found.add(`eq:${m[1]}`);
  for (const m of text.matchAll(/(?:tab(?:le)?\.?|表)\s*([0-9]+|[ivxl]+)\b/gi)) found.add(`table:${m[1].toLowerCase()}`);
  return [...found];
}
const mentions = (text: string, ref: string) => {
  const [kind, n] = ref.split(":");
  const pattern = kind === "fig" ? `(?:fig(?:ure)?s?\\.?|图)\\s*${n}(?![0-9])` : kind === "eq" ? `(?:eqs?\\.?|equation|公式|式)\\s*\\(?\\s*${n}\\s*\\)|\\(${n}\\)` : `(?:tab(?:le)?\\.?|表)\\s*${n}\\b`;
  return new RegExp(pattern, "i").test(text);
};

/** Paragraphs of every recognised page, each with its translation when there is one. */
export function passages(pages: PaperPage[]): Passage[] {
  return pages.flatMap((p, index) => p.sentences.filter(s => !s.heading && s.en.trim().length > 20).map(s => ({ page: index + 1, id: s.id, text: s.zh && s.zh !== s.en ? `${s.en}\n${s.zh}` : s.en })));
}

/** The passages most related to a question, scored with BM25; a passage naming a figure or equation the question asks about ranks first. */
export function search(all: Passage[], question: string, limit = 8): Passage[] {
  const query = [...new Set(terms(question).filter(t => !STOP.has(t)))], refs = references(question);
  if (!query.length && !refs.length) return [];
  const docs = all.map(p => terms(p.text)), avg = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(1, docs.length);
  const df = new Map(query.map(t => [t, docs.filter(d => d.includes(t)).length]));
  const scored = all.map((p, i) => {
    const counts = new Map<string, number>(); for (const t of docs[i]) counts.set(t, (counts.get(t) || 0) + 1);
    let score = 0;
    for (const t of query) {
      const f = counts.get(t) || 0; if (!f) continue;
      const idf = Math.log(1 + (all.length - df.get(t)! + .5) / (df.get(t)! + .5));
      score += idf * f * 2.2 / (f + 1.2 * (.25 + .75 * docs[i].length / avg));
    }
    for (const ref of refs) if (mentions(p.text, ref)) score += /^(?:fig(?:ure)?|table|tab)\.?\s*[0-9ivxl]+/i.test(p.text) ? 30 : 12;
    return { p, score };
  });
  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.p);
}

/**
 * What the assistant reads with a question: the pages on screen, then passages from elsewhere in the paper
 * that match the question, then the section headings. Kept under the local service's 22 000 character limit.
 */
export function questionContext(pages: PaperPage[], visible: number[], question: string, budget = 20000): { context: string; sources: number[] } {
  const onScreen = visible.map(i => `【原文第 ${i + 1} 页（当前页面）】\n${pages[i]?.text || ""}`).join("\n\n").slice(0, 9000);
  const outline = pages.map((p, i) => p.sentences.filter(s => s.heading).map(s => `第 ${i + 1} 页：${s.en}`)).flat().join("\n").slice(0, 1500);
  const shown = new Set(visible.map(i => i + 1));
  const found = search(passages(pages), question, 12).filter(p => !shown.has(p.page));
  let room = budget - onScreen.length - outline.length - 200;
  const picked: Passage[] = [];
  for (const p of found) { const size = p.text.length + 20; if (size > room) continue; picked.push(p); room -= size; }
  const excerpts = picked.sort((a, b) => a.page - b.page || a.id - b.id).map(p => `【第 ${p.page} 页摘录】\n${p.text}`).join("\n\n");
  const context = [onScreen, excerpts && `以下是从全文检索到的相关段落：\n${excerpts}`, outline && `论文章节：\n${outline}`].filter(Boolean).join("\n\n");
  return { context, sources: [...new Set(picked.map(p => p.page))].sort((a, b) => a - b) };
}
