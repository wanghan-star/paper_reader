import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTranslations,translateReliably} from '../scripts/translation-recovery.mjs';
import {JobQueue} from '../scripts/codex-bridge.mjs';

const sentences=Array.from({length:6},(_,i)=>({id:10+i*3,en:`Original sentence ${i}.`}));
const answer=rows=>JSON.stringify({translations:rows.map(r=>({id:r.id,zh:`译文 ${r.id}`}))});
const signal=()=>new AbortController().signal;

test('an omitted translation is repaired without retranslating complete rows',async()=>{
  const calls=[],progress=[];
  const result=await translateReliably(sentences,signal(),p=>progress.push(p.translation),async rows=>{
    calls.push(rows.map(r=>r.id));return answer(calls.length===1?rows.slice(1):rows);
  });
  assert.deepEqual(calls,[sentences.map(s=>s.id),[10]]);
  assert.deepEqual(result.translations.map(r=>r.id),sentences.map(s=>s.id));
  assert.ok(progress.some(p=>p.completed===5&&p.retrying));
});

test('truncated JSON preserves complete rows with escaped quotes and braces',()=>{
  const complete={id:10,zh:'中文公式 $\\frac{a}{b}$ 和 "引号"，括号 } ] 保留。'};
  const broken='```json\n{"translations":['+JSON.stringify(complete)+',{"id":13,"zh":"未完成';
  assert.deepEqual(collectTranslations(broken,sentences),[complete]);
  assert.deepEqual(collectTranslations('unstructured answer',sentences),[]);
});

test('ambiguous duplicate ids, unknown ids and empty rows are never accepted',()=>{
  const rows=[{id:10,zh:'第一份'},{id:10,zh:'另一份'},{id:10,zh:'第三份'},{id:13,zh:' '},{id:999,zh:'未知'},{id:16,zh:'有效'}];
  assert.deepEqual(collectTranslations(JSON.stringify({translations:rows}),sentences),[{id:16,zh:'有效'}]);
});

test('unusable output triggers smaller bounded retries and retains successful translations',async()=>{
  const attempts=new Map(),progress=[],sizes=[];
  await assert.rejects(translateReliably(sentences,signal(),p=>progress.push(p.translation),async rows=>{
    sizes.push(rows.length);
    rows.forEach(r=>attempts.set(r.id,(attempts.get(r.id)||0)+1));
    return answer(rows.filter(r=>r.id!==10));
  }),/还有 1 句.*已保留/);
  assert.equal(attempts.get(10),3);
  assert.equal(attempts.get(13),1);
  assert.equal(progress.at(-1).completed,5);
  assert.equal(sizes.at(-1),1);
  const shrunk=[];
  await assert.rejects(translateReliably(sentences,signal(),undefined,async rows=>{shrunk.push(rows.length);return 'bad JSON';}),/还有 6 句/);
  assert.deepEqual(shrunk,[6,3,3,2,1,2,1]);
});

test('server also splits large batches while retaining noncontiguous original ids',async()=>{
  const rows=Array.from({length:30},(_,i)=>({id:i*2,en:'x'.repeat(700)})),sizes=[];
  const result=await translateReliably(rows,signal(),undefined,async batch=>{sizes.push(batch.length);return answer([...batch].reverse());});
  assert.ok(sizes.every(n=>n<=5));assert.equal(result.translations.length,30);
  assert.deepEqual(result.translations.map(r=>r.id),rows.map(r=>r.id));
});

test('cancellation stops repair requests immediately',async()=>{
  const controller=new AbortController();let calls=0;
  await assert.rejects(translateReliably(sentences,controller.signal,p=>{if(p.translation.completed)controller.abort();},async rows=>{calls++;return answer(rows.slice(1));}),{name:'AbortError'});
  assert.equal(calls,1);
});

test('failed queued translation exposes completed rows so the browser can preserve them',async()=>{
  const queue=new JobQueue((input,signal,progress)=>translateReliably(input.sentences,signal,progress,async rows=>answer(rows.filter(r=>r.id!==10))));
  const job=queue.create({task:'translate',sentences});
  for(let i=0;i<100&&queue.view(job.id).status==='running';i++)await new Promise(resolve=>setTimeout(resolve,5));
  const failed=queue.view(job.id);
  assert.equal(failed.status,'failed');assert.equal(failed.translation.completed,5);assert.equal(failed.translation.translations.length,5);
  assert.ok(!queue.jobs.get(job.id).input);queue.close();
});
