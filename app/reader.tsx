"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ArrowDownToLine, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, FileText, Languages, Leaf, LoaderCircle, Menu, MessageSquareText, Minus, Palette, Plus, ScanLine, Settings2, Sparkles, Square, Upload, X } from "lucide-react";
import demo from "@/lib/demo.json";
import { DEFAULT_SETTINGS, extractText, toSentences, translationBatches, type PaperPage, type Settings } from "@/lib/paper";
import SettingsDialog from "./settings-dialog";
import { callCodex } from "@/lib/codex-client";
import { readingIndexes, colorInk } from "@/lib/reading";
import RichText from "./rich-text";
import ReadingPages from "./reading-pages";
import AppearanceDialog from "./appearance-dialog";
import LessonView from "./lesson-view";
import { instantVisual } from "@/lib/lesson-preview";
import type { Lesson } from "@/lib/lesson";
import {pageFromBlocks,toReadingParagraphs} from '@/lib/page-content';
import {pageCanvas} from '@/lib/pdf-render';

type Message={id:number;role:"user"|"assistant";content:string;image?:string;page:number;error?:boolean;lesson?:Lesson;visual?:Lesson["visual"];streaming?:boolean;instant?:boolean};
type Attachment={type:"image"|"text";value:string;page:number;context:string};
const seedPages:PaperPage[]=demo.pages.map(p=>({...p,text:p.sentences.map(s=>s.en).join("\n")}));

async function loadPdf(data:Uint8Array|string) {
  const pdf=await import("pdfjs-dist");
  pdf.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs";
  return pdf.getDocument(typeof data==="string"?{url:data,cMapUrl:"/cmaps/",cMapPacked:true,standardFontDataUrl:"/standard_fonts/",wasmUrl:"/wasm/"}:{data,cMapUrl:"/cmaps/",cMapPacked:true,standardFontDataUrl:"/standard_fonts/",wasmUrl:"/wasm/"}).promise;
}
async function pageImage(doc:PDFDocumentProxy,index:number) {
  return (await pageCanvas(doc,index)).toDataURL("image/jpeg",.94);
}

