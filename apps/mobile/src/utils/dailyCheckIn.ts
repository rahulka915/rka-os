import type { Item } from '../db/types';

export type DailyCheckInPhase = 'morning' | 'evening';
export type DailyCheckInPromptKind = 'morning' | 'catch-up' | 'evening' | 'logged' | 'idle';
export type DailyPriorityKind = 'linked-task' | 'freeform';
export type DailyPriorityOutcome = 'done' | 'partly' | 'carried' | 'dropped';

export interface DailyPrioritySnapshot {
  kind: DailyPriorityKind;
  taskId?: string;
  title: string;
  reason?: string;
  outcome?: DailyPriorityOutcome;
}

export interface DailyCheckInAnswers {
  sleepAmount?: string;
  sleepQuality?: string;
  energy?: string;
  mood?: string;
  stress?: string;
  focusReadiness?: string;
  intention?: string;
  dayShape?: string;
  energyNow?: string;
  moodNow?: string;
  stressNow?: string;
  friction?: string[];
  helped?: string[];
  win?: string;
  carryForward?: string;
  priorities: DailyPrioritySnapshot[];
}

export interface DailyCheckInPromptState {
  kind: DailyCheckInPromptKind;
  phase?: DailyCheckInPhase;
  dateKey: string;
}

export interface DailyPrioritySuggestion {
  taskId: string;
  title: string;
  reason: string;
  rank: number;
}

export interface DailyPrioritySuggestionContext {
  today: string;
  carriedForwardTaskIds?: Set<string>;
  focusTaskIds?: Set<string>;
  missionTaskIds?: Set<string>;
}

const EMPTY_ANSWERS: DailyCheckInAnswers = { priorities: [] };

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getDailyCheckInDateKey(now: Date = new Date()): string {
  if (now.getHours() < 2) {
    return formatDateKey(addDays(now, -1));
  }
  return formatDateKey(now);
}

export function getDailyCheckInPromptState(now: Date, morning?: unknown | null, evening?: unknown | null): DailyCheckInPromptState {
  const dateKey = getDailyCheckInDateKey(now);
  const hour = now.getHours();
  const hasMorning = Boolean(morning);
  const hasEvening = Boolean(evening);

  if (hasMorning && hasEvening) return { kind: 'logged', dateKey };
  if (hour >= 5 && hour < 12 && !hasMorning) return { kind: 'morning', phase: 'morning', dateKey };
  if (hour >= 12 && hour < 17 && !hasMorning) return { kind: 'catch-up', phase: 'morning', dateKey };
  if ((hour >= 19 || hour < 2) && !hasEvening) return { kind: 'evening', phase: 'evening', dateKey };
  if (hasMorning || hasEvening) return { kind: 'logged', dateKey };
  return { kind: 'idle', dateKey };
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

function parsePriorities(value: unknown): DailyPrioritySnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): DailyPrioritySnapshot[] => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    if (!title) return [];
    const kind = candidate.kind === 'linked-task' ? 'linked-task' : 'freeform';
    const snapshot: DailyPrioritySnapshot = {
      kind,
      taskId: typeof candidate.taskId === 'string' ? candidate.taskId : undefined,
      title,
      reason: typeof candidate.reason === 'string' ? candidate.reason : undefined,
    };
    if (candidate.outcome === 'done' || candidate.outcome === 'partly' || candidate.outcome === 'carried' || candidate.outcome === 'dropped') {
      snapshot.outcome = candidate.outcome;
    }
    return [snapshot];
  });
}

export function parseDailyCheckInAnswers(raw?: string | null): DailyCheckInAnswers {
  if (!raw) return EMPTY_ANSWERS;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      sleepAmount: typeof parsed.sleepAmount === 'string' ? parsed.sleepAmount : undefined,
      sleepQuality: typeof parsed.sleepQuality === 'string' ? parsed.sleepQuality : undefined,
      energy: typeof parsed.energy === 'string' ? parsed.energy : undefined,
      mood: typeof parsed.mood === 'string' ? parsed.mood : undefined,
      stress: typeof parsed.stress === 'string' ? parsed.stress : undefined,
      focusReadiness: typeof parsed.focusReadiness === 'string' ? parsed.focusReadiness : undefined,
      intention: typeof parsed.intention === 'string' ? parsed.intention : undefined,
      dayShape: typeof parsed.dayShape === 'string' ? parsed.dayShape : undefined,
      energyNow: typeof parsed.energyNow === 'string' ? parsed.energyNow : undefined,
      moodNow: typeof parsed.moodNow === 'string' ? parsed.moodNow : undefined,
      stressNow: typeof parsed.stressNow === 'string' ? parsed.stressNow : undefined,
      friction: parseStringArray(parsed.friction),
      helped: parseStringArray(parsed.helped),
      win: typeof parsed.win === 'string' ? parsed.win : undefined,
      carryForward: typeof parsed.carryForward === 'string' ? parsed.carryForward : undefined,
      priorities: parsePriorities(parsed.priorities),
    };
  } catch {
    return EMPTY_ANSWERS;
  }
}

function parseMetadata(item: Item): Record<string, unknown> {
  if (!item.metadata) return {};
  try {
    return JSON.parse(item.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function buildDailyPrioritySuggestions(items: Item[], context: DailyPrioritySuggestionContext): DailyPrioritySuggestion[] {
  const suggestions = new Map<string, DailyPrioritySuggestion>();
  const add = (item: Item, reason: string, rank: number) => {
    const existing = suggestions.get(item.id);
    if (!existing || rank < existing.rank) {
      suggestions.set(item.id, { taskId: item.id, title: item.title, reason, rank });
    }
  };

  for (const item of items) {
    if (item.type !== 'task' || item.status === 'completed' || item.status === 'archived' || item.deletedAt) continue;
    const meta = parseMetadata(item);
    if (item.dueDate && item.dueDate < context.today) add(item, 'Overdue', 10);
    if (item.dueDate === context.today) add(item, 'Due today', 20);
    if (item.scheduledDate === context.today) {
      const timeOfDay = typeof meta.timeOfDay === 'string' ? meta.timeOfDay : null;
      add(item, timeOfDay ? `Scheduled ${timeOfDay}` : 'Scheduled today', 30);
    }
    if (context.carriedForwardTaskIds?.has(item.id)) add(item, 'Carried forward', 40);
    if (context.focusTaskIds?.has(item.id)) add(item, 'Current Focus', 50);
    if (context.missionTaskIds?.has(item.id)) add(item, 'Active Mission', 60);
  }

  return [...suggestions.values()].sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
}

export function isDailyCheckInEditable(dateKey: string, now: Date = new Date()): boolean {
  const today = formatDateKey(now);
  const yesterday = formatDateKey(addDays(now, -1));
  return dateKey === today || dateKey === yesterday;
}
