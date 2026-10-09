export function readingIndexes(count:number,page:number,mode:"paged"|"scroll",span:number,pdf=false):number[]{
  if(mode==="scroll")return Array.from({length:count},(_,i)=>i);
  if(pdf)return [page-1];
  const start=Math.floor((page-1)/span)*span;
  return Array.from({length:Math.min(span,count-start)},(_,i)=>start+i);
}
export function colorInk(hex:string){
  const rgb=parseInt(hex.replace('#',''),16);
  const brightness=((rgb>>16)*299+((rgb>>8)&255)*587+(rgb&255)*114)/1000;
  return brightness>145?'#2b332e':'#edf2eb';
}
