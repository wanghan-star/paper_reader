// Only the current request expresses intent; selected paper text is reference data.
export function teachingPolicy(question=''){
  const request=String(question).split(/\n\s*选中文字：/)[0];
  const noQuiz=/(?:不要|不用|无需|别)[^。！？\n]{0,12}(?:提问|出题|题目|练习|测试|检查题)|(?:no|without)\s+(?:quiz|questions|test)/i.test(request);
  const reviewingAnswer=/(?:我的理解是|我的回答是|我选择了|I think|my answer is)/i.test(request);
  const quiz=!noQuiz&&!reviewingAnswer&&/(?:出|给|来|设计)[^。！？\n]{0,12}(?:一道题|一题|题目|练习|检查题)|(?:问我|考考我|测试我的理解|检查我是否理解|看看我(?:有没有|是否)理解)|quiz me|test my understanding/i.test(request);
  const visual=!/(?:不要|不用|无需|别)[^。！？\n]{0,12}(?:动画|动图|图示|图解)|只(?:用|要)[^。！？\n]{0,8}(?:文字|文本)|(?:no|without)\s+(?:animation|visual)|text only/i.test(request);
  return {visual,quiz};
}
