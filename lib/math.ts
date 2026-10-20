/** Convert common AI LaTeX delimiters before Markdown consumes their backslashes. */
// Commands that models copy from paper sources but KaTeX does not provide.
export const katexMacros={"\\bm":"\\boldsymbol{#1}","\\mathbbm":"\\mathbb{#1}","\\mathds":"\\mathbb{#1}","\\textsc":"\\text{#1}","\\eqref":"(\\text{#1})","\\ensuremath":"#1"};
export function normalizeMath(source:string):string {
  return source.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part,index)=>{
    if(index%2)return part;
    const normalized=part
      .replace(/\\label\{[^{}]*\}|\\(?:nonumber|notag)\b/g,'')
      .replace(/\\\[([\s\S]*?)\\\]/g,(_,math:string)=>'\n\n$$\n'+math.trim()+'\n$$\n\n')
      .replace(/\\\(([\s\S]*?)\\\)/g,(_,math:string)=>'$'+math.trim()+'$');
    const repaired=normalized.split(/(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$)/g).map((fragment,k)=>k%2?fragment:fragment
      .replace(/\[([^\[\]]{1,6000})\]|\(([^()\n]{1,1500})\)/g,(whole,block:string|undefined,inline:string|undefined)=>{
        const math=block??inline??"";
        if(!/\\(?:frac|sqrt|operatorname|text|sum|int|begin|left|mathbf|top)\b/.test(math))return whole;
        return block!==undefined?'\n\n$$\n'+math.trim()+'\n$$\n\n':'$'+math.trim()+'$';
      })).join('');
    // Markdown treats single-line $$...$$ as inline math. Canonical display blocks
    // are needed for equation numbers (\\tag), fractions and wide formulas.
    return repaired.replace(/(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/g,(whole,math:string,offset:number)=>{
      const before=repaired.slice(0,offset),after=repaired.slice(offset+whole.length);
      return (before&&!before.endsWith('\n\n')?'\n\n':'')+'$$\n'+math.trim()+'\n$$'+(after&&!after.startsWith('\n\n')?'\n\n':'');
    });
  }).join('');
}
