import type { Lesson } from './lesson';
export function instantVisual(question:string):Lesson['visual']|undefined{
  if(!/\bKV[\s_-]*Cache\b|KV\s*缓存|键值缓存/i.test(question))return;
  if(!/(?:用|通过)[^。！？\n]{0,8}(?:动画|动图|动态)|(?:做|制作|生成|展示|给我看)[^。！？\n]{0,8}(?:动画|动图)|(?:动态|动画|动图)(?:演示|展示|讲解|对比)|animate|show (?:an? )?animation/i.test(question)||/(?:不要|不用|无需|别)[^。！？\n]{0,12}(?:动画|动图|图示|演示)|只(?:用|要)[^。！？\n]{0,8}(?:文字|文本)|(?:no|without)\s+(?:animation|visual)|text only/i.test(question))return;
  return {type:'tokens',title:'先看懂 KV Cache 如何复用历史',xLabel:'',yLabel:'',steps:[
    {label:'我',detail:'读取第一个词元，计算并保存它的 K 和 V。',value:1/3},
    {label:'喜欢',detail:'为新词元计算 K/V；历史“我”的 K/V 可以直接复用。',value:2/3},
    {label:'学习',detail:'只新增当前词元的 K/V，注意力仍读取全部历史 K/V。',value:1}
  ]};
}
