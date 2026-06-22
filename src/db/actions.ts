import { db } from './db';
import type { ItemType, ItemStatus } from './db';
import { v4 as uuidv4 } from 'uuid';
import { parseActionInput } from '../utils/nlp';

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ------------------------------------------------------------------
// Core Graph & Activity Helpers
// ------------------------------------------------------------------

export async function linkEntities(sourceId: string, targetId: string, linkType: string) {
  await db.entityLinks.add({
    id: uuidv4(),
    sourceId,
    targetId,
    linkType,
    createdAt: Date.now()
  });
}

export async function unlinkEntities(sourceId: string, targetId: string, linkType: string) {
  const link = await db.entityLinks.where({ sourceId, targetId, linkType }).first();
  if (link) {
    await db.entityLinks.delete(link.id);
  }
}

export async function logActivity(entityId: string, actionType: string, details?: any) {
  await db.activityLogs.add({
    id: uuidv4(),
    entityId,
    actionType,
    timestamp: Date.now(),
    details
  });
}

export async function attachTags(itemId: string, tags: string[]) {
  const now = Date.now();
  for (const tagName of tags) {
    let tag = await db.tags.where('name').equalsIgnoreCase(tagName).first();
    if (!tag) {
      tag = { id: uuidv4(), name: tagName, color: '#3B82F6', createdAt: now };
      await db.tags.add(tag);
    }
    await db.itemTags.add({ id: uuidv4(), itemId, tagId: tag.id });
  }
}

// ------------------------------------------------------------------
// Generic Entity Creation
// ------------------------------------------------------------------

export async function createEntity(type: ItemType, title: string, metadata: any = {}, status: ItemStatus = 'active', scheduledDate?: string, tags: string[] = []) {
  const now = Date.now();
  const id = uuidv4();
  
  await db.transaction('rw', [db.items, db.tags, db.itemTags, db.activityLogs, db.syncQueue], async () => {
    await db.items.add({
      id,
      type,
      title,
      status,
      scheduledDate,
      rrule: metadata.rrule, // Extract rrule to top level
      metadata,
      createdAt: now,
      updatedAt: now
    });

    await attachTags(id, tags);
    await logActivity(id, 'created');
  });

  return id;
}

// ------------------------------------------------------------------
// Update Entity
// ------------------------------------------------------------------

export async function updateEntity(id: string, data: any) {
  await db.transaction('rw', [db.items, db.tags, db.itemTags, db.syncQueue], async () => {
    const item = await db.items.get(id);
    if (!item) return;

    const { title, status, scheduledDate, dueDate, rrule, tags, ...restMetadata } = data;
    
    const updates: any = { updatedAt: Date.now() };

    if (title !== undefined) updates.title = title;
    if (status !== undefined) updates.status = status;
    if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (rrule !== undefined) updates.rrule = rrule;
    
    if (Object.keys(restMetadata).length > 0) {
      updates.metadata = { ...(item.metadata || {}), ...restMetadata };
    }

    await db.items.update(id, updates);

    if (tags !== undefined && Array.isArray(tags)) {
      const existingTags = await db.itemTags.where('itemId').equals(id).toArray();
      for (const itemTag of existingTags) {
        await db.itemTags.delete(itemTag.id);
      }
      await attachTags(id, tags);
    }
  });
}

// ------------------------------------------------------------------
// Action Logging & Checking (v2)
// ------------------------------------------------------------------

export async function deleteEntity(id: string) {
  await db.transaction('rw', [db.items, db.activityLogs, db.syncQueue], async () => {
    // Also delete any child instances if it's a recurring item
    await db.items.delete(id);
  });
}

export async function logMedicationTaken(itemId: string, dose: string, amountTaken: number = 1) {
  await db.transaction('rw', [db.items, db.activityLogs, db.syncQueue], async () => {
    const item = await db.items.get(itemId);
    if (!item || item.type !== 'medication') return;

    // Decrement stock
    const meta = item.metadata || {};
    meta.initialStock = Math.max(0, (meta.initialStock || 0) - amountTaken);
    meta.lastTakenAt = Date.now();
    
    await db.items.update(itemId, { metadata: meta, updatedAt: Date.now() });

    // Record formal log
    await logActivity(itemId, 'medication-taken', { dose, amountTaken });
  });
}

export async function toggleActionInstance(instanceId: string, currentStatus: string) {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  await db.itemInstances.update(instanceId, {
    status: newStatus as any,
    completedAt: newStatus === 'completed' ? Date.now() : undefined,
    updatedAt: Date.now()
  });
}

// Quick action
export async function createAction(text: string) {
  const parsed = parseActionInput(text);
  await createEntity('task', parsed.title, {}, parsed.scheduledDate ? 'scheduled' : 'inbox', parsed.scheduledDate || undefined, parsed.tags);
}
import generatedExercises from './generated-exercises.json';

export async function importExerciseLibrary() {
  let count = 0;
  for (const ex of generatedExercises) {
    const existing = await db.items.where('type').equals('exercise').and(i => i.title === ex.title).first();
    if (!existing) {
      await createEntity('exercise', ex.title, {
        muscles: ex.metadata.muscles,
        equipment: ex.metadata.equipment,
        image: ex.image
      });
      count++;
    }
  }
  return count;
}
