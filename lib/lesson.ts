export type LessonVisual={type:"flow"|"bars"|"curve"|"tokens";title:string;xLabel:string;yLabel:string;steps:{label:string;detail:string;value:number}[]};
export type LessonQuiz={question:string;options:string[];correctIndex:number;explanation:string};
export type Lesson={visual?:LessonVisual;quiz?:LessonQuiz};
