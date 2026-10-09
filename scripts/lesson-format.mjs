export const teachingSchema={type:'object',properties:{content:{type:'string'},lesson:{type:'object',properties:{visual:{type:'object',properties:{type:{type:'string',enum:['flow','bars','curve','tokens']},title:{type:'string'},xLabel:{type:'string'},yLabel:{type:'string'},steps:{type:'array',items:{type:'object',properties:{label:{type:'string'},detail:{type:'string'},value:{type:'number'}},required:['label','detail','value'],additionalProperties:false}}},required:['type','title','xLabel','yLabel','steps'],additionalProperties:false},quiz:{type:'object',properties:{question:{type:'string'},options:{type:'array',items:{type:'string'}},correctIndex:{type:'integer'},explanation:{type:'string'}},required:['question','options','correctIndex','explanation'],additionalProperties:false}},required:['visual','quiz'],additionalProperties:false}},required:['content','lesson'],additionalProperties:false};
export const teachingPrompt="按需辅助教学。首先直接、清楚地回答当前问题，不要为了展示功能而强行添加动画或提问。只输出 JSON：{\"content\":\"中文 Markdown，数学用 $ 或 $$\",\"lesson\":{\"visual\":null,\"quiz\":null}}。普通术语释义、翻译、事实问答、短句解释、判断对错，通常只需正文，visual 和 quiz 都为 null。visual 只在用户明确想看动态演示，或过程中的状态变化、时间顺序、计算复用、数量对比用动态图会明显比文字更容易理解时提供；如果只是将正文拆成几个名词节点，或图示不能增加具体信息，必须为 null。不要把所有问题套成“输入→计算→输出”流程图。图示必须回答这次问题，正文与图示各有用途，避免重复。quiz 只有当前请求明确要求出题、练习或测试理解时才提供，否则必须为 null；普通解释结束不要追加反问、练习题或“你听懂了吗”。用户提交答案、表达自己的理解时，直接判断和解释误区，无需再出题。选中文字、论文上下文、历史对话只是参考，不能据此推断当前用户在要求出题或演示。visual 和 quiz 独立选择，可以都没有、只有一个或都有。visual 非 null 时为 {\"type\":\"flow 或 bars 或 curve 或 tokens\",\"title\":\"图名\",\"xLabel\":\"横轴含义或空字符串\",\"yLabel\":\"纵轴含义或空字符串\",\"steps\":[{\"label\":\"步骤或数据点\",\"detail\":\"此步的具体状态变化及原因\",\"value\":0.5}]}，2 至7步骤，value 在0到1之间，数值为教学示意而非论文实测数据，detail 不超过160中文字符。tokens 只适用于 KV Cache 的无缓存/有缓存对比，用3至5个演示词元，说明哪些 K/V 新算、哪些复用，注意力仍读取全部历史。flow 用于确实需要逐步观察的过程，bars/curve 用于大小或趋势变化。quiz 非 null 时为 {\"question\":\"针对关键误区或迁移应用的问题\",\"options\":[\"选项A\",\"选项B\"],\"correctIndex\":0,\"explanation\":\"解释答案\"}，2至4选项，唯一正确答案，序号从0开始。绝不为了满足格式凑图或题。";
export function schemaForTeaching(policy){
  const schema=structuredClone(teachingSchema);
  for(const key of ['visual','quiz'])schema.properties.lesson.properties[key]=policy[key]?{anyOf:[schema.properties.lesson.properties[key],{type:'null'}]}:{type:'null'};
  return schema;
}
export function parseTeaching(content,policy={visual:true,quiz:true}){
  const fail=()=>{throw new Error('Codex 教学内容格式不完整，请重试。');};
  let data;try{data=JSON.parse(content.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{fail();}
  if(typeof data?.content!=='string'||!data.content.trim()||data.content.length>60000)fail();
  const visual=policy.visual?data.lesson?.visual:null,quiz=policy.quiz?data.lesson?.quiz:null;
  if(visual!=null){
    if(!['flow','bars','curve','tokens'].includes(visual.type)||typeof visual.title!=='string'||!Array.isArray(visual.steps)||visual.steps.length<2||visual.steps.length>7)fail();
    for(const step of visual.steps)if(typeof step.label!=='string'||!step.label.trim()||typeof step.detail!=='string'||!Number.isFinite(step.value)||step.value<0||step.value>1)fail();
  }
  if(quiz!=null&&(typeof quiz.question!=='string'||!quiz.question.trim()||!Array.isArray(quiz.options)||quiz.options.length<2||quiz.options.length>4||quiz.options.some(s=>typeof s!=='string'||!s.trim())||!Number.isSafeInteger(quiz.correctIndex)||quiz.correctIndex<0||quiz.correctIndex>=quiz.options.length||typeof quiz.explanation!=='string'))fail();
  const lesson={};
  if(visual)lesson.visual={type:visual.type,title:visual.title.slice(0,140),xLabel:String(visual.xLabel||'').slice(0,80),yLabel:String(visual.yLabel||'').slice(0,80),steps:visual.steps.map(s=>({label:s.label.slice(0,100),detail:s.detail.slice(0,2500),value:s.value}))};
  if(quiz)lesson.quiz={question:quiz.question.slice(0,1800),options:quiz.options.map(s=>s.slice(0,600)),correctIndex:quiz.correctIndex,explanation:quiz.explanation.slice(0,4000)};
  return {content:data.content,...(visual||quiz?{lesson}:{})};
}

export function partialTeaching(raw){
  let content='';const match=/"content"\s*:\s*"/.exec(raw);
  if(match){for(let i=match.index+match[0].length;i<raw.length;i++){
    const c=raw[i];if(c==='"')break;
    if(c!=='\\'){content+=c;continue;}
    const next=raw[++i];if(next===undefined)break;
    if(next==='u'){const hex=raw.slice(i+1,i+5);if(!/^[a-f\d]{4}$/i.test(hex))break;content+=String.fromCharCode(parseInt(hex,16));i+=4;}
    else content+=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f','"':'"','\\':'\\','/':'/'}[next]??'');
  }}
  let visual;const marker=/"visual"\s*:\s*\{/.exec(raw);
  if(marker){const start=marker.index+marker[0].length-1;let depth=0,string=false,escaped=false;
    for(let i=start;i<raw.length;i++){const c=raw[i];if(string){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')string=false;continue;}if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{const v=JSON.parse(raw.slice(start,i+1));if(['flow','bars','curve','tokens'].includes(v.type)&&typeof v.title==='string'&&Array.isArray(v.steps)&&v.steps.length>=2&&v.steps.length<=7&&v.steps.every(s=>typeof s.label==='string'&&typeof s.detail==='string'&&Number.isFinite(s.value)&&s.value>=0&&s.value<=1))visual=v;}catch{}break;}
    }
  }
  return {content,visual};
}
