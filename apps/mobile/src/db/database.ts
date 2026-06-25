import * as SQLite from 'expo-sqlite';
import { Item, ItemInstance, ActivityLog } from './types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

let db: SQLite.SQLiteDatabase;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('rka-os.db');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      scheduledDate TEXT,
      dueDate TEXT,
      rrule TEXT,
      metadata TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      archivedAt INTEGER,
      deletedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS itemInstances (
      id TEXT PRIMARY KEY,
      itemId TEXT NOT NULL,
      scheduledDate TEXT NOT NULL,
      completedAt INTEGER,
      status TEXT NOT NULL,
      instanceMetadata TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activityLogs (
      id TEXT PRIMARY KEY,
      entityId TEXT NOT NULL,
      actionType TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      details TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appSettings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_scheduledDate ON items(scheduledDate);
    CREATE INDEX IF NOT EXISTS idx_instances_scheduledDate ON itemInstances(scheduledDate);
    CREATE INDEX IF NOT EXISTS idx_instances_itemId ON itemInstances(itemId);
  `);
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function uuid(): string {
  return uuidv4();
}

// ── Items ──────────────────────────────────────────────────────────────

export function getInboxItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE status = 'inbox' AND deletedAt IS NULL ORDER BY createdAt DESC`
  );
}

export function getTodayItems(): Item[] {
  const today = formatDate(new Date());
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE (scheduledDate = ? OR status IN ('due-today','overdue')) AND deletedAt IS NULL`,
    [today]
  );
}

export function getItemsByStatus(status: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE status = ? AND deletedAt IS NULL ORDER BY createdAt DESC`,
    [status]
  );
}

export function getItemsByType(type: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = ? AND deletedAt IS NULL AND status != 'archived' ORDER BY createdAt DESC`,
    [type]
  );
}

export function updateItemMetadata(id: string, metadata: Record<string, any>): void {
  getDb().runSync(
    `UPDATE items SET metadata = ?, updatedAt = ? WHERE id = ?`,
    [JSON.stringify(metadata), Date.now(), id]
  );
}

export function getItemWithMetadata(id: string): Item | null {
  const result = getDb().getAllSync<Item>(`SELECT * FROM items WHERE id = ?`, [id]);
  return result[0] ?? null;
}

// ── Medications ────────────────────────────────────────────────────────

export interface MedicationMeta {
  dose?: string;
  stockRemaining?: number;
  initialStock?: number;
  refillThreshold?: number;
  lastTakenAt?: number;
  maxPerDay?: number;
  minHoursBetweenDoses?: number;
  frequency?: string;
}

export interface MedicationTimerDetails {
  dose?: string;
  timerActive?: boolean;
  startedAt?: number;
  pausedAt?: number;
  accumulatedMs?: number;
  stoppedAt?: number;
  notified?: boolean;
  loggedAt?: number;
}

export interface TimerWidgetPreferences {
  presentation: 'compact' | 'expanded' | 'minimized';
  position?: { x: number; y: number };
  pinned?: boolean;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
}

function parseDetails(details?: string | null): MedicationTimerDetails {
  if (!details) return {};
  try {
    return JSON.parse(details) as MedicationTimerDetails;
  } catch {
    return {};
  }
}

function stringifyDetails(details?: string | Record<string, any>): string | undefined {
  if (details == null) return undefined;
  return typeof details === 'string' ? details : JSON.stringify(details);
}

function getAppSetting<T>(key: string, fallback: T): T {
  const result = getDb().getAllSync<{ value: string }>(
    `SELECT value FROM appSettings WHERE key = ? LIMIT 1`,
    [key]
  )[0];

  if (!result) return fallback;

  try {
    return JSON.parse(result.value) as T;
  } catch {
    return fallback;
  }
}

function setAppSetting(key: string, value: unknown): void {
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO appSettings (key, value, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    [key, JSON.stringify(value), now]
  );
}

export function getMedications(): Item[] {
  return getItemsByType('medication');
}

export function createMedication(title: string, meta: MedicationMeta): string {
  const id = uuid();
  const now = Date.now();
  const metadata = { ...meta, stockRemaining: meta.initialStock ?? meta.stockRemaining ?? 0 };
  getDb().runSync(
    `INSERT INTO items (id, type, title, status, metadata, createdAt, updatedAt)
     VALUES (?, 'medication', ?, 'active', ?, ?, ?)`,
    [id, title, JSON.stringify(metadata), now, now]
  );
  logActivity(id, 'created');
  return id;
}

export function logMedicationTaken(itemId: string, takenAt: number = Date.now(), startTimer = false): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};

  // Only update lastTakenAt if this dose is more recent than the recorded one
  if (!meta.lastTakenAt || takenAt > meta.lastTakenAt) {
    meta.lastTakenAt = takenAt;
  }
  if (meta.stockRemaining !== undefined && meta.stockRemaining > 0) {
    meta.stockRemaining = meta.stockRemaining - 1;
  }
  updateItemMetadata(itemId, meta);

  // Insert log with the actual taken timestamp
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
     VALUES (?, ?, 'medication-taken', ?, ?, ?)`,
    [uuid(), itemId, takenAt, JSON.stringify({
      dose: meta.dose,
      loggedAt: now,
      timerActive: startTimer,
      startedAt: startTimer ? takenAt : undefined,
      accumulatedMs: 0,
      notified: false,
    }), now]
  );

  // Mark today's instance complete if the dose was today
  const today = formatDate(new Date());
  const doseDate = formatDate(new Date(takenAt));
  if (doseDate === today) {
    const instance = getDb().getAllSync<{ id: string }>(
      `SELECT id FROM itemInstances WHERE itemId = ? AND scheduledDate = ? AND status = 'pending' LIMIT 1`,
      [itemId, today]
    );
    if (instance[0]) {
      completeInstance(instance[0].id);
    }
  }
}

