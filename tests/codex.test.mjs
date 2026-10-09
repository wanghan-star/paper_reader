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
