"use client";
import { useMemo } from "react";
import type { LessonVisual } from "@/lib/lesson";
import { layoutDiagram } from "@/lib/diagram";

// Flowcharts and mechanism diagrams are drawn from validated data, never from model-written markup.
export default function DiagramView({visual,step,onStep}:{visual:LessonVisual;step:number;onStep:(n:number)=>void}){
  const nodes=visual.nodes||[],edges=visual.edges||[],mechanism=visual.type==="mechanism";
  const layout=useMemo(()=>layoutDiagram(nodes,edges),[nodes,edges]);
  const order=new Map(nodes.map((n,i)=>[n.id,i]));
  const nodeState=(id:string)=>{
    if(!mechanism){const i=order.get(id)!;return i===step?"active":i<step?"done":"todo";}
    const current=edges[step];
    if(current&&(current.from===id||current.to===id))return "active";
    return edges.slice(0,step).some(e=>e.from===id||e.to===id)?"done":"todo";
  };
  const edgeState=(i:number)=>{
    if(mechanism)return i===step?"active":i<step?"done":"todo";
    const from=order.get(edges[i].from)!,to=order.get(edges[i].to)!;
    if(Math.max(from,to)>step)return "todo";
    return Math.max(from,to)===step?"active":"done";
  };
  const activate=(n:number)=>(e:React.KeyboardEvent)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onStep(n);}};
  return <svg className="lesson-diagram" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`${mechanism?"机理图":"流程图"}：${visual.title}`}>
    <defs><marker id="diagram-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 Z" fill="context-stroke"/></marker></defs>
    {layout.routes.map((r,i)=><g key={i} className={`diagram-edge ${edgeState(i)}`} {...(mechanism?{role:"button",tabIndex:0,onClick:()=>onStep(i),onKeyDown:activate(i),"aria-label":`查看第 ${i+1} 步作用`}:{})}>
      <path d={r.d} markerEnd="url(#diagram-arrow)"/>
      {(mechanism||r.label)&&<text x={r.lx} y={r.ly} textAnchor="middle">{mechanism?`${i+1} `:""}{r.label.slice(0,10)}</text>}
    </g>)}
    {layout.nodes.map((n,i)=>{
      const cx=n.x+n.w/2,first=n.y+n.h/2-(n.lines.length-1)*8+4;
      return <g key={n.id} className={`diagram-node ${n.kind} ${nodeState(n.id)}`} {...(mechanism?{}:{role:"button",tabIndex:0,onClick:()=>onStep(i),onKeyDown:activate(i),"aria-label":`查看环节 ${i+1}：${n.label}`})}>
        {n.kind==="decision"?<polygon points={`${n.x+11},${n.y} ${n.x+n.w-11},${n.y} ${n.x+n.w},${n.y+n.h/2} ${n.x+n.w-11},${n.y+n.h} ${n.x+11},${n.y+n.h} ${n.x},${n.y+n.h/2}`}/>:<rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.kind==="input"||n.kind==="output"?n.h/2:n.kind==="store"?2:9}/>}
        {n.kind==="store"&&<path d={`M${n.x} ${n.y+5} H${n.x+n.w}`}/>}
        <text textAnchor="middle">{n.lines.map((line,k)=><tspan key={k} x={cx} y={first+k*16}>{line}</tspan>)}</text>
        <title>{n.label}{n.detail?`：${n.detail}`:""}</title>
      </g>;
    })}
  </svg>;
}
