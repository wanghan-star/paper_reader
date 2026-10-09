import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import katex from 'katex';
import {parsePageLayout} from '../scripts/page-layout.mjs';
import {validateTask} from '../scripts/codex-bridge.mjs';
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const load=source=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {pageFromBlocks,toReadingParagraphs}=await load(compile('lib/page-content.ts'));
const {translationBatches}=await load(compile('lib/paper.ts'));
const box={x:50,y:200,width:850,height:300};
const block=(type,en,zh='',bounds=box)=>({type,en,zh,box:bounds});

test('layout tasks require a bounded page image and preserve original page context',()=>{
  assert.throws(()=>validateTask({task:'layout'}));
  const value=validateTask({task:'layout',image:'data:image/png;base64,YQ==',page:3,context:'x'.repeat(50000)});
  assert.equal(value.task,'layout');assert.equal(value.page,3);assert.equal(value.context.length,22000);
});
test('layout validates visual coordinates and rejects unusable structure',()=>{
  for(const value of ['bad',JSON.stringify({blocks:[block('paragraph','')]}),JSON.stringify({blocks:[block('figure','caption','',{...box,x:-1})]}),JSON.stringify({blocks:[block('equation','x','',{...box,width:0})]}),JSON.stringify({blocks:[block('unsupported','text')]})])assert.throws(()=>parsePageLayout(value));
  const result=parsePageLayout(JSON.stringify({blocks:[block('figure','caption','图注',{x:900,y:900,width:150,height:150})]}));
  assert.deepEqual(result.blocks[0].box,{x:900,y:900,width:100,height:100});
});
test('figures, captions and formulas stay in page order without retranslating equations',()=>{
  const formula=String.raw`$$H_{\mathrm{eff}}=H_{\mathrm{ext}}+\frac{2K_i}{\mu_0 M_s t_{\mathrm{fl}}}\tag{3}$$`;
  const blocks=[block('paragraph','A complete paragraph with $10^{-3}$ units.','一段完整正文。'),block('equation',formula),block('figure','Fig. 5. Validation against OOMMF.','图 5。与 OOMMF 比较。'),block('paragraph','The conclusion follows the plot.','结论位于图后。')];
  const page=pageFromBlocks(blocks,{sentences:[],text:'broken',heading:'Page 3',needsVision:true});
  assert.deepEqual(page.sentences.map(s=>s.kind),['paragraph','equation','figure','paragraph']);
  assert.equal(page.needsVision,false);assert.equal(page.sentences[1].zh,formula);
  assert.deepEqual(page.sentences[0].box,box,'inline formulas retain their paragraph original region');
  assert.deepEqual(page.sentences[2].box,box);assert.equal(translationBatches(page.sentences).length,0);
  assert.ok(katex.renderToString(formula.slice(2,-2),{displayMode:true,throwOnError:true}).includes('mfrac'));
});
test('unreadable formulas keep their image region instead of inventing symbols',()=>{
  const page=pageFromBlocks([block('equation',''),block('paragraph','Unknown □ symbol','未知符号')],{sentences:[],text:'',heading:'Page'});
  assert.ok(page.sentences.every(s=>s.uncertain&&s.box));
  assert.equal(page.sentences[0].zh,'Formula');
  assert.equal(page.sentences[0].kind,'equation');
});
test('short printed lines form complete paragraphs rather than false headings',()=>{
  const rows=toReadingParagraphs('1 Introduction\nSeveral works\nhave demonstrated\nSRAM processors.\n\nFig. 5. Validation against the\nOOMMF Framework.');
  assert.equal(rows.length,3);assert.equal(rows[0].heading,true);
  assert.equal(rows[1].en,'Several works have demonstrated SRAM processors.');assert.equal(rows[1].heading,false);
  assert.equal(rows[2].en,'Fig. 5. Validation against the OOMMF Framework.');assert.equal(rows[2].heading,false);
});
test('long unpunctuated paragraphs split without losing text',()=>{
  const original='A'+Array.from({length:1600},(_,i)=>' token'+i).join('');
  const rows=toReadingParagraphs(original);
  assert.ok(rows.every(s=>s.en.length<=2500));
  assert.equal(rows.map(s=>s.en).join(' ').replace(/\s+/g,''),original.replace(/\s+/g,''));
});
