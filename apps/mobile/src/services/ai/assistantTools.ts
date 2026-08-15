// Curated agentic surface for the web assistant: schemas + human-readable
// previews only (pure, no DB access — see assistantToolExecutor.ts for the
// real database.web.ts-backed executor). A preview is shown in the
// confirmation card BEFORE the executor ever runs; the model only ever
// proposes a call — AssistantOverlay decides whether it actually happens.
import type { Item } from '../../db/types';

export type AssistantToolName =
  | 'create_item'
  | 'update_item'
  | 'set_item_status'
  | 'set_task_priority'
  | 'delete_item'
  | 'log_habit_sample'
  | 'toggle_habit_occurrence'
  | 'log_medication_taken'
  | 'log_action'
  | 'plan_for_today';

// Firebase AI Logic's function-declaration schema shape (JSON Schema subset).
interface AssistantFunctionParamSchema {
  type: string;
  description?: string;
  enum?: string[];
}

interface AssistantFunctionDeclaration {
  name: AssistantToolName;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AssistantFunctionParamSchema>;
    required?: string[];
  };
}

const ITEM_TYPES: Item['type'][] = [
  'area', 'project', 'task', 'habit', 'medication', 'supplement', 'object',
];

const ITEM_STATUSES: Item['status'][] = [
  'inbox', 'active', 'someday', 'scheduled', 'completed', 'skipped', 'archived', 'cancelled',
];

const ASSISTANT_FUNCTION_DECLARATIONS: AssistantFunctionDeclaration[] = [
  {
    name: 'create_item',
    description:
      'Create a new item (task, project/mission, domain/area, habit, medication, supplement, or object/to-get). Use for any "add X" / "I need to..." / "remind me to..." request that names something new.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ITEM_TYPES, description: 'The kind of item to create.' },
        title: { type: 'string', description: 'The item title.' },
        notes: { type: 'string', description: 'Optional notes/description.' },
        scheduledDate: { type: 'string', description: 'Optional ISO date (YYYY-MM-DD) it should appear on.' },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'update_item',
    description:
      "Edit an existing item's title, notes, scheduled date, or due date. Use when the user refers to a specific existing item by name (resolve it against the data you were given) and asks to change one of these fields.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The item's id, from the data you were given." },
        title: { type: 'string', description: 'New title, if changing it.' },
        notes: { type: 'string', description: 'New notes, if changing them.' },
        scheduledDate: { type: 'string', description: 'New scheduled date (YYYY-MM-DD), if changing it.' },
        dueDate: { type: 'string', description: 'New due date (YYYY-MM-DD), if changing it.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'set_item_status',
    description:
      'Change an item\'s status — e.g. mark a task complete, reopen it, cancel it, or move it to someday. Use for "mark X done", "I finished X", "reopen X" requests.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The item's id, from the data you were given." },
        status: { type: 'string', enum: ITEM_STATUSES, description: 'The new status.' },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'set_task_priority',
    description: "Set or clear a task's priority.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The task's id." },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'none'], description: '"none" clears priority.' },
      },
      required: ['id', 'priority'],
    },
  },
  {
    name: 'delete_item',
    description:
      'Delete (soft-delete) an existing item. Use only when the user explicitly asks to remove/delete something — never as a side effect of another request.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The item's id, from the data you were given." },
        title: { type: 'string', description: "The item's current title, for the confirmation prompt." },
      },
      required: ['id', 'title'],
    },
  },
  {
    name: 'log_habit_sample',
    description:
      'Log a numeric sample (count or duration) toward a measurable/quantified habit. Use for "log 2 glasses of water", "I ran for 30 minutes" when it matches an existing count/duration habit.',
    parameters: {
      type: 'object',
      properties: {
        habitId: { type: 'string', description: "The habit's id." },
        habitTitle: { type: 'string', description: "The habit's current title, for the confirmation prompt." },
        value: { type: 'number', description: 'The amount to log.' },
        note: { type: 'string', description: 'Optional note for this sample.' },
      },
      required: ['habitId', 'habitTitle', 'value'],
    },
  },
  {
    name: 'toggle_habit_occurrence',
    description:
      'Mark a binary (tap-to-complete) habit done or not-done for a given date. Use for "mark my meditation habit done today".',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: "The habit's id." },
        habitTitle: { type: 'string', description: "The habit's current title, for the confirmation prompt." },
        date: { type: 'string', description: 'ISO date (YYYY-MM-DD) to toggle.' },
      },
      required: ['itemId', 'habitTitle', 'date'],
    },
  },
  {
    name: 'log_medication_taken',
    description: 'Log that a dose of a medication or supplement was taken, right now. Use for "I took my vitamin D".',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: "The medication/supplement's id." },
        medicationTitle: { type: 'string', description: 'Its current title, for the confirmation prompt.' },
      },
      required: ['itemId', 'medicationTitle'],
    },
  },
  {
    name: 'log_action',
    description:
      'Log a one-off Action — free-form activity not tied to a task/habit, e.g. practice sessions or general activity. Use for "I did a 20 minute run", "log that I practiced guitar".',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short title for the action.' },
        kind: { type: 'string', enum: ['practice', 'general'], description: '"practice" for skill/deliberate practice, otherwise "general".' },
        durationMinutes: { type: 'number', description: 'Optional duration in minutes.' },
        intensity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Optional intensity.' },
      },
      required: ['title', 'kind'],
    },
  },
  {
    name: 'plan_for_today',
    description:
      'Add an existing task to today\'s Home view without giving it a fixed calendar date. Use for "add X to today", "I want to do X today".',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: "The task's id." },
        itemTitle: { type: 'string', description: 'Its current title, for the confirmation prompt.' },
        bucket: { type: 'string', enum: ['anytime', 'morning', 'afternoon', 'evening'], description: 'Optional time-of-day bucket.' },
      },
      required: ['itemId', 'itemTitle'],
    },
  },
];