export function getMedicationLogs(itemId: string, limit = 10): ActivityLog[] {
  return getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'medication-taken' ORDER BY timestamp DESC LIMIT ?`,
    [itemId, limit]
  );
}

export function deleteMedicationLog(logId: string, itemId: string): void {
  getDb().runSync(`DELETE FROM activityLogs WHERE id = ?`, [logId]);
  // Recalculate lastTakenAt from remaining logs
  _syncLastTakenAt(itemId);
}

export function editMedicationLog(logId: string, itemId: string, newTimestamp: number): void {
  getDb().runSync(
    `UPDATE activityLogs SET timestamp = ? WHERE id = ?`,
    [newTimestamp, logId]
  );
  _syncLastTakenAt(itemId);
}

export function stopMedicationTimer(logId: string, itemId: string): void {
  const log = getDb().getAllSync<ActivityLog>(`SELECT * FROM activityLogs WHERE id = ? LIMIT 1`, [logId])[0];
  if (!log) return;
  const details = parseDetails(log.details);
  details.timerActive = false;
  delete details.pausedAt;
  delete details.accumulatedMs;
  details.stoppedAt = Date.now();
  getDb().runSync(
    `UPDATE activityLogs SET details = ? WHERE id = ?`,
    [JSON.stringify(details), logId]
  );
  _syncLastTakenAt(itemId);
}

export function pauseMedicationTimer(logId: string, itemId: string): void {
  const log = getDb().getAllSync<ActivityLog>(`SELECT * FROM activityLogs WHERE id = ? LIMIT 1`, [logId])[0];
  if (!log) return;
  const details = parseDetails(log.details);
  if (!details.timerActive || !details.startedAt) return;
  const now = Date.now();
  const accumulatedMs = (details.accumulatedMs ?? 0) + Math.max(0, now - details.startedAt);
  details.timerActive = false;
  details.pausedAt = now;
  details.accumulatedMs = accumulatedMs;
  delete details.stoppedAt;
  getDb().runSync(
    `UPDATE activityLogs SET details = ? WHERE id = ?`,
    [JSON.stringify(details), logId]
  );
  _syncLastTakenAt(itemId);
}

export function markMedicationTimerNotified(logId: string): void {
  const log = getDb().getAllSync<ActivityLog>(`SELECT * FROM activityLogs WHERE id = ? LIMIT 1`, [logId])[0];
  if (!log) return;
  const details = parseDetails(log.details);
  if (details.notified) return;
  details.notified = true;
  getDb().runSync(
    `UPDATE activityLogs SET details = ? WHERE id = ?`,
    [JSON.stringify(details), logId]
  );
}

export function resumeMedicationTimer(logId: string, itemId: string): void {
  const log = getDb().getAllSync<ActivityLog>(`SELECT * FROM activityLogs WHERE id = ? LIMIT 1`, [logId])[0];
  if (!log) return;
  const details = parseDetails(log.details);
  details.timerActive = true;
  details.startedAt = Date.now();
  delete details.pausedAt;
  details.notified = false;
  delete details.stoppedAt;
  getDb().runSync(
    `UPDATE activityLogs SET details = ? WHERE id = ?`,
    [JSON.stringify(details), logId]
  );
  _syncLastTakenAt(itemId);
}

export function resetMedicationTimer(logId: string, itemId: string): void {
  const log = getDb().getAllSync<ActivityLog>(`SELECT * FROM activityLogs WHERE id = ? LIMIT 1`, [logId])[0];
  if (!log) return;
  const details = parseDetails(log.details);
  const now = Date.now();
  details.timerActive = true;
  details.startedAt = now;
  details.accumulatedMs = 0;
  delete details.pausedAt;
  delete details.stoppedAt;
  details.notified = false;
  getDb().runSync(
    `UPDATE activityLogs SET details = ? WHERE id = ?`,
    [JSON.stringify(details), logId]
  );
  _syncLastTakenAt(itemId);
}

export function getActiveMedicationTimers(): Array<{ log: ActivityLog; med: Item; details: MedicationTimerDetails }> {
  const logs = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE actionType = 'medication-taken' ORDER BY timestamp DESC`
  );
  return logs.flatMap((log) => {
    const details = parseDetails(log.details);
    if (!details.timerActive || !details.startedAt) return [];
    const med = getItemWithMetadata(log.entityId);
    if (!med) return [];
    return [{ log, med, details }];
  });
}

