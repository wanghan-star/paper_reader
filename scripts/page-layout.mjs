const boxSchema={type:'object',properties:{x:{type:'number'},y:{type:'number'},width:{type:'number'},height:{type:'number'}},required:['x','y','width','height'],additionalProperties:false};
export const pageLayoutSchema={type:'object',properties:{blocks:{type:'array',items:{type:'object',properties:{type:{type:'string',enum:['heading','paragraph','equation','figure','table']},en:{type:'string'},zh:{type:'string'},box:boxSchema},required:['type','en','zh','box'],additionalProperties:false}}},required:['blocks'],additionalProperties:false};
export const pageLayoutPrompt=`根据所附论文整页图像，完整识别页面结构并翻译成中文，只输出符合 schema 的 JSON。
按真实阅读顺序排列 blocks：双栏先左栏再右栏，跨栏标题/图表按其在正文中的位置插入。不要概括、漏掉正文或编造看不清的符号。
type 的含义：heading 是真实标题；paragraph 是完整的自然段；equation 是独立公式；figure 是整幅图（包含全部子图、坐标轴、图例和标签）；table 是整张表格。
paragraph 必须将印刷换行拼回同一自然段，不能把几词、行尾、缩写、图内标签、坐标数字和单位拆成段落。不要把图内数字或图例重复列入正文。保留脚注和正文中的引用编号，忽略重复页眉页脚。图注应放在对应 figure/table 的 en 和 zh 中，不重复作为其他块。
en 返回原始英文，zh 返回完整中文译文。必须逐段对应。公式、数字、单位、参数、正负号都以图像为准，不能根据辅助文字猜测。
保留所有上下标、分数、积分、向量、希腊字母及公式编号。行内数学用 $...$，独立公式用 $$...$$，JSON 中反斜杠正确转义；不要输出散落的 LaTeX 命令。equation 的 en 为完整 LaTeX，zh 留空（数学本身保留，不改写成自然语言）。
所有块都提供 box，坐标相对于整页图像，左上角为原点，x/y/width/height 均采用 0 到 1000 的归一化单位。figure/table 的框覆盖完整图表及其图内文字，四周稍留边距，但不要包含相邻正文；equation 的框覆盖完整公式及编号。
如果局部公式或符号无法确认，保留 equation 块及对应原图框，en 和 zh 留空；段落中局部无法确认的字迹标注 [无法辨认]，不要替换成方框或乱猜。空白页允许 blocks 为空。`;

export function parsePageLayout(content){
  const fail=()=>{throw new Error('页面结构识别未完成，原页已保留。请重新识别此页或切换模型后重试。');};
  let data;try{data=JSON.parse(content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{fail();}
  if(!Array.isArray(data?.blocks)||data.blocks.length>100)fail();
  const blocks=data.blocks.map(block=>{
    if(!['heading','paragraph','equation','figure','table'].includes(block?.type)||typeof block.en!=='string'||typeof block.zh!=='string'||block.en.length>12000||block.zh.length>20000)fail();
    const b=block.box;
    if(!b||!['x','y','width','height'].every(k=>Number.isFinite(b[k]))||b.x<0||b.y<0||b.x>=1000||b.y>=1000||b.width<=0||b.height<=0||b.width>1000||b.height>1000)fail();
    if(['heading','paragraph'].includes(block.type)&&!block.en.trim())fail();
    return {type:block.type,en:block.en.trim(),zh:block.zh.trim(),box:{x:b.x,y:b.y,width:Math.min(b.width,1000-b.x),height:Math.min(b.height,1000-b.y)}};
  });
  if(JSON.stringify(blocks).length>200000)fail();
  return {blocks};
}