export const ASSISTANT_TOOL_DECLARATIONS = [{ functionDeclarations: ASSISTANT_FUNCTION_DECLARATIONS as any }];

function quote(s: string): string {
  return `"${s}"`;
}

export function previewAssistantTool(name: AssistantToolName, args: Record<string, any>): string {
  switch (name) {
    case 'create_item': {
      const base = `Create ${args.type} ${quote(args.title)}`;
      return args.scheduledDate ? `${base}, scheduled ${args.scheduledDate}` : base;
    }
    case 'update_item': {
      const parts: string[] = [];
      if (args.title !== undefined) parts.push(`title → ${quote(args.title)}`);
      if (args.notes !== undefined) parts.push('notes updated');
      if (args.scheduledDate !== undefined) parts.push(`scheduled date → ${args.scheduledDate}`);
      if (args.dueDate !== undefined) parts.push(`due date → ${args.dueDate}`);
      return `Update item: ${parts.join(', ')}`;
    }
    case 'set_item_status':
      return `Mark item as ${args.status}`;
    case 'set_task_priority':
      return args.priority === 'none' ? 'Clear task priority' : `Set task priority to ${args.priority}`;
    case 'delete_item':
      return `Delete ${quote(args.title)} (reversible — moves to trash, not permanently erased)`;
    case 'log_habit_sample':
      return `Log ${args.value} for ${quote(args.habitTitle)}`;
    case 'toggle_habit_occurrence':
      return `Mark ${quote(args.habitTitle)} done for ${args.date}`;
    case 'log_medication_taken':
      return `Log a dose of ${quote(args.medicationTitle)} taken now`;
    case 'log_action': {
      const base = `Log action ${quote(args.title)} (${args.kind}`;
      return args.durationMinutes ? `${base}, ${args.durationMinutes} min)` : `${base})`;
    }
    case 'plan_for_today': {
      const base = `Add ${quote(args.itemTitle)} to Today`;
      return args.bucket ? `${base} (${args.bucket})` : base;
    }
    default:
      return `Run ${name}`;
  }
}

