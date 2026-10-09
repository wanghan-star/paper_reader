import type { Lesson } from './lesson';
export function instantVisual(question:string):Lesson['visual']|undefined{
  if(!/\bKV[\s_-]*Cache\b|KV\s*缓存|键值缓存/i.test(question))return;
  return {type:'tokens',title:'先看懂 KV Cache 如何复用历史',xLabel:'',yLabel:'',steps:[
    {label:'我',detail:'读取第一个词元，计算并保存它的 K 和 V。',value:1/3},
    {label:'喜欢',detail:'为新词元计算 K/V；历史“我”的 K/V 可以直接复用。',value:2/3},
    {label:'学习',detail:'只新增当前词元的 K/V，注意力仍读取全部历史 K/V。',value:1}
  ]};
}
