import type { MatchPolicy } from './sessionTypes';

export type LlmProviderKind =
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'local-http'
  | 'mock';

export type TutorDepth = 'hint' | 'tactical' | 'strategic' | 'full-lesson';

export interface LlmProviderConfig {
  id: string;
  label: string;
  kind: LlmProviderKind;
  model: string;
  enabled: boolean;
  baseUrl?: string;
  apiKeyEnv?: string;
  supportsStreaming?: boolean;
}

export interface EngineLine {
  evaluation: string;
  principalVariation: string;
}

export interface VisualAnnotation {
  kind: 'arrow' | 'square' | 'line' | 'opacity';
  from?: string;
  to?: string;
  square?: string;
  color: 'green' | 'amber' | 'red' | 'blue' | 'violet';
  label?: string;
}

export interface TutorPromptContext {
  language: 'es' | 'en';
  tutorDepth: TutorDepth;
  fen: string;
  pgn: string;
  lastMove?: string;
  engineLines: EngineLine[];
  studentProfileSummary: string;
  matchPolicy: MatchPolicy;
}

export interface TutorResponse {
  summary: string;
  candidateMove?: string;
  teachingFocus: string[];
  visualAnnotations: VisualAnnotation[];
  followUpExercise?: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface LlmTutorProvider {
  readonly config: LlmProviderConfig;
  explainPosition(_context: TutorPromptContext): Promise<TutorResponse>;
}
