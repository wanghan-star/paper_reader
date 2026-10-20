import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVisual,parseTeaching,partialTeaching,schemaForTeaching,teachingPromptFor} from '../scripts/lesson-format.mjs';
import {parseGuide} from '../scripts/reading-guide.mjs';
import {teachingPolicy} from '../scripts/teaching-policy.mjs';
import {JobQueue,validateTask} from '../scripts/codex-bridge.mjs';
const data={content:'中文解释：$QK^\\top$\n包含“引号”、\\反斜线。',lesson:{visual:{type:'tokens',title:'KV Cache',xLabel:'',yLabel:'',steps:[{label:'我',detail:'新计算',value:.3},{label:'喜欢',detail:'复用“我”的 K/V',value:.6},{label:'学习',detail:'读取历史 {K,V}',value:1}]},quiz:{question:'历史 K/V 怎么处理？',options:['复用','丢弃'],correctIndex:0,explanation:'复用，但注意力仍读取历史。'}}};
test('teaching format retains the targeted animation and validates quiz boundaries',()=>{
  assert.deepEqual(parseTeaching(JSON.stringify(data)),data);
  for(const change of [v=>v.lesson.quiz.correctIndex=2,v=>v.lesson.quiz.options=['唯一']]){const invalid=structuredClone(data);change(invalid);assert.throws(()=>parseTeaching(JSON.stringify(invalid)));}
  // A malformed drawing is dropped while the answer and the quiz are kept.
  for(const change of [v=>v.lesson.visual.steps[0].value=NaN,v=>v.lesson.visual.steps=[],v=>v.lesson.visual.type='html',v=>v.lesson.visual.type='flow']){const invalid=structuredClone(data);change(invalid);assert.deepEqual(parseTeaching(JSON.stringify(invalid)),{content:data.content,lesson:{quiz:data.lesson.quiz}});}
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
test('ordinary answers, visual explanations and requested practice are independently valid',()=>{
  assert.deepEqual(parseTeaching(JSON.stringify({content:'KV 表示 Key 和 Value。',lesson:{visual:null,quiz:null}})),{content:'KV 表示 Key 和 Value。'});
  assert.deepEqual(parseTeaching(JSON.stringify({content:data.content,lesson:{visual:data.lesson.visual,quiz:null}})),{content:data.content,lesson:{visual:data.lesson.visual}});
  assert.deepEqual(parseTeaching(JSON.stringify({content:data.content,lesson:{visual:null,quiz:data.lesson.quiz}})),{content:data.content,lesson:{quiz:data.lesson.quiz}});
  assert.equal(partialTeaching('{"content":"直接回答","lesson":{"visual":null,"quiz":null}}').visual,undefined);
});
test('the tutor decides on visuals and practice unless the current request rules them out',()=>{
  // Ordinary questions leave both choices to the model; nothing is forced.
  for(const q of ['KV Cache 的英文全称是什么？','解释这段话','注意力权重能证明预测原因吗？','请讲解这个阅读难点「为什么要缩放」\n\n选中文字：\n出一道题，用动画演示']){const p=teachingPolicy(q);assert.deepEqual(p,{visual:true,quiz:true,visualRequested:false,quizRequested:false},q);assert.ok(schemaForTeaching(p).properties.lesson.properties.quiz.anyOf);assert.ok(schemaForTeaching(p).properties.lesson.properties.visual.anyOf);}
  // Declining, or handing in an answer, switches practice off.
  for(const q of ['你刚才的理解检查题是：历史 K/V 怎么处理？我的理解是：可以复用。请先判断我是否理解正确。','阅读思考题：为什么要缩放？\n我的理解是：防止数值太大','用动画解释 KV Cache，不要提问','解释一下，别考我'])assert.equal(teachingPolicy(q).quiz,false,q);
  // An explicit request makes the item mandatory.
  for(const q of ['出一道题检查我是否理解 KV Cache','用动画讲解，再考考我','Quiz me on this concept']){const p=teachingPolicy(q);assert.equal(p.quizRequested,true,q);assert.equal(schemaForTeaching(p).properties.lesson.properties.quiz.type,'object');}
  assert.equal(teachingPolicy('请用动图演示刚才讲的过程。').visualRequested,true);
  assert.equal(teachingPolicy('不用动画，直接说').visualRequested,false);
  const policy=teachingPolicy('只用文字解释 KV Cache，不要出题');
  assert.deepEqual(schemaForTeaching(policy).properties.lesson.properties.quiz,{type:'null'});
  assert.deepEqual(schemaForTeaching(policy).properties.lesson.properties.visual,{type:'null'});
  assert.deepEqual(parseTeaching(JSON.stringify(data),policy),{content:data.content});
});
test('the prompt states what this request requires or forbids, and a quiz hint is kept',()=>{
  assert.match(teachingPromptFor(teachingPolicy('解释这段话')),/难点/);
  assert.match(teachingPromptFor(teachingPolicy('考考我')),/必须提供 quiz/);
  assert.match(teachingPromptFor(teachingPolicy('我的理解是：复用')),/quiz 必须为 null/);
  assert.match(teachingPromptFor(teachingPolicy('只用文字解释')),/visual 必须为 null/);
  const hinted=structuredClone(data);hinted.lesson.quiz.hint=' 想想历史词元的 K/V 会不会变 ';
  assert.equal(parseTeaching(JSON.stringify(hinted)).lesson.quiz.hint,'想想历史词元的 K/V 会不会变');
});
test('difficult-spot guide keeps valid points and drops unknown or repeated paragraphs',()=>{
  const task=validateTask({task:'guide',title:'T',page:2,paragraphs:[{id:1,text:'Scaled dot-product attention.',extra:'x'},{id:3,text:'Softmax.'}]});
  assert.deepEqual(task.paragraphs,[{id:1,text:'Scaled dot-product attention.'},{id:3,text:'Softmax.'}]);
  for(const paragraphs of [[],[{id:1,text:'a'},{id:1,text:'b'}],[{id:-1,text:'a'}],[{id:0,text:' '}],Array.from({length:81},(_,id)=>({id,text:'x'}))])assert.throws(()=>validateTask({task:'guide',paragraphs}));
  const point=id=>({id,title:'为什么缩放',why:'维度大时点积大',question:'不缩放会怎样？'});
  assert.deepEqual(parseGuide(JSON.stringify({points:[point(3),point(3),point(9),{id:1,title:'',why:'',question:''}]}),[1,3]),{points:[point(3)]});
  assert.deepEqual(parseGuide('{"points":[]}',[1]),{points:[]});
  assert.equal(parseGuide(JSON.stringify({points:[1,2,3,4].map(point)}),[1,2,3,4]).points.length,3);
  assert.throws(()=>parseGuide('not json',[1]));
});
test('diagrams are drawn only for genuinely complex flows and mechanisms',()=>{
  const node=(id,kind='process')=>({id,label:'环节 '+id,kind,detail:'说明'}),edge=(from,to,label='')=>({from,to,label,detail:'原因'});
  const graph=(type,nodes,edges)=>({type,title:'图',xLabel:'',yLabel:'',steps:[],nodes,edges});
  const chain=n=>Array.from({length:n-1},(_,i)=>edge('n'+i,'n'+(i+1))),nodes=n=>Array.from({length:n},(_,i)=>node('n'+i));
  // Three steps in a row is exactly the trivial picture that must not be drawn.
  assert.equal(normalizeVisual(graph('flowchart',nodes(3),chain(3))),null);
  assert.equal(normalizeVisual(graph('flowchart',nodes(4),chain(4))),null);
  assert.equal(normalizeVisual(graph('flowchart',nodes(5),chain(5))).nodes.length,5);
  assert.ok(normalizeVisual(graph('flowchart',nodes(4),[edge('n0','n1'),edge('n0','n2'),edge('n1','n3'),edge('n2','n3')])));
  assert.equal(normalizeVisual(graph('mechanism',nodes(3),chain(3))),null);
  const loop=normalizeVisual(graph('mechanism',nodes(3),[...chain(3),edge('n2','n0','反馈'),edge('n0','n2'),edge('n0','n0'),edge('n0','zz'),edge('n0','n1')]));
  assert.equal(loop.edges.length,4);assert.deepEqual(loop.steps,[]);
  // An explicit request lowers the bar, isolated or unknown nodes never survive.
  assert.ok(normalizeVisual(graph('flowchart',nodes(3),chain(3)),true));
  assert.deepEqual(normalizeVisual(graph('flowchart',[...nodes(5),node('alone'),{...node('odd'),kind:'weird'}],[...chain(5),edge('n4','odd')])).nodes.map(n=>n.kind).slice(-1),['process']);
  assert.equal(normalizeVisual(graph('flowchart',[...nodes(5),node('n1')],chain(5))),null);
  assert.equal(normalizeVisual({type:'bars',title:'对比',xLabel:'',yLabel:'',steps:[{label:'a',detail:'',value:.2},{label:'b',detail:'',value:.8}],nodes:[],edges:[]}),null);
  const parsed=parseTeaching(JSON.stringify({content:'讲解',lesson:{visual:graph('flowchart',nodes(3),chain(3)),quiz:null}}));
  assert.deepEqual(parsed,{content:'讲解'});
  assert.match(teachingPromptFor(teachingPolicy('解释这段话')),/一律不画/);
  assert.equal(teachingPolicy('请把刚才讲的内容画成流程图或机理图。').visualRequested,true);
});
