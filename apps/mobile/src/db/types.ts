export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'supplement' | 'workout-template' | 'workout-block' | 'exercise' | 'workout-session' | 'meal' | 'object' | 'potential-stat' | 'achievement' | 'focus' | 'routine' | 'routine-step' | 'routine-session' | 'skill' | 'backward-plan' | 'potential-attribute';
export type ItemStatus = 'inbox' | 'active' | 'someday' | 'scheduled' | 'due-today' | 'overdue' | 'completed' | 'skipped' | 'archived' | 'cancelled';

// Object's own possession-tracking lifecycle — independent of the generic ItemStatus
// column (which has no vocabulary for "I want this"). Not a strict pipeline: a user can
// jump straight to 'owned' or move backward, no enforced transitions.
export type ObjectStatus = 'want' | 'need' | 'saving' | 'ready' | 'ordered' | 'owned';

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  status: ItemStatus;
  notes?: string;
  voice_transcript?: string; // Original voice transcript before editing
  scheduledDate?: string; // YYYY-MM-DD
  dueDate?: string;       // YYYY-MM-DD
  rrule?: string;
  metadata?: string;      // JSON string in SQLite
  createdAt: number;
  updatedAt: number;
  userId?: string;
  archivedAt?: number;
  deletedAt?: number;
  completedAt?: number;
}

export interface ItemInstance {
  id: string;
  itemId: string;
  scheduledDate: string;
  completedAt?: number;
  status: 'pending' | 'completed' | 'skipped' | 'partial';
  instanceMetadata?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ActivityLog {
  id: string;
  entityId: string;
  actionType: string;
  timestamp: number;
  details?: string;
  createdAt: number;
}

export interface ItemRelationRow {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  createdAt: number;
}

export interface ItemOrderRow {
  listKey: string;
  itemId: string;
  position: number;
}

export interface AppSettingRow {
  key: string;
  value: string;
  updatedAt: number;
}

export interface DailyCheckInRow {
  id: string;
  dateKey: string;
  phase: 'morning' | 'evening';
  answers: string;
  createdAt: number;
  updatedAt: number;
}

// Plan Backwards: a plan block belongs to one 'backward-plan' item (planId)
// and is NOT itself an item — its placement/buffer/completion state is
// plan-instance-specific and must never leak back into a reusable 'routine'
// template. A 'routine' block copies its steps into planBlockSteps at
// add-time (see addPlanBlockRoutine); a 'task'/'travel' block has no steps
// and tracks its own completedAt directly on this row.
export interface PlanBlockRow {
  id: string;
  planId: string;
  type: 'routine' | 'task' | 'travel';
  title: string;
  orderIndex: number;
  placement: 'auto' | 'anytime-before' | 'keep-near-event';
  bufferMinutes: number | null;
  durationMinutes: number | null;
  actualMinutes: number | null;
  routineTemplateId: string | null;
  linkedItemId: string | null;
  completedAt: number | null;
  travelConfig: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PlanBlockStepRow {
  id: string;
  blockId: string;
  templateStepId: string | null;
  title: string;
  estimatedMinutes: number;
  actualMinutes: number | null;
  orderIndex: number;
  placement: 'auto' | 'anytime-before' | 'keep-near-event';
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

// One row per completion-event's live scoring effect on a Domain. Kept
// separate from the permanent 'achievement'/'project' items records so the
// scoring formula/defaults can be re-tuned or a contribution soft-disabled
// without ever touching achievement or Mission history.
export interface DomainContributionRow {
  id: string;
  areaId: string;
  sourceType: 'mission' | 'achievement' | 'skill';
  sourceId: string;
  magnitude: number;
  halfLifeDays: number;
  occurredAt: number;
  excludedAt?: number;
  createdAt: number;
}

// Evidence log row for the Potential Attribute system — see
// src/utils/attributes.ts. Deliberately has no `magnitude`/`halfLifeDays`
// like DomainContributionRow: those encode a specific decay formula, and the
// Attribute scoring formula is intentionally not decided yet (see the
// 2026-08-14 architecture note in apps/mobile/CLAUDE.md). `weight` is the
// only thing recorded at evidence time.
export interface AttributeContributionRow {
  id: string;
  attributeId: string;
  sourceType: 'habit' | 'action';
  sourceId: string;
  weight: 'minor' | 'moderate' | 'major';
  occurredAt: number;
  excludedAt?: number;
  createdAt: number;
}
