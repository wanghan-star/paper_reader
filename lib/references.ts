import type { PaperPage } from "./paper";

export type RefKind = "fig" | "table" | "eq" | "cite";
export type Target = { page: number; id: number };

// "Fig. 3", "Figs. 3", "Figure 3(b)", "图 3", "Table II", "表 2", "Eq. (2)", "式 (2)", "公式 2", and citations "[12]", "[3, 5]".
const PATTERN = /(?<![A-Za-z])(Fig(?:ure)?s?\.?\s*|图\s*)(\d{1,3})(?:[a-h](?![a-z])|\s*\([a-h]\))?|(?<![A-Za-z])(Table|TABLE|Tab\.|表)\s*(\d{1,3}|[IVXL]{1,6})(?![A-Za-z0-9])|(?<![A-Za-z])(?:Eqs?\.?\s*|Equation\s*|公式\s*)\(?\s*(\d{1,3})\s*\)?|(?<!方|公)式\s*\(\s*(\d{1,3})\s*\)|\[(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\]/g;

/**
 * Turn figure, table, equation and citation mentions into links of the form #paper-ref-fig-3 so the
 * renderer can make them jump. Math is left alone.
 */
export function linkReferences(text: string): string {
  return text.split(/(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$|`[^`\n]*`)/g).map((part, i) => i % 2 ? part : part.replace(PATTERN, (whole, _f, fig, _kind, table, eqA, eqB, cite, offset) => {
    // A caption's own label ("Fig. 3." at the very start) is not a reference to follow.
    if (i === 0 && offset === 0 && (fig || table || cite)) return whole;
    const eq = eqA || eqB;
    if (fig) return `[${whole}](#paper-ref-fig-${fig})`;
    if (table) return `[${whole}](#paper-ref-table-${String(table).toLowerCase()})`;
    if (eq) return `[${whole}](#paper-ref-eq-${eq})`;
    // Each number of a citation group links on its own. The brackets are entities: an escaped "\\[" would
    // be read as a LaTeX display-math delimiter further down the renderer.
    const numbers = String(cite).split(/\s*,\s*/);
    return `&#91;${numbers.map(n => /[–-]/.test(n) ? n : `[${n}](#paper-ref-cite-${n})`).join(", ")}&#93;`;
  })).join("");
}

export function parseRef(href: string): { kind: RefKind; key: string } | null {
  const m = /^#paper-ref-(fig|table|eq|cite)-([0-9a-z]+)$/.exec(href);
  return m ? { kind: m[1] as RefKind, key: m[2] } : null;
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
const sameTable = (caption: string, key: string) => {
  const m = /^\s*(?:Table|TABLE|Tab\.)\s*([0-9]+|[IVXL]+)/.exec(caption); if (!m) return false;
  const a = m[1].toLowerCase(), b = key.toLowerCase();
  return a === b || (ROMAN[a] ?? Number(a)) === (ROMAN[b] ?? Number(b));
};

/** Where a figure, table or equation is, or which reference entry a citation number is. */
export function findTarget(pages: PaperPage[], kind: RefKind, key: string): Target | null {
  const match = (test: (en: string, kind?: string) => boolean): Target | null => {
    for (let p = 0; p < pages.length; p++) for (const s of pages[p].sentences) if (test(s.en, s.kind)) return { page: p + 1, id: s.id };
    return null;
  };
  if (kind === "fig") return match((en, k) => (k === "figure" || !k) && new RegExp(`^\\s*(?:Fig(?:ure)?\\.?|FIG\\.?)\\s*${key}(?![0-9])`).test(en))
    // Pages not yet recognised only have text: fall back to the page whose text has the caption.
    ?? (() => { const i = pages.findIndex(p => new RegExp(`(?:^|\\n)\\s*(?:Fig(?:ure)?\\.?|FIG\\.?)\\s*${key}[.:]`).test(p.text)); return i < 0 ? null : { page: i + 1, id: -1 }; })();
  if (kind === "table") return match((en, k) => (k === "table" || !k) && sameTable(en, key));
  if (kind === "eq") return match((en, k) => k === "equation" && (new RegExp(`\\\\tag\\{${key}\\}`).test(en) || new RegExp(`\\(${key}\\)\\s*\\$*\\s*$`).test(en)));
  return match(en => new RegExp(`^\\s*\\[${key}\\]`).test(en));
}

/** The text of reference entry n, for showing a citation in place. */
export function citation(pages: PaperPage[], n: string): string | null {
  const target = findTarget(pages, "cite", n);
  return target ? pages[target.page - 1].sentences.find(s => s.id === target.id)?.en ?? null : null;
}
