import type { PaperPage, Sentence } from './paper';
export type GuidePoint={id:number;title:string;why:string;question:string};
export type GuideState={status:'loading'|'done'|'failed';points:GuidePoint[]};

// Paragraphs worth scanning for difficult spots; headings and unreadable blocks are left out.
export function guideParagraphs(page:PaperPage):{id:number;text:string}[]{
  const rows:{id:number;text:string}[]=[];let size=0;
  for(const s of page.sentences){
    if(s.heading||s.uncertain||s.en.trim().length<(s.kind==='equation'?4:40))continue;
    const text=s.en.slice(0,1500);
    if(size+text.length>20000||rows.length>=60)break;
    rows.push({id:s.id,text});size+=text.length;
  }
  return size<200?[]:rows;
}
export const explainPointPrompt=(p:GuidePoint,s:Sentence)=>`请讲解这个阅读难点「${p.title}」${p.why?`：${p.why}`:''}\n\n选中文字：\n${s.en}`;
export const answerPointPrompt=(p:GuidePoint,s:Sentence,words:string)=>`阅读思考题：${p.question}\n我的理解是：${words}\n请先判断我是否理解正确，再指出遗漏或误区，必要时补充讲解。\n\n选中文字：\n${s.en}`;
