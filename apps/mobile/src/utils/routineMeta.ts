export interface RoutineStepMeta {
  order: number;
  durationSeconds?: number;
  autoAdvance: boolean;
  instructions?: string;
}

export type RoutineSessionStatus = 'running' | 'paused';

export interface RoutineSessionMeta {
  currentStepIndex: number;
  stepStartedAt: number;
  elapsedBeforePauseMs: number;
  status: RoutineSessionStatus;
  // Session-local per-step "add time" overrides — never mutates the step
  // template, so extending one session doesn't change the routine for next time.
  stepOverrides?: Record<number, { extraSeconds: number }>;
}

export function parseRoutineStepMeta(metadata?: string): RoutineStepMeta {
  if (!metadata) return { order: 0, autoAdvance: false };
  try {
    const parsed = JSON.parse(metadata);
    return {
      order: typeof parsed.order === 'number' ? parsed.order : 0,
      durationSeconds: typeof parsed.durationSeconds === 'number' ? parsed.durationSeconds : undefined,
      autoAdvance: parsed.autoAdvance === true,
      instructions: typeof parsed.instructions === 'string' ? parsed.instructions : undefined,
    };
  } catch {
    return { order: 0, autoAdvance: false };
  }
}

export function parseRoutineSessionMeta(metadata?: string): RoutineSessionMeta {
  if (!metadata) return { currentStepIndex: 0, stepStartedAt: Date.now(), elapsedBeforePauseMs: 0, status: 'running' };
  try {
    const parsed = JSON.parse(metadata);
    return {
      currentStepIndex: typeof parsed.currentStepIndex === 'number' ? parsed.currentStepIndex : 0,
      stepStartedAt: typeof parsed.stepStartedAt === 'number' ? parsed.stepStartedAt : Date.now(),
      elapsedBeforePauseMs: typeof parsed.elapsedBeforePauseMs === 'number' ? parsed.elapsedBeforePauseMs : 0,
      status: parsed.status === 'paused' ? 'paused' : 'running',
      stepOverrides: parsed.stepOverrides ?? undefined,
    };
  } catch {
    return { currentStepIndex: 0, stepStartedAt: Date.now(), elapsedBeforePauseMs: 0, status: 'running' };
  }
}

// Remaining time for the current step, derived entirely from persisted
// timestamps (never a local setInterval counter) so it's correct
// immediately after backgrounding or a full relaunch. Returns null when the
// step has no duration (manual/untimed step).
export function computeStepRemainingSeconds(durationSeconds: number | undefined, session: RoutineSessionMeta, now: number): number | null {
  if (durationSeconds === undefined) return null;
  const override = session.stepOverrides?.[session.currentStepIndex]?.extraSeconds ?? 0;
  const effectiveDurationMs = (durationSeconds + override) * 1000;
  const elapsedMs = session.elapsedBeforePauseMs + (session.status === 'running' ? Math.max(now - session.stepStartedAt, 0) : 0);
  return Math.max(Math.ceil((effectiveDurationMs - elapsedMs) / 1000), 0);
}
