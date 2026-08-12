// Pure types + helpers for the Actions model. An "Action" is a lightweight
// event stored in the generic activityLogs table (actionType 'action') — NOT a
// new item type, NOT a scoring input. See database.ts logAction/getActions and
// the Actions page. This module holds only pure logic so it's unit-testable
// with no DB access.

export type ActionKind = 'practice' | 'general';
export type ActionIntensity = 'low' | 'medium' | 'high';

export interface ActionDetails {
  title: string;
  kind: ActionKind;
  durationMinutes?: number;
  intensity?: ActionIntensity;
  why?: string;
  domainId?: string; // 'area' item
  pillarId?: string; // 'potential-stat' item
  skillId?: string;
  missionId?: string; // 'project' item
}

// occurredAt is reserved for a future "log after the fact" flow; v1 logs at
// now (the row timestamp), so it's accepted but currently ignored by logAction.
export interface LogActionInput extends ActionDetails {
  occurredAt?: number;
}

export interface ActionRow extends ActionDetails {
  id: string;
  entityId: string;
  timestamp: number;
}

// Priority order for which linked entity becomes the activityLogs.entityId
// (which is NOT NULL). Falls back to 'manual' for a free-form action.
export function primaryEntityId(details: ActionDetails): string {
  return details.skillId || details.missionId || details.pillarId || details.domainId || 'manual';
}

// Parse a stored 'action' row's details JSON back into an ActionRow. Tolerant
// of malformed/partial JSON — a row with unreadable details still yields a
// minimally-valid ActionRow so the feed never crashes.
export function parseActionRow(row: { id: string; entityId: string; timestamp: number; details?: string | null }): ActionRow {
  let d: Partial<ActionDetails> = {};
  if (row.details) {
    try {
      d = JSON.parse(row.details);
    } catch {
      d = {};
    }
  }
  return {
    id: row.id,
    entityId: row.entityId,
    timestamp: row.timestamp,
    title: typeof d.title === 'string' && d.title ? d.title : 'Action',
    kind: d.kind === 'practice' ? 'practice' : 'general',
    durationMinutes: typeof d.durationMinutes === 'number' && d.durationMinutes > 0 ? d.durationMinutes : undefined,
    intensity: d.intensity === 'low' || d.intensity === 'medium' || d.intensity === 'high' ? d.intensity : undefined,
    why: typeof d.why === 'string' && d.why ? d.why : undefined,
    domainId: d.domainId || undefined,
    pillarId: d.pillarId || undefined,
    skillId: d.skillId || undefined,
    missionId: d.missionId || undefined,
  };
}

// One-line summary for an ActionRow, e.g. "45 min · high" or "Practice".
export function actionSubtitle(a: ActionRow): string {
  const parts: string[] = [];
  if (a.durationMinutes) parts.push(`${a.durationMinutes} min`);
  if (a.intensity) parts.push(a.intensity);
  if (parts.length === 0) parts.push(a.kind === 'practice' ? 'Practice' : 'Action');
  return parts.join(' · ');
}

// ── Unified feed ───────────────────────────────────────────────────────────

export type FeedSource = 'action' | 'habit' | 'task' | 'medication' | 'routine';

export interface FeedEntry {
  id: string;
  source: FeedSource;
  title: string;
  timestamp: number;
  subtitle?: string;
  entityId?: string;
}

// Merge already-normalized entries from every source, newest-first, capped at
// `limit`. Callers (database.ts/database.web.ts) gather rows per source, map
// each to a FeedEntry, and pass them all here — keeping the sort/dedupe/limit
// policy in one tested place.
export function buildActionFeed(entries: FeedEntry[], limit?: number): FeedEntry[] {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}
