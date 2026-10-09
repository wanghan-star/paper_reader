export const teachingSchema={type:'object',properties:{content:{type:'string'},lesson:{type:'object',properties:{visual:{type:'object',properties:{type:{type:'string',enum:['flow','bars','curve','tokens']},title:{type:'string'},xLabel:{type:'string'},yLabel:{type:'string'},steps:{type:'array',items:{type:'object',properties:{label:{type:'string'},detail:{type:'string'},value:{type:'number'}},required:['label','detail','value'],additionalProperties:false}}},required:['type','title','xLabel','yLabel','steps'],additionalProperties:false},quiz:{type:'object',properties:{question:{type:'string'},options:{type:'array',items:{type:'string'}},correctIndex:{type:'integer'},explanation:{type:'string'}},required:['question','options','correctIndex','explanation'],additionalProperties:false}},required:['visual','quiz'],additionalProperties:false}},required:['content','lesson'],additionalProperties:false};
export const teachingPrompt='教学模式：除中文讲解外，还要提供能帮助用户理解这个具体问题的动态示意及一道理解检查题。只输出 JSON，结构为 {"content":"中文讲解 Markdown，数学用 $ 或 $$", "lesson":{"visual":{"type":"flow 或 bars 或 curve 或 tokens","title":"图名","xLabel":"横轴含义，无横轴则空字符串","yLabel":"纵轴含义，无纵轴则空字符串","steps":[{"label":"步骤或数据点名称","detail":"此步的具体解释","value":0.5}]},"quiz":{"question":"根据这次讲解反问一个检查理解的问题","options":["选项A","选项B","选项C"],"correctIndex":0,"explanation":"为什么这个选项正确，其他误解在哪里"}}}。对于 KV Cache、自回归词元生成等问题，使用 tokens 类型进行“无缓存/有缓存”的逐步对比，steps 中每个 label 是演示句子的一个词元（例如“我”“喜欢”“学习”），detail 解释生成这个词元时哪些 K/V 新算、哪些复用；用3至5个词元，强调缓存不会省略历史上下文。其他动态示意必须有2至7个步骤，优先用 flow 展示因果或计算过程；只有需要比较大小或变化趋势时使用 bars/curve。value 必须在0到1之间，为归一化教学示意值，不能冒充论文真实实验数据。每个步骤 detail 控制在160个中文字符以内，讲解正文优先简短清晰；步骤内容需针对用户的具体问题和论文上下文，不要套用无关模板。理解检查题有2至4个选项、唯一正确答案，correctIndex 为从0开始的选项序号。题目应检查关键误解或迁移应用，而不是仅问用户是否听懂。';
export function parseTeaching(content){
  const fail=()=>{throw new Error('Codex 教学内容格式不完整，请重试。');};
  let data;try{data=JSON.parse(content.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{fail();}
  if(typeof data?.content!=='string'||!data.content.trim()||data.content.length>60000)fail();
  const visual=data.lesson?.visual,quiz=data.lesson?.quiz;
  if(!visual||!['flow','bars','curve','tokens'].includes(visual.type)||typeof visual.title!=='string'||!Array.isArray(visual.steps)||visual.steps.length<2||visual.steps.length>7)fail();
  for(const step of visual.steps)if(typeof step.label!=='string'||!step.label.trim()||typeof step.detail!=='string'||!Number.isFinite(step.value)||step.value<0||step.value>1)fail();
  if(!quiz||typeof quiz.question!=='string'||!quiz.question.trim()||!Array.isArray(quiz.options)||quiz.options.length<2||quiz.options.length>4||quiz.options.some(s=>typeof s!=='string'||!s.trim())||!Number.isSafeInteger(quiz.correctIndex)||quiz.correctIndex<0||quiz.correctIndex>=quiz.options.length||typeof quiz.explanation!=='string')fail();
  return {content:data.content,lesson:{visual:{type:visual.type,title:visual.title.slice(0,140),xLabel:String(visual.xLabel||'').slice(0,80),yLabel:String(visual.yLabel||'').slice(0,80),steps:visual.steps.map(s=>({label:s.label.slice(0,100),detail:s.detail.slice(0,2500),value:s.value}))},quiz:{question:quiz.question.slice(0,1800),options:quiz.options.map(s=>s.slice(0,600)),correctIndex:quiz.correctIndex,explanation:quiz.explanation.slice(0,4000)}}};
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
