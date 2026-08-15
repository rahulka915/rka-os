// Real database.web.ts-backed executor for the agentic tool set declared in
// assistantTools.ts. Kept in its own module (separate from the pure
// schema/preview logic) because it pulls in the whole web data layer, which
// isn't unit-testable under plain Node — see assistantTools.test.ts instead.
import {
  createItem,
  updateItem,
  updateItemStatus,
  deleteItem,
  setTaskPriority,
  logHabitSample,
  toggleHabitOccurrence,
  logMedicationTaken,
  logAction,
  planForToday,
  getItemWithMetadata,
} from '../../db/database.web';
import type { ActionKind, ActionIntensity } from '../../utils/actions';
import type { AssistantToolName } from './assistantTools';

export function executeAssistantTool(
  name: AssistantToolName,
  args: Record<string, any>
): { ok: true; result: string } | { ok: false; error: string } {
  try {
    switch (name) {
      case 'create_item': {
        const id = createItem(args.type, args.title, 'inbox', args.scheduledDate, args.notes);
        return { ok: true, result: `Created with id ${id}` };
      }
      case 'update_item': {
        if (!getItemWithMetadata(args.id)) return { ok: false, error: 'Item not found' };
        updateItem(args.id, {
          title: args.title,
          notes: args.notes,
          scheduledDate: args.scheduledDate,
          dueDate: args.dueDate,
        });
        return { ok: true, result: 'Updated' };
      }
      case 'set_item_status': {
        if (!getItemWithMetadata(args.id)) return { ok: false, error: 'Item not found' };
        updateItemStatus(args.id, args.status);
        return { ok: true, result: 'Status updated' };
      }
      case 'set_task_priority': {
        if (!getItemWithMetadata(args.id)) return { ok: false, error: 'Item not found' };
        setTaskPriority(args.id, args.priority === 'none' ? null : args.priority);
        return { ok: true, result: 'Priority updated' };
      }
      case 'delete_item': {
        if (!getItemWithMetadata(args.id)) return { ok: false, error: 'Item not found' };
        deleteItem(args.id);
        return { ok: true, result: 'Deleted' };
      }
      case 'log_habit_sample': {
        logHabitSample(args.habitId, args.value, args.note);
        return { ok: true, result: 'Sample logged' };
      }
      case 'toggle_habit_occurrence': {
        toggleHabitOccurrence(args.itemId, args.date);
        return { ok: true, result: 'Occurrence toggled' };
      }
      case 'log_medication_taken': {
        logMedicationTaken(args.itemId);
        return { ok: true, result: 'Dose logged' };
      }
      case 'log_action': {
        logAction({
          title: args.title,
          kind: args.kind as ActionKind,
          durationMinutes: args.durationMinutes,
          intensity: args.intensity as ActionIntensity | undefined,
        });
        return { ok: true, result: 'Action logged' };
      }
      case 'plan_for_today': {
        planForToday(args.itemId, args.bucket);
        return { ok: true, result: 'Added to Today' };
      }
      default:
        return { ok: false, error: `Unknown tool ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
