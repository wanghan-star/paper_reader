import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTeaching,partialTeaching} from '../scripts/lesson-format.mjs';
import {JobQueue} from '../scripts/codex-bridge.mjs';
const data={content:'中文解释：$QK^\\top$\n包含“引号”、\\反斜线。',lesson:{visual:{type:'tokens',title:'KV Cache',xLabel:'',yLabel:'',steps:[{label:'我',detail:'新计算',value:.3},{label:'喜欢',detail:'复用“我”的 K/V',value:.6},{label:'学习',detail:'读取历史 {K,V}',value:1}]},quiz:{question:'历史 K/V 怎么处理？',options:['复用','丢弃'],correctIndex:0,explanation:'复用，但注意力仍读取历史。'}}};
test('teaching format retains the targeted animation and validates quiz boundaries',()=>{
  assert.deepEqual(parseTeaching(JSON.stringify(data)),data);
  for(const change of [v=>v.lesson.quiz.correctIndex=2,v=>v.lesson.visual.steps[0].value=NaN,v=>v.lesson.visual.steps=[],v=>v.lesson.visual.type='html',v=>v.lesson.quiz.options=['唯一']]){const invalid=structuredClone(data);change(invalid);assert.throws(()=>parseTeaching(JSON.stringify(invalid)));}
});
test('partial structured output decodes escapes and reveals visuals only when complete',()=>{
  const raw=JSON.stringify(data),visualEnd=raw.indexOf(',"quiz"');
  for(let n=0;n<raw.length;n++){const p=partialTeaching(raw.slice(0,n));assert.ok(data.content.startsWith(p.content));if(n<visualEnd)assert.equal(p.visual,undefined);}
  assert.deepEqual(partialTeaching(raw),{content:data.content,visual:data.lesson.visual});
  assert.equal(partialTeaching('{"content":"\\u4e2d\\u6587\\u').content,'中文');
});
test('streamed job reports progress, then releases progress on completion',async()=>{
  let done;const q=new JobQueue((input,signal,progress)=>{progress({content:'先显示',visual:data.lesson.visual});return new Promise(resolve=>{done=()=>resolve(data);});});
  const job=q.create({task:'chat'});assert.equal(q.view(job.id).partial,'先显示');assert.deepEqual(q.view(job.id).visual,data.lesson.visual);done();await new Promise(r=>setTimeout(r,10));assert.equal(q.view(job.id).result.content,data.content);assert.equal(q.view(job.id).partial,undefined);q.close();
});
