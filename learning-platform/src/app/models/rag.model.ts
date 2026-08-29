/** A topic-library excerpt the assistant was given as grounding for an answer. */
export interface RagCitation {
  topicId: string;
  subtopicId: string;
  /** e.g. "JavaScript > Closures" — pre-joined topic/subtopic titles. */
  title: string;
  languagePlatform: string;
}

/** One line of the backend's newline-delimited streaming response. */
export type RagStreamEvent =
  | { type: 'citations'; citations: RagCitation[] }
  | { type: 'delta'; text: string }
  | { type: 'refusal' }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface RagChatMessage {
  role: 'user' | 'assistant';
  text: string;
  citations?: RagCitation[];
  /** True while an assistant message is still streaming in. */
  pending?: boolean;
  /** True if generation failed or was refused — styled distinctly, not retried automatically. */
  failed?: boolean;
}
