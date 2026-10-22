import test from 'node:test';
import assert from 'node:assert/strict';
import {JobQueue,validateTask,translationResult} from '../scripts/codex-bridge.mjs';
const wait=()=>new Promise(r=>setTimeout(r,10));

test('Codex translation rejects malformed ids and bounds input without retaining unrelated credentials',()=>{
  const valid=validateTask({task:'translate',config:{key:'must-not-pass',baseUrl:'https://example.com',codexModel:'gpt-6.1-sol'},sentences:[{id:9,en:'Attention.'}]});
  assert.equal(valid.model,'gpt-6.1-sol');assert.ok(!JSON.stringify(valid).includes('must-not-pass'));
  for(const sentences of [[],[{id:1,en:'a'},{id:1,en:'b'}],[{id:-1,en:'a'}],[{id:0,en:''}],Array.from({length:31},(_,id)=>({id,en:'x'}))])assert.throws(()=>validateTask({task:'translate',sentences}));
  assert.throws(()=>validateTask({task:'test',config:{codexModel:'model --shell'}}));
});
test('Codex figure and OCR jobs carry bounded page context and an explicit image',()=>{
  const value=validateTask({task:'chat',question:'解释这张图',image:'data:image/png;base64,YQ==',page:4,context:'x'.repeat(50000),history:[{role:'system',content:'bad'},{role:'user',content:'question'}]});
  assert.equal(value.context.length,22000);assert.equal(value.page,4);assert.equal(value.history.length,1);assert.equal(value.image,'data:image/png;base64,YQ==');
  assert.throws(()=>validateTask({task:'ocr'}));assert.throws(()=>validateTask({task:'chat',question:'q',image:'https://example.com/a.png'}));
});
test('Codex translation output requires all matching ids exactly once',()=>{
  const sentences=[{id:2},{id:5}];
  assert.deepEqual(translationResult('{"translations":[{"id":5,"zh":"五"},{"id":2,"zh":"二"}]}',sentences).translations.map(r=>r.id),[5,2]);
  for(const content of ['not json','{"translations":[]}','{"translations":[{"id":2,"zh":"二"},{"id":2,"zh":"重复"}]}','{"translations":[{"id":2,"zh":""},{"id":5,"zh":"五"}]}'])assert.throws(()=>translationResult(content,sentences));
});
test('queue runs one inference at a time, honours pending cancellation, and releases input',async()=>{
  let release;const started=[];const q=new JobQueue((input,signal)=>{started.push(input.task);return new Promise((resolve,reject)=>{release=()=>resolve({content:input.task});signal.addEventListener('abort',()=>reject(new DOMException('stop','AbortError')),{once:true});});});
  const one=q.create({task:'first'}),two=q.create({task:'second'}),three=q.create({task:'third'});
  assert.equal(q.view(one.id).status,'running');assert.equal(q.view(two.id).status,'queued');
  q.cancel(two.id);release();await wait();assert.deepEqual(started,['first','third']);assert.equal(q.view(one.id).result.content,'first');assert.ok(!q.jobs.get(one.id).input);
  q.cancel(three.id);await wait();assert.equal(q.view(three.id).status,'cancelled');assert.equal(q.view(two.id).status,'cancelled');assert.ok(!q.active);q.close();
});
test('inference failures return a failed job and allow the next question',async()=>{
  const q=new JobQueue(async input=>{if(input.task==='fail')throw new Error('network failed');return {content:'answer'};});const failed=q.create({task:'fail'}),next=q.create({task:'chat'});await wait();assert.equal(q.view(failed.id).status,'failed');assert.equal(q.view(failed.id).error,'network failed');assert.equal(q.view(next.id).result.content,'answer');assert.ok(!JSON.stringify(q.view(next.id)).includes('controller'));q.close();
});
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRecordStore} from '../scripts/record-store.mjs';
test('reading records keep translation, chat and the paper, and refuse unsafe names',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'paperleaf-records-test-'));
  try{
    const store=createRecordStore(path.join(root,'records')),id='0123456789abcdef0123456789abcdef';
    assert.deepEqual(await store.list(),[]);assert.equal(await store.read(id),null);
    const pages=[{text:'A. B.',heading:'Intro',sentences:[{id:0,en:'A.',zh:'甲。'},{id:1,en:'B.'}]}];
    const meta=await store.save(id,{title:'Paper',filename:'p.pdf',page:1,pages,messages:[{id:1,role:'user',content:'问',page:1}],guides:{0:{status:'done',points:[]}}});
    assert.deepEqual({...meta,updated:0},{id,title:'Paper',filename:'p.pdf',pageCount:1,total:2,translated:1,messages:1,terms:0,updated:0});
    const record=await store.read(id);assert.deepEqual(record.pages,pages);assert.equal(record.messages[0].content,'问');
    await store.savePdf(id,Buffer.from('%PDF-1.7 demo'));assert.equal((await store.openPdf(id)).size,13);(await store.openPdf(id)).stream.destroy();
    await assert.rejects(store.savePdf(id,Buffer.from('not a pdf')));
    assert.deepEqual((await store.list()).map(r=>r.id),[id]);
    for(const bad of ['../secret','0123','0123456789ABCDEF0123456789abcdef','0123456789abcdef0123456789abcde/'])await assert.rejects(store.read(bad));
    await assert.rejects(store.save(id,{pages:[]}));
    await store.remove(id);assert.deepEqual(await store.list(),[]);assert.equal(await store.read(id),null);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('a parallel queue runs up to its limit, lets questions jump ahead, and refills as jobs finish',async()=>{
  const releases=new Map(),started=[];
  const q=new JobQueue(input=>{started.push(input.task);return new Promise(resolve=>releases.set(input.task,()=>resolve({content:input.task})));},2);
  const jobs=['p1','p2','p3','p4'].map(task=>q.create({task}));
  assert.deepEqual(started,['p1','p2']);assert.equal(q.view(jobs[2].id).status,'queued');
  q.create({task:'chat'});
  releases.get('p1')();await wait();
  assert.deepEqual(started,['p1','p2','chat'],'the question runs before queued pages');
  releases.get('p2')();await wait();assert.deepEqual(started,['p1','p2','chat','p3']);
  assert.equal(q.view(jobs[0].id).result.content,'p1');q.close();
});
