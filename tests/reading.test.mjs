import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import katex from 'katex';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const {normalizeMath}=await load('lib/math.ts');const {readingIndexes,colorInk}=await load('lib/reading.ts');
const {instantVisual}=await load('lib/lesson-preview.ts');
test('KV Cache preview appears only for a requested dynamic demonstration',()=>{
  for(const q of ['KV Cache 的英文全称是什么？','解释 KV Cache','KV Cache 动画中的 6 是什么意思？','不要动画，用文字解释 KV Cache','Show KV Cache with no animation'])assert.equal(instantVisual(q),undefined,q);
  assert.equal(instantVisual('用动画演示 KV Cache 如何复用历史').type,'tokens');
});
const formula=String.raw`\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V`;
test('AI display and inline LaTeX survive Markdown delimiter conversion',()=>{
  for(const input of [String.raw`\[${formula}\]`,'[ '+formula+' ]','$$'+formula+'$$']){
    const normalized=normalizeMath(input);const body=/\$\$([\s\S]*?)\$\$/.exec(normalized)?.[1];assert.ok(body);assert.equal(body.trim(),formula);assert.ok(katex.renderToString(body).includes('katex'));assert.equal(normalizeMath(normalized),normalized);
  }
  assert.equal(normalizeMath(String.raw`键维度为 \(d_k\)，分数为 \(QK^\top\)。`),String.raw`键维度为 $d_k$，分数为 $QK^\top$。`);
  assert.equal(normalizeMath(String.raw`分数 (QK^\top)`),String.raw`分数 $QK^\top$`);
});
test('ordinary brackets, Markdown links, code samples, and existing math remain unchanged',()=>{
  const source=String.raw`[阅读链接](https://example.com) [1, 2] (普通备注) $\sqrt{d_k}$`;
  assert.equal(normalizeMath(source),source);
  for(const source of [String.raw`示例：\`\[x\]\``,String.raw`\`\`\`latex
\[\frac{x}{y}\]
\`\`\``].map(s=>s.replaceAll('\\`','`')))assert.equal(normalizeMath(source),source);
});
test('numbered formulas are canonical display blocks rather than inline Markdown math',()=>{
  const source=String.raw`$$H_{\mathrm{eff}}=H_{\mathrm{ext}}+\frac{2K_i}{\mu_0M_st_{\mathrm{fl}}}\tag{3}$$`;
  const normalized=normalizeMath(source);
  assert.ok(normalized.startsWith('$$\n')&&normalized.endsWith('\n$$'));
  assert.equal(normalizeMath(normalized),normalized);
  assert.ok(katex.renderToString(normalized.slice(3,-3),{displayMode:true,throwOnError:true}).includes('mfrac'));
});
test('reading groups combine pages without losing or duplicating original page identity',()=>{
  assert.deepEqual(readingIndexes(5,1,'paged',2),[0,1]);assert.deepEqual(readingIndexes(5,2,'paged',2),[0,1]);assert.deepEqual(readingIndexes(5,3,'paged',2),[2,3]);assert.deepEqual(readingIndexes(5,5,'paged',2),[4]);
  assert.deepEqual(readingIndexes(5,3,'scroll',2),[0,1,2,3,4]);assert.deepEqual(readingIndexes(5,3,'paged',2,true),[2]);
});
test('custom background chooses a readable foreground on bright and dark paper',()=>{assert.equal(colorInk('#ffffff'),'#2b332e');assert.equal(colorInk('#101010'),'#edf2eb');});

