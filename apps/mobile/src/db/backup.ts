import { getDb, uuid } from './database';
import type { Item, ItemInstance, ActivityLog } from './types';

export interface BackupItemRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  createdAt: number;
}

export interface BackupAppSetting {
  key: string;
  value: string;
  updatedAt: number;
}

export interface BackupPayload {
  schemaVersion: 1;
  items: Item[];
  itemInstances: ItemInstance[];
  activityLogs: ActivityLog[];
  itemRelations: BackupItemRelation[];
  appSettings: BackupAppSetting[];
}

export function serializeBackup(): BackupPayload {
  const db = getDb();
  return {
    schemaVersion: 1,
    items: db.getAllSync<Item>(`SELECT * FROM items`),
    itemInstances: db.getAllSync<ItemInstance>(`SELECT * FROM itemInstances`),
    activityLogs: db.getAllSync<ActivityLog>(`SELECT * FROM activityLogs`),
    itemRelations: db.getAllSync<BackupItemRelation>(`SELECT * FROM itemRelations`),
    appSettings: db.getAllSync<BackupAppSetting>(`SELECT * FROM appSettings`),
  };
}

export function restoreBackup(payload: BackupPayload): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM items`);
    db.runSync(`DELETE FROM itemInstances`);
    db.runSync(`DELETE FROM activityLogs`);
    db.runSync(`DELETE FROM itemRelations`);
    db.runSync(`DELETE FROM appSettings`);

    for (const item of payload.items) {
      db.runSync(
        `INSERT INTO items (id, type, title, status, notes, voice_transcript, scheduledDate, dueDate, rrule, metadata, createdAt, updatedAt, userId, archivedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id, item.type, item.title, item.status,
          item.notes ?? null, item.voice_transcript ?? null,
          item.scheduledDate ?? null, item.dueDate ?? null, item.rrule ?? null,
          item.metadata ?? null, item.createdAt, item.updatedAt,
          item.userId ?? null, item.archivedAt ?? null, item.deletedAt ?? null,
        ]
      );
    }

    for (const inst of payload.itemInstances) {
      db.runSync(
        `INSERT INTO itemInstances (id, itemId, scheduledDate, completedAt, status, instanceMetadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inst.id, inst.itemId, inst.scheduledDate, inst.completedAt ?? null,
          inst.status, inst.instanceMetadata ?? null, inst.createdAt, inst.updatedAt,
        ]
      );
    }

    for (const log of payload.activityLogs) {
      db.runSync(
        `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [log.id, log.entityId, log.actionType, log.timestamp, log.details ?? null, log.createdAt]
      );
    }

    for (const rel of payload.itemRelations) {
      db.runSync(
        `INSERT INTO itemRelations (id, sourceId, targetId, relationType, createdAt)
         VALUES (?, ?, ?, ?, ?)`,
        [rel.id, rel.sourceId, rel.targetId, rel.relationType, rel.createdAt]
      );
    }

    for (const setting of payload.appSettings) {
      db.runSync(
        `INSERT INTO appSettings (key, value, updatedAt) VALUES (?, ?, ?)`,
        [setting.key, setting.value, setting.updatedAt]
      );
    }
  });
}

export function getOrCreateDeviceId(): string {
  const db = getDb();
  const existing = db.getAllSync<{ value: string }>(
    `SELECT value FROM appSettings WHERE key = 'backupDeviceId' LIMIT 1`
  )[0];
  if (existing) return existing.value;

  const id = uuid();
  db.runSync(
    `INSERT INTO appSettings (key, value, updatedAt) VALUES ('backupDeviceId', ?, ?)`,
    [id, Date.now()]
  );
  return id;
}
