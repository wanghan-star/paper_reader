import type { DiagramEdge, DiagramNode, LessonVisual } from "./lesson";

export type PlacedNode=DiagramNode&{x:number;y:number;w:number;h:number;lines:string[]};
export type Route=DiagramEdge&{d:string;lx:number;ly:number};
export type DiagramLayout={nodes:PlacedNode[];routes:Route[];width:number;height:number};

// CJK glyphs take a full em, Latin letters roughly half.
const units=(text:string)=>[...text].reduce((sum,c)=>sum+(c.charCodeAt(0)>255?1:.56),0);
function wrap(label:string,capacity:number):string[]{
  const lines:string[]=[];let current="";
  for(const c of label){
    if(current&&units(current+c)>capacity){lines.push(current);current=c===" "?"":c;}else current+=c;
  }
  if(current)lines.push(current);
  if(lines.length>3){lines.length=3;lines[2]=lines[2].slice(0,-1)+"…";}
  return lines;
}

/** Layered top-to-bottom layout; edges that point back up (loops, feedback) run along the right side. */
export function layoutDiagram(nodes:DiagramNode[],edges:DiagramEdge[],width=360):DiagramLayout{
  const ids=nodes.map(n=>n.id),out=new Map(ids.map(id=>[id,[] as string[]]));
  for(const e of edges)out.get(e.from)?.push(e.to);
  const state=new Map<string,number>(),back=new Set<string>();
  const visit=(id:string)=>{state.set(id,1);for(const next of out.get(id)||[]){if(state.get(next)===1)back.add(id+">"+next);else if(!state.get(next))visit(next);}state.set(id,2);};
  for(const id of ids)if(!state.get(id))visit(id);
  const rank=new Map(ids.map(id=>[id,0]));
  for(let i=0;i<ids.length;i++)for(const e of edges)if(!back.has(e.from+">"+e.to))rank.set(e.to,Math.max(rank.get(e.to)!,rank.get(e.from)!+1));
  // An input that joins late sits just above the step it feeds, instead of sending a long edge through the chart.
  const forward=edges.filter(e=>!back.has(e.from+">"+e.to));
  for(const id of ids)if(!forward.some(e=>e.to===id)){const targets=forward.filter(e=>e.from===id).map(e=>rank.get(e.to)!);if(targets.length)rank.set(id,Math.min(...targets)-1);}
  const layers:string[][]=[];
  for(const id of ids)(layers[rank.get(id)!]??=[]).push(id);
  // Order each layer by where its predecessors sit, to keep edges from crossing needlessly.
  const position=new Map<string,number>();
  layers.forEach((layer,r)=>{
    if(r){
      const center=(id:string)=>{const from=edges.filter(e=>e.to===id&&position.has(e.from)).map(e=>position.get(e.from)!);return from.length?from.reduce((a,b)=>a+b,0)/from.length:.5;};
      const keyed=layer.map((id,i)=>({id,key:center(id),i})).sort((a,b)=>a.key-b.key||a.i-b.i);
      layer.splice(0,layer.length,...keyed.map(k=>k.id));
    }
    layer.forEach((id,i)=>position.set(id,(i+.5)/layer.length));
  });
  const byId=new Map(nodes.map(n=>[n.id,n])),placed=new Map<string,PlacedNode>();
  let y=6;
  for(const layer of layers){
    const slot=width/layer.length,w=Math.min(176,slot-14);
    const boxes=layer.map((id,i)=>{const node=byId.get(id)!,lines=wrap(node.label,Math.max(3,(w-(node.kind==="decision"?30:16))/12.5));return {...node,lines,w,h:20+lines.length*16,x:slot*(i+.5)-w/2,y:0};});
    const tallest=Math.max(...boxes.map(b=>b.h));
    for(const box of boxes){box.y=y+(tallest-box.h)/2;placed.set(box.id,box);}
    y+=tallest+46;
  }
  const height=y-46+8,hasBack=back.size>0;
  const routes=edges.map((e,index)=>{
    const a=placed.get(e.from)!,b=placed.get(e.to)!,ax=a.x+a.w/2,bx=b.x+b.w/2,ay=a.y+a.h/2,by=b.y+b.h/2;
    if(back.has(e.from+">"+e.to)){
      const bulge=width+8+(index%3)*9;
      return {...e,d:`M${a.x+a.w} ${ay} C${bulge} ${ay} ${bulge} ${by} ${b.x+b.w+3} ${by}`,lx:.25*(a.x+a.w+b.x+b.w)/2+.75*bulge-6,ly:(ay+by)/2};
    }
    if(rank.get(e.from)===rank.get(e.to)){
      const right=ax<bx,x1=right?a.x+a.w:a.x,x2=right?b.x-3:b.x+b.w+3;
      return {...e,d:`M${x1} ${ay} L${x2} ${by}`,lx:(x1+x2)/2,ly:ay-7};
    }
    const y1=a.y+a.h,y2=b.y-3,bend=(y2-y1)/2;
    return {...e,d:`M${ax} ${y1} C${ax} ${y1+bend} ${bx} ${y2-bend} ${bx} ${y2}`,lx:(ax+bx)/2,ly:(y1+y2)/2+4};
  });
  return {nodes:ids.map(id=>placed.get(id)!),routes,width:width+(hasBack?34:0),height};
}

/** A flowchart is walked node by node; a mechanism interaction by interaction. */
export function diagramSteps(visual:LessonVisual):LessonVisual["steps"]{
  const nodes=visual.nodes||[],edges=visual.edges||[],name=(id:string)=>nodes.find(n=>n.id===id)?.label||id;
  if(visual.type==="flowchart")return nodes.map(n=>({label:n.label,detail:n.detail,value:0}));
  return edges.map(e=>({label:`${name(e.from)} → ${name(e.to)}${e.label?`：${e.label}`:""}`,detail:e.detail,value:0}));
}
