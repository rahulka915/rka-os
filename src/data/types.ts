export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface SupabaseBaseRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  deleted_at?: string | null;
  metadata?: Json | null;
}

export interface SupabaseItemRow extends SupabaseBaseRow {
  type: string;
  title: string;
  status: string;
  notes?: string | null;
  scheduled_date?: string | null;
  due_date?: string | null;
  rrule?: string | null;
}

export interface SupabaseItemInstanceRow extends SupabaseBaseRow {
  item_id: string;
  scheduled_date: string;
  completed_at?: string | null;
  status: 'pending' | 'completed' | 'skipped' | 'partial';
  instance_metadata?: Json | null;
}

export interface SupabaseTagRow extends SupabaseBaseRow {
  name: string;
  color: string;
}

export interface SupabaseItemTagRow extends SupabaseBaseRow {
  item_id: string;
  tag_id: string;
}

export interface SupabaseEntityLinkRow extends SupabaseBaseRow {
  source_id: string;
  target_id: string;
  link_type: string;
}

export interface SupabaseActivityLogRow extends SupabaseBaseRow {
  entity_id: string;
  action_type: string;
  timestamp: string;
  details?: Json | null;
}

export interface SupabaseWorkoutSessionRow extends SupabaseBaseRow {
  template_id: string;
  date: string;
  duration: number;
  notes?: string | null;
}

export interface SupabaseExerciseSessionRow extends SupabaseBaseRow {
  workout_session_id: string;
  exercise_id: string;
  order: number;
  notes?: string | null;
}

export interface SupabaseSetEntryRow extends SupabaseBaseRow {
  exercise_session_id: string;
  set_number: number;
  reps: number;
  weight: number;
  rir?: number | null;
  rpe?: number | null;
  completed: boolean;
}

export interface SupabaseExerciseMediaRow extends SupabaseBaseRow {
  exercise_id: string;
  storage_path: string;
  url: string;
  media_type: 'image' | 'video';
}

