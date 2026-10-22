import type { Box } from "./box-refine";

/** A line of the PDF text layer, in 0-1000 page units. */
export type TextRow={x:number;top:number;bottom:number;width:number;size:number;text:string};
type Caption={key:string;x:number;top:number;bottom:number;width:number};

/** Group PDF.js text items into lines (0-1000 units). Pieces on one baseline join; a wide gap starts another column. */
export function textRows(items:{str:string;transform:number[];width:number;height:number}[],pageWidth:number,pageHeight:number):TextRow[]{
  const pieces=items.filter(i=>i.str.trim()).map(i=>({text:i.str,x:i.transform[4],base:i.transform[5],size:Math.abs(i.transform[3])||i.height||10,width:i.width}));
  pieces.sort((a,b)=>b.base-a.base||a.x-b.x);
  const lines:{text:string;x:number;right:number;base:number;size:number}[]=[];
  for(const piece of pieces){
    const line=lines.find(l=>Math.abs(l.base-piece.base)<Math.max(1.5,piece.size*.35)&&piece.x-l.right<piece.size*.8&&piece.x>=l.x-1);
    if(line){line.text+=(piece.x-line.right>piece.size*.15?" ":"")+piece.text;line.right=Math.max(line.right,piece.x+piece.width);line.size=Math.max(line.size,piece.size);}
    else lines.push({text:piece.text,x:piece.x,right:piece.x+piece.width,base:piece.base,size:piece.size});
  }
  return lines.map(l=>({text:l.text,x:l.x/pageWidth*1000,width:Math.max(1,l.right-l.x)/pageWidth*1000,top:(pageHeight-l.base-l.size*.85)/pageHeight*1000,bottom:(pageHeight-l.base+l.size*.25)/pageHeight*1000,size:l.size/pageHeight*1000}));
}

const CAPTION=/^\s*(Fig(?:ure)?s?\.?|FIG(?:URE)?\.?|Tab(?:le)?\.?|TABLE)\s*([0-9]+|[IVXL]+)\b/;
/** "figure:3" or "table:II" for a caption such as "Fig. 3. (a) ..."; null for other text. */
export function captionKey(text:string):string|null{
  const match=CAPTION.exec(text);
  return match?`${/^t/i.test(match[1])?"table":"figure"}:${match[2].toUpperCase()}`:null;
}
const overlap=(a0:number,a1:number,b0:number,b1:number)=>Math.min(a1,b1)-Math.max(a0,b0);

/** Caption blocks: the "Fig. N" line plus the lines directly beneath it in the same column. */
export function captionBlocks(rows:TextRow[]):Caption[]{
  const sorted=[...rows].sort((a,b)=>a.top-b.top||a.x-b.x),blocks:Caption[]=[];
  for(const row of sorted){
    const key=captionKey(row.text);if(!key)continue;
    const block={key,x:row.x,top:row.top,bottom:row.bottom,width:row.width};
    for(const next of sorted){
      // A continuation line has the caption's type size and starts just below the lines taken so far.
      if(Math.abs(next.size-row.size)>row.size*.1||next.top<block.top+row.size*.5||next.top-block.bottom>row.size*.6+1)continue;
      if(captionKey(next.text)||overlap(block.x,block.x+block.width,next.x,next.x+next.width)<Math.min(next.width,block.width)*.5)continue;
      const right=Math.max(block.x+block.width,next.x+next.width);
      block.x=Math.min(block.x,next.x);block.width=right-block.x;block.bottom=next.bottom;
    }
    blocks.push(block);
  }
  return blocks;
}

/**
 * Body paragraphs are the lines that run across most of their column, plus the short closing line that
 * follows one. Labels inside a figure rarely do either, so these lines bound a figure from above or below.
 */
function bodyRows(rows:TextRow[],columnWidth:number,captions:Caption[]):TextRow[]{
  const inCaption=(r:TextRow)=>captions.some(c=>r.top>=c.top-1&&r.bottom<=c.bottom+1&&overlap(c.x,c.x+c.width,r.x,r.x+r.width)>0);
  const sorted=[...rows].sort((a,b)=>a.top-b.top),body:TextRow[]=[];
  for(const row of sorted){
    if(inCaption(row))continue;
    const full=row.width>=columnWidth*.7&&row.text.trim().length>=40;
    const follows=body.some(b=>row.top>b.bottom-1&&row.top-b.bottom<row.size*1.2+2&&Math.abs(b.x-row.x)<12&&Math.abs(b.size-row.size)<2);
    if(full||follows)body.push(row);
  }
  return body;
}

/**
 * The region of a figure or table, located from the PDF's own text layout instead of the model's estimate:
 * vertically it runs from its caption to the nearest caption or body paragraph in the same column;
 * horizontally it keeps the model's estimate. Returns null when the caption cannot be found.
 */
export function figureRegion(rows:TextRow[],caption:string,model:Box):Box|null{
  const key=captionKey(caption);if(!key)return null;
  const captions=captionBlocks(rows);
  const own=captions.filter(c=>c.key===key).sort((a,b)=>Math.abs(a.x-model.x)-Math.abs(b.x-model.x))[0];
  if(!own)return null;
  const left=model.x,right=model.x+model.width,width=right-left;
  if(overlap(left,right,own.x,own.x+own.width)<=0)return null;
  const obstacles=[...captions.filter(c=>c!==own),...bodyRows(rows,width,captions)].filter(o=>overlap(left,right,o.x,o.x+o.width)>width*.15);
  const gap=4;
  // Tables usually carry their caption above; figures below. Decide from where the model put the caption.
  const above=key.startsWith("table")&&own.top<model.y+model.height*.35;
  let top:number,bottom:number;
  if(above){
    top=own.bottom+gap;
    bottom=Math.min(985,...obstacles.filter(o=>o.top>=own.bottom).map(o=>o.top-gap));
  }else{
    bottom=own.top-gap;
    top=Math.max(15,...obstacles.filter(o=>o.bottom<=own.top).map(o=>o.bottom+gap));
  }
  if(bottom-top<25)return null;
  return {x:left,y:top,width,height:bottom-top};
}
