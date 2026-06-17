import Dexie from 'dexie';

export interface MedicationMetadata {
  dose: string;
  stockRemaining: number;
  stockUnit: string;
  refillThreshold: number;
  lastTakenAt?: number;
  maxPerDay?: number;
  frequency?: string;
}

export interface HabitMetadata {
  currentStreak: number;
  longestStreak: number;
}

export interface WorkoutSession {
  id: string;
  templateId: string; // references 'workout-template' item
  date: number; // timestamp
  duration: number; // seconds
  notes?: string;
  createdAt: number;
}

export interface ExerciseSession {
  id: string;
  workoutSessionId: string;
  exerciseId: string; // references 'exercise' item
  order: number;
  notes?: string;
}

export interface SetEntry {
  id: string;
  exerciseSessionId: string;
  setNumber: number;
  reps: number;
  weight: number;
  rir?: number;
  rpe?: number;
  completed: boolean;
}

export interface WorkoutMetadata {
  exercises?: any[];
}

export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'workout-template' | 'workout-block' | 'exercise' | 'meal';
export type ItemStatus = 'inbox' | 'active' | 'scheduled' | 'due-today' | 'overdue' | 'completed' | 'skipped' | 'archived' | 'cancelled';

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface ItemTag {
  itemId: string;
  tagId: string;
}

export interface EntityLink {
  id: string;
  sourceId: string;
  targetId: string;
  linkType: string; // e.g. 'contains', 'includes_exercise', 'belongs_to'
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  entityId: string;
  actionType: string; // e.g. 'medication-taken', 'workout-logged', 'status-changed', 'created'
  timestamp: number;
  details?: any; // arbitrary JSON for things like sets/reps performed, or dose taken
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  status: ItemStatus;
  notes?: string;
  scheduledDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  rrule?: string; // Unified recurrence
  metadata?: any;
  createdAt: number;
  updatedAt: number;
}

export interface ItemInstance {
  id: string;
  itemId: string;
  scheduledDate: string; // YYYY-MM-DD
  completedAt?: number; // timestamp
  status: 'pending' | 'completed' | 'skipped' | 'partial';
  instanceMetadata?: any;
  createdAt: number;
  updatedAt: number;
}

const db = new Dexie('PersonalOS_v4') as Dexie & {
  items: Dexie.Table<Item, string>;
  itemInstances: Dexie.Table<ItemInstance, string>;
  tags: Dexie.Table<Tag, string>;
  itemTags: Dexie.Table<ItemTag, number>;
  entityLinks: Dexie.Table<EntityLink, string>;
  activityLogs: Dexie.Table<ActivityLog, string>;
  workoutSessions: Dexie.Table<WorkoutSession, string>;
  exerciseSessions: Dexie.Table<ExerciseSession, string>;
  setEntries: Dexie.Table<SetEntry, string>;
};

db.version(1).stores({
  items: 'id, type, status, scheduledDate, dueDate',
  itemInstances: 'id, itemId, scheduledDate, status',
  tags: 'id, name',
  itemTags: '++, itemId, tagId',
  entityLinks: 'id, sourceId, targetId, linkType, [sourceId+linkType], [targetId+linkType]',
  activityLogs: 'id, entityId, actionType, timestamp',
  workoutSessions: 'id, templateId, date',
  exerciseSessions: 'id, workoutSessionId, exerciseId',
  setEntries: 'id, exerciseSessionId'
});

export { db };
