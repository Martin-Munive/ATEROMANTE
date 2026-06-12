export type StationRole = 'player-client' | 'moderator-server' | 'hybrid';
export type TutorVisibility = 'none' | 'private' | 'shared' | 'symmetric';
export type AssistanceTiming = 'live' | 'post-game' | 'paused-only';
export type EnginePermission = 'disabled' | 'evaluation-only' | 'best-moves';

export interface MatchPolicy {
  tutorVisibility: TutorVisibility;
  assistanceTiming: AssistanceTiming;
  enginePermission: EnginePermission;
  allowStudyBranches: boolean;
  markExportsAsAssisted: boolean;
}

export interface TrainingSessionSummary {
  mode: string;
  stationRole: StationRole;
  moderatorState: string;
  tutorPolicy: string;
  assistanceLevel: string;
  visibility: string;
  matchPolicy: MatchPolicy;
}
