import * as SQLite from 'expo-sqlite';
import { Item, ItemInstance, ActivityLog } from './types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getTimeOfDayFromHour, normalizeTimeInput, timeToMinutes, type TimeOfDay } from '../utils/time';

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
      voice_transcript TEXT,
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

export type TimerWidgetPresentation = 'compact' | 'expanded' | 'minimized' | 'hidden';
export type VisibleTimerWidgetPresentation = Exclude<TimerWidgetPresentation, 'hidden'>;

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

export function updateItem(
  id: string,
  updates: Partial<Pick<Item, 'type' | 'title' | 'status' | 'notes' | 'scheduledDate' | 'dueDate' | 'rrule'>>,
): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.scheduledDate !== undefined) {
    fields.push('scheduledDate = ?');
    values.push(updates.scheduledDate);
  }
  if (updates.dueDate !== undefined) {
    fields.push('dueDate = ?');
    values.push(updates.dueDate);
  }
  if (updates.rrule !== undefined) {
    fields.push('rrule = ?');
    values.push(updates.rrule);
  }

  if (fields.length === 0) return;

  fields.push('updatedAt = ?');
  values.push(Date.now());
  values.push(id);

  getDb().runSync(
    `UPDATE items SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export function updateInstanceMetadata(instanceId: string, metadata: Record<string, any>): void {
  getDb().runSync(
    `UPDATE itemInstances SET instanceMetadata = ?, updatedAt = ? WHERE id = ?`,
    [JSON.stringify(metadata), Date.now(), instanceId]
  );
}

export function getItemWithMetadata(id: string): Item | null {
  const result = getDb().getAllSync<Item>(`SELECT * FROM items WHERE id = ?`, [id]);
  return result[0] ?? null;
}

type RepeatRule = 'DAILY' | 'WEEKDAYS' | 'WEEKEND' | 'WEEKLY' | `WEEKLY:${number}`;

function parseDayCode(code: string): number | null {
  switch (code) {
    case 'SU': return 0;
    case 'MO': return 1;
    case 'TU': return 2;
    case 'WE': return 3;
    case 'TH': return 4;
    case 'FR': return 5;
    case 'SA': return 6;
    default: return null;
  }
}

function parseRepeatRule(rrule?: string | null): RepeatRule | null {
  if (!rrule) return null;
  const rule = rrule.trim().toUpperCase();
  if (rule === 'FREQ=DAILY' || rule === 'DAILY') return 'DAILY';
  if (rule === 'FREQ=WEEKDAYS' || rule === 'WEEKDAYS') return 'WEEKDAYS';
  if (rule === 'FREQ=WEEKEND' || rule === 'WEEKEND') return 'WEEKEND';
  if (rule === 'FREQ=WEEKLY' || rule === 'WEEKLY') return 'WEEKLY';
  const byDayMatch = rule.match(/BYDAY=([A-Z,]+)/);
  if (byDayMatch) return `WEEKLY:${parseDayCode(byDayMatch[1].split(',')[0]) ?? 0}` as RepeatRule;
  return null;
}

function dayMatchesRepeat(rule: RepeatRule, date: string, startDate?: string): boolean {
  const day = new Date(`${date}T00:00:00`).getDay();
  if (startDate && date < startDate) return false;

  if (rule === 'DAILY') return true;
  if (rule === 'WEEKDAYS') return day >= 1 && day <= 5;
  if (rule === 'WEEKEND') return day === 0 || day === 6;
  if (rule === 'WEEKLY') {
    const startDay = startDate ? new Date(`${startDate}T00:00:00`).getDay() : day;
    return day === startDay;
  }
  const targetDay = Number(rule.split(':')[1]);
  return day === targetDay;
}

function ensureItemInstance(item: Item, date: string): ItemInstance | null {
  const existing = getDb().getAllSync<ItemInstance>(
    `SELECT * FROM itemInstances WHERE itemId = ? AND scheduledDate = ? LIMIT 1`,
    [item.id, date]
  )[0];
  if (existing) return existing;

  const itemMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const now = Date.now();
  const instanceId = uuid();
  getDb().runSync(
    `INSERT INTO itemInstances (id, itemId, scheduledDate, status, instanceMetadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [instanceId, item.id, date, 'pending', JSON.stringify({ ...itemMeta, time: itemMeta.time ?? null, timeOfDay: itemMeta.timeOfDay ?? null, generated: true }), now, now]
  );
  return getDb().getAllSync<ItemInstance>(`SELECT * FROM itemInstances WHERE id = ? LIMIT 1`, [instanceId])[0] ?? null;
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
  presentation: TimerWidgetPresentation;
  resumePresentation?: VisibleTimerWidgetPresentation;
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

// Merges into existing metadata rather than replacing it outright, so editing name/dose/stock
// doesn't clobber tracking fields the edit form never shows (lastTakenAt, initialStock).
export function updateMedication(id: string, title: string, meta: MedicationMeta): void {
  const item = getItemWithMetadata(id);
  const existing: MedicationMeta = item?.metadata ? JSON.parse(item.metadata) : {};
  updateItem(id, { title });
  updateItemMetadata(id, { ...existing, ...meta });
  logActivity(id, 'edited');
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

export interface TimelineEntry {
  item: Item;
  instance?: ItemInstance;
  time: string | null;
  minutes: number | null;
  timeOfDay: TimeOfDay;
}

function parseJson<T extends Record<string, any>>(value?: string | null): T {
  if (!value) return {} as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return {} as T;
  }
}

function getEntryTiming(item: Item, instance?: ItemInstance) {
  const itemMeta = parseJson<Record<string, any>>(item.metadata);
  const instanceMeta = parseJson<Record<string, any>>(instance?.instanceMetadata);
  const time = normalizeTimeInput(instanceMeta.time ?? itemMeta.time);
  const minutes = timeToMinutes(time);
  const derivedHour = minutes != null ? Math.floor(minutes / 60) : null;
  const timeOfDay = (instanceMeta.timeOfDay ?? itemMeta.timeOfDay ?? (derivedHour != null ? getTimeOfDayFromHour(derivedHour) : 'anytime')) as TimeOfDay;

  return { time, minutes, timeOfDay };
}

export function getTimelineEntriesForDate(date: string): TimelineEntry[] {
  const items = getItemsForDate(date);
  const instances = getInstancesForDate(date);
  const instanceByItemId = new Map(instances.map((instance) => [instance.itemId, instance] as const));
  const usedInstanceIds = new Set<string>();

  const entries = items.map((item) => {
    const instance = instanceByItemId.get(item.id);
    if (instance) usedInstanceIds.add(instance.id);
    const timing = getEntryTiming(item, instance);
    return {
      item,
      instance,
      ...timing,
    };
  });

  for (const instance of instances) {
    if (usedInstanceIds.has(instance.id)) continue;
    const item = items.find((candidate) => candidate.id === instance.itemId);
    if (!item) continue;
    const timing = getEntryTiming(item, instance);
    entries.push({
      item,
      instance,
      ...timing,
    });
  }

  return entries.sort((a, b) => {
    const timeA = a.minutes ?? Number.POSITIVE_INFINITY;
    const timeB = b.minutes ?? Number.POSITIVE_INFINITY;
    if (timeA !== timeB) return timeA - timeB;
    return a.item.createdAt - b.item.createdAt;
  });
}

export function createItem(
  type: Item['type'],
  title: string,
  status: Item['status'] = 'inbox',
  scheduledDate?: string,
  notes?: string,
  voice_transcript?: string
): string {
  const id = uuid();
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO items (id, type, title, status, scheduledDate, notes, voice_transcript, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, type, title, status, scheduledDate ?? null, notes ?? null, voice_transcript ?? null, now, now]
  );
  logActivity(id, 'created');
  return id;
}

