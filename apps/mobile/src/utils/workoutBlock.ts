export interface WorkoutBlockMeta {
  sets?: number;
  reps?: string;
  weight?: string;
  restSeconds?: number;
  notes?: string;
}

export function parseBlockMeta(metadata?: string): WorkoutBlockMeta {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    const meta: WorkoutBlockMeta = {};
    if (typeof parsed.sets === 'number') meta.sets = parsed.sets;
    if (typeof parsed.reps === 'string' && parsed.reps.trim()) meta.reps = parsed.reps.trim();
    if (typeof parsed.weight === 'string' && parsed.weight.trim()) meta.weight = parsed.weight.trim();
    if (typeof parsed.restSeconds === 'number') meta.restSeconds = parsed.restSeconds;
    if (typeof parsed.notes === 'string' && parsed.notes.trim()) meta.notes = parsed.notes.trim();
    return meta;
  } catch {
    return {};
  }
}

export function formatBlockSummary(meta: WorkoutBlockMeta): string {
  const parts: string[] = [];
  if (meta.sets && meta.reps) parts.push(`${meta.sets} × ${meta.reps}`);
  else if (meta.sets) parts.push(`${meta.sets} sets`);
  else if (meta.reps) parts.push(meta.reps);
  if (meta.weight) parts.push(meta.weight);
  if (parts.length > 0) return parts.join(' · ');
  if (meta.restSeconds) return `Rest ${meta.restSeconds}s`;
  return 'Tap to configure';
}
