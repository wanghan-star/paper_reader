export type Sentence = { id: number; en: string; zh?: string; heading?: boolean;kind?:'heading'|'paragraph'|'equation'|'figure'|'table';box?:{x:number;y:number;width:number;height:number};uncertain?:boolean };
export type PaperPage = { sentences: Sentence[]; text: string; heading: string; ocr?: boolean;needsVision?:boolean };
export type Theme = "forest" | "sepia" | "mist" | "night" | "custom";
export type Settings = { theme:Theme; background:string; readingMode:"paged"|"scroll"; textSize:number; readingSpan:number; compact:boolean; teaching:boolean; codexModel: string; autoTranslate: boolean };
export const DEFAULT_SETTINGS: Settings = { theme:"forest", background:"#fffefa", readingMode:"paged", textSize:18, readingSpan:2, compact:true, teaching:true, codexModel: "gpt-6.1-sol", autoTranslate: true };

type Item = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean };
export function extractText(items: Item[], pageWidth: number): string {
  const nonempty = items.filter(i => i.str.trim());
  const mid = pageWidth / 2;
  const left = nonempty.filter(i => i.transform[4] < mid && i.transform[4] + i.width < mid + 12);
  const right = nonempty.filter(i => i.transform[4] > mid - 12);
  const rows = (group: Item[]) => {
    const lines: { y: number; items: Item[] }[] = [];
    for (const item of [...group].sort((a,b) => b.transform[5]-a.transform[5] || a.transform[4]-b.transform[4])) {
      const line = lines.find(l => Math.abs(l.y-item.transform[5]) < Math.max(2, Math.min(item.height * .35, 4)));
      if (line) line.items.push(item); else lines.push({y:item.transform[5],items:[item]});
    }
    return lines.sort((a,b)=>b.y-a.y).map(l => l.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(" ").trim());
  };
  const crossing = nonempty.filter(i=>i.transform[4]<mid-12 && i.transform[4]+i.width>mid+12);
  const isTwo = left.length>25 && right.length>25 && crossing.length<nonempty.length*.08;
  if (!isTwo) return rows(nonempty).join("\n");
  const rightTop = Math.max(...right.map(i=>i.transform[5]));
  const headers = nonempty.filter(i=>i.transform[5]>rightTop+14);
  const body = nonempty.filter(i=>!headers.includes(i));
  return [...rows(headers), ...rows(body.filter(i=>i.transform[4]<mid)), "", ...rows(body.filter(i=>i.transform[4]>=mid))].join("\n");
}

export function toSentences(text: string): Sentence[] {
  const blocks: string[]=[];
  let paragraph="";
  for (const raw of text.split("\n")) {
    const line=raw.trim();
    if (!line) { if(paragraph) blocks.push(paragraph); paragraph=""; continue; }
    const heading = line.length<100 && /^(\d+(?:\.\d+)*\s+[A-Z]|abstract$|references$|introduction$|conclusion$)/i.test(line);
    if(heading) { if(paragraph) blocks.push(paragraph); blocks.push(line); paragraph=""; }
    else { paragraph=paragraph.endsWith("-") ? paragraph.slice(0,-1)+line : paragraph ? paragraph+" "+line : line; }
  }
  if(paragraph) blocks.push(paragraph);
  const segmenter=new Intl.Segmenter("en",{granularity:"sentence"});
  const values=blocks.flatMap(block=> {
    const segments=[...segmenter.segment(block)].map(s=>s.segment.trim()).filter(Boolean);
    const merged:string[]=[];
    for(const s of segments){const previous=merged.at(-1);if(previous && /\b(?:Dr|Mr|Ms|Mrs|Prof|Fig|Figs|Eq|Eqs|Sec|Secs|et al|e\.g|i\.e)\.$/i.test(previous)) merged[merged.length-1]=previous+" "+s;else merged.push(s);}
    return merged;
  });
  return values.flatMap(s=>s.length>2200 ? (s.match(/[\s\S]{1,2000}(?:\s|$)/g)??[s]) : [s]).map((en,id)=>({id,en,heading:en.length<100 && !/[.!?]$/.test(en)}));
}

export function translationBatches(sentences: Sentence[], maxChars=3500): Sentence[][] {
  const result:Sentence[][]=[]; let group:Sentence[]=[]; let size=0;
  for(const sentence of sentences.filter(s=>!s.zh)) {
    if(group.length && (size+sentence.en.length>maxChars || group.length>=12)) { result.push(group);group=[];size=0; }
    group.push(sentence);size+=sentence.en.length;
  }
  if(group.length) result.push(group);
  return result;
}

export function parseTranslations(content: string, expected: {id:number}[]): {id:number;zh:string}[] {
  let parsed: {translations?:unknown};
  try { parsed=JSON.parse(content.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim()); }
  catch { throw new Error("模型未返回有效的翻译格式，请重试或切换翻译模型。"); }
  if(!Array.isArray(parsed.translations)) throw new Error("模型返回的翻译缺少逐句对应内容，请重试。");
  const rows=parsed.translations as {id:number;zh:string}[];
  if(rows.length!==expected.length || new Set(rows.map(r=>r.id)).size!==rows.length || expected.some(e=>!rows.some(r=>r.id===e.id && typeof r.zh==="string" && r.zh.trim().length>0))) throw new Error("部分句子未完成翻译，请重试。已经完成的翻译会保留。");
  return rows.map(r=>({id:r.id,zh:r.zh.trim()}));
}

