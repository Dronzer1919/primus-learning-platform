export type DifficultyLevel = 'beginner' | 'intermediate' | 'advance' | 'expert';

export type LanguagePlatform = 'html' | 'scss' | 'css' | 'typescript' | 'javascript' | 'angular' | 'nodejs' | 'rxjs';

export interface LanguageTab {
  id: string;
  name: string;
  code: LanguagePlatform;
  order: number;
  isActive: boolean;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  difficultyLevel: DifficultyLevel;
  languagePlatform: LanguagePlatform;
  order: number;
  subtopics: Subtopic[];
}

export interface Subtopic {
  id: string;
  topicId: string;
  title: string;
  order: number;
  subSubtopics?: SubSubtopic[];
  content: ContentBlock[];
}

export interface SubSubtopic {
  id: string;
  subtopicId: string;
  title: string;
  order: number;
  content: ContentBlock[];
}

export type ContentType = 'description' | 'code' | 'image' | 'youtube';

export interface ContentBlock {
  id: string;
  type: ContentType;
  order: number;
  data: any;
}

export interface DescriptionContent {
  text: string;
}

export interface CodeContent {
  language: string;
  code: string;
  title?: string;
}

export interface ImageContent {
  url: string;
  alt: string;
  caption?: string;
}

export interface YoutubeContent {
  videoId: string;
  title?: string;
}

export interface UserNote {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  isPinned: boolean;
}