export function getPersistentMedicationTimers(): Array<{ log: ActivityLog; med: Item; details: MedicationTimerDetails }> {
  const logs = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE actionType = 'medication-taken' ORDER BY timestamp DESC`
  );
  return logs.flatMap((log) => {
    const details = parseDetails(log.details);
    if (!details.timerActive && !details.pausedAt) return [];
    const med = getItemWithMetadata(log.entityId);
    if (!med) return [];
    return [{ log, med, details }];
  });
}

export function getTimerWidgetPreferences(): TimerWidgetPreferences {
  return getAppSetting<TimerWidgetPreferences>('timerWidgetPreferences', {
    presentation: 'compact',
    pinned: false,
    soundEnabled: true,
    notificationsEnabled: true,
  });
}

export function setTimerWidgetPreferences(preferences: Partial<TimerWidgetPreferences>): TimerWidgetPreferences {
  const next = {
    ...getTimerWidgetPreferences(),
    ...preferences,
  };
  setAppSetting('timerWidgetPreferences', next);
  return next;
}

// Keeps lastTakenAt in item metadata in sync with the actual log records
function _syncLastTakenAt(itemId: string): void {
  const latest = getDb().getAllSync<{ timestamp: number }>(
    `SELECT timestamp FROM activityLogs WHERE entityId = ? AND actionType = 'medication-taken' ORDER BY timestamp DESC LIMIT 1`,
    [itemId]
  );
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  meta.lastTakenAt = latest[0]?.timestamp ?? undefined;
  updateItemMetadata(itemId, meta);
}

export function getLastTakenLog(itemId: string): ActivityLog | null {
  const result = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'medication-taken' ORDER BY timestamp DESC LIMIT 1`,
    [itemId]
  );
  return result[0] ?? null;
}

// ── Calendar ───────────────────────────────────────────────────────────

export function getItemsForDate(date: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE scheduledDate = ? AND deletedAt IS NULL ORDER BY createdAt ASC`,
    [date]
  );
}

export function getInstancesForDate(date: string): ItemInstance[] {
  return getDb().getAllSync<ItemInstance>(
    `SELECT * FROM itemInstances WHERE scheduledDate = ? ORDER BY createdAt ASC`,
    [date]
  );
}

export function createItem(
  type: Item['type'],
  title: string,
  status: Item['status'] = 'inbox',
  scheduledDate?: string,
  notes?: string
): string {
  const id = uuid();
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO items (id, type, title, status, scheduledDate, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, type, title, status, scheduledDate ?? null, notes ?? null, now, now]
  );
  logActivity(id, 'created');
  return id;
}

export function updateItemStatus(id: string, status: Item['status']): void {
  getDb().runSync(
    `UPDATE items SET status = ?, updatedAt = ? WHERE id = ?`,
    [status, Date.now(), id]
  );
  logActivity(id, 'status-changed', JSON.stringify({ status }));
}

export function deleteItem(id: string): void {
  getDb().runSync(
    `UPDATE items SET deletedAt = ?, updatedAt = ? WHERE id = ?`,
    [Date.now(), Date.now(), id]
  );
}

// ── Instances ──────────────────────────────────────────────────────────

export function getTodayInstances(): ItemInstance[] {
  const today = formatDate(new Date());
  return getDb().getAllSync<ItemInstance>(
    `SELECT * FROM itemInstances WHERE scheduledDate = ?`,
    [today]
  );
}

export function completeInstance(instanceId: string): void {
  const now = Date.now();
  getDb().runSync(
    `UPDATE itemInstances SET status = 'completed', completedAt = ?, updatedAt = ? WHERE id = ?`,
    [now, now, instanceId]
  );
}

// ── Activity Logs ──────────────────────────────────────────────────────

export function logActivity(entityId: string, actionType: string, details?: string): void {
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid(), entityId, actionType, now, stringifyDetails(details) ?? null, now]
  );
}

export function getTodayLogs(): ActivityLog[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC`,
    [start.getTime(), end.getTime()]
  );
}
