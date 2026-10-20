import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageBox } from './page-content';
import { refineBox, type TextLine } from './box-refine';
const captionCache=new WeakMap<PDFDocumentProxy,Map<number,Promise<TextLine[]>>>();
const CAPTION=/^\s*(?:Fig(?:ure)?s?\.?|FIG(?:URE)?\.?|Tab(?:le)?\.?|TABLE)\s*[0-9IVX]+/;

/** Lines of a born-digital page that begin a figure or table caption, in 0-1000 page units. Scans have none. */
export function captionLines(doc:PDFDocumentProxy,index:number):Promise<TextLine[]>{
  let pages=captionCache.get(doc);if(!pages){pages=new Map();captionCache.set(doc,pages);}
  const existing=pages.get(index);if(existing)return existing;
  const promise=(async()=>{
    const page=await doc.getPage(index),{width,height}=page.getViewport({scale:1}),content=await page.getTextContent();
    return content.items.flatMap(item=>{
      if(!("str" in item)||!CAPTION.test(item.str))return [];
      const size=Math.abs(item.transform[3])||item.height||10;
      return [{x:item.transform[4]/width*1000,top:(height-item.transform[5]-size)/height*1000,width:Math.max(item.width,1)/width*1000}];
    });
  })().catch(()=>[]);
  pages.set(index,promise);
  return promise;
}
const cache=new WeakMap<PDFDocumentProxy,Map<number,Promise<HTMLCanvasElement>>>();

export function pageCanvas(doc:PDFDocumentProxy,index:number):Promise<HTMLCanvasElement>{
  let pages=cache.get(doc);if(!pages){pages=new Map();cache.set(doc,pages);}
  const existing=pages.get(index);if(existing)return existing;
  const promise=(async()=>{
    const page=await doc.getPage(index),original=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(2.5,2200/Math.max(original.width,original.height))});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    // The print intent renders without animation frames, which browsers suspend while the tab is in the
    // background; otherwise recognition of a long paper stalls as soon as the reader switches tabs.
    await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport,intent:'print'}).promise;
    return canvas;
  })();
  pages.set(index,promise);
  // Reuse one raster for every figure on a page, with bounded retained page memory.
  while(pages.size>4)pages.delete(pages.keys().next().value!);
  void promise.catch(()=>{if(pages?.get(index)===promise)pages.delete(index);});
  return promise;
}

export function regionCanvas(source:HTMLCanvasElement,box:PageBox):HTMLCanvasElement{
  const x=Math.max(0,Math.floor(box.x/1000*source.width)),y=Math.max(0,Math.floor(box.y/1000*source.height));
  const width=Math.max(1,Math.min(source.width-x,Math.ceil(box.width/1000*source.width)));
  const height=Math.max(1,Math.min(source.height-y,Math.ceil(box.height/1000*source.height)));
  const target=document.createElement('canvas');target.width=width;target.height=height;
  target.getContext('2d')!.drawImage(source,x,y,width,height,0,0,width,height);
  return target;
}

type InkGrid={ink:Uint8Array;columns:number;rows:number};
const grids=new WeakMap<HTMLCanvasElement,InkGrid|null>();
function inkGrid(source:HTMLCanvasElement):InkGrid|null{
  if(grids.has(source))return grids.get(source)!;
  let grid:InkGrid|null=null;
  try{
    const columns=Math.min(source.width,640),rows=Math.max(1,Math.round(source.height*columns/source.width));
    const small=document.createElement('canvas');small.width=columns;small.height=rows;
    const context=small.getContext('2d',{willReadFrequently:true})!;context.fillStyle='#fff';context.fillRect(0,0,columns,rows);context.drawImage(source,0,0,columns,rows);
    const data=context.getImageData(0,0,columns,rows).data,ink=new Uint8Array(columns*rows);let dark=0;
    for(let i=0;i<ink.length;i++)if(data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114<215){ink[i]=1;dark++;}
    // A mostly dark page has no white margins to measure against.
    if(dark<ink.length*.5)grid={ink,columns,rows};
  }catch{/* keep the model's region */}
  grids.set(source,grid);return grid;
}
/** Adjust a model-estimated region (0-1000 units) so that the crop neither clips nor pads the figure or formula. */
export function snapBox(source:HTMLCanvasElement,box:PageBox):PageBox{
  const grid=inkGrid(source);if(!grid)return box;
  const fx=grid.columns/1000,fy=grid.rows/1000;
  const refined=refineBox(grid.ink,grid.columns,grid.rows,{x:box.x*fx,y:box.y*fy,width:box.width*fx,height:box.height*fy});
  return {x:refined.x/fx,y:refined.y/fy,width:refined.width/fx,height:refined.height/fy};
}
