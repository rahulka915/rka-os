import * as SQLite from 'expo-sqlite';
import { Item, ItemInstance, ActivityLog, DomainContributionRow } from './types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getTimeOfDayFromHour, normalizeTimeInput, timeToMinutes, type TimeOfDay } from '../utils/time';
import { resolveAutoStopAfterMs } from '../domain/medicationTimer/timerMath';
import { nextOccurrenceDate, parseRepeatRule, dayMatchesRepeat } from '../utils/repeat';
import { countDosesByDay } from '../utils/medicationDoseHistory';
import { buildTimelineEntries, type TimelineEntry } from './timelineEntry';
import type { WorkoutSetDetails } from '../utils/workoutSet';
import { getMostRecentSessionSets } from '../utils/workoutSet';
import { computePotentialStats, type PotentialStatResult } from '../utils/potential';
import {
  domainScore,
  overallPotential,
  MISSION_CONTRIBUTION_DEFAULTS,
  ACHIEVEMENT_CONTRIBUTION_DEFAULTS,
} from '../utils/domainScoring';
import {
  parseRoutineStepMeta,
  parseRoutineSessionMeta,
  type RoutineStepMeta,
  type RoutineSessionMeta,
} from '../utils/routineMeta';

// Re-exported so `import type { TimelineEntry } from '../db/database'` keeps
// working for CalendarScreen and useDb.
export type { TimelineEntry } from './timelineEntry';

import { getCurrentSyncUserId, pushItemToFirestore, pushItemRelationToFirestore, deleteItemRelationFromFirestore, pushItemOrderBatchToFirestore, pushAppSettingToFirestore, pushActivityLogToFirestore } from '../services/firestoreSync';

let db: SQLite.SQLiteDatabase;

export function syncItemToRemote(id: string): void {
  const userId = getCurrentSyncUserId();
  if (!userId) return;
  const item = getItemWithMetadata(id);
  if (item) {
    pushItemToFirestore(userId, item).catch(() => {});
  }
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('rka-os.db');
    initSchema();
    migratePotentialStats();
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

    -- Generic Notion-style relation edges between items (e.g. a task related to a project
    -- via relationType 'project', a project related to an area via relationType 'area').
    -- One row per (sourceId, relationType) — each source has at most one target per relation
    -- type, matching how Areas/Projects/Tasks link today (single-select relation, not multi).
    CREATE TABLE IF NOT EXISTS itemRelations (
      id TEXT PRIMARY KEY,
      sourceId TEXT NOT NULL,
      targetId TEXT NOT NULL,
      relationType TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      UNIQUE(sourceId, relationType)
    );

    -- Manual drag-to-reorder position, scoped per list (not global) — the same task can sit
    -- at a different position in its Project's task list vs. the Tasks screen vs. a Home time
    -- block, since those are independent orderings a user drags separately. listKey identifies
    -- which list, e.g. project:projectId, tasks:active, tasks:someday, home:morning.
    CREATE TABLE IF NOT EXISTS itemOrder (
      listKey TEXT NOT NULL,
      itemId TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (listKey, itemId)
    );

    -- One row per completion-event's live scoring effect on a Domain (see
    -- src/utils/domainScoring.ts for the decay/lift math). Kept separate from
    -- the permanent 'achievement'/'project' items rows so the scoring formula
    -- can be re-tuned, and a contribution soft-disabled (excludedAt), without
    -- ever touching achievement or Mission history. sourceType/sourceId point
    -- at the project or achievement item that produced this contribution.
    CREATE TABLE IF NOT EXISTS domainContributions (
      id TEXT PRIMARY KEY,
      areaId TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      magnitude REAL NOT NULL,
      halfLifeDays REAL NOT NULL,
      occurredAt INTEGER NOT NULL,
      excludedAt INTEGER,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_scheduledDate ON items(scheduledDate);
    CREATE INDEX IF NOT EXISTS idx_instances_scheduledDate ON itemInstances(scheduledDate);
    CREATE INDEX IF NOT EXISTS idx_instances_itemId ON itemInstances(itemId);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON itemRelations(targetId, relationType);
    CREATE INDEX IF NOT EXISTS idx_itemOrder_list ON itemOrder(listKey);
    CREATE INDEX IF NOT EXISTS idx_domainContributions_area ON domainContributions(areaId);
    CREATE INDEX IF NOT EXISTS idx_domainContributions_source ON domainContributions(sourceType, sourceId);
  `);

  try {
    db.execSync(`ALTER TABLE items ADD COLUMN completedAt INTEGER`);
  } catch {
    // Column already exists on this device's DB — safe to ignore.
  }
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

// Everything scheduled after today, for the Upcoming list. Completed and
// deleted rows are excluded; ordering is by date so grouping stays cheap.
export function getUpcomingItems(fromDate: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE scheduledDate > ? AND status != 'completed' AND deletedAt IS NULL
     ORDER BY scheduledDate ASC, createdAt ASC`,
    [fromDate]
  );
}

export function getItemsByStatus(status: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE status = ? AND deletedAt IS NULL ORDER BY createdAt DESC`,
    [status]
  );
}

export function getCompletedItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE status = 'completed' AND deletedAt IS NULL ORDER BY COALESCE(completedAt, updatedAt) DESC`
  );
}

export function getItemsByType(type: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = ? AND deletedAt IS NULL AND status != 'archived' ORDER BY createdAt DESC`,
    [type]
  );
}

// Rollup for the Calendar tray: every task-like item with no scheduledDate at
// all (Inbox + undated Tasks), matching the scope of the web app's
// UnscheduledPane — not date-scoped, unlike the timeline's existing
// "Flexible" concept (which only covers items already assigned to the
// viewed day but missing a time).
export function getUnscheduledItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = 'task' AND scheduledDate IS NULL AND deletedAt IS NULL AND status NOT IN ('completed', 'archived') ORDER BY createdAt DESC`
  );
}

// --- Generic relations (Notion-style single-select relation property) -------------------
// One source item points at one target item per relationType (e.g. a task's 'project'
// relation, a project's 'area' relation). Rollups (counts, related-item lists) are just
// queries against this one table, so any future entity pair (medication -> area, habit ->
// project, ...) reuses the same three functions instead of a bespoke metadata convention.

export function setRelation(sourceId: string, relationType: string, targetId: string | null): void {
  if (targetId === null) {
    const existing = getDb().getAllSync<{ id: string }>(
      `SELECT id FROM itemRelations WHERE sourceId = ? AND relationType = ?`,
      [sourceId, relationType]
    );
    getDb().runSync(`DELETE FROM itemRelations WHERE sourceId = ? AND relationType = ?`, [sourceId, relationType]);
    const userId = getCurrentSyncUserId();
    if (userId) {
      for (const row of existing) {
        deleteItemRelationFromFirestore(userId, row.id).catch(() => {});
      }
    }
    return;
  }
  const id = uuidv4();
  const createdAt = Date.now();
  getDb().runSync(
    `INSERT INTO itemRelations (id, sourceId, targetId, relationType, createdAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(sourceId, relationType) DO UPDATE SET targetId = excluded.targetId`,
    [id, sourceId, targetId, relationType, createdAt]
  );
  const userId = getCurrentSyncUserId();
  if (userId) {
    // Read back the row so an upsert (ON CONFLICT branch) pushes the existing
    // id/createdAt rather than the freshly generated ones from this call.
    const row = getDb().getAllSync<{ id: string; createdAt: number }>(
      `SELECT id, createdAt FROM itemRelations WHERE sourceId = ? AND relationType = ?`,
      [sourceId, relationType]
    )[0];
    if (row) {
      pushItemRelationToFirestore(userId, { id: row.id, sourceId, targetId, relationType, createdAt: row.createdAt }).catch(() => {});
    }
  }
}

export function getRelation(sourceId: string, relationType: string): string | null {
  const row = getDb().getAllSync<{ targetId: string }>(
    `SELECT targetId FROM itemRelations WHERE sourceId = ? AND relationType = ? LIMIT 1`,
    [sourceId, relationType]
  );
  return row[0]?.targetId ?? null;
}

