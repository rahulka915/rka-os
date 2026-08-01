export interface WorkoutSetDetails {
  sessionId: string;
  setNumber: number;
  reps: number;
  weight: number;
  weightUnit: string;
}

export function parseSetLogDetails(details?: string | null): WorkoutSetDetails | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details);
    if (typeof parsed.sessionId !== 'string') return null;
    if (typeof parsed.setNumber !== 'number') return null;
    if (typeof parsed.reps !== 'number') return null;
    if (typeof parsed.weight !== 'number') return null;
    return {
      sessionId: parsed.sessionId,
      setNumber: parsed.setNumber,
      reps: parsed.reps,
      weight: parsed.weight,
      weightUnit: typeof parsed.weightUnit === 'string' ? parsed.weightUnit : 'kg',
    };
  } catch {
    return null;
  }
}

export function formatSetSummary(set: WorkoutSetDetails): string {
  return `${set.reps} × ${set.weight}${set.weightUnit}`;
}

// Given raw activityLogs rows for one exercise (any mix of sessions, any order),
// return just the sets from the single most recent session — this is the "last
// time" reference shown while logging. excludeSessionId drops the in-progress
// session so a session never shows itself back as its own "last time".
export function getMostRecentSessionSets(
  logs: Array<{ timestamp: number; details?: string | null }>,
  excludeSessionId?: string
): WorkoutSetDetails[] {
  const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
  let latestSessionId: string | null = null;
  const setsInLatestSession: WorkoutSetDetails[] = [];

  for (const log of sorted) {
    const parsed = parseSetLogDetails(log.details);
    if (!parsed) continue;
    if (excludeSessionId && parsed.sessionId === excludeSessionId) continue;
    if (latestSessionId === null) latestSessionId = parsed.sessionId;
    if (parsed.sessionId !== latestSessionId) continue;
    setsInLatestSession.push(parsed);
  }

  return setsInLatestSession.sort((a, b) => a.setNumber - b.setNumber);
}