export function createTimedItem(
  type: Item['type'],
  title: string,
  scheduledDate: string,
  time: string,
  notes?: string,
): { itemId: string; instanceId: string } {
  const normalizedTime = normalizeTimeInput(time) ?? '09:00';
  const itemId = createItem(type, title, 'scheduled', scheduledDate, notes);
  const timeOfDay = getTimeOfDayFromHour(Math.floor(timeToMinutes(normalizedTime)! / 60));
  const nextMeta = { time: normalizedTime, timeOfDay };
  updateItemMetadata(itemId, nextMeta);

  const now = Date.now();
  const instanceId = uuid();
  getDb().runSync(
    `INSERT INTO itemInstances (id, itemId, scheduledDate, status, instanceMetadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [instanceId, itemId, scheduledDate, 'pending', JSON.stringify(nextMeta), now, now]
  );

  return { itemId, instanceId };
}

export function updateTimelineItemTime(id: string, time: string, timeOfDay?: TimeOfDay): void {
  const item = getItemWithMetadata(id);
  if (!item) return;

  const normalizedTime = normalizeTimeInput(time);
  if (!normalizedTime) return;

  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  const nextTimeOfDay = timeOfDay ?? getTimeOfDayFromHour(Math.floor(timeToMinutes(normalizedTime)! / 60));
  updateItemMetadata(id, {
    ...meta,
    time: normalizedTime,
    timeOfDay: nextTimeOfDay,
  });

  const instance = getDb().getAllSync<ItemInstance>(
    `SELECT * FROM itemInstances WHERE itemId = ? AND scheduledDate = ? ORDER BY createdAt DESC LIMIT 1`,
    [id, item.scheduledDate ?? '']
  )[0];

  if (instance) {
    const parsed = instance.instanceMetadata ? JSON.parse(instance.instanceMetadata) : {};
    updateInstanceMetadata(instance.id, {
      ...parsed,
      time: normalizedTime,
      timeOfDay: nextTimeOfDay,
    });
  }
}

export function updateItemStatus(id: string, status: Item['status']): void {
  updateItem(id, { status });
  logActivity(id, 'status-changed', JSON.stringify({ status }));
}

export function deleteItem(id: string): void {
  getDb().runSync(
    `UPDATE items SET deletedAt = ?, updatedAt = ? WHERE id = ?`,
    [Date.now(), Date.now(), id]
  );
}

export type GtdDestination =
  | 'today' | 'morning' | 'evening'
  | 'project' | 'habit' | 'medication'
  | 'reference' | 'someday' | 'delete';

export function processInboxItem(id: string, destination: GtdDestination): void {
  const db = getDb();
  const now = Date.now();
  const today = formatDate(new Date());

  if (destination === 'delete') {
    db.runSync('UPDATE items SET deletedAt = ?, updatedAt = ? WHERE id = ?', [now, now, id]);
    return;
  }

  const item = getItemWithMetadata(id);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};

  switch (destination) {
    case 'today':
      db.runSync(
        'UPDATE items SET status = ?, scheduledDate = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['active', today, JSON.stringify({ ...meta, gtdContext: 'today' }), now, id]
      );
      break;
    case 'morning':
      db.runSync(
        'UPDATE items SET status = ?, scheduledDate = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['active', today, JSON.stringify({ ...meta, timeOfDay: 'morning', gtdContext: 'scheduled' }), now, id]
      );
      break;
    case 'evening':
      db.runSync(
        'UPDATE items SET status = ?, scheduledDate = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['active', today, JSON.stringify({ ...meta, timeOfDay: 'evening', gtdContext: 'scheduled' }), now, id]
      );
      break;
    case 'project':
      db.runSync(
        'UPDATE items SET status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['active', JSON.stringify({ ...meta, gtdContext: 'project' }), now, id]
      );
      break;
    case 'habit':
      db.runSync(
        'UPDATE items SET type = ?, status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['habit', 'active', JSON.stringify({ ...meta, gtdContext: 'habit' }), now, id]
      );
      break;
    case 'medication':
      db.runSync(
        'UPDATE items SET type = ?, status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['medication', 'active', JSON.stringify({ ...meta, gtdContext: 'medication' }), now, id]
      );
      break;
    case 'reference':
      db.runSync(
        'UPDATE items SET status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['archived', JSON.stringify({ ...meta, gtdContext: 'reference' }), now, id]
      );
      break;
    case 'someday':
      db.runSync(
        'UPDATE items SET status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['archived', JSON.stringify({ ...meta, gtdContext: 'someday' }), now, id]
      );
      break;
  }
  logActivity(id, 'status-changed', JSON.stringify({ destination }));
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
