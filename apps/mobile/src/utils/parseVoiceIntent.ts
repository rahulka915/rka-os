export type VoiceIntent = 'task' | 'medication' | 'workout' | 'note';

const MEDICATION_KEYWORDS = ['take', 'dose', 'pill', 'tablet', 'medication', 'medicine'];
const WORKOUT_KEYWORDS = ['run', 'walk', 'lift', 'exercise', 'gym', 'bike', 'swim', 'workout', 'stretch'];
const TASK_KEYWORDS = ['call', 'email', 'buy', 'finish', 'complete', 'do', 'need', 'should', 'have', 'remember'];

export function parseVoiceIntent(transcript: string): VoiceIntent {
  if (!transcript.trim()) return 'note';

  const lower = transcript.toLowerCase();
  const words = lower.split(/\s+/);

  // Check for medication keywords
  if (MEDICATION_KEYWORDS.some(kw => words.some(w => w.includes(kw)))) {
    return 'medication';
  }

  // Check for workout keywords
  if (WORKOUT_KEYWORDS.some(kw => words.some(w => w.includes(kw)))) {
    return 'workout';
  }

  // Check for task keywords
  if (TASK_KEYWORDS.some(kw => words.some(w => w.includes(kw)))) {
    return 'task';
  }

  // Default to note
  return 'note';
}