// Task dependencies reuse the generic itemRelations primitive with relationType 'dependsOn'
// (sourceId = the dependent task, targetId = the task it's blocked by) — single-select like
// every other relation here, so a task can depend on at most one other task at a time.
// Returns the blocking task only while it's still incomplete; once done, the dependency
// relation stays recorded but no longer blocks anything (matches "the task IS done, not
// just unassigned" — no need to prompt clearing the link).
export function getBlockingTask(itemId: string): Item | null {
  const dependsOnId = getRelation(itemId, 'dependsOn');
  if (!dependsOnId) return null;
  const blocker = getItemWithMetadata(dependsOnId);
  if (!blocker || blocker.status === 'completed' || blocker.deletedAt) return null;
  return blocker;
}

// Persists a full drag-to-reorder result for one list — always rewrites the whole ordering
// rather than shuffling individual rows, since a drag operation already produces the final
// order client-side and this keeps positions dense (0..n-1) with no gap-management logic.
export function setManualOrder(listKey: string, orderedIds: string[]): void {
  const database = getDb();
  database.withTransactionSync(() => {
    database.runSync(`DELETE FROM itemOrder WHERE listKey = ?`, [listKey]);
    orderedIds.forEach((itemId, position) => {
      database.runSync(
        `INSERT INTO itemOrder (listKey, itemId, position) VALUES (?, ?, ?)`,
        [listKey, itemId, position]
      );
    });
  });
  const userId = getCurrentSyncUserId();
  if (userId) {
    pushItemOrderBatchToFirestore(userId, listKey, orderedIds).catch(() => {});
  }
}

// Sorts `items` by their saved manual position for `listKey`, if any. Items with no saved
// position (never dragged, or added since the last reorder) keep their relative order from
// `items` and are appended after every manually-positioned item — so a freshly created task
// shows up at the end rather than jumping to an arbitrary spot.
export function applyManualOrder<T extends { id: string }>(listKey: string, items: T[]): T[] {
  const rows = getDb().getAllSync<{ itemId: string; position: number }>(
    `SELECT itemId, position FROM itemOrder WHERE listKey = ?`,
    [listKey]
  );
  if (rows.length === 0) return items;
  const positions = new Map(rows.map(r => [r.itemId, r.position]));
  return [...items].sort((a, b) => {
    const posA = positions.get(a.id);
    const posB = positions.get(b.id);
    if (posA === undefined && posB === undefined) return 0;
    if (posA === undefined) return 1;
    if (posB === undefined) return -1;
    return posA - posB;
  });
}

// Rollup: items relating to `targetId` via `relationType` (e.g. all projects in an area).
export function getRelatedItems(targetId: string, relationType: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT items.* FROM items
     JOIN itemRelations ON itemRelations.sourceId = items.id
     WHERE itemRelations.targetId = ? AND itemRelations.relationType = ?
       AND items.deletedAt IS NULL AND items.status != 'completed' AND items.status != 'archived'
     ORDER BY items.createdAt DESC`,
    [targetId, relationType]
  );
}

// Rollup count — the RKA-OS equivalent of a Notion "Count" rollup property.
export function countRelated(targetId: string, relationType: string): number {
  const row = getDb().getAllSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM itemRelations
     JOIN items ON items.id = itemRelations.sourceId
     WHERE itemRelations.targetId = ? AND itemRelations.relationType = ?
       AND items.deletedAt IS NULL AND items.status != 'completed' AND items.status != 'archived'`,
    [targetId, relationType]
  );
  return row[0]?.count ?? 0;
}

// Like getRelatedItems, but also filters the joined side by items.type and
// applies no status filter — needed because Potential Stats and Achievements
// link to a Domain via their own relationTypes ('potentialStatArea',
// 'achievementArea', see below) rather than reusing 'area' (which is reserved
// for project -> area, so Mission rollups never pick up a stat or trophy).
export function getRelatedItemsByType(targetId: string, relationType: string, itemType: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT items.* FROM items
     JOIN itemRelations ON itemRelations.sourceId = items.id
     WHERE itemRelations.targetId = ? AND itemRelations.relationType = ? AND items.type = ?
       AND items.deletedAt IS NULL
     ORDER BY items.createdAt DESC`,
    [targetId, relationType, itemType]
  );
}

export function getProjectItemCount(projectId: string): number {
  return countRelated(projectId, 'project');
}

export function getAreaProjectCount(areaId: string): number {
  return countRelated(areaId, 'area');
}

// ── Potential Stats ───────────────────────────────────────────────────────
// Potential Stats are 'potential-stat' items, optionally linked to a Domain
// via relationType 'potentialStatArea' (kept distinct from 'area' so they
// never leak into Mission rollups above). A stat with no Domain link is
// legal — it just doesn't feed any Domain's maintenance score yet.

export function getPotentialStats(): Item[] {
  return getItemsByType('potential-stat');
}

export function getPotentialStatsForArea(areaId: string): Item[] {
  return getRelatedItemsByType(areaId, 'potentialStatArea', 'potential-stat');
}

export function getAreaForPotentialStat(statId: string): string | null {
  return getRelation(statId, 'potentialStatArea');
}

export function setPotentialStatArea(statId: string, areaId: string | null): void {
  setRelation(statId, 'potentialStatArea', areaId);
}

export function createPotentialStat(title: string, areaId?: string | null): string {
  const id = createItem('potential-stat', title, 'active');
  if (areaId) setPotentialStatArea(id, areaId);
  return id;
}

const LEGACY_POTENTIAL_STAT_KEYS = ['physique', 'skin', 'oralHygiene', 'vitality'] as const;
const LEGACY_POTENTIAL_STAT_LABELS: Record<string, string> = {
  physique: 'Physique',
  skin: 'Skin',
  oralHygiene: 'Oral Hygiene',
  vitality: 'Vitality',
};

// One-time (idempotent) migration from the old fixed 4-stat enum to DB-backed
// 'potential-stat' items: seeds the 4 defaults (tagged metadata.seedKey so
// re-runs don't duplicate them) and rewrites any habit still carrying the
// legacy literal stat name in its metadata to the new item id. Safe to call
// on every launch — after the first run there's nothing left to migrate.
function migratePotentialStats(): void {
  const existingStats = getPotentialStats();
  const seedKeyToId: Record<string, string> = {};
  for (const stat of existingStats) {
    if (!stat.metadata) continue;
    try {
      const meta = JSON.parse(stat.metadata);
      if (meta.seedKey) seedKeyToId[meta.seedKey] = stat.id;
    } catch {
      // Malformed metadata — skip, treated as unseeded below.
    }
  }
  for (const key of LEGACY_POTENTIAL_STAT_KEYS) {
    if (!seedKeyToId[key]) {
      const id = createItem('potential-stat', LEGACY_POTENTIAL_STAT_LABELS[key], 'active');
      updateItemMetadata(id, { seedKey: key });
      seedKeyToId[key] = id;
    }
  }

  const habits = getItemsByType('habit');
  for (const habit of habits) {
    if (!habit.metadata) continue;
    let meta: any;
    try {
      meta = JSON.parse(habit.metadata);
    } catch {
      continue;
    }
    if (meta.potentialStat && (LEGACY_POTENTIAL_STAT_KEYS as readonly string[]).includes(meta.potentialStat)) {
      meta.potentialStat = seedKeyToId[meta.potentialStat];
      updateItemMetadata(habit.id, meta);
    }
  }
}

// ── Domain contributions (live scoring) ───────────────────────────────────
// See src/utils/domainScoring.ts for the decay/lift math these rows feed.

function insertDomainContribution(
  areaId: string,
  sourceType: 'mission' | 'achievement',
  sourceId: string,
  magnitude: number,
  halfLifeDays: number,
  occurredAt: number,
): string {
  const id = uuidv4();
  getDb().runSync(
    `INSERT INTO domainContributions (id, areaId, sourceType, sourceId, magnitude, halfLifeDays, occurredAt, excludedAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [id, areaId, sourceType, sourceId, magnitude, halfLifeDays, occurredAt, Date.now()]
  );
  return id;
}

export function excludeDomainContribution(id: string): void {
  getDb().runSync(`UPDATE domainContributions SET excludedAt = ? WHERE id = ?`, [Date.now(), id]);
}

export function reactivateDomainContribution(id: string): void {
  getDb().runSync(`UPDATE domainContributions SET excludedAt = NULL WHERE id = ?`, [id]);
}

export function getActiveContributionsForArea(areaId: string): DomainContributionRow[] {
  return getDb().getAllSync<DomainContributionRow>(
    `SELECT * FROM domainContributions WHERE areaId = ? AND excludedAt IS NULL`,
    [areaId]
  );
}

