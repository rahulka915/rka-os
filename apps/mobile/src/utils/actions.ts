// Pure types + helpers for the Actions model. An "Action" is a lightweight
// event stored in the generic activityLogs table (actionType 'action') — NOT
// a new item type. See database.ts logAction/getActions and the Actions
// page. This module holds only pure logic so it's unit-testable with no DB
// access.
//
// Scoring note (2026-08-14): Actions were originally scoring-inert by
// design. That's since been reversed for Potential Attributes specifically —
// an Action can optionally tag one or more Attributes (attributeContributions
// below), each generating an attributeContributions evidence row (see
// database.ts's logAction/updateAction/deleteAction). Domain/Pillar/Skill/
// Mission tags below remain purely contextual — untouched by this change.

import type { AttributeContributionConfig } from './attributes.ts';
import { parseAttributeContributions } from './attributes.ts';

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
  attributeContributions?: AttributeContributionConfig[]; // which Attribute(s) this is evidence for, and how strongly
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
    attributeContributions: parseAttributeContributions(d.attributeContributions),
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

export const SOURCE_LABELS: Record<FeedSource, string> = {
  action: 'Actions',
  task: 'Tasks',
  habit: 'Habit check-ins',
  medication: 'Medication',
  routine: 'Routines',
};

export interface FeedGroup {
  source: FeedSource;
  label: string;
  entries: FeedEntry[];
}

// Buckets an already newest-first feed (e.g. buildActionFeed's output) by
// source, preserving each entry's relative order within its bucket. Groups
// are ordered by their own most-recent entry (freshest activity type first),
// so "what have I been doing lately" reads naturally from top to bottom.
export function groupFeedBySource(entries: FeedEntry[]): FeedGroup[] {
  const buckets = new Map<FeedSource, FeedEntry[]>();
  for (const entry of entries) {
    const bucket = buckets.get(entry.source);
    if (bucket) bucket.push(entry);
    else buckets.set(entry.source, [entry]);
  }
  return Array.from(buckets.entries())
    .map(([source, groupEntries]) => ({ source, label: SOURCE_LABELS[source], entries: groupEntries }))
    .sort((a, b) => b.entries[0].timestamp - a.entries[0].timestamp);
}
