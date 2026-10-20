"use client";
import { useEffect, type RefObject } from "react";
import { mapSentences, splitSentences } from "@/lib/sentence-align";

const NAME="linked-sentence";
type Piece={node:Text;start:number;length:number};

// Visible text of one side of a bilingual pair. A formula counts as opaque characters, so that the
// punctuation inside it never ends a sentence, and its hidden MathML copy is left out altogether.
function collect(side:HTMLElement){
  const root=side.querySelector<HTMLElement>(":scope > div")||side,pieces:Piece[]=[];let text="";
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode() as Text|null;node;node=walker.nextNode() as Text|null){
    const parent=node.parentElement;if(!parent||parent.closest(".katex-mathml"))continue;
    pieces.push({node,start:text.length,length:node.data.length});
    text+=parent.closest(".katex")?"x".repeat(node.data.length):node.data;
  }
  return {pieces,text};
}

/** While text is selected on one side of a bilingual paragraph, mark the matching sentences on the other side. */
export function useLinkedHighlight(container:RefObject<HTMLElement|null>){
  useEffect(()=>{
    if(typeof CSS==="undefined"||!("highlights" in CSS)||typeof Highlight==="undefined")return;
    let frame=0;
    const update=()=>{
      frame=0;CSS.highlights.delete(NAME);
      const selection=document.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return;
      const range=selection.getRangeAt(0),origin=range.startContainer instanceof Element?range.startContainer:range.startContainer.parentElement;
      const side=origin?.closest<HTMLElement>(".sentence-zh,.sentence-en");
      if(!side||!container.current?.contains(side))return;
      const chinese=side.classList.contains("sentence-zh");
      const other=side.parentElement?.querySelector<HTMLElement>(chinese?":scope > .sentence-en":":scope > .sentence-zh");
      if(!other||side.classList.contains("untranslated")||other.classList.contains("untranslated"))return;
      const source=collect(side),target=collect(other);
      let from=Infinity,to=-1;
      for(const piece of source.pieces){
        if(!range.intersectsNode(piece.node))continue;
        const a=piece.node===range.startContainer?range.startOffset:0,b=piece.node===range.endContainer?range.endOffset:piece.length;
        if(b>a){from=Math.min(from,piece.start+a);to=Math.max(to,piece.start+b);}
      }
      if(to<0)return;
      const sentences=splitSentences(source.text,chinese?"zh":"en"),matches=splitSentences(target.text,chinese?"en":"zh");
      const touched=sentences.map((s,i)=>s[0]<to&&s[1]>from?i:-1).filter(i=>i>=0);
      if(!touched.length||!matches.length)return;
      const [first,last]=mapSentences(touched[0],touched[touched.length-1],sentences.length,matches.length);
      const begin=matches[first][0],end=matches[last][1];
      const head=target.pieces.find(p=>begin<p.start+p.length),tail=[...target.pieces].reverse().find(p=>end>p.start);
      if(!head||!tail)return;
      const mark=new Range();mark.setStart(head.node,Math.max(0,begin-head.start));mark.setEnd(tail.node,Math.min(tail.length,end-tail.start));
      CSS.highlights.set(NAME,new Highlight(mark));
    };
    const schedule=()=>{if(!frame)frame=window.setTimeout(update,30);};
    document.addEventListener("selectionchange",schedule);
    return()=>{document.removeEventListener("selectionchange",schedule);window.clearTimeout(frame);CSS.highlights.delete(NAME);};
  },[container]);
}