// Most recent contribution row (active or excluded) for a given source —
// used by the achievement-eligibility upgrade/downgrade flow to find the row
// to exclude/reactivate rather than creating duplicates.
function getContributionForSource(sourceType: 'mission' | 'achievement', sourceId: string): DomainContributionRow | null {
  const rows = getDb().getAllSync<DomainContributionRow>(
    `SELECT * FROM domainContributions WHERE sourceType = ? AND sourceId = ? ORDER BY createdAt DESC LIMIT 1`,
    [sourceType, sourceId]
  );
  return rows[0] ?? null;
}

// ── Achievements (permanent trophies) ─────────────────────────────────────
// 'achievement' items are permanent history — created once, status stays
// 'completed' forever, never deleted by any scoring change. Their live
// scoring effect (if any) is a separate domainContributions row, so toggling
// contributesToScore or excluding a contribution never touches this record.

export interface CreateAchievementInput {
  title: string;
  areaId?: string | null;
  earnedAt: string; // YYYY-MM-DD, the real date it happened — not createdAt
  source: 'mission' | 'milestone' | 'manual';
  sourceId?: string;
  contributesToScore: boolean;
  notes?: string;
}

export function createAchievement(input: CreateAchievementInput): string {
  const id = createItem('achievement', input.title, 'completed', undefined, input.notes);
  updateItemMetadata(id, {
    earnedAt: input.earnedAt,
    source: input.source,
    sourceId: input.sourceId,
    contributesToScore: input.contributesToScore,
  });
  if (input.areaId) setRelation(id, 'achievementArea', input.areaId);
  return id;
}

export function getAchievementsForArea(areaId: string): Item[] {
  return getRelatedItemsByType(areaId, 'achievementArea', 'achievement');
}

export function getAllAchievements(): Item[] {
  return getItemsByType('achievement');
}

export function getAreaForAchievement(achievementId: string): string | null {
  return getRelation(achievementId, 'achievementArea');
}

function getAchievementForSource(source: 'mission' | 'milestone' | 'manual', sourceId: string): Item | null {
  const achievements = getItemsByType('achievement');
  for (const achievement of achievements) {
    if (!achievement.metadata) continue;
    try {
      const meta = JSON.parse(achievement.metadata);
      if (meta.source === source && meta.sourceId === sourceId) return achievement;
    } catch {
      // Malformed metadata — skip.
    }
  }
  return null;
}

// ── Mission completion (mutually exclusive Mission vs. Achievement tier) ──

// Completing a Mission always produces exactly one active domainContribution
// for this event — never both. Achievement-eligible Missions (metadata.
// achievementEligible) get the larger/slower Achievement tier plus a
// permanent trophy; ordinary Missions get the smaller/faster Mission tier.
// No-op for the score side if the Mission has no Domain — a trophy/contribution
// needs somewhere to attach.
export function completeMission(missionId: string): void {
  updateItemStatus(missionId, 'completed');
  const item = getItemWithMetadata(missionId);
  const areaId = getRelation(missionId, 'area');
  if (!item || !areaId) return;

  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  const eligible = !!meta.achievementEligible;
  const now = Date.now();

  if (eligible) {
    const achievementId = createAchievement({
      title: item.title,
      areaId,
      earnedAt: formatDate(new Date(now)),
      source: 'mission',
      sourceId: missionId,
      contributesToScore: true,
    });
    insertDomainContribution(
      areaId,
      'achievement',
      achievementId,
      ACHIEVEMENT_CONTRIBUTION_DEFAULTS.magnitude,
      ACHIEVEMENT_CONTRIBUTION_DEFAULTS.halfLifeDays,
      now,
    );
  } else {
    insertDomainContribution(
      areaId,
      'mission',
      missionId,
      MISSION_CONTRIBUTION_DEFAULTS.magnitude,
      MISSION_CONTRIBUTION_DEFAULTS.halfLifeDays,
      now,
    );
  }
}

// Toggling achievementEligible always updates the flag. If the Mission isn't
// completed yet, that's all — the flag is simply read at completion time. If
// it IS already completed, this performs the upgrade/downgrade dance: at
// most one contribution for this completion event stays active, the trophy
// (once created) is permanent, and the achievement contribution always uses
// the Mission's ORIGINAL completion date, not the toggle time.
export function setMissionAchievementEligible(missionId: string, eligible: boolean): void {
  const item = getItemWithMetadata(missionId);
  if (!item) return;
  const existingMeta = item.metadata ? JSON.parse(item.metadata) : {};
  updateItemMetadata(missionId, { ...existingMeta, achievementEligible: eligible });

  if (item.status !== 'completed') return;
  const areaId = getRelation(missionId, 'area');
  if (!areaId) return;
  const completedAt = item.completedAt ?? item.updatedAt;

  if (eligible) {
    const missionContribution = getContributionForSource('mission', missionId);
    if (missionContribution && !missionContribution.excludedAt) {
      excludeDomainContribution(missionContribution.id);
    }

    let achievement = getAchievementForSource('mission', missionId);
    if (!achievement) {
      const achievementId = createAchievement({
        title: item.title,
        areaId,
        earnedAt: formatDate(new Date(completedAt)),
        source: 'mission',
        sourceId: missionId,
        contributesToScore: true,
      });
      achievement = getItemWithMetadata(achievementId);
    }
    if (!achievement) return;

    const achievementContribution = getContributionForSource('achievement', achievement.id);
    if (achievementContribution) {
      reactivateDomainContribution(achievementContribution.id);
    } else {
      insertDomainContribution(
        areaId,
        'achievement',
        achievement.id,
        ACHIEVEMENT_CONTRIBUTION_DEFAULTS.magnitude,
        ACHIEVEMENT_CONTRIBUTION_DEFAULTS.halfLifeDays,
        completedAt,
      );
    }
  } else {
    const achievement = getAchievementForSource('mission', missionId);
    if (achievement) {
      const achievementContribution = getContributionForSource('achievement', achievement.id);
      if (achievementContribution && !achievementContribution.excludedAt) {
        excludeDomainContribution(achievementContribution.id);
      }
    }

    const missionContribution = getContributionForSource('mission', missionId);
    if (missionContribution) {
      reactivateDomainContribution(missionContribution.id);
    } else {
      insertDomainContribution(
        areaId,
        'mission',
        missionId,
        MISSION_CONTRIBUTION_DEFAULTS.magnitude,
        MISSION_CONTRIBUTION_DEFAULTS.halfLifeDays,
        completedAt,
      );
    }
  }
}

// ── Current Focus (singleton) ─────────────────────────────────────────────
// A temporary label + per-Domain weight overrides for Overall Potential.
// Changing it never touches Domains/Missions/Achievements/history — it's
// purely a read-time weighting multiplier in computeOverallPotential.

export interface FocusData {
  id: string;
  label: string;
  weights: Record<string, number>;
}

export function getFocus(): FocusData | null {
  const rows = getItemsByType('focus');
  const focus = rows[0];
  if (!focus) return null;
  const meta = focus.metadata ? JSON.parse(focus.metadata) : {};
  return { id: focus.id, label: focus.title, weights: meta.weights ?? {} };
}

export function setFocus(label: string, weights: Record<string, number>): void {
  const rows = getItemsByType('focus');
  if (rows[0]) {
    updateItem(rows[0].id, { title: label });
    updateItemMetadata(rows[0].id, { weights });
  } else {
    const id = createItem('focus', label, 'active');
    updateItemMetadata(id, { weights });
  }
}

export function clearFocus(): void {
  const rows = getItemsByType('focus');
  if (rows[0]) deleteItem(rows[0].id);
}

// ── Domain score / Overall Potential ──────────────────────────────────────

export function getPotentialStatResultsForArea(areaId: string, today: string): Record<string, PotentialStatResult> {
  const stats = getPotentialStatsForArea(areaId);
  const habits = getItemsByType('habit');
  const completedDatesByHabitId: Record<string, Set<string>> = {};
  for (const habit of habits) {
    completedDatesByHabitId[habit.id] = getCompletedOccurrenceDates(habit.id);
  }
  return computePotentialStats(habits, stats, completedDatesByHabitId, today);
}

