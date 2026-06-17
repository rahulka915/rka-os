export type FieldType = 'text' | 'textarea' | 'single-select' | 'multi-select' | 'number-selector' | 'date' | 'sub-items' | 'entity-linker';

export interface FieldOption {
  id: string;
  label: string;
  color?: string;
}

export interface FieldSchema {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  advanced?: boolean;
  placeholder?: string;
  
  // For select fields
  options?: FieldOption[];
  allowInlineCreate?: boolean;
  inlineCreateType?: 'tag' | 'project' | 'area';
  
  // For number selectors
  numberOptions?: number[];
  numberSuffix?: string;

  // For entity-linker
  targetEntityType?: string;
}

export interface EntitySchema {
  id: string;
  label: string;
  fields: FieldSchema[];
}

export const TASK_SCHEMA: EntitySchema = {
  id: 'task',
  label: 'Task',
  fields: [
    { id: 'title', label: 'Title', type: 'text', required: true, placeholder: 'What needs to be done?' },
    { id: 'scheduledDate', label: 'Date', type: 'date', advanced: false },
    { id: 'timeOfDay', label: 'Time of day', type: 'single-select', advanced: false, options: [
      { id: 'anytime', label: 'Anytime' },
      { id: 'morning', label: 'Morning' },
      { id: 'afternoon', label: 'Afternoon' },
      { id: 'evening', label: 'Evening' }
    ]},
    { id: 'duration', label: 'Duration', type: 'single-select', advanced: false, options: [
      { id: '5m', label: '5 min' },
      { id: '15m', label: '15 min' },
      { id: '30m', label: '30 min' },
      { id: '1h', label: '1 hour' },
      { id: '2h', label: '2 hours' }
    ]},
    { id: 'subItems', label: 'Sub-tasks', type: 'sub-items', advanced: false },
    { id: 'tags', label: 'Tags', type: 'multi-select', advanced: true, allowInlineCreate: true, inlineCreateType: 'tag' },
    { id: 'notes', label: 'Notes', type: 'textarea', advanced: true, placeholder: 'Add some details...' }
  ]
};

