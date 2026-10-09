"use client";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CircleHelp, Maximize2, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { Lesson } from "@/lib/lesson";
import RichText from "./rich-text";
import TokenAnimation from "./token-animation";

export default function LessonView({lesson,onAsk,busy,preview=false,expanded=false,previewNote}:{lesson:Lesson;onAsk:(question:string)=>void;busy:boolean;preview?:boolean;expanded?:boolean;previewNote?:string}){
  const [currentStep,setStep]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[choice,setChoice]=useState<number|null>(null),[checked,setChecked]=useState(false),[words,setWords]=useState("");
  const visual=lesson.visual,quiz=lesson.quiz,count=visual?.steps.length||0;
  const step=Math.min(currentStep,count-1);
  const [wide,setWide]=useState(false);
  useEffect(()=>{if(!wide)return;const previous=document.activeElement as HTMLElement;requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.lesson-dialog-close')?.focus());const fn=(e:KeyboardEvent)=>{if(e.key==="Escape")setWide(false);if(e.key==="Tab"){const list=document.querySelector('.lesson-dialog')?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,textarea,[tabindex="0"]');if(!list?.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',fn);return()=>{document.removeEventListener('keydown',fn);previous?.focus();};},[wide]);
  useEffect(()=>{setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);},[]);
  useEffect(()=>{if(!playing||!visual)return;const id=setInterval(()=>setStep(s=>(s+1)%count),2400/speed);return()=>clearInterval(id);},[playing,speed,count,visual]);
  const move=(n:number)=>{setPlaying(false);setStep(Math.max(0,Math.min(count-1,n)));};
  const points=(visual?.steps||[]).map((s,i)=>({x:24+i*252/(count-1),y:145-s.value*100}));
  const correct=choice===quiz?.correctIndex;
  return <div className={`lesson-view ${expanded?"lesson-full":""}`}>
    {visual&&<div className="lesson-animation"><div className="lesson-title"><Sparkles size={14}/><strong>{visual.title}</strong><span>动态讲解</span></div>
      {visual.type==="tokens"?<TokenAnimation steps={visual.steps} step={step}/>:<svg className="lesson-chart" viewBox={visual.type==="flow"?"0 0 300 112":"0 0 300 184"} role="img" aria-label={visual.title}>
        {visual.type==="flow"?<>
          <path d="M24 43 H276" className="lesson-track"/>
          <path d={`M24 43 H${points[step].x}`} className="lesson-trail"/>
          {visual.steps.map((s,i)=><g key={i} role="button" tabIndex={0} aria-label={`查看步骤 ${i+1}：${s.label}`} onClick={()=>move(i)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();move(i);}}} className={`lesson-node ${i===step?"active":""}`}><circle cx={points[i].x} cy="43" r={i===step?15:11}/><text x={points[i].x} y="47" textAnchor="middle">{i+1}</text><text x={points[i].x} y={i%2?92:75} textAnchor="middle" className="node-caption">{s.label.slice(0,count>5?5:7)}</text><title>{s.label}</title></g>)}
          {playing&&step<count-1&&<circle r="3.5" cy="43" className="lesson-particle"><animate attributeName="cx" from={points[step].x} to={points[step+1].x} dur={`${2.4/speed}s`} repeatCount="indefinite"/></circle>}
        </>:<>
          <path d="M24 20 V146 H281" className="chart-axis"/>
          {visual.type==="curve"?<><polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')} className="lesson-trail curve"/>{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" className="curve-dot"/>)}<circle r="6" className="lesson-marker" style={{transform:`translate(${points[step].x}px,${points[step].y}px)`}}/></>:visual.steps.map((s,i)=>{const width=Math.min(38,220/count),x=35+i*240/count;return <g key={i}><rect x={x} width={width} y={145-(i<=step?s.value:0)*100} height={(i<=step?s.value:0)*100} className={`lesson-bar ${i===step?"active":""}`}/><text x={x+width/2} y="160" textAnchor="middle" className="node-caption">{s.label.slice(0,5)}</text></g>;})}
          <text x="25" y="14" className="axis-label">{visual.yLabel.slice(0,20)}</text><text x="281" y="179" textAnchor="end" className="axis-label">{visual.xLabel.slice(0,22)}</text>
        </>}
      </svg>}
      <div className="lesson-step" aria-live={playing?"off":"polite"}><span>STEP {String(step+1).padStart(2,"0")} / {count}</span><strong>{visual.steps[step].label}</strong><RichText>{visual.steps[step].detail}</RichText></div>
      <div className="animation-controls"><button aria-label={playing?"暂停动画":"播放动画"} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={14}/>:<Play size={14}/>}</button><button aria-label="重播动画" onClick={()=>{setStep(0);setPlaying(true);}}><RotateCcw size={13}/></button><input aria-label="动画步骤" type="range" min="0" max={count-1} value={step} onChange={e=>move(Number(e.target.value))}/><button aria-label="上一步动画" disabled={step===0} onClick={()=>move(step-1)}><ChevronLeft size={14}/></button><button aria-label="下一步动画" disabled={step===count-1} onClick={()=>move(step+1)}><ChevronRight size={14}/></button><select aria-label="动画速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></div>
      <small className="illustration-note">AI 教学示意，图中数值不代表论文实测数据</small>
      {!expanded&&<button className="lesson-expand" onClick={()=>{setPlaying(false);setWide(true);}}><Maximize2 size={12}/>展开讲解</button>}
    </div>}
    {!preview&&quiz&&<div className="understanding-check"><div className="lesson-title"><CircleHelp size={14}/><strong>轮到你，试着想一想</strong></div><RichText>{quiz.question}</RichText><div className="quiz-options" role="radiogroup" aria-label="理解检查答案">{quiz.options.map((option,i)=><button role="radio" aria-checked={choice===i} key={i} disabled={checked} className={`${choice===i?"chosen":""} ${checked&&i===quiz.correctIndex?"correct":""} ${checked&&choice===i&&!correct?"incorrect":""}`} onClick={()=>setChoice(i)}><span>{String.fromCharCode(65+i)}</span><div><RichText>{option}</RichText></div>{checked&&i===quiz.correctIndex&&<Check size={14}/>}</button>)}</div>
      {!checked?<button className="quiz-submit" disabled={choice===null} onClick={()=>setChecked(true)}>检查我的理解<Check size={13}/></button>:<div className={`quiz-feedback ${correct?"good":""}`} role="status"><strong>{correct?"理解正确，继续保持。":"这个地方容易混淆，我们再拆开看。"}</strong><RichText>{quiz.explanation}</RichText><div><button className="text-button" onClick={()=>{setChecked(false);setChoice(null);}}>再试一次</button><button className="text-button" disabled={busy} onClick={()=>onAsk(`你刚才的理解检查题是：${quiz.question}。我选择了“${quiz.options[choice!] }”，正确答案是“${quiz.options[quiz.correctIndex]}”。请针对我的理解${correct?"补充一个稍难的应用例子":"解释误区，并换一个简单例子"}。`)}>继续讲解<ChevronRight size={12}/></button></div></div>}
      <details className="own-words"><summary>也可以用自己的话回答</summary><textarea aria-label="用自己的话回答理解检查" rows={3} value={words} maxLength={2000} placeholder="写下你的理解，让 Codex 帮你检查…" onChange={e=>setWords(e.target.value)}/><button className="quiz-submit" disabled={busy||!words.trim()} onClick={()=>{onAsk(`你刚才的理解检查题是：${quiz.question}。我的理解是：${words.trim()}。请先判断我是否理解正确，再指出遗漏或误区。`);setWords("");}}>请 Codex 检查<Sparkles size={13}/></button></details>
    </div>}
    {preview&&<p className="lesson-generating">{previewNote||"正在结合论文补充讲解…"}</p>}
    {wide&&visual&&createPortal(<div className="lesson-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setWide(false);}}><div className="lesson-dialog" role="dialog" aria-modal="true" aria-label="展开的动态讲解"><div className="lesson-dialog-heading"><h2>{visual.title}</h2><button className="icon-btn lesson-dialog-close" aria-label="关闭展开讲解" onClick={()=>setWide(false)}><X size={20}/></button></div><LessonView lesson={lesson} busy={busy} onAsk={q=>{setWide(false);onAsk(q);}} preview={preview} previewNote={previewNote} expanded/></div></div>,document.querySelector('.app-shell')||document.body)}
  </div>;
}
