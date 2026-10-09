// Only accept unambiguous rows belonging to this request. Never shift sentence ids.
export function collectTranslations(content, sentences) {
  const text=content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let rows;
  try { rows=JSON.parse(text)?.translations; } catch {
    // A cut-off JSON response may still contain complete rows. Ignore its unfinished tail.
    const start=/^\s*\{\s*"translations"\s*:\s*\[/.exec(text);
    rows=[];
    if(start){
      let depth=0,quoted=false,escaped=false,begin=-1;
      for(let i=start[0].length;i<text.length;i++){
        const c=text[i];
        if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
        if(c==='"'){quoted=true;continue;}
        if(c==='{'){if(depth===0)begin=i;depth++;}
        else if(c==='}'&&depth>0){depth--;if(depth===0){try{rows.push(JSON.parse(text.slice(begin,i+1)));}catch{/* retry this row */}}}
        else if(depth===0&&c===']')break;
        else if(depth===0&&!/[\s,]/.test(c))break;
      }
    }
  }
  if(!Array.isArray(rows))return [];
  const expected=new Set(sentences.map(s=>s.id)),seen=new Set(),accepted=new Map();
  for(const row of rows){
    if(!expected.has(row?.id))continue;
    if(seen.has(row.id)){accepted.delete(row.id);continue;}
    seen.add(row.id);
    if(typeof row.zh==='string'&&row.zh.trim())accepted.set(row.id,{id:row.id,zh:row.zh.trim()});
  }
  return [...accepted.values()];
}

export function splitTranslationBatches(sentences,maxChars=3500,maxRows=12){
  const batches=[];let batch=[],chars=0;
  for(const row of sentences){
    if(batch.length&&(chars+row.en.length>maxChars||batch.length>=maxRows)){batches.push(batch);batch=[];chars=0;}
    batch.push(row);chars+=row.en.length;
  }
  if(batch.length)batches.push(batch);
  return batches;
}

export async function translateReliably(sentences,signal,onProgress,request){
  const completed=new Map(),unresolved=[];
  const pending=splitTranslationBatches(sentences).map(rows=>({rows,attempt:1}));
  const ordered=()=>sentences.filter(s=>completed.has(s.id)).map(s=>completed.get(s.id));
  const report=retrying=>onProgress?.({translation:{translations:ordered(),completed:completed.size,total:sentences.length,retrying}});
  while(pending.length){
    signal.throwIfAborted();
    const {rows,attempt}=pending.shift();
    report(attempt>1);
    const content=await request(rows);
    signal.throwIfAborted();
    for(const row of collectTranslations(content,rows))completed.set(row.id,row);
    const missing=rows.filter(s=>!completed.has(s.id));
    report(missing.length>0);
    if(missing.length){
      if(attempt>=3)unresolved.push(...missing);
      else {
        // Each retry asks only for missing ids and reduces the response size again.
        const limit=Math.max(1,Math.ceil(missing.length/2));
        pending.push(...splitTranslationBatches(missing,Math.max(1000,3500/attempt),limit).map(rows=>({rows,attempt:attempt+1})));
      }
    }
  }
  if(unresolved.length)throw new Error(`还有 ${unresolved.length} 句未完成翻译，已完成的译文已保留。点击翻译可继续补译，也可切换模型后重试。`);
  return {translations:ordered()};
}