export function computeDomainMaintenance(areaId: string, today: string): number {
  const stats = getPotentialStatsForArea(areaId);
  if (stats.length === 0) return 0;
  const results = getPotentialStatResultsForArea(areaId, today);
  const percents = stats.map((stat) => results[stat.id]?.percent ?? 0);
  return percents.reduce((sum, p) => sum + p, 0) / percents.length;
}

export function computeDomainScore(areaId: string, now: number = Date.now()): number {
  const today = formatDate(new Date(now));
  const maintenance = computeDomainMaintenance(areaId, today);
  const rows = getActiveContributionsForArea(areaId);
  const contributions = rows.map((row) => ({
    magnitude: row.magnitude,
    halfLifeDays: row.halfLifeDays,
    occurredAt: row.occurredAt,
  }));
  return domainScore(maintenance, contributions, now);
}

export function computeOverallPotential(now: number = Date.now()): number {
  const areas = getItemsByType('area');
  if (areas.length === 0) return 0;
  const focus = getFocus();
  const scores: Record<string, number> = {};
  const weights: Record<string, number> = {};
  for (const area of areas) {
    scores[area.id] = computeDomainScore(area.id, now);
    weights[area.id] = focus?.weights?.[area.id] ?? 1;
  }
  return overallPotential(scores, weights);
}

export function getProjectsForArea(areaId: string): Item[] {
  return getRelatedItems(areaId, 'area');
}

// Rollup: templates that include this exercise, deduped across the (possibly
// multiple) workout-blocks referencing it within the same template.
export function getTemplatesForExercise(exerciseId: string): Item[] {
  const blocks = getRelatedItems(exerciseId, 'exercise');
  const seen = new Set<string>();
  const templates: Item[] = [];
  for (const block of blocks) {
    const templateId = getRelation(block.id, 'workout-template');
    if (templateId && !seen.has(templateId)) {
      seen.add(templateId);
      const template = getItemWithMetadata(templateId);
      if (template) templates.push(template);
    }
  }
  return templates;
}

export function updateItemMetadata(id: string, metadata: Record<string, any>): void {
  getDb().runSync(
    `UPDATE items SET metadata = ?, updatedAt = ? WHERE id = ?`,
    [JSON.stringify(metadata), Date.now(), id]
  );
  syncItemToRemote(id);
}

export function updateItemTitle(id: string, title: string): void {
  getDb().runSync(`UPDATE items SET title = ?, updatedAt = ? WHERE id = ?`, [title, Date.now(), id]);
  syncItemToRemote(id);
}

// "Plan for Today" — the lightweight way to put an un-dated task onto the Home
// Today blocks without giving it a calendar date/time. Marks it with today's
// date in metadata.plannedDate; Home shows the union of scheduledDate=today and
// plannedDate=today items. The stamp is date-specific, so it naturally falls
// off the next day (no cleanup needed). An optional bucket lets a caller drop
// the task straight into a specific block.
export function planForToday(itemId: string, bucket?: 'anytime' | 'morning' | 'afternoon' | 'evening'): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  meta.plannedDate = formatDate(new Date());
  if (bucket) meta.preferredTimeBucket = bucket;
  updateItemMetadata(itemId, meta);
}

export function unplanToday(itemId: string): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  delete meta.plannedDate;
  // Also drop a real block preference back to Anytime — otherwise the editor's
  // save path (which re-plans an un-dated task whose bucket is a real block)
  // would immediately re-add it to Today, fighting this removal.
  if (meta.preferredTimeBucket && meta.preferredTimeBucket !== 'anytime') {
    meta.preferredTimeBucket = 'anytime';
  }
  updateItemMetadata(itemId, meta);
}

// Un-dated tasks the user explicitly planned for today (see planForToday).
// LIKE on the JSON metadata is fine for a single-user local DB; the pattern
// matches JSON.stringify's contiguous `"plannedDate":"<today>"`.
export function getPlannedTodayItems(): Item[] {
  const today = formatDate(new Date());
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = 'task' AND status NOT IN ('completed', 'inbox')
       AND deletedAt IS NULL AND metadata LIKE ?`,
    [`%"plannedDate":"${today}"%`]
  );
}

// Repeating tasks whose rule fires today. These usually have no scheduledDate
// of their own, so getTodayItems can never see them — the rule itself decides
// membership. scheduledDate doubles as the rule's "not before" start date,
// which is what makes a task vanish for the rest of the day once completed:
// the roll-forward in updateItemStatus sets scheduledDate to the next
// occurrence, so today no longer matches.
export function getRepeatingItemsForToday(): Item[] {
  const today = formatDate(new Date());
  const rows = getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE rrule IS NOT NULL AND rrule != '' AND type = 'task'
       AND status NOT IN ('completed', 'inbox') AND deletedAt IS NULL`
  );
  return rows.filter((item) => {
    const rule = parseRepeatRule(item.rrule);
    return rule ? dayMatchesRepeat(rule, today, item.scheduledDate ?? undefined) : false;
  });
}

// Reads back every occurrence a recurring item (task or habit) has ever
// completed, from the 'completed-occurrence' activity log entries
// updateItemStatus already writes on each roll-forward. Source of truth for
// streak calculation (see utils/streak.ts) — never a separately stored count.
export function getCompletedOccurrenceDates(itemId: string): Set<string> {
  const rows = getDb().getAllSync<{ details: string | null }>(
    `SELECT details FROM activityLogs WHERE entityId = ? AND actionType = 'completed-occurrence'`,
    [itemId]
  );
  const dates = new Set<string>();
  for (const row of rows) {
    if (!row.details) continue;
    try {
      const parsed = JSON.parse(row.details) as { occurrence?: string };
      if (parsed.occurrence) dates.add(parsed.occurrence);
    } catch {
      // Malformed/legacy details row — skip rather than throw.
    }
  }
  return dates;
}

// Adds or removes a single 'completed-occurrence' log entry for an arbitrary
// date — used by the habit detail page's calendar to backfill a forgotten
// check-in or undo a mistaken one. Adding never touches item.scheduledDate
// (a pure historical backfill shouldn't move the habit's current pointer).
// Removing DOES roll item.scheduledDate back to `date` when it's currently
// ahead of it — undoing an accidental check-in via the Home widget/Habits
// list (which calls updateItemStatus, advancing scheduledDate to the next
// occurrence) must also undo that advance, or the habit would incorrectly
// stop matching "scheduled today" everywhere: dayMatchesRepeat treats
// scheduledDate as a floor (date < startDate → false), so a scheduledDate
// left stuck in the future would hide today's occurrence until real time
// caught up to it.
export function toggleHabitOccurrence(itemId: string, date: string): void {
  const rows = getDb().getAllSync<{ id: string; details: string | null }>(
    `SELECT id, details FROM activityLogs WHERE entityId = ? AND actionType = 'completed-occurrence'`,
    [itemId]
  );
  const existing = rows.find((row) => {
    if (!row.details) return false;
    try {
      return (JSON.parse(row.details) as { occurrence?: string }).occurrence === date;
    } catch {
      return false;
    }
  });
  if (existing) {
    getDb().runSync(`DELETE FROM activityLogs WHERE id = ?`, [existing.id]);
    const item = getItemWithMetadata(itemId);
    if (item?.scheduledDate && item.scheduledDate > date) {
      getDb().runSync(`UPDATE items SET scheduledDate = ?, updatedAt = ? WHERE id = ?`, [date, Date.now(), itemId]);
    }
  } else {
    logActivity(itemId, 'completed-occurrence', JSON.stringify({ occurrence: date }));
  }
}

// Quantified habit sample: one manual log entry (count/duration value +
// optional note) for a non-binary habit. Stored as 'habit-sample'
// activityLogs rows rather than a running total column, so period progress
// (utils/habitMeta.ts computeHabitPeriodProgress) is always recomputed from
// the actual events — no stale/duplicated counter to keep in sync.
export function logHabitSample(habitId: string, value: number, note?: string): void {
  logActivity(habitId, 'habit-sample', JSON.stringify({ value, note }));
}

export function getHabitSamples(habitId: string, sinceMs?: number): ActivityLog[] {
  const rows = sinceMs
    ? getDb().getAllSync<ActivityLog>(
        `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'habit-sample' AND timestamp >= ? ORDER BY timestamp DESC`,
        [habitId, sinceMs]
      )
    : getDb().getAllSync<ActivityLog>(
        `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'habit-sample' ORDER BY timestamp DESC`,
        [habitId]
      );
  return rows;
}

