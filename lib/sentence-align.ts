export type Span=[start:number,end:number];

// A period after these does not end a sentence: abbreviations common in papers, and single initials.
const ABBREVIATION=/(?:\b(?:e\.g|i\.e|et al|etc|vs|cf|Figs?|Eqs?|Secs?|Tab|Refs?|No|Dr|Mrs?|Ms|Prof|approx|resp)|\b[A-Z])\.$/;

/** Sentence spans of a paragraph, as character offsets. Chinese is cut at 。！？, English at . ! ? before a new capital. */
export function splitSentences(text:string,language:"en"|"zh"):Span[]{
  const boundary=language==="zh"?/[。！？!?]+[”’」』）)\]]*\s*/g:/[.!?]+["')\]”’]*\s+(?=["'(\[“‘]?[A-Z0-9])/g;
  const spans:Span[]=[];let start=0;
  const push=(end:number)=>{
    let a=start,b=end;while(a<b&&/\s/.test(text[a]))a++;while(b>a&&/\s/.test(text[b-1]))b--;
    if(b>a)spans.push([a,b]);start=end;
  };
  for(const match of text.matchAll(boundary)){
    const end=match.index+match[0].length;
    if(language==="en"&&ABBREVIATION.test(text.slice(0,match.index+1)))continue;
    push(end);
  }
  push(text.length);
  return spans;
}

/**
 * Sentences first..last of a paragraph with `count` sentences, mapped onto its translation with `other` sentences.
 * Equal counts pair one to one; otherwise a translator merged or split a sentence, so the nearest proportional
 * range is used, erring on the side of covering a little more.
 */
export function mapSentences(first:number,last:number,count:number,other:number):Span{
  if(count<=0||other<=0)return [0,-1];
  if(count===other)return [first,last];
  const start=Math.min(other-1,Math.floor(first*other/count));
  return [start,Math.min(other-1,Math.max(start,Math.ceil((last+1)*other/count)-1))];
}
