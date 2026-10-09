import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageBox } from './page-content';
const cache=new WeakMap<PDFDocumentProxy,Map<number,Promise<HTMLCanvasElement>>>();

export function pageCanvas(doc:PDFDocumentProxy,index:number):Promise<HTMLCanvasElement>{
  let pages=cache.get(doc);if(!pages){pages=new Map();cache.set(doc,pages);}
  const existing=pages.get(index);if(existing)return existing;
  const promise=(async()=>{
    const page=await doc.getPage(index),original=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(2.5,2200/Math.max(original.width,original.height))});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;
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