export function undoLastHabitSample(habitId: string): void {
  const last = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'habit-sample' ORDER BY timestamp DESC LIMIT 1`,
    [habitId]
  )[0];
  if (last) getDb().runSync(`DELETE FROM activityLogs WHERE id = ?`, [last.id]);
}

// --- Routines -----------------------------------------------------------
// A routine is an 'items' row (type='routine') with ordered 'routine-step'
// items linked via itemRelations (relationType='routine', sourceId=step,
// targetId=routine — same pattern as workout-template/workout-block). A
// live play-through is a 'routine-session' item, linked to its routine via
// relationType='routine-template'. Session progress (currentStepIndex,
// timing) lives in the session's metadata as RoutineSessionMeta — see
// utils/routineMeta.ts for the pure parsing/timing math. Routine sessions
// deliberately never write to domainContributions or potentialStat: only a
// linked habit's own maintenance math may affect Potential, so completing a
// routine never double-counts alongside a habit it happens to reference.

export function createRoutine(title: string, notes?: string): string {
  return createItem('routine', title, 'active', undefined, notes);
}

export function addRoutineStep(routineId: string, title: string, meta: RoutineStepMeta): string {
  const stepId = createItem('routine-step', title, 'active');
  updateItemMetadata(stepId, meta as unknown as Record<string, any>);
  setRelation(stepId, 'routine', routineId);
  return stepId;
}

export function updateRoutineStep(stepId: string, meta: RoutineStepMeta): void {
  updateItemMetadata(stepId, meta as unknown as Record<string, any>);
}

// Ordering reuses the app's existing manual-order table (itemOrder), same as
// WorkoutTemplateDetailScreen's blocks — not a metadata field — so the
// existing useHapticReorder drag gesture hook (which calls setManualOrder
// directly) works here unmodified.
export function getRoutineSteps(routineId: string): Item[] {
  return applyManualOrder(`routine:${routineId}`, getRelatedItems(routineId, 'routine'));
}

export function startRoutineSession(routineId: string): string {
  const routine = getItemWithMetadata(routineId);
  const sessionId = createItem('routine-session', routine?.title ?? 'Routine', 'active');
  setRelation(sessionId, 'routine-template', routineId);
  const meta: RoutineSessionMeta = { currentStepIndex: 0, stepStartedAt: Date.now(), elapsedBeforePauseMs: 0, status: 'running' };
  updateItemMetadata(sessionId, meta as unknown as Record<string, any>);
  return sessionId;
}

// Looks up an in-progress ('active' status) routine-session, optionally
// scoped to one routine. With no routineId, returns the most recent active
// session across all routines — used for app-launch/foreground recovery.
export function getActiveRoutineSession(routineId?: string): Item | null {
  const sessions = getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = 'routine-session' AND status = 'active' AND deletedAt IS NULL ORDER BY createdAt DESC`
  );
  if (!routineId) return sessions[0] ?? null;
  for (const session of sessions) {
    if (getRelation(session.id, 'routine-template') === routineId) return session;
  }
  return null;
}

export function getRoutineForSession(sessionId: string): string | null {
  return getRelation(sessionId, 'routine-template');
}

export function advanceRoutineSession(sessionId: string, opts?: { skipped?: boolean }): void {
  const session = getItemWithMetadata(sessionId);
  if (!session) return;
  const meta = parseRoutineSessionMeta(session.metadata);
  logActivity(sessionId, opts?.skipped ? 'routine-step-skipped' : 'routine-step-completed', JSON.stringify({ stepIndex: meta.currentStepIndex }));
  const nextMeta: RoutineSessionMeta = {
    ...meta,
    currentStepIndex: meta.currentStepIndex + 1,
    stepStartedAt: Date.now(),
    elapsedBeforePauseMs: 0,
  };
  updateItemMetadata(sessionId, nextMeta as unknown as Record<string, any>);
}

export function pauseRoutineSession(sessionId: string): void {
  const session = getItemWithMetadata(sessionId);
  if (!session) return;
  const meta = parseRoutineSessionMeta(session.metadata);
  if (meta.status === 'paused') return;
  const elapsed = meta.elapsedBeforePauseMs + Math.max(Date.now() - meta.stepStartedAt, 0);
  updateItemMetadata(sessionId, { ...meta, status: 'paused', elapsedBeforePauseMs: elapsed } as unknown as Record<string, any>);
}

export function resumeRoutineSession(sessionId: string): void {
  const session = getItemWithMetadata(sessionId);
  if (!session) return;
  const meta = parseRoutineSessionMeta(session.metadata);
  if (meta.status === 'running') return;
  updateItemMetadata(sessionId, { ...meta, status: 'running', stepStartedAt: Date.now() } as unknown as Record<string, any>);
}

export function addRoutineSessionStepTime(sessionId: string, extraSeconds: number): void {
  const session = getItemWithMetadata(sessionId);
  if (!session) return;
  const meta = parseRoutineSessionMeta(session.metadata);
  const existing = meta.stepOverrides?.[meta.currentStepIndex]?.extraSeconds ?? 0;
  const stepOverrides = { ...(meta.stepOverrides ?? {}), [meta.currentStepIndex]: { extraSeconds: existing + extraSeconds } };
  updateItemMetadata(sessionId, { ...meta, stepOverrides } as unknown as Record<string, any>);
}

// Does NOT write to domainContributions or touch any potentialStat linkage
// — routine completion is deliberately invisible to Potential, per the
// product brief's double-counting guardrail. Only a linked habit's own
// maintenance math (streak-based) may affect Potential.
export function finishRoutineSession(sessionId: string): void {
  updateItemStatus(sessionId, 'completed');
}

// Abandons an in-progress session without completing it — the escape hatch
// for a session that was started by mistake (e.g. a routine with no steps
// yet) or one the user simply no longer wants to resume. 'cancelled' status
// removes it from getActiveRoutineSession's 'active'-only query, same as
// 'completed' does, so it stops surfacing in the resume banner.
export function cancelRoutineSession(sessionId: string): void {
  updateItemStatus(sessionId, 'cancelled');
}

export function hasSeenRoutinesIntro(): boolean {
  return getAppSetting<boolean>('hasSeenRoutinesIntro', false);
}

export function markRoutinesIntroSeen(): void {
  setAppSetting('hasSeenRoutinesIntro', true);
}

export function isPlannedForToday(item: Item): boolean {
  if (!item.metadata) return false;
  try {
    return (JSON.parse(item.metadata) as { plannedDate?: string }).plannedDate === formatDate(new Date());
  } catch {
    return false;
  }
}

