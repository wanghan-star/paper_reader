"use client";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { katexMacros, normalizeMath } from "@/lib/math";
import { linkReferences, parseRef, type RefKind } from "@/lib/references";

// With `onPage`, mentions such as “第 3 页” become links that jump to that page of the paper.
// With `onRef`, figure, table, equation and citation mentions become links as well.
export default function RichText({children,streaming=false,onPage,onRef}:{children:string;streaming?:boolean;onPage?:(page:number)=>void;onRef?:(kind:RefKind,key:string,anchor:HTMLElement)=>void}){
  let text=children;
  if(streaming){const matches=[...text.matchAll(/(?<!\\)\$\$|(?<!\\)\$/g)];let open=-1,delimiter="";for(const m of matches){if(open<0){open=m.index!;delimiter=m[0];}else if(m[0]===delimiter)open=-1;}if(open>=0)text=text.slice(0,open);}
  if(onRef)text=linkReferences(text);
  if(onPage)text=text.replace(/(?<![\[\w])第\s*(\d{1,3})\s*页/g,(whole,n)=>`[${whole}](#paper-page-${n})`);
  return <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex,{strict:false,throwOnError:false,trust:false,maxExpand:1000,macros:{...katexMacros}}]]} components={{
    a:({node,href,children,...props})=>{const ref=onRef&&parseRef(href||"");if(ref)return <button type="button" className={`ref-link ref-${ref.kind}`} onClick={e=>onRef!(ref.kind,ref.key,e.currentTarget)}>{children}</button>;const page=/^#paper-page-(\d+)$/.exec(href||"");return page&&onPage?<button type="button" className="page-link" onClick={()=>onPage(Number(page[1]))}>{children}</button>:<a {...props} href={href} target="_blank" rel="noreferrer">{children}</a>;},
    span:({node,...props})=>props.className?.includes("katex-error")?<span className="formula-fallback" title="公式格式不完整，请核对 PDF 原文">公式暂无法显示，请核对原文</span>:<span {...props}/>
  }}>{normalizeMath(text)}</Markdown>;
}
