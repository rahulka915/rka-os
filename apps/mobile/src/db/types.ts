export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'workout-template' | 'workout-block' | 'exercise' | 'workout-session' | 'meal' | 'object' | 'potential-stat' | 'achievement' | 'focus' | 'routine' | 'routine-step' | 'routine-session';
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

// One row per completion-event's live scoring effect on a Domain. Kept
// separate from the permanent 'achievement'/'project' items records so the
// scoring formula/defaults can be re-tuned or a contribution soft-disabled
// without ever touching achievement or Mission history.
export interface DomainContributionRow {
  id: string;
  areaId: string;
  sourceType: 'mission' | 'achievement';
  sourceId: string;
  magnitude: number;
  halfLifeDays: number;
  occurredAt: number;
  excludedAt?: number;
  createdAt: number;
}
