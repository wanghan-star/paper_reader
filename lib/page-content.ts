import type { PaperPage, Sentence } from './paper';
export type PageBox={x:number;y:number;width:number;height:number};
export type PageBlock={type:'heading'|'paragraph'|'equation'|'figure'|'table';en:string;zh:string;box:PageBox};

export function pageFromBlocks(blocks:PageBlock[],fallback:PaperPage):PaperPage{
  const sentences:Sentence[]=blocks.map((block,id)=>{
    const visual=['figure','table','equation'].includes(block.type);
    const damaged=/[\uFFFD\u25A1\u25A0]|无法辨认/.test(block.en+block.zh);
    const en=block.en|| (block.type==='equation'?'Formula':block.type==='table'?'Table':'Figure');
    return {id,en,zh:block.type==='equation'?en:block.zh||(!block.en&&visual?'原图':'')||undefined,heading:block.type==='heading',kind:block.type,box:visual||damaged||block.en.includes('$')?block.box:undefined,uncertain:damaged||!block.en};
  });
  return {...fallback,sentences,text:blocks.map(b=>b.en).filter(Boolean).join('\n\n'),heading:sentences.find(s=>s.heading)?.en||fallback.heading,ocr:true,needsVision:false};
}

// Keep normal paragraphs intact; small print lines are not semantic headings.
export function toReadingParagraphs(text:string):Sentence[]{
  const blocks:string[]=[];let paragraph='';
  const flush=()=>{if(paragraph)blocks.push(paragraph);paragraph='';};
  for(const raw of text.split('\n')){
    const line=raw.trim();if(!line){flush();continue;}
    if(/^(?:abstract|references|introduction|conclusion)s?$|^\d+(?:\.\d+)*\s+[A-Z][A-Za-z -]{2,70}$/i.test(line)){flush();blocks.push(line);}
    else paragraph=paragraph.endsWith('-')?paragraph.slice(0,-1)+line:paragraph?paragraph+' '+line:line;
  }
  flush();
  const bounded:string[]=[];
  for(const block of blocks){
    if(block.length<=2500){bounded.push(block);continue;}
    let buffer='';
    for(const part of new Intl.Segmenter('en',{granularity:'sentence'}).segment(block)){
      if(buffer&&buffer.length+part.segment.length>2000){bounded.push(buffer.trim());buffer='';}
      // A long unpunctuated fragment is split without dropping any characters.
      let segment=part.segment;
      while(segment.length>2500){if(buffer){bounded.push(buffer.trim());buffer='';}let cut=segment.lastIndexOf(' ',2000);if(cut<1000)cut=2000;bounded.push(segment.slice(0,cut));segment=segment.slice(cut).trimStart();}
      buffer+=segment;
    }
    if(buffer.trim())bounded.push(buffer.trim());
  }
  return bounded.map((en,id)=>({id,en,heading:/^(?:abstract|references|introduction|conclusion)s?$|^\d+(?:\.\d+)*\s+[A-Z][A-Za-z -]{2,70}$/i.test(en)}));
}
