/** Convert common AI LaTeX delimiters before Markdown consumes their backslashes. */
export function normalizeMath(source:string):string {
  return source.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part,index)=>{
    if(index%2)return part;
    const normalized=part
      .replace(/\\\[([\s\S]*?)\\\]/g,(_,math:string)=>'\n\n$$\n'+math.trim()+'\n$$\n\n')
      .replace(/\\\(([\s\S]*?)\\\)/g,(_,math:string)=>'$'+math.trim()+'$');
    return normalized.split(/(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$)/g).map((fragment,k)=>k%2?fragment:fragment
      .replace(/\[([^\[\]]{1,6000})\]|\(([^()\n]{1,1500})\)/g,(whole,block:string|undefined,inline:string|undefined)=>{
        const math=block??inline??"";
        if(!/\\(?:frac|sqrt|operatorname|text|sum|int|begin|left|mathbf|top)\b/.test(math))return whole;
        return block!==undefined?'\n\n$$\n'+math.trim()+'\n$$\n\n':'$'+math.trim()+'$';
      })).join('');
  }).join('');
}
