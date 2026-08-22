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
  | 'plan_for_today'
  | 'create_mission'
  | 'create_skill'
  | 'create_habit'
  | 'link_items'
  | 'set_focus'
  | 'get_item_status';

// Tools in this set are read-only — they never show a confirmation card and
// execute immediately, since there's nothing for the user to approve.
export const READ_ONLY_TOOL_NAMES: ReadonlySet<AssistantToolName> = new Set(['get_item_status']);

// Firebase AI Logic's function-declaration schema shape (JSON Schema subset).
interface AssistantFunctionParamSchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: AssistantFunctionParamSchema;
  properties?: Record<string, AssistantFunctionParamSchema>;
  required?: string[];
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
        durationMinutes: { type: 'number', description: 'For tasks: a rough time estimate in minutes, if known/asked about.' },
        interstitial: { type: 'boolean', description: 'For tasks: true if this is a "downtime" task worked on in short sessions whenever there is spare time, rather than finished in one sitting.' },
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
      'Log a one-off Action — free-form activity not tied to a task/habit, e.g. practice sessions or general activity. Also use this to log a session against a Downtime task (taskId/taskTitle) — e.g. "I did 10 minutes on sorting the wardrobe".',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short title for the action.' },
        kind: { type: 'string', enum: ['practice', 'general'], description: '"practice" for skill/deliberate practice, otherwise "general".' },
        durationMinutes: { type: 'number', description: 'Optional duration in minutes.' },
        intensity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Optional intensity.' },
        taskId: { type: 'string', description: 'Optional: the id of a Downtime task this session counts toward.' },
        taskTitle: { type: 'string', description: "The task's title, for the confirmation prompt — required if taskId is set." },
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
  {
    name: 'create_mission',
    description:
      'Create a Mission (a project/goal) optionally linked to a Domain. Use during setup or when the user describes a goal/project to work toward.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The mission title.' },
        domainId: { type: 'string', description: "Optional id of the Domain (area item) this mission belongs to, from the data you were given." },
        domainTitle: { type: 'string', description: 'The Domain\'s title, for the confirmation prompt (omit if no domain).' },
        notes: { type: 'string', description: 'Optional notes.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_skill',
    description:
      'Create a Skill (a capability the user develops), optionally linked to a primary Domain and secondary Domains. New skills start locked ("still learning") unless unlocked is true.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The skill title.' },
        primaryDomainId: { type: 'string', description: "Optional id of the primary Domain (area item), from the data you were given." },
        primaryDomainTitle: { type: 'string', description: "The primary Domain's title, for the confirmation prompt." },
        secondaryDomainIds: { type: 'array', items: { type: 'string' }, description: 'Optional ids of secondary Domains.' },
        unlocked: { type: 'boolean', description: 'True if the user already practises this; false/omitted = still learning.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_habit',
    description:
      'Create a measurable Habit. measurement "binary" = simple tap-to-complete; "count"/"duration" track a target amount per period. Optionally tag Potential Attribute evidence (e.g. Strength/Stamina) so completing it develops that attribute.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The habit title.' },
        measurement: { type: 'string', enum: ['binary', 'count', 'duration'], description: 'How it is measured.' },
        target: { type: 'number', description: 'Target amount per period (for count/duration). Ignored for binary.' },
        unit: { type: 'string', description: "Unit label for count/duration, e.g. 'glasses', 'min', 'reps'." },
        period: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'Target period. Defaults to daily.' },
        intent: { type: 'string', enum: ['build', 'quit'], description: 'Building a habit or quitting one. Defaults to build.' },
        attributeEvidence: {
          type: 'array',
          description: 'Optional Potential Attribute evidence tags.',
          items: {
            type: 'object',
            properties: {
              attributeId: { type: 'string', description: 'Attribute id from the data you were given (e.g. Strength/Stamina).' },
              attributeTitle: { type: 'string', description: "The attribute's title, for the confirmation prompt." },
              weight: { type: 'string', enum: ['minor', 'moderate', 'major'], description: 'How strongly this habit develops the attribute.' },
            },
            required: ['attributeId', 'weight'],
          },
        },
      },
      required: ['title', 'measurement'],
    },
  },
  {
    name: 'link_items',
    description:
      'Link one item to another via a relation. Use to attach a Habit to a Skill (relationType "habitSkill"), a Mission to a Skill ("missionSkill"), a Mission to a Domain ("area"), one task to a task it must wait on ("dependsOn": sourceId is the WAITING task, targetId is the task that must be done first), or one task to its parent task ("subtaskOf": sourceId is the SUBTASK, targetId is the parent). sourceId/targetId are ids from the data you were given.',
    parameters: {
      type: 'object',
      properties: {
        sourceId: { type: 'string', description: 'The item being linked (e.g. the habit, mission, or dependent/subtask task).' },
        sourceTitle: { type: 'string', description: "The source item's title, for the confirmation prompt." },
        relationType: { type: 'string', enum: ['habitSkill', 'missionSkill', 'area', 'skillArea', 'dependsOn', 'subtaskOf'], description: 'The relation.' },
        targetId: { type: 'string', description: 'The item it links to (e.g. the skill, domain, blocking task, or parent task).' },
        targetTitle: { type: 'string', description: "The target item's title, for the confirmation prompt." },
      },
      required: ['sourceId', 'sourceTitle', 'relationType', 'targetId', 'targetTitle'],
    },
  },
  {
    name: 'set_focus',
    description:
      'Set the user\'s Current Focus — a label plus per-Domain weights (0..1) describing where they want to concentrate. weights maps Domain id → weight.',
    parameters: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'A short focus label, e.g. "Health sprint".' },
        weights: {
          type: 'array',
          description: 'Per-Domain weights.',
          items: {
            type: 'object',
            properties: {
              domainId: { type: 'string', description: 'Domain (area) id.' },
              domainTitle: { type: 'string', description: "Domain's title, for the confirmation prompt." },
              weight: { type: 'number', description: 'Weight 0..1.' },
            },
            required: ['domainId', 'weight'],
          },
        },
      },
      required: ['label', 'weights'],
    },
  },
  {
    name: 'get_item_status',
    description:
      "Read an item's CURRENT real status/fields directly from the database. Use this whenever the user questions, doubts, or asks you to verify/check/confirm something you previously said about an item's state (e.g. \"are you sure?\", \"can you check\", \"is it really on Today?\") — never just re-assert from memory or from an earlier tool's response, always re-read it fresh.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The item's id, from the data you were given." },
      },
      required: ['id'],
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
      let base = `Create ${args.type} ${quote(args.title)}`;
      if (args.durationMinutes) base += ` (${args.durationMinutes} min)`;
      if (args.interstitial) base += ' · downtime task';
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
      const withDuration = args.durationMinutes ? `${base}, ${args.durationMinutes} min)` : `${base})`;
      return args.taskTitle ? `${withDuration} → ${quote(args.taskTitle)}` : withDuration;
    }
    case 'plan_for_today': {
      const base = `Add ${quote(args.itemTitle)} to Today`;
      return args.bucket ? `${base} (${args.bucket})` : base;
    }
    case 'create_mission': {
      const base = `Create mission ${quote(args.title)}`;
      return args.domainTitle ? `${base} in ${args.domainTitle}` : base;
    }
    case 'create_skill': {
      const base = `Create skill ${quote(args.title)}`;
      const inDomain = args.primaryDomainTitle ? ` in ${args.primaryDomainTitle}` : '';
      const lock = args.unlocked ? '' : ' (still learning)';
      return `${base}${inDomain}${lock}`;
    }
    case 'create_habit': {
      if (args.measurement === 'binary') return `Create habit ${quote(args.title)}`;
      const unit = args.unit ? ` ${args.unit}` : '';
      const period = args.period ?? 'daily';
      return `Create habit ${quote(args.title)} (${args.target ?? ''}${unit} ${period})`.replace('( ', '(');
    }
    case 'link_items': {
      if (args.relationType === 'dependsOn') {
        return `${quote(args.sourceTitle)} depends on ${quote(args.targetTitle)} (must be done first)`;
      }
      if (args.relationType === 'subtaskOf') {
        return `${quote(args.sourceTitle)} becomes a subtask of ${quote(args.targetTitle)}`;
      }
      return `Link ${quote(args.sourceTitle)} → ${quote(args.targetTitle)} (${args.relationType})`;
    }
    case 'set_focus': {
      const count = Array.isArray(args.weights) ? args.weights.length : 0;
      return `Set focus to ${quote(args.label)} (${count} domain${count === 1 ? '' : 's'})`;
    }
    case 'get_item_status':
      return 'Checking current status…';
    default:
      return `Run ${name}`;
  }
}

