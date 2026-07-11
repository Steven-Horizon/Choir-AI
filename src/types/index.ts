export interface Note {
  note: string;
  duration: string;
  time: string;
}

export interface VoicePart {
  name: string;
  color: string;
  notes: Note[];
}

export interface Score {
  id: number;
  title: string;
  composer: string;
  file_path: string | null;
  external_url: string | null;
  midi_parsed: boolean;
  parts_data: {
    soprano: VoicePart;
    alto: VoicePart;
    tenor: VoicePart;
    bass: VoicePart;
    tempo: number;
    key: string;
    timeSignature: string;
    totalMeasures: number;
  } | null;
  tempo: number;
  key_sig: string;
  time_signature: string;
  total_measures: number;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  attachments: string | null;
  created_at: string;
}

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
}

export interface TrainingPlan {
  id: number;
  session_id: number;
  title: string;
  plan_data: PlanPhase[];
  created_at: string;
}

export interface PlanPhase {
  phase: string;
  days: string;
  goal: string;
  tasks: string[];
}

export interface RehearsalIssue {
  measure: number;
  part: string;
  type: 'pitch' | 'rhythm' | 'timing';
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export interface RehearsalRecord {
  id: number;
  score_id: number;
  score_title: string;
  start_time: string;
  end_time: string | null;
  settings: Record<string, unknown> | null;
  issues: RehearsalIssue[] | null;
  created_at: string;
}

export interface PartVolume {
  soprano: number;
  alto: number;
  tenor: number;
  bass: number;
}

export interface PartEnabled {
  soprano: boolean;
  alto: boolean;
  tenor: boolean;
  bass: boolean;
}