export const HABIT_SCHEMA: EntitySchema = {
  id: 'habit',
  label: 'Habit',
  fields: [
    { id: 'title', label: 'Name', type: 'text', required: true, placeholder: 'e.g., Read 10 pages' },
    { id: 'rrule', label: 'Frequency', type: 'single-select', required: true, options: [
      { id: 'FREQ=DAILY', label: 'Daily' },
      { id: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', label: 'Weekdays' },
      { id: 'FREQ=WEEKLY', label: 'Weekly' }
    ]},
    { id: 'subItems', label: 'Habit Steps', type: 'sub-items', advanced: false },
    { id: 'tags', label: 'Tags', type: 'multi-select', advanced: true, allowInlineCreate: true, inlineCreateType: 'tag' },
  ]
};

export const MEDICATION_SCHEMA: EntitySchema = {
  id: 'medication',
  label: 'Medication',
  fields: [
    { id: 'title', label: 'Name', type: 'text', required: true, placeholder: 'e.g., Elvanse' },
    { id: 'dose', label: 'Dose', type: 'text', required: true, placeholder: 'e.g., 50mg' },
    { id: 'frequency', label: 'Frequency', type: 'single-select', required: true, options: [
      { id: 'daily', label: 'Once Daily' },
      { id: 'twice-daily', label: 'Twice Daily' },
      { id: 'prn', label: 'As Needed (PRN)' }
    ]},
    { id: 'maxPerDay', label: 'Max / Day', type: 'number-selector', numberOptions: [1, 2, 3, 4, 6, 8], advanced: true },
    { id: 'initialStock', label: 'Stock', type: 'number-selector', numberOptions: [10, 30, 60, 90], required: true },
    { id: 'refillThreshold', label: 'Refill Alert', type: 'number-selector', numberOptions: [5, 10, 15], required: true },
    { id: 'tags', label: 'Tags', type: 'multi-select', advanced: true, allowInlineCreate: true, inlineCreateType: 'tag' },
  ]
};

export const EXERCISE_SCHEMA: EntitySchema = {
  id: 'exercise',
  label: 'Exercise',
  fields: [
    { id: 'title', label: 'Name', type: 'text', required: true, placeholder: 'e.g., Bench Press' },
    { id: 'muscles', label: 'Muscles', type: 'multi-select', options: [
      { id: 'chest', label: 'Chest' },
      { id: 'back', label: 'Back' },
      { id: 'legs', label: 'Legs' },
      { id: 'shoulders', label: 'Shoulders' },
      { id: 'arms', label: 'Arms' },
      { id: 'core', label: 'Core' }
    ]},
    { id: 'equipment', label: 'Equipment', type: 'single-select', options: [
      { id: 'barbell', label: 'Barbell' },
      { id: 'dumbbell', label: 'Dumbbell' },
      { id: 'machine', label: 'Machine' },
      { id: 'cable', label: 'Cable' },
      { id: 'bodyweight', label: 'Bodyweight' }
    ]},
    { id: 'movementPattern', label: 'Movement Pattern', type: 'single-select', advanced: true, options: [
      { id: 'push', label: 'Push' },
      { id: 'pull', label: 'Pull' },
      { id: 'squat', label: 'Squat' },
      { id: 'hinge', label: 'Hinge' },
      { id: 'carry', label: 'Carry' }
    ]},
    { id: 'forceType', label: 'Force Type', type: 'single-select', advanced: true, options: [
      { id: 'compound', label: 'Compound' },
      { id: 'isolation', label: 'Isolation' }
    ]},
    { id: 'mechanic', label: 'Mechanic', type: 'single-select', advanced: true, options: [
      { id: 'bilateral', label: 'Bilateral' },
      { id: 'unilateral', label: 'Unilateral' }
    ]},
    { id: 'difficulty', label: 'Difficulty', type: 'single-select', advanced: true, options: [
      { id: 'beginner', label: 'Beginner' },
      { id: 'intermediate', label: 'Intermediate' },
      { id: 'advanced', label: 'Advanced' }
    ]},
    { id: 'notes', label: 'Notes', type: 'textarea', advanced: true }
  ]
};

export const WORKOUT_SCHEMA: EntitySchema = {
  id: 'workout-template',
  label: 'Workout Template',
  fields: [
    { id: 'title', label: 'Name', type: 'text', required: true, placeholder: 'e.g., Push Day' },
    { id: 'duration', label: 'Duration', type: 'single-select', options: [
      { id: '30m', label: '30 min' },
      { id: '45m', label: '45 min' },
      { id: '1h', label: '1 hour' },
      { id: '90m', label: '1.5 hours' }
    ]},
    { id: 'exercises', label: 'Exercises', type: 'entity-linker', targetEntityType: 'exercise' },
    { id: 'tags', label: 'Tags', type: 'multi-select', advanced: true, allowInlineCreate: true, inlineCreateType: 'tag' }
  ]
};

export const PROJECT_SCHEMA: EntitySchema = {
  id: 'project',
  label: 'Project',
  fields: [
    { id: 'title', label: 'Name', type: 'text', required: true, placeholder: 'Project Name' },
    { id: 'color', label: 'Color', type: 'single-select', options: [
      { id: '#EF4444', label: 'Red' },
      { id: '#10B981', label: 'Green' },
      { id: '#3B82F6', label: 'Blue' },
      { id: '#F59E0B', label: 'Orange' },
      { id: '#8B5CF6', label: 'Purple' }
    ]}
  ]
};

export const AREA_SCHEMA: EntitySchema = {
  id: 'area',
  label: 'Area',
  fields: [
    { id: 'title', label: 'Name', type: 'text', required: true, placeholder: 'e.g., Medicine, Fitness' },
    { id: 'color', label: 'Color', type: 'single-select', options: [
      { id: '#EF4444', label: 'Red' },
      { id: '#10B981', label: 'Green' },
      { id: '#3B82F6', label: 'Blue' },
      { id: '#F59E0B', label: 'Orange' },
      { id: '#8B5CF6', label: 'Purple' }
    ]}
  ]
};

export const ENTITY_SCHEMAS: Record<string, EntitySchema> = {
  task: TASK_SCHEMA,
  habit: HABIT_SCHEMA,
  medication: MEDICATION_SCHEMA,
  exercise: EXERCISE_SCHEMA,
  'workout-template': WORKOUT_SCHEMA,
  project: PROJECT_SCHEMA,
  area: AREA_SCHEMA
};
