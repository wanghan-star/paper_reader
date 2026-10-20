export type DiagramNode={id:string;label:string;kind:"input"|"process"|"decision"|"output"|"store";detail:string};
export type DiagramEdge={from:string;to:string;label:string;detail:string};
export type LessonVisual={type:"flowchart"|"mechanism"|"bars"|"curve"|"tokens";title:string;xLabel:string;yLabel:string;steps:{label:string;detail:string;value:number}[];nodes?:DiagramNode[];edges?:DiagramEdge[]};
export type LessonQuiz={question:string;options:string[];correctIndex:number;hint?:string;explanation:string};
export type Lesson={visual?:LessonVisual;quiz?:LessonQuiz};