export default function Reader() {
  const [settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS),[settingsOpen,setSettingsOpen]=useState(false);
  const [pages,setPages]=useState<PaperPage[]>(seedPages),[page,setPage]=useState(1),[isDemo,setDemo]=useState(true),[title,setTitle]=useState(demo.title),[filename,setFilename]=useState("transformer-reading-sample.pdf"),[doc,setDoc]=useState<PDFDocumentProxy|null>(null);
  const [tab,setTab]=useState<"bilingual"|"pdf">("bilingual"),[zoom,setZoom]=useState(100),[loading,setLoading]=useState(false),[dragging,setDragging]=useState(false),[translation,setTranslation]=useState(""),[toast,setToast]=useState<{message:string;error?:boolean}|null>(null);
  const [assistantOpen,setAssistantOpen]=useState(false),[navOpen,setNavOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[question,setQuestion]=useState(""),[chatBusy,setChatBusy]=useState(false),[attachment,setAttachment]=useState<Attachment|null>(null);
  const [selection,setSelection]=useState<{text:string;x:number;y:number;page:number}|null>(null);
  const [appearanceOpen,setAppearanceOpen]=useState(false);
  const [pendingAuto,setPendingAuto]=useState<number|null>(null);
  const activeModel=settings.codexModel;
  const [codexReady,setCodexReady]=useState<boolean|null>(null);
  const fileInput=useRef<HTMLInputElement>(null),reader=useRef<HTMLDivElement>(null),chatEnd=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null);
  const docRef=useRef<PDFDocumentProxy|null>(null),epoch=useRef(0),translationController=useRef<AbortController|null>(null),chatController=useRef<AbortController|null>(null),uploadLock=useRef(false),messageId=useRef(0);
  const current=pages[page-1];
  const continuous=settings.readingMode==="scroll";
  const shown=readingIndexes(pages.length,page,settings.readingMode,settings.readingSpan,tab==="pdf");
  const step=tab==="bilingual"&&!continuous?settings.readingSpan:1;
  const groupStart=Math.floor((page-1)/step)*step+1;
  const lastGroup=groupStart+step>pages.length;
  const scrollFrame=useRef(0);
  const goToPage=(n:number)=>{setPage(n);if(continuous)requestAnimationFrame(()=>reader.current?.querySelector<HTMLElement>(`[data-paper-page="${n}"]`)?.scrollIntoView({block:"start"}));};
  const original=(n:number)=>{setPage(n);setTab("pdf");};
  const onReadingScroll=()=>{setSelection(null);if(!continuous||scrollFrame.current)return;scrollFrame.current=requestAnimationFrame(()=>{scrollFrame.current=0;const el=reader.current;if(!el)return;const top=el.getBoundingClientRect().top+90;const found=Array.from(el.querySelectorAll<HTMLElement>("[data-paper-page]")).find(section=>{const box=section.getBoundingClientRect();return box.top<=top&&box.bottom>top;});if(found)setPage(Number(found.dataset.paperPage));});};
  const totalSentences=pages.reduce((sum,p)=>sum+p.sentences.length,0),translated=pages.reduce((sum,p)=>sum+p.sentences.filter(s=>s.zh).length,0);
  const progress=totalSentences?Math.round(translated/totalSentences*100):0;
  const notify=useCallback((message:string,error=false)=>setToast({message,error}),[]);
  const closeSettings=useCallback(()=>setSettingsOpen(false),[]);
  const closeAppearance=useCallback(()=>setAppearanceOpen(false),[]);
  useEffect(()=>{
    try{const raw=JSON.parse(localStorage.getItem("zhiye-settings")||"{}");const safe:Settings={...DEFAULT_SETTINGS};if(typeof raw.codexModel==="string"&&raw.codexModel)safe.codexModel=raw.codexModel;if(["forest","sepia","mist","night","custom"].includes(raw.theme))safe.theme=raw.theme;if(typeof raw.background==="string"&&/^#[0-9a-f]{6}$/i.test(raw.background))safe.background=raw.background;if(raw.readingMode==="scroll")safe.readingMode="scroll";if([14,16,18,20,22,24].includes(raw.textSize))safe.textSize=raw.textSize;if([1,2,3,4].includes(raw.readingSpan))safe.readingSpan=raw.readingSpan;for(const k of ["compact","autoTranslate","teaching"] as const)if(typeof raw[k]==="boolean")safe[k]=raw[k];setSettings(safe);localStorage.setItem("zhiye-settings",JSON.stringify(safe));sessionStorage.removeItem("zhiye-key");}catch{/* storage may be unavailable */}
    const statusAbort=new AbortController();fetch("/api/codex/status",{signal:statusAbort.signal}).then(async r=>{if(!r.ok)throw new Error();return await r.json() as {available:boolean};}).then(async s=>{setCodexReady(s.available);if(s.available){const r=await fetch("/api/codex/models",{signal:statusAbort.signal});if(r.ok){const data=await r.json() as {models:{id:string;image:boolean;isDefault?:boolean}[]};const supported=data.models.filter(m=>m.image);setSettings(current=>{if(supported.some(m=>m.id===current.codexModel))return current;const model=supported.find(m=>m.isDefault)||supported[0];if(!model)return current;const next={...current,codexModel:model.id};try{localStorage.setItem("zhiye-settings",JSON.stringify(next));}catch{}return next;});}}}).catch(e=>{if(e.name!=="AbortError")setCodexReady(ready=>ready===true?true:false);});
    let alive=true;const version=epoch.current;
    loadPdf("/sample.pdf").then(pdf=>{if(alive&&version===epoch.current){docRef.current=pdf;setDoc(pdf);}else void pdf.destroy();}).catch(()=>{if(alive&&version===epoch.current)notify("示例 PDF 加载失败，你仍可以上传自己的论文。",true);});
    return()=>{alive=false;statusAbort.abort();cancelAnimationFrame(scrollFrame.current);translationController.current?.abort();chatController.current?.abort();void docRef.current?.destroy();};
  },[notify]);
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(null),6000);return()=>clearTimeout(id);},[toast]);
  useEffect(()=>{if(!continuous)reader.current?.scrollTo({top:0});setSelection(null);},[page,tab,continuous,settings.readingSpan]);
  useEffect(()=>{if(continuous)requestAnimationFrame(()=>reader.current?.querySelector<HTMLElement>(`[data-paper-page="${page}"]`)?.scrollIntoView({block:"start"}));},[tab,continuous]);
  useEffect(()=>{if(!messages.length&&!chatBusy)return;chatEnd.current?.scrollIntoView({behavior:"smooth",block:"end"});},[messages,chatBusy]);
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==="Escape"){setSelection(null);setNavOpen(false);setAssistantOpen(false);}if((e.ctrlKey||e.metaKey)&&e.key===","){e.preventDefault();setSettingsOpen(true);}};window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn);},[]);
  const saveSettings=(s:Settings,message="Codex 设置已保存")=>{setSettings(s);try{localStorage.setItem("zhiye-settings",JSON.stringify(s));}catch{notify("设置已应用，但浏览器不允许保存。",true);return;}notify(message);};
  const requireLogin=()=>{if(codexReady!==false)return true;setSettingsOpen(true);notify("请先登录本机 Codex，并测试连接。",true);return false;};
  const api=(task:string,payload:Record<string,unknown>,signal:AbortSignal,onProgress?:(content:string,visual?:Lesson["visual"])=>void)=>callCodex(task,payload,settings.codexModel,signal,p=>onProgress?.(p.content||"",p.visual));
  const translate=async(all=false,forceOCR=false,focusPage=page)=>{
    if(loading||translation)return;if(!requireLogin())return;
    const pdf=docRef.current;if(!pdf){notify("PDF 仍在加载，请稍后再试。",true);return;}
    const controller=new AbortController();translationController.current=controller;const version=epoch.current;
    const targets=all?pages.map((_,i)=>i):forceOCR||continuous||tab==="pdf"?[focusPage-1]:shown;
    setTab("bilingual");setTranslation("正在准备翻译…");
    try{
      for(const index of targets){
        if(controller.signal.aborted)throw new DOMException("取消","AbortError");
        let p=pages[index];
        if((forceOCR&&index===focusPage-1)||p.needsVision||p.text.replace(/\s/g,"").length<35){
          setTranslation(`正在识别第 ${index+1} / ${pages.length} 页 · 正文、公式与图表…`);
          const image=await pageImage(pdf,index+1);if(controller.signal.aborted)throw new DOMException("取消","AbortError");
          const result=await api("layout",{image,context:p.text,page:index+1},controller.signal);if(epoch.current!==version)return;
          if(!result.blocks)throw new Error(`第 ${index+1} 页识别未完成，原页已保留，请重新识别。`);
          p=pageFromBlocks(result.blocks,p);
          setPages(prev=>prev.map((value,i)=>i===index?p:value));
        }
        const batches=translationBatches(p.sentences);
        for(let b=0;b<batches.length;b++){
          const status=`正在翻译第 ${index+1} / ${pages.length} 页 · ${b+1}/${batches.length} 批`;
          setTranslation(status);
          const apply=(rows:{id:number;zh:string}[])=>{
            if(epoch.current!==version)return;
            const lookup=new Map(rows.map(r=>[r.id,r.zh]));
            setPages(prev=>prev.map((value,i)=>i===index?{...value,sentences:value.sentences.map(s=>lookup.has(s.id)?{...s,zh:lookup.get(s.id)}:s)}:value));
          };
          const result=await callCodex("translate",{sentences:batches[b].map(({id,en})=>({id,en}))},settings.codexModel,controller.signal,progress=>{
            if(epoch.current!==version||!progress.translation)return;
            const {translations,completed,total,retrying}=progress.translation;
            apply(translations);
            setTranslation(`${status} · ${completed}/${total} 句${retrying?" · 正在自动补译":""}`);
          });if(epoch.current!==version)return;
          apply(result.translations);
        }
      }
      notify(all?"全文翻译完成，可以慢慢读了。":"当前页翻译完成。");
    }catch(e){if((e as Error).name==="AbortError")notify("翻译已停止，完成的内容已保留。");else notify((e as Error).message,true);}
    finally{if(version===epoch.current){setTranslation("");translationController.current=null;}}
  };
  useEffect(()=>{if(pendingAuto===null||loading)return;setPendingAuto(null);if(pendingAuto===epoch.current&&settings.autoTranslate)void translate(true);},[pendingAuto,loading]);
  const upload=async(file:File)=>{
    if(uploadLock.current)return;
    if(!/\.pdf$/i.test(file.name)){notify("请选择 PDF 格式的论文。",true);return;}
    if(file.size>60*1024*1024){notify("PDF 超过 60 MB，请压缩后上传。",true);return;}
    uploadLock.current=true;setLoading(true);setPendingAuto(null);
    translationController.current?.abort();chatController.current?.abort();setTranslation("");setChatBusy(false);
    const version=++epoch.current;let nextDoc:PDFDocumentProxy|null=null;
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());if(!new TextDecoder().decode(bytes.slice(0,1024)).includes("%PDF-"))throw new Error("文件不是有效的 PDF。");
      nextDoc=await loadPdf(bytes);if(nextDoc.numPages>350)throw new Error("论文超过 350 页，请分卷上传。");
      const parsed:PaperPage[]=[];
      for(let index=1;index<=nextDoc.numPages;index++){
        const pdfPage=await nextDoc.getPage(index);const text=extractText((await pdfPage.getTextContent()).items.filter(item=>"str"in item) as Parameters<typeof extractText>[0],pdfPage.getViewport({scale:1}).width);
        const sentences=toReadingParagraphs(text);parsed.push({text,sentences,heading:sentences.find(s=>s.heading&&s.en.length>4)?.en||`第 ${index} 页`,needsVision:true});
      }
      if(version!==epoch.current){void nextDoc.destroy();return;}
      const metadata=await nextDoc.getMetadata().catch(()=>null);const info=metadata?.info as {Title?:string}|undefined;
      const nextTitle=typeof info?.Title==="string"&&info.Title.trim()&&info.Title.length<200&&!/untitled|microsoft word/i.test(info.Title)?info.Title.trim():file.name.replace(/\.pdf$/i,"");
      const previous=docRef.current;docRef.current=nextDoc;setDoc(nextDoc);setTitle(nextTitle);setFilename(file.name);setPages(parsed);setPage(1);setDemo(false);setTab("bilingual");setMessages([]);setAttachment(null);setSelection(null);setNavOpen(false);
      // Let the current viewer cancel rendering before destroying its document.
      setTimeout(()=>void previous?.destroy(),100);
      if(settings.autoTranslate){setPendingAuto(version);notify(`已导入 ${nextDoc.numPages} 页，正在自动交给 Codex 翻译全文。`);}else notify(`已导入 ${nextDoc.numPages} 页论文。${parsed[0].text.length<35?"检测到扫描页，点击翻译会自动识别。":"点击“翻译当前页”开始中英对照。"}`);
    }catch(e){if(nextDoc&&nextDoc!==docRef.current)void nextDoc.destroy();notify((e as Error).name==="PasswordException"?"这份 PDF 已加密，请解锁后重新上传。":(e as Error).message||"无法读取 PDF，请检查文件是否损坏。",true);}
    finally{uploadLock.current=false;setLoading(false);if(fileInput.current)fileInput.current.value="";}
  };
  const selectText=()=>{
    const selected=window.getSelection();const text=selected?.toString().trim();
    if(!text||!selected?.rangeCount||text.length<2){setSelection(null);return;}
    const container=reader.current;if(!container?.contains(selected.anchorNode))return;
    const rect=selected.getRangeAt(0).getBoundingClientRect();
    const anchor=selected.anchorNode instanceof Element?selected.anchorNode:selected.anchorNode?.parentElement;const selectedPage=Number(anchor?.closest("[data-paper-page]")?.getAttribute("data-paper-page"))||page;
    setSelection({page:selectedPage,text:text.slice(0,6000),x:Math.max(90,Math.min(window.innerWidth-110,rect.left+rect.width/2)),y:Math.max(88,Math.min(window.innerHeight-60,rect.bottom+8))});
  };
  const attachText=(text:string,sourcePage=page)=>{setAttachment({type:"text",value:text,page:sourcePage,context:pages[sourcePage-1]?.text||""});setAssistantOpen(true);setSelection(null);window.getSelection()?.removeAllRanges();input.current?.focus();};
  const attachImage=(image:string,sourcePage=page)=>{setAttachment({type:"image",value:image,page:sourcePage,context:pages[sourcePage-1]?.text||""});setAssistantOpen(true);input.current?.focus();};
  const ask=async(override?:string,sourcePage?:number)=>{
    if(chatBusy||loading)return;const q=(override||question).trim()||(attachment?.type==="text"?"请用通俗中文解释这段文字，说明关键术语，必要时举例。":attachment?.type==="image"?"请详细解释这张图的含义，以及它与论文的关系。":"");if(!q)return;
    if(!requireLogin())return;
    const selected=sourcePage?null:attachment;const usedPage=selected?.page||sourcePage||page;const combined=selected?.type==="text"?`${q}\n\n选中文字：\n${selected.value}`:q;
    const user:Message={id:++messageId.current,role:"user",content:combined,page:usedPage,image:selected?.type==="image"?selected.value:undefined};
    const previous=messages.filter(m=>!m.error).map(m=>({role:m.role,content:m.content}));
    const replyId=++messageId.current;const quickVisual=settings.teaching?instantVisual(combined):undefined;
    setMessages(prev=>[...prev,user,{id:replyId,role:"assistant",content:"",page:usedPage,streaming:true,visual:quickVisual,instant:!!quickVisual}]);setQuestion("");setAttachment(null);setChatBusy(true);setAssistantOpen(true);
    const controller=new AbortController();chatController.current=controller;const version=epoch.current;
    try{const result=await api("chat",{question:combined,title,page:usedPage,context:selected?.context||(sourcePage?pages[sourcePage-1]?.text||"":tab==="bilingual"&&!continuous?shown.map(i=>`原文第 ${i+1} 页\n${pages[i].text}`).join("\n\n"):current.text),image:user.image,history:previous,teaching:settings.teaching},controller.signal,(content,visual)=>{if(version===epoch.current)setMessages(prev=>prev.map(m=>m.id===replyId?{...m,content,visual:visual||m.visual,instant:visual?false:m.instant}:m));});if(version!==epoch.current)return;setMessages(prev=>prev.map(m=>m.id===replyId?{...m,content:result.content,lesson:result.lesson,visual:undefined,streaming:false}:m));}
    catch(e){if(version!==epoch.current)return;const stopped=(e as Error).name==="AbortError";setMessages(prev=>prev.map(m=>m.id===replyId?{...m,content:stopped&&m.content?m.content+"\n\n*回答已停止。*":stopped?"回答已停止，可以重新提问。":(e as Error).message||"回答失败，请重试。",visual:undefined,streaming:false,error:true}:m));setAttachment(selected);setQuestion(q);}
    finally{if(version===epoch.current){setChatBusy(false);chatController.current=null;}}
  };
  const exportTranslation=()=>{
    const content=`# ${title}\n\n`+pages.map((p,i)=>`## 第 ${i+1} 页\n\n`+p.sentences.map(s=>`${s.zh||"[尚未翻译]"}\n\n${s.en}`).join("\n\n")).join("\n\n---\n\n");
    const url=URL.createObjectURL(new Blob([content],{type:"text/markdown;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=filename.replace(/\.pdf$/i,"")+"-中英对照.md";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify("中英对照已导出。");
  };
  return <div className={`app-shell ${settings.compact?"compact-reading":""}`} data-theme={settings.theme} data-dark={settings.theme==="night"||(settings.theme==="custom"&&colorInk(settings.background)==="#edf2eb")} style={{"--reading-size":`${settings.textSize}px`,...(settings.theme==="custom"?{"--paper":settings.background,"--ink":colorInk(settings.background)}:{})} as CSSProperties} onDragOver={e=>{e.preventDefault();if(e.dataTransfer.types.includes("Files"))setDragging(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false);}} onDrop={e=>{e.preventDefault();setDragging(false);const file=e.dataTransfer.files[0];if(file)void upload(file);}}>
    <header className="app-header"><div className="brand"><div className="brand-mark"><BookOpen size={23}/><span/></div><div><strong>知页<span className="brand-en">Paperleaf</span></strong><small>让理解，多一页。</small></div></div><div className="header-center"><span className="status-dot"/>一个安静的论文阅读空间</div><div className="header-actions"><button className="btn appearance-trigger" aria-label="阅读与主题设置" onClick={()=>setAppearanceOpen(true)}><Palette size={16}/><span>阅读设置</span></button><button aria-label="Codex 设置" className="btn settings-trigger" onClick={()=>setSettingsOpen(true)}><Settings2 size={16}/><span>Codex 设置</span>{codexReady&&<span className="connected-dot"/>}</button><button className="btn primary upload-trigger" disabled={loading} onClick={()=>fileInput.current?.click()}>{loading?<LoaderCircle className="spin" size={16}/>:<Plus size={17}/>}<span>{loading?"正在读取":"上传论文"}</span></button></div></header>
    <input type="file" ref={fileInput} accept="application/pdf,.pdf" className="sr-only" aria-label="上传论文 PDF" onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);}}/>
    <div className="workspace">
      {navOpen&&<button className="panel-shade nav-shade" aria-label="关闭论文目录" onClick={()=>setNavOpen(false)}/>}
      <aside className={`sidebar ${navOpen?"open":""}`}><div className="sidebar-top"><span className="eyebrow">我的阅读</span><button className="icon-btn mobile-only" onClick={()=>setNavOpen(false)} aria-label="关闭目录"><X size={17}/></button></div>
        <div className="document-card"><div className="document-icon"><FileText size={19}/></div><div><strong title={filename}>{filename.replace(/\.pdf$/i,"")}</strong><span>{pages.length} 页 <i/> {isDemo?"示例论文":"PDF 文档"}</span></div></div>
        <div className="sidebar-label"><span>论文目录</span><span>{String(pages.length).padStart(2,"0")}</span></div><nav className="page-nav" aria-label="论文页面">{pages.map((p,index)=><button key={index} className={page===index+1?"active":""} onClick={()=>{goToPage(index+1);setNavOpen(false);}} aria-current={page===index+1?"page":undefined}><span className="page-index">{String(index+1).padStart(2,"0")}</span><span className="page-heading" title={p.heading}>{p.heading}</span>{p.sentences.length>0&&p.sentences.every(s=>s.zh)?<Check size={12}/>:<span className="page-number">{index+1}</span>}</button>)}</nav>
        <div className="reading-progress"><div><span>翻译进度</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{width:`${progress}%`}}/></div><small>{isDemo?"示例已预置译文，可直接体验":"完成的翻译会在当前阅读中保留"}</small></div>
        <div className="sidebar-bottom"><div className="reading-tip"><Leaf size={19}/><p>不必一次读懂。<br/>每一个疑问，都值得停留。</p></div><button onClick={()=>setSettingsOpen(true)} className="model-status"><span className={`status-dot ${codexReady?"on":""}`}/><div><span>{codexReady?"本地 Codex":"连接 Codex"}</span><small>{activeModel}</small></div><ChevronRight size={14}/></button></div>
      </aside>
      <main className="reader-main"><div className="reader-toolbar"><button className="icon-btn mobile-only" aria-label="打开论文目录" onClick={()=>setNavOpen(true)}><Menu size={19}/></button><div className="segmented"><button className={tab==="bilingual"?"selected":""} onClick={()=>setTab("bilingual")}><Languages size={15}/>中英对照</button><button className={tab==="pdf"?"selected":""} onClick={()=>setTab("pdf")}><FileText size={14}/>PDF 原文</button></div><div className="toolbar-right"><div className="segmented reading-mode-switch" aria-label="阅读模式"><button aria-pressed={!continuous} className={!continuous?"selected":""} onClick={()=>saveSettings({...settings,readingMode:"paged"},"已切换翻页阅读")} title="翻页模式">翻页</button><button aria-pressed={continuous} className={continuous?"selected":""} onClick={()=>saveSettings({...settings,readingMode:"scroll"},"已切换连续滑动")} title="连续滑动模式">滑动</button></div><div className="zoom-controls"><button aria-label="缩小" disabled={zoom<=75} onClick={()=>setZoom(z=>Math.max(75,z-10))}><Minus size={13}/></button><span>{zoom}%</span><button aria-label="放大" disabled={zoom>=150} onClick={()=>setZoom(z=>Math.min(150,z+10))}><Plus size={13}/></button></div><span className="toolbar-divider"/><button className="icon-btn" onClick={exportTranslation} title="导出中英对照" aria-label="导出中英对照"><ArrowDownToLine size={17}/></button><button className="icon-btn assistant-toggle" aria-label="打开 AI 阅读助手" onClick={()=>setAssistantOpen(v=>!v)}><MessageSquareText size={18}/></button></div></div>
        <div className="document-action-bar"><div>{isDemo?<span className="demo-tag">体验示例</span>:<span className="file-tag">PDF</span>}<span>{isDemo?"上传你的论文，开启真正的阅读":"中文在上 · 英文在下 · 图表保留"}</span></div><div className="translation-actions">{translation?<button className="text-button" onClick={()=>translationController.current?.abort()}><Square size={12}/>停止翻译</button>:<><button className="text-button" disabled={loading} onClick={()=>void translate(false)}><Sparkles size={13}/>翻译当前页</button><details className="translation-menu"><summary aria-label="更多翻译选项"><ChevronDown size={15}/></summary><div><button onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");void translate(true);}}>翻译全文</button><button onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");void translate(false,true);}}>视觉识别并翻译此页</button></div></details></>}</div></div>
        {translation&&<div className="translation-status" role="status"><LoaderCircle size={14} className="spin"/>{translation}</div>}
        <div className="reader-scroll" ref={reader} onMouseUp={selectText} onTouchEnd={()=>setTimeout(selectText,100)} onScroll={onReadingScroll}>
          {tab==="bilingual"?<article className="paper-article" style={{fontSize:`${settings.textSize*zoom/100}px`}}><div className="paper-kicker"><span>{isDemo?"PAPERLEAF READING SAMPLE":"YOUR READING SPACE"}</span><span>{continuous?"连续阅读":`原文 ${shown[0]+1}–${shown.at(-1)!+1} 页`}</span></div><h1>{title}</h1>{isDemo&&<p className="paper-subtitle">{demo.subtitle}</p>}<div className="paper-meta"><span><FileText size={12}/>{isDemo?"原创阅读示例":"上传的论文"}</span><span>{continuous?"逐页向下阅读":`每个阅读页合并 ${settings.readingSpan} 页原文`}</span></div><div className="paper-rule"/>
            <ReadingPages pages={pages} indexes={shown} continuous={continuous} pdf={false} doc={doc} zoom={zoom} isDemo={isDemo} attachText={attachText} attachImage={attachImage} onOriginal={original} onOCR={n=>{goToPage(n);void translate(false,true,n);}} busy={!!translation||loading}/>
          </article>:<ReadingPages pages={pages} indexes={shown} continuous={continuous} pdf={true} doc={doc} zoom={zoom} isDemo={isDemo} attachText={attachText} attachImage={attachImage} onOriginal={original} onOCR={n=>void translate(false,true,n)} busy={!!translation||loading}/>}
        </div>
        <footer className="reader-footer"><span><span className="status-dot"/> {isDemo?"示例阅读":"文件在本机解析"}</span><div className="page-controls"><button className="icon-btn" disabled={groupStart===1||loading} aria-label="上一页" onClick={()=>goToPage(Math.max(1,groupStart-step))}><ChevronLeft size={17}/></button><label><input aria-label="当前页码" type="number" min="1" max={pages.length} value={page} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=pages.length)goToPage(n);}}/><span>/ {pages.length} 原文页</span></label><button className="icon-btn" disabled={lastGroup||loading} aria-label="下一页" onClick={()=>goToPage(Math.min(pages.length,groupStart+step))}><ChevronRight size={17}/></button></div><span className="footer-hint">选中文字，随时提问</span></footer>
      </main>
      {assistantOpen&&<button className="panel-shade assistant-shade" aria-label="关闭阅读助手" onClick={()=>setAssistantOpen(false)}/>}
      <aside className={`assistant-panel ${assistantOpen?"open":""}`}><div className="assistant-header"><div><Sparkles size={17}/><strong>AI 阅读助手</strong></div><button className="icon-btn assistant-close" aria-label="关闭阅读助手" onClick={()=>setAssistantOpen(false)}><X size={17}/></button><span className="assistant-label">随时问，慢慢懂</span></div>
        <div className="chat-scroll">{!messages.length?<div className="assistant-welcome"><div className="assistant-art"><div className="art-orbit"/><BookOpen size={34}/><span><Sparkles size={14}/></span></div><h2>一起，把论文读明白。</h2><p>复杂的概念，陌生的公式，<br/>或是一张看不懂的图。<br/>把疑问交给我。</p><div className="assistant-tips"><button onClick={()=>{setTab("pdf");notify("点击“框选图表”，在原文上按住并拖动即可。");}}><span className="tip-icon"><ScanLine size={16}/></span><div><strong>圈起图表，读懂细节</strong><small>在 PDF 原文上拖动框选</small></div><ArrowUpRight size={13}/></button><button onClick={()=>{setTab("bilingual");notify("拖动选中文字后点击“解释这段”，或点击句子旁的提问图标。");}}><span className="tip-icon"><Languages size={16}/></span><div><strong>选中文字，拆解难点</strong><small>术语、句子和公式都可以问</small></div><ArrowUpRight size={13}/></button></div><span className="suggestions-label">可以从这些问题开始</span><div className="suggestions">{["用通俗语言解释这一页","这一页的核心概念是什么？","帮我梳理这里的推理过程"].map(q=><button key={q} onClick={()=>void ask(q)}>{q}<Plus size={13}/></button>)}</div></div>:<div className="messages">{messages.map(m=><div key={m.id} className={`message ${m.role} ${m.error?"failed":""}`}><div className="message-label">{m.role==="assistant"?<><Sparkles size={12}/>Codex · 知页</>:<>你</>}<span>第 {m.page} 页</span></div>{m.image&&<img src={m.image} alt={`第 ${m.page} 页圈选区域`}/>}<div className="message-content"><RichText streaming={m.streaming}>{m.content}</RichText></div>{m.visual&&!m.lesson&&<LessonView preview previewNote={m.instant?"即时概念预览 · Codex 正在结合论文补充讲解与题目…":undefined} lesson={{visual:m.visual,quiz:{question:"",options:[],correctIndex:0,explanation:""}}} busy={chatBusy} onAsk={q=>void ask(q,m.page)}/>} {m.lesson&&<LessonView lesson={m.lesson} busy={chatBusy} onAsk={q=>void ask(q,m.page)}/>}</div>)}</div>}{chatBusy&&<div className="thinking" role="status"><Sparkles size={14}/><span>{settings.teaching?"正在准备讲解、动图和检查题":"正在结合论文思考"}</span><i/><i/><i/></div>}<div ref={chatEnd}/></div>
        <div className="chat-bottom"><div className="teaching-toggle"><span><Sparkles size={12}/>动图与理解检查</span><button type="button" role="switch" aria-label="教学模式" aria-checked={settings.teaching} disabled={chatBusy} onClick={()=>saveSettings({...settings,teaching:!settings.teaching},settings.teaching?"已切换普通问答":"已开启动图讲解与理解检查")}><i/></button></div>{attachment&&<div className="attachment"><button className="attachment-remove" onClick={()=>setAttachment(null)} aria-label="移除选中内容"><X size={12}/></button>{attachment.type==="image"?<img src={attachment.value} alt="准备提问的圈选区域"/>:<span className="attachment-text">“{attachment.value.slice(0,170)}{attachment.value.length>170?"…":""}”</span>}<div><span>{attachment.type==="image"?"已圈选图片":"已选中文字"} · 第 {attachment.page} 页</span><button onClick={()=>void ask()} disabled={chatBusy} className="text-button"><Sparkles size={12}/>解释{attachment.type==="image"?"这张图":"这段"}</button></div></div>}
          <form className="question-box" onSubmit={e=>{e.preventDefault();void ask();}}><textarea ref={input} value={question} maxLength={4000} onChange={e=>setQuestion(e.target.value)} placeholder={attachment?"有什么想了解的？也可以直接发送…":"关于这篇论文，你想了解什么？"} aria-label="向阅读助手提问" rows={3} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void ask();}}}/><div><span><span className="status-dot"/>{settings.codexModel}</span>{chatBusy?<button type="button" className="send-button" aria-label="停止回答" onClick={()=>chatController.current?.abort()}><Square size={13}/></button>:<button type="submit" className="send-button" disabled={(!question.trim()&&!attachment)||loading} aria-label="发送问题"><ArrowUp size={17}/></button>}</div></form><p className="ai-note">AI 回答仅供辅助理解，请结合原文核对。</p></div>
      </aside>
    </div>
    {selection&&<div className="selection-popup" style={{left:selection.x,top:selection.y}}><button onMouseDown={e=>e.preventDefault()} onClick={()=>attachText(selection.text,selection.page)}><Sparkles size={14}/>解释这段<ArrowUpRight size={13}/></button></div>}
    {toast&&<div className={`toast ${toast.error?"error":""}`} role={toast.error?"alert":"status"}>{toast.error?<CircleHelp size={17}/>:<Check size={17}/>}<span>{toast.message}</span><button onClick={()=>setToast(null)} aria-label="关闭提示"><X size={14}/></button></div>}
    {dragging&&<div className="drop-overlay"><div><Upload size={40}/><h2>把论文放在这里</h2><p>PDF · 文字版或扫描版 · 最大 60 MB</p></div></div>}
    {loading&&<div className="loading-bar" role="status">正在读取论文并识别页面<LoaderCircle size={14} className="spin"/></div>}
    {appearanceOpen&&<AppearanceDialog settings={settings} onSave={s=>saveSettings(s,"阅读偏好已保存")} onClose={closeAppearance}/>}
    {settingsOpen&&<SettingsDialog settings={settings} onSave={saveSettings} onStatus={setCodexReady} onClose={closeSettings}/>}
  </div>;
}

function MouseHint(){return <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true"><path d="m13 8 17 15-9 2-4 8-4-25Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m24 28 5 5M29 13l3-3M32 21h4M21 7V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;}



