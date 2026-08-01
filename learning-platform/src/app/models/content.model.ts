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

/**
 * Per-note presentation. Mirrors the flowchart's label styling (see FlowNode in
 * flowchart.model.ts) so both editors offer the same set of text controls.
 * Every field is optional; unset means the theme default.
 */
export interface NoteStyle {
  /** Card background. When set, the note text switches to a dark ink so the
   *  pale swatches stay readable on the dark themes. */
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
  /** Font size in px. */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface UserNote {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  isPinned: boolean;
  /** `null` clears the styling. It has to be an explicit null rather than undefined:
   *  JSON.stringify drops undefined keys, so the server would never see the change
   *  and the old style would survive the save. */
  style?: NoteStyle | null;
}