const retrieval=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync('lib/retrieval.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
test('whole-paper questions find matching passages on other pages, figures first',()=>{
  const page=(...rows)=>({text:rows.map(r=>r[0]).join('\n'),heading:'',sentences:rows.map(([en,zh,heading],id)=>({id,en,zh,heading}))});
  const pages=[
    page(['1 Introduction','1 引言',true],['Voltage-controlled magnetic anisotropy lowers the write energy of the junction considerably.','压控磁各向异性显著降低了结的写入能量。']),
    page(['The calibration circuit trims the pulse width so that every neuron fires with the same probability.','校准电路调节脉冲宽度，使每个神经元以相同概率发放。'],['Fig. 3. Measured switching probability against pulse width for the fabricated devices.','图 3。器件的开关概率随脉冲宽度的测量结果。']),
    page(['The accelerator reaches 27 TOPS/W at 0.8 V with the proposed readout scheme.','在 0.8 V 下，采用所提读出方案的加速器达到 27 TOPS/W。'])
  ];
  assert.deepEqual(retrieval.references('图3和公式 (2) 以及 Table II 说明了什么'),['fig:3','eq:2','table:ii']);
  const hits=retrieval.search(retrieval.passages(pages),'图 3 里的开关概率是怎么测的？');
  assert.equal(hits[0].page,2);assert.match(hits[0].text,/^Fig\. 3/);
  assert.equal(retrieval.search(retrieval.passages(pages),'VCMA 为什么能降低写入能量')[0].page,1,'a Chinese question matches the translation');
  const {context,sources}=retrieval.questionContext(pages,[2],'压控磁各向异性如何降低写入能量？');
  assert.match(context,/当前页面/);assert.match(context,/第 1 页摘录/);assert.deepEqual(sources,[1]);
  assert.ok(!retrieval.questionContext(pages,[0],'写入能量').sources.includes(1),'pages already on screen are not repeated');
  assert.ok(retrieval.questionContext(pages,[0],'x'.repeat(10)).context.length<22000);
});

const glossary=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync('lib/glossary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
test('glossary candidates come from defined phrases and repeated acronyms; terms match whole words',()=>{
  const pages=[{text:'',heading:'',sentences:[{id:0,en:'Voltage-Controlled Magnetic Anisotropy (VCMA) lowers write energy in a VCMA-MTJ.'},{id:1,en:'The MTJ is read by an ADC. IEEE IEEE'}]},{text:'',heading:'',sentences:[{id:0,en:'Each MTJ and the VCMA effect.'}]}];
  const c=glossary.candidates(pages);
  assert.ok(c.includes('Voltage-Controlled Magnetic Anisotropy (VCMA)'));assert.ok(c.some(x=>x.startsWith('MTJ(')));assert.ok(!c.some(x=>x.startsWith('ADC(')),'used once');assert.ok(!c.some(x=>x.startsWith('IEEE')));
  assert.equal(glossary.firstPage(pages,'MTJ'),1);assert.equal(glossary.firstPage(pages,'effect'),2);
  const p=glossary.termPattern('MTJ');assert.deepEqual('MTJs and MTJ, not SMTJ'.match(p),['MTJs','MTJ'],'singular and plural, never inside another word');
});

const refs=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync('lib/references.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
test('figure, table, equation and citation mentions become links that resolve to their blocks',()=>{
  const linked=refs.linkReferences('As shown in Fig. 5a and Table II, Eq. (2) holds [3, 7]; see $x(2)$ and 图 3 及式 (4)。方式 (5) 不是公式。');
  assert.match(linked,/\[Fig\. 5a\]\(#paper-ref-fig-5\)/);assert.match(linked,/\(#paper-ref-table-ii\)/);assert.match(linked,/\(#paper-ref-eq-2\)/);
  assert.match(linked,/&#91;\[3\]\(#paper-ref-cite-3\), \[7\]\(#paper-ref-cite-7\)&#93;/);
  assert.match(refs.linkReferences('(Fig. 1a) and Fig. 3(b).'),/\[Fig\. 1a\]\(#paper-ref-fig-1\)\) and \[Fig\. 3\(b\)\]/,'a closing parenthesis stays outside the link');
  assert.match(linked,/\$x\(2\)\$/,'math is untouched');assert.match(linked,/#paper-ref-fig-3/);assert.match(linked,/#paper-ref-eq-4/);assert.doesNotMatch(linked,/#paper-ref-eq-5/);
  assert.equal(refs.linkReferences('Fig. 5. Proposed architecture with Fig. 2 inputs.').match(/paper-ref/g).length,1,"a caption's own label is not linked");
  assert.deepEqual(refs.parseRef('#paper-ref-table-ii'),{kind:'table',key:'ii'});assert.equal(refs.parseRef('#x'),null);
  const pages=[{text:'',heading:'',sentences:[{id:0,en:'Body text.'},{id:1,en:'$$E=mc^2 \\tag{2}$$',kind:'equation'}]},{text:'',heading:'',sentences:[{id:0,en:'Fig. 5. Architecture.',kind:'figure'},{id:1,en:'TABLE II Comparison',kind:'table'},{id:2,en:'[3] A. Author, Title, 2024.'}]},{text:'Fig. 9. Only in text.',heading:'',sentences:[]}];
  assert.deepEqual(refs.findTarget(pages,'fig','5'),{page:2,id:0});assert.deepEqual(refs.findTarget(pages,'table','2'),{page:2,id:1});
  assert.deepEqual(refs.findTarget(pages,'eq','2'),{page:1,id:1});assert.deepEqual(refs.findTarget(pages,'fig','9'),{page:3,id:-1});
  assert.equal(refs.findTarget(pages,'fig','4'),null);assert.equal(refs.citation(pages,'3'),'[3] A. Author, Title, 2024.');
});
