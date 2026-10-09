import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const asModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const coreURL=asModule(compile('lib/paper.ts'));
const core=await import(coreURL);
test('sentences preserve abbreviations and join line-break hyphenation',()=>{
  const output=core.toSentences('1 Introduction\nThe Trans-\nformer processes tokens. Dr. Smith studies it.');
  assert.equal(output[0].en,'1 Introduction');assert.equal(output[1].en,'The Transformer processes tokens.');assert.equal(output[2].en,'Dr. Smith studies it.');
});
test('translation batches bound work and omit already translated sentences',()=>{
  const rows=Array.from({length:50},(_,id)=>({id,en:'x'.repeat(400),...(id===0?{zh:'已有译文'}:{})}));const batches=core.translationBatches(rows);assert.equal(batches.flat().length,49);assert.equal(batches.flat()[0].id,1);for(const batch of batches){assert.ok(batch.length<=12);assert.ok(batch.reduce((n,r)=>n+r.en.length,0)<=3500);}
});
test('translation ids may arrive out of order but cannot be missing or duplicated',()=>{
  const valid=core.parseTranslations('{"translations":[{"id":2,"zh":"第二句"},{"id":1,"zh":"第一句"}]}',[{id:1},{id:2}]);assert.equal(valid[0].id,2);
  for(const rows of [[{id:1,zh:'a'}],[{id:1,zh:'a'},{id:1,zh:'b'}],[{id:1,zh:'a'},{id:2,zh:''}],[{id:1,zh:'a'},{id:3,zh:'b'}]])assert.throws(()=>core.parseTranslations(JSON.stringify({translations:rows}),[{id:1},{id:2}]));
});
test('extracts two columns top to bottom with a full-width title',()=>{
  const item=(str,x,y,width=100)=>({str,transform:[10,0,0,10,x,y],width,height:10});const rows=[item('Title crossing both columns',40,780,480)];for(let i=0;i<30;i++){rows.push(item('Left '+i,40,740-i*15),item('Right '+i,310,740-i*15));}const text=core.extractText(rows,595);assert.ok(text.indexOf('Title')<text.indexOf('Left 0'));assert.ok(text.indexOf('Left 29')<text.indexOf('Right 0'));assert.ok(text.indexOf('Right 0')<text.indexOf('Right 29'));
});
