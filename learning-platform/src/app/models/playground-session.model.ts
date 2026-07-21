export type PlaygroundModeId = 'web' | 'javascript' | 'typescript';

export interface PlaygroundSession {
  _id: string;
  userId: string;
  title: string;
  mode: PlaygroundModeId;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  jsOnlyCode: string;
  tsCode: string;
  selectedTab: 'html' | 'css' | 'js';
  createdAt: string;
  updatedAt: string;
}
