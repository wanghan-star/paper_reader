"use client";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { katexMacros, normalizeMath } from "@/lib/math";

export default function RichText({children,streaming=false}:{children:string;streaming?:boolean}){
  let text=children;
  if(streaming){const matches=[...text.matchAll(/(?<!\\)\$\$|(?<!\\)\$/g)];let open=-1,delimiter="";for(const m of matches){if(open<0){open=m.index!;delimiter=m[0];}else if(m[0]===delimiter)open=-1;}if(open>=0)text=text.slice(0,open);}
  return <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex,{strict:false,throwOnError:false,trust:false,maxExpand:1000,macros:{...katexMacros}}]]} components={{
    a:props=><a {...props} target="_blank" rel="noreferrer"/>,
    span:({node,...props})=>props.className?.includes("katex-error")?<span className="formula-fallback" title="公式格式不完整，请核对 PDF 原文">公式暂无法显示，请核对原文</span>:<span {...props}/>
  }}>{normalizeMath(text)}</Markdown>;
}