export function updateItem(
  id: string,
  // Nullable columns accept an explicit `null` to CLEAR them. Each field below
  // is gated on `!== undefined`, so `undefined` means "leave this column
  // alone" while `null` writes a real SQL NULL — that distinction is what lets
  // callers clear a deadline or repeat rule rather than silently no-op.
  updates: Partial<{
    type: Item['type'];
    title: string;
    status: Item['status'];
    notes: string | null;
    scheduledDate: string | null;
    dueDate: string | null;
    rrule: string | null;
  }>,
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
  syncItemToRemote(id);
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

export const getItemById = getItemWithMetadata;

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

export interface MedicationContainer {
  total: number;      // capacity when full/sealed
  remaining: number;  // current count left in this specific container
}

export interface MedicationMeta {
  dose?: string;
  autoStopAfterHours?: number;
  // Legacy flat count — still the source of truth for medications that never configured
  // packaging. Once `containers` is set, this becomes a derived/cached mirror of the sum
  // (see getTotalStock), kept in sync for the low-stock check and any old call sites.
  stockRemaining?: number;
  initialStock?: number;
  refillThreshold?: number;
  lastTakenAt?: number;
  maxPerDay?: number;
  minHoursBetweenDoses?: number;
  frequency?: string;

  // Split-dose support (e.g. Modafinil: take half now, the other half later with
  // no required gap). Opt-in per medication since most meds are taken whole.
  splitDoseEnabled?: boolean;
  // Set when the first half has been taken and the second is still owed; cleared
  // once the second half is logged. While set, minHoursBetweenDoses is bypassed
  // for completing this specific dose.
  pendingHalfDoseAt?: number;

  // Packaging: how a single restock breaks down for this medication, e.g. Dexamfetamine
  // restocks as 2 boxes of 30 (3 sheets of 10 each); Elvanse restocks as 1 container of 30.
  containerLabel?: string;        // e.g. 'box', 'container' — defaults to 'container'
  containerSize?: number;         // pills per container when full
  containersPerRestock?: number;  // how many containers one restock adds, defaults to 1
  sheetsPerContainer?: number;    // purely descriptive breakdown, optional
  pillsPerSheet?: number;         // purely descriptive breakdown, optional
  packagingNote?: string;         // free text for one-off quirks, e.g. "28 + 2 topper blister"
  containers?: MedicationContainer[]; // real inventory instances, oldest/open-first
}

// Total pills across all containers, falling back to the legacy flat count for medications
// that haven't configured packaging.
export function getTotalStock(meta: MedicationMeta): number {
  if (meta.containers) return meta.containers.reduce((sum, c) => sum + c.remaining, 0);
  return meta.stockRemaining ?? 0;
}

export interface StockBreakdownSheet {
  total: number;
  remaining: number;
}

export interface StockBreakdownContainer {
  total: number;
  remaining: number;
  sheets?: StockBreakdownSheet[];
}

export interface StockBreakdown {
  current: number;   // pills held right now
  capacity: number;  // what a full restock represents (containerSize * containersPerRestock)
  containers: StockBreakdownContainer[]; // always padded out to containersPerRestock slots
}

// Projects the medication's held stock against its *configured* full-restock shape — even
// before a restock ever happens, an empty/never-restocked container still shows as an empty
// slot (e.g. Elvanse's single 30-pill container shows 0/30 instead of nothing). Sheets are
// derived, not stored: pills are assumed consumed front-to-back (the in-use sheet drains
// first, later sheets stay full until reached).
export function getStockBreakdown(meta: MedicationMeta): StockBreakdown | null {
  if (!meta.containerSize && (!meta.containers || meta.containers.length === 0)) return null;

  const containerSize = meta.containerSize ?? meta.containers![0].total;
  const perRestock = meta.containersPerRestock ?? 1;
  const real = meta.containers ?? [];
  const slots = Math.max(perRestock, real.length);

  const containers: StockBreakdownContainer[] = Array.from({ length: slots }, (_, i) => {
    const c = real[i] ?? { total: containerSize, remaining: 0 };
    if (!meta.sheetsPerContainer || !meta.pillsPerSheet) return c;

    let consumed = c.total - c.remaining;
    const sheets: StockBreakdownSheet[] = Array.from({ length: meta.sheetsPerContainer! }, () => {
      const taken = Math.max(0, Math.min(meta.pillsPerSheet!, consumed));
      consumed -= taken;
      return { total: meta.pillsPerSheet!, remaining: meta.pillsPerSheet! - taken };
    });
    return { ...c, sheets };
  });

  return {
    current: containers.reduce((sum, c) => sum + c.remaining, 0),
    capacity: containers.reduce((sum, c) => sum + c.total, 0),
    containers,
  };
}

// Compact display string, e.g. "23/60 · 23/30 (3/10+10/10+10/10) + 0/30 (0/10+0/10+0/10)".
// The top fraction alone is shown when there's only one container and no sheet breakdown.
export function getContainerSummary(meta: MedicationMeta): string | null {
  const breakdown = getStockBreakdown(meta);
  if (!breakdown) return null;
  const { current, capacity, containers } = breakdown;
  const top = `${current}/${capacity}`;
  const showDetail = containers.length > 1 || containers.some(c => c.sheets);
  if (!showDetail) return top;

  const containerParts = containers.map(c => {
    if (c.sheets) {
      const sheetParts = c.sheets.map(s => `${s.remaining}/${s.total}`).join('+');
      return `${c.remaining}/${c.total} (${sheetParts})`;
    }
    return `${c.remaining}/${c.total}`;
  });
  return `${top} · ${containerParts.join(' + ')}`;
}

// Decrements `amount` pills (1 for a whole dose, 0.5 for a split half) from the first
// non-empty container (oldest/open one first). Falls back to the legacy flat decrement
// for medications without configured packaging.
function decrementStock(meta: MedicationMeta, amount = 1): MedicationMeta {
  if (meta.containers) {
    const containers = meta.containers.map(c => ({ ...c }));
    const target = containers.find(c => c.remaining > 0);
    if (target) target.remaining = Math.max(0, target.remaining - amount);
    return { ...meta, containers, stockRemaining: containers.reduce((sum, c) => sum + c.remaining, 0) };
  }
  if (meta.stockRemaining !== undefined && meta.stockRemaining > 0) {
    return { ...meta, stockRemaining: Math.max(0, meta.stockRemaining - amount) };
  }
  return meta;
}

// The additive restock fix: adds new full containers rather than overwriting the count.
// containerCount defaults to the medication's configured containersPerRestock (or 1).
export function restockMedication(itemId: string, containerCount?: number): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};

  if (!meta.containerSize) {
    // No packaging configured — fall back to a flat additive bump using containerSize-less
    // legacy behavior: just add containerCount (interpreted as raw pill count) to the total.
    const amount = containerCount ?? 0;
    const updated = { ...meta, stockRemaining: (meta.stockRemaining ?? 0) + amount };
    updateItemMetadata(itemId, updated);
    logActivity(itemId, 'restocked', JSON.stringify({ amount }));
    return;
  }

  const count = containerCount ?? meta.containersPerRestock ?? 1;
  const newContainers: MedicationContainer[] = Array.from({ length: count }, () => ({
    total: meta.containerSize!,
    remaining: meta.containerSize!,
  }));
  const containers = [...(meta.containers ?? []), ...newContainers];
  const updated = { ...meta, containers, stockRemaining: containers.reduce((sum, c) => sum + c.remaining, 0) };
  updateItemMetadata(itemId, updated);
  logActivity(itemId, 'restocked', JSON.stringify({ containers: count, containerSize: meta.containerSize }));
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
  autoStopAfterMs?: number;
  autoStopNotificationId?: string;
  completedElapsedMs?: number;
  timerStoppedReason?: 'manual' | 'automatic';
}

export interface TimerWidgetPreferences {
  presentation: TimerWidgetPresentation;
  resumePresentation?: VisibleTimerWidgetPresentation;
  position?: { x: number; y: number };
  pinned?: boolean;
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
}

export function parseMedicationTimerDetails(details?: string | null): MedicationTimerDetails {
  if (!details) return {};
  try {
    return JSON.parse(details) as MedicationTimerDetails;
  } catch {
    return {};
  }
}

