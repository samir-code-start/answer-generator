
export enum MarksWeightage {
  TWO = '2',
  FIVE = '5',
  EIGHT = '8',
  TEN = '10'
}

export enum DefaultAnswerStyle {
  MODEL_ANSWER = 'SPPU Model Answer',
  BRIEF = 'Brief',
  DETAILED = 'Detailed'
}

export type AnswerStyle = DefaultAnswerStyle | string;

export interface CustomStyle {
  id: string;
  name: string;
  instruction: string;
}

export interface GeneratedAnswer {
  id: string;
  question: string;
  marks: MarksWeightage;
  style: AnswerStyle;
  answer: string;
  timestamp: number;
}
