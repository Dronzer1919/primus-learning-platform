export type PlaygroundModeId = 'web' | 'javascript' | 'typescript';

export interface PlaygroundLanguage {
  id: PlaygroundModeId;
  label: string;
  icon: string;
  multiFile: boolean;
  locked: boolean;
  lockedMessage?: string;
}

export const PLAYGROUND_LANGUAGES: PlaygroundLanguage[] = [
  { id: 'web', label: 'Playground', icon: 'code-slash-outline', multiFile: true, locked: false },
  { id: 'javascript', label: 'JavaScript', icon: 'logo-javascript', multiFile: false, locked: false },
  { id: 'typescript', label: 'TypeScript', icon: 'logo-javascript', multiFile: false, locked: false }
];
