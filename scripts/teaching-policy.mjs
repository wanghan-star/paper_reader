// Only the current request expresses intent; selected paper text is reference data.
// visual/quiz say whether the model may add them; *Requested says the user asked outright.
export function teachingPolicy(question=''){
  const request=String(question).split(/\n\s*选中文字：/)[0];
  const noQuiz=/(?:不要|不用|无需|别)[^。！？\n]{0,12}(?:提问|出题|题目|练习|测试|检查题|考我)|(?:no|without)\s+(?:quiz|questions|test)/i.test(request);
  const reviewingAnswer=/(?:我的理解是|我的回答是|我的想法是|我选择了|I think|my answer is)/i.test(request);
  const noVisual=/(?:不要|不用|无需|别)[^。！？\n]{0,12}(?:动画|动图|图示|图解|流程图|机理图|示意图|画图|演示)|只(?:用|要)[^。！？\n]{0,8}(?:文字|文本)|(?:no|without)\s+(?:animation|visual)|text only/i.test(request);
  const quiz=!noQuiz&&!reviewingAnswer;
  const quizRequested=quiz&&/(?:出|给|来|设计)[^。！？\n]{0,12}(?:一道题|一题|题目|练习|检查题)|(?:问我|考考我|考我|测试我的理解|检查我是否理解|看看我(?:有没有|是否)理解)|quiz me|test my understanding/i.test(request);
  const visualRequested=!noVisual&&/(?:用|通过|做|画|制作|生成|展示|给我看|来)[^。！？\n]{0,8}(?:动画|动图|图示|图解|流程图|机理图|示意图)|(?:动态|动画|动图)(?:演示|展示|讲解|对比)|animate|show (?:an? )?animation/i.test(request);
  return {visual:!noVisual,quiz,visualRequested,quizRequested};
}
