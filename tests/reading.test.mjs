import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import katex from 'katex';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const {normalizeMath}=await load('lib/math.ts');const {readingIndexes,colorInk}=await load('lib/reading.ts');
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
