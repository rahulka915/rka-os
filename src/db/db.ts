import Dexie, { type EntityTable } from 'dexie';

export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface MedicationMetadata {
  dosage: string;
  stock: number;
  stockUnit: string;
}

export interface HabitMetadata {
  currentStreak: number;
  longestStreak: number;
}

export interface WorkoutSet {
  reps: number;
  weight: number;
  completed: boolean;
}

export interface Exercise {
  name: string;
  sets: WorkoutSet[];
}

export interface WorkoutMetadata {
  exercises: Exercise[];
}

export interface WorkoutInstanceMetadata {
  exercises: Exercise[];
}

export interface Item {
  id: string;
  type: 'task' | 'habit' | 'medication' | 'workout' | 'meal';
  title: string;
  notes?: string;
  projectId?: string;
  rrule?: string;
  metadata?: MedicationMetadata | HabitMetadata | WorkoutMetadata | any;
}

export interface ItemInstance {
  id: string;
  itemId: string;
  scheduledDate: string; // YYYY-MM-DD
  completedAt?: number; // timestamp
  status: 'pending' | 'completed' | 'skipped' | 'partial';
  instanceMetadata?: WorkoutInstanceMetadata | any;
}

const db = new Dexie('PersonalOSDB') as Dexie & {
  projects: EntityTable<Project, 'id'>;
  items: EntityTable<Item, 'id'>;
  itemInstances: EntityTable<ItemInstance, 'id'>;
};

db.version(1).stores({
  projects: 'id, name',
  items: 'id, type, projectId',
  itemInstances: 'id, itemId, scheduledDate, status'
});

export { db };
