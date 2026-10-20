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
  for(const value of ['bad',JSON.stringify({blocks:[block('paragraph','')]}),JSON.stringify({blocks:[block('figure','caption','',{...box,width:0})]}),JSON.stringify({blocks:[block('figure','caption','',{...box,x:NaN})]}),JSON.stringify({blocks:[block('unsupported','text')]})])assert.throws(()=>parsePageLayout(value));
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
test('one malformed block is repaired or dropped without losing the rest of the page',()=>{
  const result=parsePageLayout(JSON.stringify({blocks:[block('paragraph','Kept paragraph.','保留'),block('paragraph','  '),block('figure','Fig. 1','图 1',{...box,width:0}),block('unsupported','x'),block('equation','E=mc^2','',{...box,x:NaN}),block('figure','Fig. 2','图 2',{x:-20,y:-10,width:520,height:310}),{type:'paragraph',en:'No region.',zh:'无区域'}]}));
  assert.deepEqual(result.blocks.map(b=>b.en),['Kept paragraph.','E=mc^2','Fig. 2','No region.']);
  assert.deepEqual(result.blocks[2].box,{x:0,y:0,width:500,height:300});
  assert.deepEqual(result.blocks[3].box,{x:0,y:0,width:1000,height:1000});
  assert.deepEqual(parsePageLayout('{"blocks":[]}'),{blocks:[]});
});
const {refineBox}=await load(compile('lib/box-refine.ts'));
test('figure regions grow to content that the estimate clipped and shed blank margins',()=>{
  const columns=100,rows=100,ink=new Uint8Array(columns*rows);
  const fill=(x0,y0,x1,y1)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)ink[y*columns+x]=1;};
  fill(20,30,60,50);          // the figure
  fill(20,56,60,58);          // body text below, separated by a blank gap
  fill(70,30,90,50);          // the neighbouring column
  const inside=b=>b.x<=20&&b.y<=30&&b.x+b.width>=60&&b.y+b.height>=50;
  const clipped=refineBox(ink,columns,rows,{x:24,y:33,width:30,height:14});
  assert.ok(inside(clipped),'grows to the whole figure');
  assert.ok(clipped.y+clipped.height<=56&&clipped.x+clipped.width<=70,'stops at the blank gap');
  const padded=refineBox(ink,columns,rows,{x:12,y:22,width:52,height:31});
  assert.ok(inside(padded)&&padded.x>=17&&padded.y>=27,'sheds the blank margin');
  assert.deepEqual(refineBox(new Uint8Array(columns*rows),columns,rows,{x:10,y:10,width:1,height:1}),{x:10,y:10,width:1,height:1});
});
const {splitSentences,mapSentences}=await load(compile('lib/sentence-align.ts'));
test('paragraphs split into sentences that pair across languages',()=>{
  const en='Keys and values are generated by learned projections, e.g. linear maps. During decoding they are stored in the KV cache (see Fig. 3 and Vaswani et al. for details). Is 0.5 enough? Yes.';
  const zh='键和值由可学习的投影生成，例如线性映射。解码时它们被存入 KV 缓存（详见图 3 和 Vaswani et al. 的说明）。0.5 够吗？够。';
  const parts=(text,language)=>splitSentences(text,language).map(([a,b])=>text.slice(a,b));
  assert.deepEqual(parts(en,'en'),['Keys and values are generated by learned projections, e.g. linear maps.','During decoding they are stored in the KV cache (see Fig. 3 and Vaswani et al. for details).','Is 0.5 enough?','Yes.']);
  assert.deepEqual(parts(zh,'zh'),['键和值由可学习的投影生成，例如线性映射。','解码时它们被存入 KV 缓存（详见图 3 和 Vaswani et al. 的说明）。','0.5 够吗？','够。']);
  assert.deepEqual(parts('No final stop','en'),['No final stop']);assert.deepEqual(splitSentences('  ','zh'),[]);
});
test('sentence ranges map one to one, or proportionally when a translation merged or split sentences',()=>{
  assert.deepEqual(mapSentences(1,2,4,4),[1,2]);
  assert.deepEqual(mapSentences(0,0,1,3),[0,2]);
  assert.deepEqual(mapSentences(2,2,3,1),[0,0]);
  assert.deepEqual(mapSentences(3,3,4,2),[1,1]);
  assert.deepEqual(mapSentences(0,0,4,2),[0,0]);
  assert.deepEqual(mapSentences(0,0,0,2),[0,-1]);
});
