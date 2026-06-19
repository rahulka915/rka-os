import type {
  ActivityLog,
  EntityLink,
  ExerciseSession,
  Item,
  ItemInstance,
  ItemTag,
  SetEntry,
  Tag,
  WorkoutSession,
  ExerciseMedia,
} from '../db/db';
import type {
  SupabaseActivityLogRow,
  SupabaseEntityLinkRow,
  SupabaseExerciseMediaRow,
  SupabaseExerciseSessionRow,
  SupabaseItemInstanceRow,
  SupabaseItemRow,
  SupabaseItemTagRow,
  SupabaseSetEntryRow,
  SupabaseTagRow,
  SupabaseWorkoutSessionRow,
  Json,
} from './types';

function toIso(value?: number | null) {
  if (value === undefined || value === null) return null;
  return new Date(value).toISOString();
}

function toNumber(value?: string | null) {
  if (!value) return Date.now();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeMetadata(metadata: unknown): Json {
  if (metadata === undefined) return {};
  return metadata as Json;
}

export function itemToRemote(item: Item, userId: string): SupabaseItemRow {
  return {
    id: item.id,
    user_id: userId,
    type: item.type,
    title: item.title,
    status: item.status,
    notes: item.notes ?? null,
    scheduled_date: item.scheduledDate ?? null,
    due_date: item.dueDate ?? null,
    rrule: item.rrule ?? null,
    metadata: normalizeMetadata(item.metadata),
    created_at: toIso(item.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(item.updatedAt) ?? new Date().toISOString(),
    archived_at: item.archivedAt ? toIso(item.archivedAt) : null,
    deleted_at: item.deletedAt ? toIso(item.deletedAt) : null,
  };
}

export function itemFromRemote(row: SupabaseItemRow): Item {
  return {
    id: row.id,
    type: row.type as Item['type'],
    title: row.title,
    status: row.status as Item['status'],
    notes: row.notes ?? undefined,
    scheduledDate: row.scheduled_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    rrule: row.rrule ?? undefined,
    metadata: (row.metadata ?? {}) as Item['metadata'],
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
    archivedAt: row.archived_at ? toNumber(row.archived_at) : undefined,
    deletedAt: row.deleted_at ? toNumber(row.deleted_at) : undefined,
    userId: row.user_id,
  };
}

export function itemInstanceToRemote(instance: ItemInstance, userId: string): SupabaseItemInstanceRow {
  return {
    id: instance.id,
    user_id: userId,
    item_id: instance.itemId,
    scheduled_date: instance.scheduledDate,
    completed_at: instance.completedAt ? toIso(instance.completedAt) : null,
    status: instance.status,
    instance_metadata: normalizeMetadata(instance.instanceMetadata),
    created_at: toIso(instance.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(instance.updatedAt) ?? new Date().toISOString(),
  };
}

export function itemInstanceFromRemote(row: SupabaseItemInstanceRow): ItemInstance {
  return {
    id: row.id,
    itemId: row.item_id,
    scheduledDate: row.scheduled_date,
    completedAt: row.completed_at ? toNumber(row.completed_at) : undefined,
    status: row.status,
    instanceMetadata: (row.instance_metadata ?? {}) as ItemInstance['instanceMetadata'],
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
    userId: row.user_id,
  };
}

export function tagToRemote(tag: Tag, userId: string): SupabaseTagRow {
  return {
    id: tag.id,
    user_id: userId,
    name: tag.name,
    color: tag.color,
    metadata: normalizeMetadata((tag as any).metadata),
    created_at: toIso(tag.createdAt) ?? new Date().toISOString(),
    updated_at: toIso((tag as any).updatedAt) ?? new Date().toISOString(),
  };
}

export function tagFromRemote(row: SupabaseTagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: toNumber(row.created_at),
    userId: row.user_id,
  } as Tag;
}

export function itemTagToRemote(itemTag: ItemTag, userId: string, id: string = crypto.randomUUID() as string): SupabaseItemTagRow {
  return {
    id,
    user_id: userId,
    item_id: itemTag.itemId,
    tag_id: itemTag.tagId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function itemTagFromRemote(row: SupabaseItemTagRow): ItemTag {
  return {
    id: row.id,
    itemId: row.item_id,
    tagId: row.tag_id,
    userId: row.user_id,
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
  } as ItemTag;
}

export function linkToRemote(link: EntityLink, userId: string): SupabaseEntityLinkRow {
  return {
    id: link.id,
    user_id: userId,
    source_id: link.sourceId,
    target_id: link.targetId,
    link_type: link.linkType,
    metadata: normalizeMetadata((link as any).metadata),
    created_at: toIso(link.createdAt) ?? new Date().toISOString(),
    updated_at: toIso((link as any).updatedAt) ?? new Date().toISOString(),
  };
}

export function linkFromRemote(row: SupabaseEntityLinkRow): EntityLink {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    linkType: row.link_type,
    createdAt: toNumber(row.created_at),
    userId: row.user_id,
  } as EntityLink;
}

export function activityToRemote(log: ActivityLog, userId: string): SupabaseActivityLogRow {
  return {
    id: log.id,
    user_id: userId,
    entity_id: log.entityId,
    action_type: log.actionType,
    timestamp: toIso(log.timestamp) ?? new Date().toISOString(),
    details: normalizeMetadata(log.details),
    created_at: toIso((log as any).createdAt) ?? new Date().toISOString(),
    updated_at: toIso((log as any).updatedAt) ?? new Date().toISOString(),
  };
}

export function activityFromRemote(row: SupabaseActivityLogRow): ActivityLog {
  return {
    id: row.id,
    entityId: row.entity_id,
    actionType: row.action_type,
    timestamp: toNumber(row.timestamp),
    details: row.details ?? undefined,
    userId: row.user_id,
  } as ActivityLog;
}

export function workoutSessionToRemote(session: WorkoutSession, userId: string): SupabaseWorkoutSessionRow {
  return {
    id: session.id,
    user_id: userId,
    template_id: session.templateId,
    date: toIso(session.date) ?? new Date().toISOString(),
    duration: session.duration,
    notes: session.notes ?? null,
    metadata: normalizeMetadata((session as any).metadata),
    created_at: toIso(session.createdAt) ?? new Date().toISOString(),
    updated_at: toIso((session as any).updatedAt) ?? new Date().toISOString(),
  };
}

export function workoutSessionFromRemote(row: SupabaseWorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    templateId: row.template_id,
    date: toNumber(row.date),
    duration: row.duration,
    notes: row.notes ?? undefined,
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
    userId: row.user_id,
  } as WorkoutSession;
}

export function exerciseSessionToRemote(session: ExerciseSession, userId: string): SupabaseExerciseSessionRow {
  return {
    id: session.id,
    user_id: userId,
    workout_session_id: session.workoutSessionId,
    exercise_id: session.exerciseId,
    order: session.order,
    notes: session.notes ?? null,
    metadata: normalizeMetadata((session as any).metadata),
    created_at: toIso((session as any).createdAt) ?? new Date().toISOString(),
    updated_at: toIso((session as any).updatedAt) ?? new Date().toISOString(),
  };
}

export function exerciseSessionFromRemote(row: SupabaseExerciseSessionRow): ExerciseSession {
  return {
    id: row.id,
    workoutSessionId: row.workout_session_id,
    exerciseId: row.exercise_id,
    order: row.order,
    notes: row.notes ?? undefined,
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
    userId: row.user_id,
  } as ExerciseSession;
}

export function setEntryToRemote(entry: SetEntry, userId: string): SupabaseSetEntryRow {
  return {
    id: entry.id,
    user_id: userId,
    exercise_session_id: entry.exerciseSessionId,
    set_number: entry.setNumber,
    reps: entry.reps,
    weight: entry.weight,
    rir: entry.rir ?? null,
    rpe: entry.rpe ?? null,
    completed: entry.completed,
    metadata: normalizeMetadata((entry as any).metadata),
    created_at: toIso((entry as any).createdAt) ?? new Date().toISOString(),
    updated_at: toIso((entry as any).updatedAt) ?? new Date().toISOString(),
  };
}

export function setEntryFromRemote(row: SupabaseSetEntryRow): SetEntry {
  return {
    id: row.id,
    exerciseSessionId: row.exercise_session_id,
    setNumber: row.set_number,
    reps: row.reps,
    weight: row.weight,
    rir: row.rir ?? undefined,
    rpe: row.rpe ?? undefined,
    completed: row.completed,
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
    userId: row.user_id,
  } as SetEntry;
}

export function exerciseMediaToRemote(media: ExerciseMedia, userId: string): SupabaseExerciseMediaRow {
  return {
    id: media.id,
    user_id: userId,
    exercise_id: media.exerciseId,
    storage_path: media.storagePath,
    url: media.url,
    media_type: media.mediaType,
    metadata: normalizeMetadata((media as any).metadata),
    created_at: toIso((media as any).createdAt) ?? new Date().toISOString(),
    updated_at: toIso((media as any).updatedAt) ?? new Date().toISOString(),
  };
}

export function exerciseMediaFromRemote(row: SupabaseExerciseMediaRow): ExerciseMedia {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    storagePath: row.storage_path,
    url: row.url,
    mediaType: row.media_type,
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
    userId: row.user_id,
  } as ExerciseMedia;
}