const parseDetails = parseMedicationTimerDetails;

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
  const serialized = JSON.stringify(value);
  getDb().runSync(
    `INSERT INTO appSettings (key, value, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    [key, serialized, now]
  );
  const userId = getCurrentSyncUserId();
  if (userId) {
    pushAppSettingToFirestore(userId, key, serialized).catch(() => {});
  }
}

export function getMedications(): Item[] {
  return getItemsByType('medication');
}

export function createMedication(title: string, meta: MedicationMeta): string {
  const id = uuid();
  const now = Date.now();
  const initial = meta.initialStock ?? meta.stockRemaining ?? 0;
  const metadata: MedicationMeta = meta.containerSize
    ? { ...meta, containers: initial > 0 ? [{ total: meta.containerSize, remaining: initial }] : [], stockRemaining: initial }
    : { ...meta, stockRemaining: initial };
  getDb().runSync(
    `INSERT INTO items (id, type, title, status, metadata, createdAt, updatedAt)
     VALUES (?, 'medication', ?, 'active', ?, ?, ?)`,
    [id, title, JSON.stringify(metadata), now, now]
  );
  logActivity(id, 'created');
  syncItemToRemote(id);
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

export function logMedicationTaken(itemId: string, takenAt: number = Date.now(), startTimer = false, amount = 1): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  let meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};

  // Only update lastTakenAt if this dose is more recent than the recorded one
  if (!meta.lastTakenAt || takenAt > meta.lastTakenAt) {
    meta.lastTakenAt = takenAt;
  }
  meta = decrementStock(meta, amount);
  updateItemMetadata(itemId, meta);

  // Insert log with the actual taken timestamp
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
     VALUES (?, ?, 'medication-taken', ?, ?, ?)`,
    [uuid(), itemId, takenAt, JSON.stringify({
      dose: meta.dose,
      amount,
      loggedAt: now,
      timerActive: startTimer,
      startedAt: startTimer ? takenAt : undefined,
      accumulatedMs: 0,
      autoStopAfterMs: startTimer ? resolveAutoStopAfterMs(meta.autoStopAfterHours) : undefined,
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

// Logs half a dose for medications with splitDoseEnabled. The first call starts a pending
// split (half taken, half owed); the second call — at any time afterward, no minimum gap —
// completes it. Returns whether this call completed a pending split (vs. starting a new one),
// so the caller can show the right confirmation/haptic.
export function logHalfDoseTaken(itemId: string, takenAt: number = Date.now(), startTimer = false): boolean {
  const item = getItemWithMetadata(itemId);
  if (!item) return false;
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const completingSplit = !!meta.pendingHalfDoseAt;

  logMedicationTaken(itemId, takenAt, startTimer, 0.5);

  const updated = getItemWithMetadata(itemId);
  const updatedMeta: MedicationMeta = updated?.metadata ? JSON.parse(updated.metadata) : {};
  updatedMeta.pendingHalfDoseAt = completingSplit ? undefined : takenAt;
  updateItemMetadata(itemId, updatedMeta);

  return completingSplit;
}

export function getMedicationLogs(itemId: string, limit = 10): ActivityLog[] {
  return getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'medication-taken' ORDER BY timestamp DESC LIMIT ?`,
    [itemId, limit]
  );
}

// Per-day dose count over the trailing window. There's no per-day dose-schedule model yet
// (medications don't carry an rrule), so this can't say whether a count is "enough" — it only
// reports what's known: how many times a dose was logged on each calendar day.
export function getMedicationDoseHistory(itemId: string, days = 7): Array<{ date: string; count: number }> {
  const logs = getMedicationLogs(itemId, days * 3);
  return countDosesByDay(logs.map(log => log.timestamp), days);
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

function pushActivityLogUpdate(log: ActivityLog, details: MedicationTimerDetails): void {
  const userId = getCurrentSyncUserId();
  if (!userId) return;
  pushActivityLogToFirestore(userId, { ...log, details: JSON.stringify(details) }).catch(() => {});
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
  pushActivityLogUpdate(log, details);
  _syncLastTakenAt(itemId);
}

export function completeMedicationTimer(
  logId: string,
  itemId: string,
  completedElapsedMs: number,
  reason: 'manual' | 'automatic'
): void {
  const log = getDb().getAllSync<ActivityLog>(`SELECT * FROM activityLogs WHERE id = ? LIMIT 1`, [logId])[0];
  if (!log) return;
  const details = parseDetails(log.details);
  if (details.stoppedAt && details.timerStoppedReason) return;
  details.timerActive = false;
  delete details.pausedAt;
  details.accumulatedMs = completedElapsedMs;
  details.completedElapsedMs = completedElapsedMs;
  details.timerStoppedReason = reason;
  details.stoppedAt = Date.now();
  delete details.autoStopNotificationId;
  getDb().runSync(`UPDATE activityLogs SET details = ? WHERE id = ?`, [JSON.stringify(details), logId]);
  pushActivityLogUpdate(log, details);
  _syncLastTakenAt(itemId);
}

export function setMedicationTimerNotificationId(logId: string, notificationId?: string): void {
  const log = getDb().getAllSync<ActivityLog>(`SELECT * FROM activityLogs WHERE id = ? LIMIT 1`, [logId])[0];
  if (!log) return;
  const details = parseDetails(log.details);
  if (notificationId) details.autoStopNotificationId = notificationId;
  else delete details.autoStopNotificationId;
  getDb().runSync(`UPDATE activityLogs SET details = ? WHERE id = ?`, [JSON.stringify(details), logId]);
  pushActivityLogUpdate(log, details);
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
  pushActivityLogUpdate(log, details);
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
  pushActivityLogUpdate(log, details);
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
  pushActivityLogUpdate(log, details);
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
  pushActivityLogUpdate(log, details);
  _syncLastTakenAt(itemId);
}

// Attaches a timer to a dose that was already logged without one (e.g. forgot to tap
// "Take + Start Timer" at the time). Starts counting from when the dose was actually
// taken (the log's own timestamp), not from now, so the elapsed time is accurate rather
// than restarting from zero.
export function startTimerFromLoggedDose(logId: string, itemId: string): void {
  const log = getDb().getAllSync<ActivityLog>(`SELECT * FROM activityLogs WHERE id = ? LIMIT 1`, [logId])[0];
  if (!log) return;
  const details = parseDetails(log.details);
  const item = getItemWithMetadata(itemId);
  const meta: MedicationMeta = item?.metadata ? JSON.parse(item.metadata) : {};
  details.timerActive = true;
  details.startedAt = log.timestamp;
  details.accumulatedMs = 0;
  details.autoStopAfterMs = resolveAutoStopAfterMs(meta.autoStopAfterHours);
  delete details.pausedAt;
  delete details.stoppedAt;
  details.notified = false;
  getDb().runSync(
    `UPDATE activityLogs SET details = ? WHERE id = ?`,
    [JSON.stringify(details), logId]
  );
  pushActivityLogUpdate(log, details);
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

export function getTimelineEntriesForDate(date: string): TimelineEntry[] {
  return buildTimelineEntries(getItemsForDate(date), getInstancesForDate(date));
}

// Lightweight per-day counts for a date range (month-grid badges) — counts distinct
// scheduled items per day across both items.scheduledDate and itemInstances.scheduledDate,
// not the full TimelineEntry shape getTimelineEntriesForDate builds, since the grid only
// needs a badge count.
export function getItemCountsForRange(startDate: string, endDate: string): Record<string, number> {
  const rows = getDb().getAllSync<{ date: string; count: number }>(
    `SELECT date, COUNT(DISTINCT id) as count FROM (
       SELECT scheduledDate as date, id FROM items
         WHERE scheduledDate BETWEEN ? AND ? AND deletedAt IS NULL
       UNION ALL
       SELECT scheduledDate as date, itemId as id FROM itemInstances
         WHERE scheduledDate BETWEEN ? AND ?
     ) GROUP BY date`,
    [startDate, endDate, startDate, endDate]
  );
  return Object.fromEntries(rows.map((row) => [row.date, row.count]));
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
  syncItemToRemote(id);
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
  const nextMeta = { time: normalizedTime, timeOfDay, preferredTimeBucket: 'anytime', durationMinutes: 45 };
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
  const preferredTimeBucket = meta.preferredTimeBucket ?? meta.timeOfDay ?? 'anytime';
  updateItemMetadata(id, {
    ...meta,
    time: normalizedTime,
    timeOfDay: nextTimeOfDay,
    preferredTimeBucket,
  });

  const instance = getDb().getAllSync<ItemInstance>(
    `SELECT * FROM itemInstances WHERE itemId = ? AND scheduledDate = ? ORDER BY createdAt DESC LIMIT 1`,
    [id, item.scheduledDate ?? '']
  )[0];

  if (instance) {
    const parsed = instance.instanceMetadata ? JSON.parse(instance.instanceMetadata) : {};
    const instancePreferredTimeBucket = parsed.preferredTimeBucket ?? preferredTimeBucket;
    updateInstanceMetadata(instance.id, {
      ...parsed,
      time: normalizedTime,
      timeOfDay: nextTimeOfDay,
      preferredTimeBucket: instancePreferredTimeBucket,
    });
  }
}

export function updateTimelineItemSchedule(id: string, scheduledDate?: string, time?: string): void {
  const item = getItemWithMetadata(id);
  if (!item) return;

  const metadata: Record<string, unknown> = item.metadata ? JSON.parse(item.metadata) : {};
  const now = Date.now();

  if (!scheduledDate) {
    delete metadata.time;
    delete metadata.timeOfDay;
    getDb().runSync(
      `UPDATE items SET scheduledDate = NULL, status = ?, metadata = ?, updatedAt = ? WHERE id = ?`,
      [item.status === 'scheduled' ? 'active' : item.status, JSON.stringify(metadata), now, id],
    );
    getDb().runSync(
      `DELETE FROM itemInstances WHERE itemId = ? AND status = 'pending'`,
      [id],
    );
    syncItemToRemote(id);
    return;
  }

  if (!time) {
    // Date-only: keep the date, drop the time-of-day and any pending timed
    // instance that went with it, but don't clear the date itself.
    delete metadata.time;
    delete metadata.timeOfDay;
    getDb().runSync(
      `UPDATE items SET scheduledDate = ?, status = 'scheduled', metadata = ?, updatedAt = ? WHERE id = ?`,
      [scheduledDate, JSON.stringify(metadata), now, id],
    );
    getDb().runSync(
      `DELETE FROM itemInstances WHERE itemId = ? AND status = 'pending'`,
      [id],
    );
    syncItemToRemote(id);
    return;
  }

  const normalizedTime = normalizeTimeInput(time);
  if (!normalizedTime) return;
  const timeOfDay = getTimeOfDayFromHour(Math.floor(timeToMinutes(normalizedTime)! / 60));
  const preferredTimeBucket = metadata.preferredTimeBucket ?? metadata.timeOfDay ?? 'anytime';
  const nextMetadata = { ...metadata, time: normalizedTime, timeOfDay, preferredTimeBucket };

  getDb().runSync(
    `UPDATE items SET scheduledDate = ?, status = 'scheduled', metadata = ?, updatedAt = ? WHERE id = ?`,
    [scheduledDate, JSON.stringify(nextMetadata), now, id],
  );
  syncItemToRemote(id);

  const instance = getDb().getAllSync<ItemInstance>(
    `SELECT * FROM itemInstances WHERE itemId = ? AND status = 'pending' ORDER BY createdAt DESC LIMIT 1`,
    [id],
  )[0];

  if (instance) {
    const instanceMetadata = instance.instanceMetadata ? JSON.parse(instance.instanceMetadata) : {};
    const instancePreferredTimeBucket = instanceMetadata.preferredTimeBucket ?? preferredTimeBucket;
    getDb().runSync(
      `UPDATE itemInstances SET scheduledDate = ?, instanceMetadata = ?, updatedAt = ? WHERE id = ?`,
      [scheduledDate, JSON.stringify({ ...instanceMetadata, time: normalizedTime, timeOfDay, preferredTimeBucket: instancePreferredTimeBucket }), now, instance.id],
    );
  } else {
    getDb().runSync(
      `INSERT INTO itemInstances (id, itemId, scheduledDate, status, instanceMetadata, createdAt, updatedAt)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
      [uuid(), id, scheduledDate, JSON.stringify({ time: normalizedTime, timeOfDay }), now, now],
    );
  }
}

export function updateItemStatus(id: string, status: Item['status']): void {
  const now = Date.now();

  // A repeating task is never "done" — completing one occurrence logs it and
  // rolls the task forward to its next matching date, Things 3 style. Handled
  // here so every completion path in the app inherits it.
  if (status === 'completed') {
    const item = getItemWithMetadata(id);
    const next = item ? nextOccurrenceDate(item.rrule, item.scheduledDate ?? formatDate(new Date())) : null;
    if (item && next) {
      getDb().runSync(
        `UPDATE items SET scheduledDate = ?, status = ?, completedAt = NULL, updatedAt = ? WHERE id = ?`,
        [next, 'active', now, id]
      );
      logActivity(id, 'completed-occurrence', JSON.stringify({ occurrence: item.scheduledDate, next }));
      syncItemToRemote(id);
      return;
    }
  }

  getDb().runSync(
    `UPDATE items SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?`,
    [status, status === 'completed' ? now : null, now, id]
  );
  logActivity(id, 'status-changed', JSON.stringify({ status }));
  syncItemToRemote(id);
}

export function deleteItem(id: string): void {
  getDb().runSync(
    `UPDATE items SET deletedAt = ?, updatedAt = ? WHERE id = ?`,
    [Date.now(), Date.now(), id]
  );
  syncItemToRemote(id);
}

export type GtdDestination =
  | 'today' | 'morning' | 'evening'
  | 'project' | 'area' | 'habit' | 'medication' | 'object'
  | 'reference' | 'someday' | 'delete';

export function processInboxItem(id: string, destination: GtdDestination): void {
  const db = getDb();
  const now = Date.now();
  const today = formatDate(new Date());

  if (destination === 'delete') {
    db.runSync('UPDATE items SET deletedAt = ?, updatedAt = ? WHERE id = ?', [now, now, id]);
    syncItemToRemote(id);
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
        'UPDATE items SET type = ?, status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['project', 'active', JSON.stringify({ ...meta, gtdContext: 'project' }), now, id]
      );
      break;
    case 'area':
      db.runSync(
        'UPDATE items SET type = ?, status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['area', 'active', JSON.stringify({ ...meta, gtdContext: 'area' }), now, id]
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
    case 'object':
      db.runSync(
        'UPDATE items SET type = ?, status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['object', 'active', JSON.stringify({ ...meta, gtdContext: 'object', objectStatus: 'want' }), now, id]
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
        ['someday', JSON.stringify({ ...meta, gtdContext: 'someday' }), now, id]
      );
      break;
  }
  logActivity(id, 'status-changed', JSON.stringify({ destination }));
  syncItemToRemote(id);
}

// Confirmed Task-branch decision from Inbox Triage Mode (see useTriageSession).
// Three separate writes, same composable pattern saveItemDraft already uses
// (updateItem for status/scheduledDate, updateItemMetadata for the metadata
// blob, setRelation for the project link) rather than processInboxItem's
// single-statement style — triage has richer combined state than a single
// GTD destination.
export function applyTaskTriage(
  id: string,
  decision: {
    priority: 'low' | 'medium' | 'high';
    when: 'today' | 'tomorrow' | 'week' | 'someday';
    projectId: string | null;
  },
): void {
  const item = getItemWithMetadata(id);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  meta.priority = decision.priority;

  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  switch (decision.when) {
    case 'today':
      updateItem(id, { status: 'active', scheduledDate: today });
      break;
    case 'tomorrow':
      updateItem(id, { status: 'active', scheduledDate: tomorrow });
      break;
    case 'week':
      meta.gtdContext = 'week';
      updateItem(id, { status: 'active', scheduledDate: null });
      break;
    case 'someday':
      updateItem(id, { status: 'someday', scheduledDate: null });
      break;
  }

  updateItemMetadata(id, meta);
  setRelation(id, 'project', decision.projectId);
  logActivity(id, 'status-changed', JSON.stringify({ destination: 'triage-task', ...decision }));
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

export function logActivity(entityId: string, actionType: string, details?: string): string {
  const id = uuid();
  const now = Date.now();
  const serializedDetails = stringifyDetails(details) ?? undefined;
  getDb().runSync(
    `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entityId, actionType, now, serializedDetails ?? null, now]
  );
  const userId = getCurrentSyncUserId();
  if (userId) {
    pushActivityLogToFirestore(userId, {
      id,
      entityId,
      actionType,
      timestamp: now,
      details: serializedDetails,
      createdAt: now,
    }).catch(() => {});
  }
  return id;
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

// A logged workout occurrence. Optionally related to a workout-template
// (relationType 'workout-template') when started from one; freeform sessions
// have no such relation row. Status flows 'active' -> 'completed'.
export function startWorkoutSession(templateId?: string | null): string {
  const title = templateId ? (getItemWithMetadata(templateId)?.title ?? 'Workout') : 'Freeform Workout';
  const sessionId = createItem('workout-session', title, 'active');
  if (templateId) setRelation(sessionId, 'workout-template', templateId);
  return sessionId;
}

export interface LogWorkoutSetInput {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
  weightUnit?: string;
}

// entityId = exerciseId (not sessionId) so "what did I do last time for this
// exercise" is a direct, single-column lookup across every session ever logged.
export function logWorkoutSet(input: LogWorkoutSetInput): string {
  return logActivity(
    input.exerciseId,
    'workout-set-logged',
    JSON.stringify({
      sessionId: input.sessionId,
      setNumber: input.setNumber,
      reps: input.reps,
      weight: input.weight,
      weightUnit: input.weightUnit ?? 'kg',
    })
  );
}

export function finishWorkoutSession(sessionId: string): void {
  updateItemStatus(sessionId, 'completed');
}

export function getLastSessionSetsForExercise(exerciseId: string, excludeSessionId?: string): WorkoutSetDetails[] {
  const logs = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'workout-set-logged' ORDER BY timestamp DESC LIMIT 200`,
    [exerciseId]
  );
  return getMostRecentSessionSets(logs, excludeSessionId);
}
