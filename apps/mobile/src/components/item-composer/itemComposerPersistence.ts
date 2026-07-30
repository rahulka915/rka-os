import {
  createItem,
  createTimedItem,
  deleteItem,
  getItemWithMetadata,
  getRelation,
  setRelation,
  updateItem,
  updateItemMetadata,
  updateItemStatus,
  updateTimelineItemSchedule,
} from '../../db/database';
import type { Item } from '../../db/types';
import { getTimeOfDayFromHour, normalizeTimeInput } from '../../utils/time';
import { readChecklist } from '../../utils/checklist';
import type { ItemComposerContext, ItemDraft } from './types';

function parseMetadata(metadata?: string): Record<string, unknown> {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function metadataTags(metadata: Record<string, unknown>): string[] {
  return Array.isArray(metadata.tags)
    ? metadata.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
}

function metadataPriority(metadata: Record<string, unknown>): ItemDraft['priority'] {
  return metadata.priority === 'low' || metadata.priority === 'medium' || metadata.priority === 'high'
    ? metadata.priority
    : undefined;
}

function metadataTimeBucket(metadata: Record<string, unknown>): ItemDraft['preferredTimeBucket'] {
  const value = metadata.preferredTimeBucket ?? metadata.timeOfDay;
  return value === 'morning' || value === 'afternoon' || value === 'evening' || value === 'anytime'
    ? value
    : 'anytime';
}

export function createDraft(context: ItemComposerContext = {}): ItemDraft {
  return {
    mode: 'create',
    itemType: 'task',
    title: '',
    notes: '',
    status: context.scheduledDate && context.scheduledTime ? 'scheduled' : context.status ?? 'inbox',
    scheduledDate: context.scheduledDate,
    scheduledTime: context.scheduledTime ? normalizeTimeInput(context.scheduledTime) ?? context.scheduledTime : undefined,
    dueDate: undefined,
    rrule: undefined,
    projectId: context.projectId,
    projectTitle: context.projectTitle,
    tags: [],
    checklist: [],
    durationMinutes: context.durationMinutes ?? 45,
    preferredTimeBucket: context.preferredTimeBucket ?? 'anytime',
    metadata: {},
    lockScheduleDate: context.lockScheduleDate ?? false,
    minuteInterval: context.minuteInterval ?? 5,
  };
}

export function createEditDraft(item: Item, context: ItemComposerContext = {}): ItemDraft {
  const metadata = parseMetadata(item.metadata);
  const time = typeof metadata.time === 'string' ? normalizeTimeInput(metadata.time) ?? metadata.time : undefined;
  const projectId = context.projectId ?? getRelation(item.id, 'project') ?? undefined;
  const projectTitle = context.projectTitle ?? (projectId ? getItemWithMetadata(projectId)?.title : undefined);
  return {
    mode: 'edit',
    itemId: item.id,
    itemType: item.type,
    title: item.title,
    notes: item.notes ?? '',
    status: item.status === 'scheduled' ? 'scheduled' : item.status === 'inbox' ? 'inbox' : 'active',
    scheduledDate: context.scheduledDate ?? item.scheduledDate,
    scheduledTime: context.scheduledTime ? normalizeTimeInput(context.scheduledTime) ?? context.scheduledTime : time,
    dueDate: item.dueDate ?? undefined,
    rrule: item.rrule ?? undefined,
    projectId,
    projectTitle,
    tags: metadataTags(metadata),
    checklist: readChecklist(metadata),
    priority: metadataPriority(metadata),
    durationMinutes: typeof metadata.durationMinutes === 'number' && metadata.durationMinutes > 0
      ? metadata.durationMinutes
      : 45,
    preferredTimeBucket: metadataTimeBucket(metadata),
    metadata,
    lockScheduleDate: context.lockScheduleDate ?? false,
    minuteInterval: context.minuteInterval ?? 5,
  };
}

function mergedMetadata(draft: ItemDraft): Record<string, unknown> {
  const metadata = { ...draft.metadata };
  if (draft.tags.length) metadata.tags = draft.tags;
  else delete metadata.tags;
  if (draft.checklist.length) metadata.checklist = draft.checklist;
  else delete metadata.checklist;
  if (draft.priority) metadata.priority = draft.priority;
  else delete metadata.priority;
  metadata.durationMinutes = Math.max(5, Math.min(24 * 60, Math.round(draft.durationMinutes)));
  metadata.preferredTimeBucket = draft.preferredTimeBucket;
  if (draft.scheduledTime) {
    metadata.time = draft.scheduledTime;
    metadata.timeOfDay = getTimeOfDayFromHour(Number(draft.scheduledTime.split(':')[0]));
  } else {
    delete metadata.time;
    delete metadata.timeOfDay;
  }
  // Choosing a real block (Morning/Afternoon/Evening) for an un-dated task is
  // treated as "put it on Today" — so it actually appears in that Home block.
  // Dated tasks are already on Today via scheduledDate; Anytime is the neutral
  // default and doesn't imply Today. "Remove from Today" resets the bucket, so
  // this can't fight an explicit removal.
  const realBucket = draft.preferredTimeBucket === 'morning'
    || draft.preferredTimeBucket === 'afternoon'
    || draft.preferredTimeBucket === 'evening';
  if (!draft.scheduledDate && realBucket) {
    metadata.plannedDate = new Date().toISOString().split('T')[0];
  }
  return metadata;
}

export function saveItemDraft(draft: ItemDraft): string {
  const title = draft.title.trim();
  if (!title) throw new Error('Add a title before saving.');
  if (draft.scheduledTime && !draft.scheduledDate) {
    throw new Error('Choose a date before setting a time.');
  }

  const notes = draft.notes.trim();
  const hasTime = Boolean(draft.scheduledDate && draft.scheduledTime);
  const hasDate = Boolean(draft.scheduledDate);
  let itemId = draft.itemId;

  if (draft.mode === 'create') {
    itemId = hasTime
      ? createTimedItem(draft.itemType, title, draft.scheduledDate!, draft.scheduledTime!, notes || undefined).itemId
      : createItem(
          draft.itemType,
          title,
          hasDate ? 'scheduled' : (draft.status === 'scheduled' ? 'active' : draft.status),
          hasDate ? draft.scheduledDate : undefined,
          notes || undefined,
        );
  } else if (itemId) {
    updateItem(itemId, { type: draft.itemType, title, notes, dueDate: draft.dueDate ?? null, rrule: draft.rrule ?? null });
    updateTimelineItemSchedule(itemId, draft.scheduledDate, draft.scheduledTime);
    if (!hasDate) updateItem(itemId, { status: draft.status === 'scheduled' ? 'active' : draft.status });
  }

  if (draft.mode === 'create' && itemId && (draft.dueDate || draft.rrule)) {
    updateItem(itemId, { dueDate: draft.dueDate, rrule: draft.rrule });
  }

  if (!itemId) throw new Error('Unable to save this task.');
  updateItemMetadata(itemId, mergedMetadata(draft));
  setRelation(itemId, 'project', draft.projectId ?? null);
  return itemId;
}

export function deleteDraftItem(draft: ItemDraft): string {
  if (!draft.itemId) throw new Error('This task has not been saved yet.');
  deleteItem(draft.itemId);
  return draft.itemId;
}

export function completeDraftItem(draft: ItemDraft): string {
  if (!draft.itemId) throw new Error('This item has not been saved yet.');
  updateItemStatus(draft.itemId, 'completed');
  return draft.itemId;
}
