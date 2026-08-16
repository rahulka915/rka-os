import * as SQLite from 'expo-sqlite';
import { Item, ItemInstance, ActivityLog, DomainContributionRow, AttributeContributionRow, DailyCheckInRow } from './types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getTimeOfDayFromHour, normalizeTimeInput, timeToMinutes, type TimeOfDay } from '../utils/time';
import { resolveAutoStopAfterMs } from '../domain/medicationTimer/timerMath';
import { nextOccurrenceDate, parseRepeatRule, dayMatchesRepeat } from '../utils/repeat';
import { countDosesByDay } from '../utils/medicationDoseHistory';
import { sumNutrientLogs, type NutrientProfile } from '../utils/nutrientTotals';
import { buildTimelineEntries, type TimelineEntry } from './timelineEntry';
import type { WorkoutSetDetails } from '../utils/workoutSet';
import { getMostRecentSessionSets } from '../utils/workoutSet';
import { computePotentialStats, parseHabitPotentialMeta, type PotentialStatResult } from '../utils/potential';
import { parseHabitMeta, computeHabitPeriodProgress, periodWindow } from '../utils/habitMeta';
import { parseAttributeContributions, type AttributeContributionConfig, type AttributeEvidence, type AttributeWeight } from '../utils/attributes';
import { computeAttributeValue, DEFAULT_ATTRIBUTE_SCORING_CONFIG, type AttributeScoringConfig } from '../utils/attributeScoring';
import { computeAlertness as computeAlertnessValue, type AlertnessInputs } from '../utils/alertness';
import {
  primaryEntityId,
  parseActionRow,
  actionSubtitle,
  buildActionFeed,
  type ActionDetails,
  type ActionRow,
  type LogActionInput,
  type FeedEntry,
  type FeedSource,
} from '../utils/actions';
import {
  domainScore,
  domainMaintenance,
  NO_PILLAR_MAINTENANCE_BASELINE,
  overallPotential,
  MISSION_CONTRIBUTION_DEFAULTS,
  ACHIEVEMENT_CONTRIBUTION_DEFAULTS,
  SKILL_CONTRIBUTION_DEFAULTS,
} from '../utils/domainScoring';
import {
  parseRoutineStepMeta,
  parseRoutineSessionMeta,
  type RoutineStepMeta,
  type RoutineSessionMeta,
} from '../utils/routineMeta';
import { parseBackwardPlanMeta, type BackwardPlanMeta, type PlacementBehavior, type TravelConfig } from '../utils/backwardPlanMeta';
import type { DailyCheckInAnswers, DailyCheckInPhase } from '../utils/dailyCheckIn';
import type { PlanBlockRow, PlanBlockStepRow } from './types';

// Re-exported so `import type { TimelineEntry } from '../db/database'` keeps
// working for CalendarScreen and useDb.
export type { TimelineEntry } from './timelineEntry';

import { getCurrentSyncUserId, pushItemToFirestore, pushItemRelationToFirestore, deleteItemRelationFromFirestore, pushItemOrderBatchToFirestore, pushAppSettingToFirestore, pushActivityLogToFirestore } from '../services/firestoreSync';

let db: SQLite.SQLiteDatabase;

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function logDevTiming(label: string, startedAt: number): void {
  if (!__DEV__) return;
  const elapsed = Math.round(nowMs() - startedAt);
  if (elapsed >= 8) console.warn(`[startup-perf] ${label} took ${elapsed}ms`);
}

export function syncItemToRemote(id: string): void {
  const userId = getCurrentSyncUserId();
  if (!userId) return;
  const item = getItemWithMetadata(id);
  if (item) {
    pushItemToFirestore(userId, item).catch(() => {});
  }
}

// __DEV__-only guardrail: every synchronous SQLite call blocks the single JS
// thread that also handles taps and rendering, so any one that runs long is a
// direct source of the lag this app must never have. We wrap the sync methods
// once, at the single chokepoint every query already funnels through, and warn
// (with the offending SQL) whenever a call exceeds one frame (~16ms). This is
// a development tripwire — it catches N+1s, unbounded scans, and huge-batch
// applies the moment they're written, instead of months later on a full DB.
// Compiled out entirely in production (the `if (!__DEV__) return` short-circuit
// leaves the raw native object untouched).
function instrumentDbForDev(rawDb: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  if (!__DEV__) return rawDb;
  const SLOW_MS = 16;
  const methods = ['getAllSync', 'getFirstSync', 'runSync', 'execSync', 'withTransactionSync'] as const;
  for (const method of methods) {
    const original = (rawDb as any)[method];
    if (typeof original !== 'function') continue;
    (rawDb as any)[method] = function instrumented(this: unknown, ...args: any[]) {
      const start = nowMs();
      try {
        return original.apply(this, args);
      } finally {
        const elapsed = nowMs() - start;
        if (elapsed >= SLOW_MS) {
          const label = typeof args[0] === 'string' ? args[0].replace(/\s+/g, ' ').trim().slice(0, 140) : method;
          console.warn(`[db-perf] ${method} blocked the JS thread ${Math.round(elapsed)}ms — ${label}`);
        }
      }
    };
  }
  return rawDb;
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    const bootStart = nowMs();
    let stepStart = bootStart;
    db = SQLite.openDatabaseSync('rka-os.db');
    logDevTiming('SQLite.openDatabaseSync', stepStart);
    stepStart = nowMs();
    // Default rollback-journal mode fsyncs the main DB file on every COMMIT —
    // a fixed ~15-25ms cost per write transaction on iOS flash regardless of
    // transaction size (confirmed: a single-row INSERT blocked the thread as
    // long as a multi-row chunk). WAL only appends to a separate -wal file on
    // commit and checkpoints back to the main file periodically instead, so
    // writes stop paying a synchronous fsync tax on the JS thread.
    db.execSync('PRAGMA journal_mode = WAL;');
    logDevTiming('PRAGMA journal_mode=WAL', stepStart);
    stepStart = nowMs();
    initSchema();
    logDevTiming('initSchema', stepStart);
    stepStart = nowMs();
    migratePotentialStats();
    logDevTiming('migratePotentialStats', stepStart);
    stepStart = nowMs();
    retireDroppedDomains();
    seedInitialAttributes();
    logDevTiming('attributesMigration', stepStart);
    logDevTiming('getDb cold init', bootStart);
    // Instrument after one-time schema/migration work so steady-state queries
    // are what's measured, not the legitimately heavier first-boot setup.
    db = instrumentDbForDev(db);
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

    CREATE TABLE IF NOT EXISTS dailyCheckIns (
      id TEXT PRIMARY KEY,
      dateKey TEXT NOT NULL,
      phase TEXT NOT NULL,
      answers TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(dateKey, phase)
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

    -- Many-to-many association between a 'potential-attribute' item (Strength,
    -- Stamina, ...) and a Domain — display/context only, deliberately NOT a
    -- scoring input (see src/utils/attributes.ts). itemRelations enforces one
    -- target per (sourceId, relationType), which is wrong for this — an
    -- Attribute can relate to more than one Domain, so this is a plain join
    -- table instead of reusing itemRelations.
    CREATE TABLE IF NOT EXISTS attributeDomains (
      attributeId TEXT NOT NULL,
      areaId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (attributeId, areaId)
    );

    -- Evidence log for the Potential Attribute system (see
    -- src/utils/attributes.ts) — one row per piece of real-world evidence
    -- (a Habit occurrence, a logged Action) that a given Attribute happened.
    -- Deliberately separate from whatever formula eventually turns this into
    -- a live Attribute value: this table only records what happened and how
    -- strong the evidence was (weight), never a computed score, so the
    -- progression/decay model can be designed and re-tuned later without
    -- touching or replaying this history.
    CREATE TABLE IF NOT EXISTS attributeContributions (
      id TEXT PRIMARY KEY,
      attributeId TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      weight TEXT NOT NULL,
      fraction REAL,
      occurredAt INTEGER NOT NULL,
      excludedAt INTEGER,
      createdAt INTEGER NOT NULL
    );

    -- Plan Backwards: a plan revolves around one anchor 'backward-plan' item
    -- (see items.type) whose metadata holds Goal/Start/Expected/Latest/End
    -- time + location + an optional device-calendar event reference (never
    -- written back to — see services/deviceCalendar.ts). Its ordered plan
    -- blocks (routine/task/travel) live here rather than as 'items' rows,
    -- since a block's placement/buffer/completion is plan-instance-specific
    -- and must never leak back into a reusable routine template (see
    -- planBlockSteps below, and addPlanBlockRoutine's copy-not-link
    -- instantiation).
    CREATE TABLE IF NOT EXISTS planBlocks (
      id TEXT PRIMARY KEY,
      planId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      orderIndex INTEGER NOT NULL DEFAULT 0,
      placement TEXT NOT NULL DEFAULT 'auto',
      bufferMinutes INTEGER,
      durationMinutes INTEGER,
      actualMinutes INTEGER,
      routineTemplateId TEXT,
      linkedItemId TEXT,
      completedAt INTEGER,
      travelConfig TEXT,
      notes TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    -- Plan-instance steps for a 'routine'-type planBlock, copied from the
    -- routine template's routine-step items when the routine is added to a
    -- plan (see addPlanBlockRoutine). templateStepId is a soft, non-live
    -- reference kept only so a future duration-learning pass can trace a
    -- step instance back to its template step — completing/editing a step
    -- here never mutates the template, and vice versa.
    CREATE TABLE IF NOT EXISTS planBlockSteps (
      id TEXT PRIMARY KEY,
      blockId TEXT NOT NULL,
      templateStepId TEXT,
      title TEXT NOT NULL,
      estimatedMinutes INTEGER NOT NULL,
      actualMinutes INTEGER,
      orderIndex INTEGER NOT NULL DEFAULT 0,
      placement TEXT NOT NULL DEFAULT 'auto',
      completedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_status_deleted_created ON items(status, deletedAt, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_items_type_deleted_status_created ON items(type, deletedAt, status, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_items_task_unscheduled ON items(type, status, deletedAt, scheduledDate, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_items_completed_logbook ON items(status, deletedAt, completedAt DESC, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_items_scheduledDate ON items(scheduledDate);
    CREATE INDEX IF NOT EXISTS idx_instances_scheduledDate ON itemInstances(scheduledDate);
    CREATE INDEX IF NOT EXISTS idx_instances_itemId ON itemInstances(itemId);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON itemRelations(targetId, relationType);
    CREATE INDEX IF NOT EXISTS idx_itemOrder_list ON itemOrder(listKey);
    CREATE INDEX IF NOT EXISTS idx_domainContributions_area ON domainContributions(areaId);
    CREATE INDEX IF NOT EXISTS idx_domainContributions_source ON domainContributions(sourceType, sourceId);
    CREATE INDEX IF NOT EXISTS idx_attributeDomains_area ON attributeDomains(areaId);
    CREATE INDEX IF NOT EXISTS idx_attributeContributions_attribute ON attributeContributions(attributeId);
    CREATE INDEX IF NOT EXISTS idx_attributeContributions_source ON attributeContributions(sourceType, sourceId);
    CREATE INDEX IF NOT EXISTS idx_activityLogs_entity ON activityLogs(entityId, actionType);
    CREATE INDEX IF NOT EXISTS idx_activityLogs_action_timestamp ON activityLogs(actionType, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_activityLogs_entity_action_timestamp ON activityLogs(entityId, actionType, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_dailyCheckIns_date ON dailyCheckIns(dateKey);
    CREATE INDEX IF NOT EXISTS idx_planBlocks_plan ON planBlocks(planId);
    CREATE INDEX IF NOT EXISTS idx_planBlockSteps_block ON planBlockSteps(blockId);
  `);

  try {
    db.execSync(`ALTER TABLE items ADD COLUMN completedAt INTEGER`);
  } catch {
    // Column already exists on this device's DB — safe to ignore.
  }

  // Added 2026-08-15 for measurable (count/duration) Habit evidence — see
  // recordHabitProgressEvidence. A device whose attributeContributions table
  // predates this column needs it added; a fresh install already has it from
  // the CREATE TABLE above, so this ALTER harmlessly no-ops there.
  try {
    db.execSync(`ALTER TABLE attributeContributions ADD COLUMN fraction REAL`);
  } catch {
    // Column already exists on this device's DB — safe to ignore.
  }

  // One-time fix-up for a bug where Domains created during onboarding never
  // got an explicit status and fell back to createItem's 'inbox' default —
  // silently landing structural Domain items in the Inbox triage queue
  // alongside genuinely unprocessed captures. Domains are never a capture
  // type, so any 'area' item still sitting in 'inbox' gets normalized to
  // 'active'. Idempotent — a no-op once no rows match.
  db.execSync(`UPDATE items SET status = 'active', updatedAt = ${Date.now()} WHERE type = 'area' AND status = 'inbox'`);

  // Retroactively mark pre-existing Domains as canonical (mandatory,
  // undeletable) for devices that onboarded before that flag existed —
  // matched by exact title against the same 8-Domain baseline OnboardingScreen
  // creates today (see CANONICAL_DOMAIN_TITLES). A Domain already renamed
  // away from its default title won't match and stays a regular, deletable
  // Domain — this is a best-effort backfill, not a guarantee for every
  // pre-existing install. Plain JS over existing rows (matching how metadata
  // is read/written everywhere else in this file) rather than SQL JSON
  // functions, which aren't used elsewhere and may not be available.
  const existingAreas = db.getAllSync<{ id: string; title: string; metadata: string | null }>(
    `SELECT id, title, metadata FROM items WHERE type = 'area' AND deletedAt IS NULL`
  );
  const alreadyHasCanonical = existingAreas.some((row) => {
    const meta = row.metadata ? JSON.parse(row.metadata) : {};
    return meta.canonical === true;
  });
  if (!alreadyHasCanonical) {
    const now = Date.now();
    for (const row of existingAreas) {
      if (!CANONICAL_DOMAIN_TITLES.includes(row.title)) continue;
      const meta = row.metadata ? JSON.parse(row.metadata) : {};
      db.runSync(
        `UPDATE items SET metadata = ?, updatedAt = ? WHERE id = ?`,
        [JSON.stringify({ ...meta, canonical: true }), now, row.id]
      );
    }
  }

  // Corrective pass, runs every boot (cheap, idempotent): a device with
  // duplicate-titled Domains (e.g. repeated onboarding runs during dev
  // testing) could have the backfill above — or an earlier version of it —
  // tag MORE THAN ONE row canonical for the same title, which incorrectly
  // locks every duplicate as undeletable instead of just one. For each
  // canonical title with multiple canonical=true rows, keep only the one
  // with the most linked Missions (falling back to earliest createdAt) and
  // clear the flag on the rest — they become ordinary, mergeable/deletable
  // Domains again. Never deletes anything itself.
  const canonicalRows = db.getAllSync<{ id: string; title: string; metadata: string | null; createdAt: number }>(
    `SELECT id, title, metadata, createdAt FROM items WHERE type = 'area' AND deletedAt IS NULL`
  ).filter((row) => {
    const meta = row.metadata ? JSON.parse(row.metadata) : {};
    return meta.canonical === true;
  });
  const byTitle = new Map<string, typeof canonicalRows>();
  for (const row of canonicalRows) {
    const list = byTitle.get(row.title) ?? [];
    list.push(row);
    byTitle.set(row.title, list);
  }
  for (const [, rows] of byTitle) {
    if (rows.length <= 1) continue;
    const missionCount = (areaId: string) =>
      db.getFirstSync<{ count: number }>(
        `SELECT COUNT(*) as count FROM itemRelations WHERE relationType = 'area' AND targetId = ?`,
        [areaId]
      )?.count ?? 0;
    const [keep] = [...rows].sort((a, b) => missionCount(b.id) - missionCount(a.id) || a.createdAt - b.createdAt);
    for (const row of rows) {
      if (row.id === keep.id) continue;
      const meta = row.metadata ? JSON.parse(row.metadata) : {};
      delete meta.canonical;
      db.runSync(`UPDATE items SET metadata = ?, updatedAt = ? WHERE id = ?`, [JSON.stringify(meta), Date.now(), row.id]);
    }
  }

  // Fill-the-gaps pass, runs every boot: recomputes which canonical titles
  // currently have a live canonical=true row (after the dedup pass above)
  // and creates any that are missing entirely — e.g. a Domain deleted before
  // the canonical flag existed, before it could ever be protected. This is
  // what actually makes "every user has all 8" hold for devices with messy
  // pre-existing data, not just fresh installs.
  const canonicalTitlesPresent = new Set(
    db.getAllSync<{ title: string; metadata: string | null }>(
      `SELECT title, metadata FROM items WHERE type = 'area' AND deletedAt IS NULL`
    )
      .filter((row) => {
        const meta = row.metadata ? JSON.parse(row.metadata) : {};
        return meta.canonical === true;
      })
      .map((row) => row.title)
  );
  for (const title of CANONICAL_DOMAIN_TITLES) {
    if (canonicalTitlesPresent.has(title)) continue;
    const id = uuidv4();
    const now = Date.now();
    db.runSync(
      `INSERT INTO items (id, type, title, status, metadata, createdAt, updatedAt) VALUES (?, 'area', ?, 'active', ?, ?, ?)`,
      [id, title, JSON.stringify({ canonical: true }), now, now]
    );
  }

  // One-time cleanup for the specific duplicate-title pairs left over from
  // repeated onboarding test runs, confirmed with the user directly: "Mind"
  // is a duplicate of the canonical "Growth", "Craft" a duplicate of the
  // canonical "Creativity". Only acts when there's exactly one duplicate row
  // and exactly one canonical target row (both active) — anything messier
  // than that is left for manual "Merge into..." in AreasScreen rather than
  // guessed at here. Uses mergeAreaIntoArea so linked Missions/Stats/
  // Achievements/Skills and historical scoring re-home instead of being lost.
  const KNOWN_DUPLICATE_MERGES: Array<[duplicateTitle: string, canonicalTitle: string]> = [
    ['Mind', 'Growth'],
    ['Craft', 'Creativity'],
  ];
  for (const [duplicateTitle, canonicalTitle] of KNOWN_DUPLICATE_MERGES) {
    const duplicates = db.getAllSync<{ id: string }>(
      `SELECT id FROM items WHERE type = 'area' AND title = ? AND deletedAt IS NULL`,
      [duplicateTitle]
    );
    const canonicalTargets = db.getAllSync<{ id: string; metadata: string | null }>(
      `SELECT id, metadata FROM items WHERE type = 'area' AND title = ? AND deletedAt IS NULL`,
      [canonicalTitle]
    ).filter((row) => {
      const meta = row.metadata ? JSON.parse(row.metadata) : {};
      return meta.canonical === true;
    });
    if (duplicates.length === 1 && canonicalTargets.length === 1) {
      mergeAreaIntoArea(duplicates[0].id, canonicalTargets[0].id);
    }
  }
}

// Single source of truth for the 6-Domain baseline every user gets from
// onboarding (see OnboardingScreen.tsx's SUGGESTED_DOMAINS, which pairs these
// titles with icons) — used by the retroactive canonical-flag backfill above.
// Was 8 (Harada-inspired) through 2026-08-13; Discipline and Growth were
// dropped 2026-08-14 as deliberately too cross-cutting to be their own
// Domain (Growth happens across every Domain; Discipline may resurface later
// as a Potential Attribute, not a Domain) — see RETIRED_DOMAIN_TITLES below
// for the one-time migration that retires any pre-existing rows.
export const CANONICAL_DOMAIN_TITLES = [
  'Health & Wellbeing',
  'Fitness & Performance',
  'Career',
  'Finance',
  'Creativity',
  'Relationships',
];

// Domains dropped from the canonical baseline on 2026-08-14 (see
// CANONICAL_DOMAIN_TITLES above). Both were confirmed empty on the live
// account before removal — no Missions, Habits, Skills, Pillars, or
// Achievements linked to either — so retireDroppedDomains() below simply
// un-flags and deletes them rather than re-homing any data via
// mergeAreaIntoArea. If a future install somehow has real data on one of
// these, retireDroppedDomains() re-homes it into Creativity (Growth) /
// Health & Wellbeing (Discipline) instead of silently dropping it.
export const RETIRED_DOMAIN_TITLES = ['Discipline', 'Growth'] as const;
const RETIRED_DOMAIN_FALLBACK: Record<string, string> = {
  Discipline: 'Health & Wellbeing',
  Growth: 'Creativity',
};

// One-time, idempotent: retires the two dropped canonical Domains (see
// RETIRED_DOMAIN_TITLES) so they stop being undeletable and actually
// disappear, instead of the boot-time "fill the gaps" pass (further down)
// recreating them forever now that they're no longer in
// CANONICAL_DOMAIN_TITLES. Must run AFTER that fill-the-gaps pass so the
// fallback Domains below are guaranteed to already exist. Confirmed empty on
// the live account before this was written (no Missions/Habits/Skills/
// Pillars/Achievements linked to either) — mergeAreaIntoArea re-homes
// anything found anyway rather than assuming that stays true forever, and
// already bypasses the canonical-delete guard itself (see its own body).
function retireDroppedDomains(): void {
  const db = getDb();
  for (const title of RETIRED_DOMAIN_TITLES) {
    const rows = db.getAllSync<{ id: string }>(
      `SELECT id FROM items WHERE type = 'area' AND title = ? AND deletedAt IS NULL`,
      [title]
    );
    if (rows.length === 0) continue;
    const fallback = db.getAllSync<{ id: string }>(
      `SELECT id FROM items WHERE type = 'area' AND title = ? AND deletedAt IS NULL LIMIT 1`,
      [RETIRED_DOMAIN_FALLBACK[title]]
    )[0];
    if (!fallback) continue; // fallback should always exist post fill-the-gaps; skip rather than guess
    for (const row of rows) mergeAreaIntoArea(row.id, fallback.id);
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

// ── Daily Check-Ins ────────────────────────────────────────────────────

export function upsertDailyCheckIn(dateKey: string, phase: DailyCheckInPhase, answers: DailyCheckInAnswers): DailyCheckInRow {
  const now = Date.now();
  const existing = getDailyCheckIn(dateKey, phase);
  const id = existing?.id ?? uuid();
  const createdAt = existing?.createdAt ?? now;
  getDb().runSync(
    `INSERT INTO dailyCheckIns (id, dateKey, phase, answers, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(dateKey, phase) DO UPDATE SET
       answers = excluded.answers,
       updatedAt = excluded.updatedAt`,
    [id, dateKey, phase, JSON.stringify(answers), createdAt, now],
  );
  return getDailyCheckIn(dateKey, phase)!;
}

export function getDailyCheckIn(dateKey: string, phase: DailyCheckInPhase): DailyCheckInRow | null {
  return getDb().getAllSync<DailyCheckInRow>(
    `SELECT * FROM dailyCheckIns WHERE dateKey = ? AND phase = ? LIMIT 1`,
    [dateKey, phase],
  )[0] ?? null;
}

export function getDailyCheckInsForDate(dateKey: string): DailyCheckInRow[] {
  return getDb().getAllSync<DailyCheckInRow>(
    `SELECT * FROM dailyCheckIns WHERE dateKey = ? ORDER BY CASE phase WHEN 'morning' THEN 0 ELSE 1 END`,
    [dateKey],
  );
}

export function getDailyCheckIns(limit = 30): DailyCheckInRow[] {
  return getDb().getAllSync<DailyCheckInRow>(
    `SELECT * FROM dailyCheckIns ORDER BY dateKey DESC, CASE phase WHEN 'morning' THEN 0 ELSE 1 END LIMIT ?`,
    [limit],
  );
}

// ── Items ──────────────────────────────────────────────────────────────

export function getInboxItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE status = 'inbox' AND deletedAt IS NULL ORDER BY createdAt DESC`
  );
}

export function getInboxCount(): number {
  return getItemCountByStatus('inbox');
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

export function getItemCountByStatus(status: string): number {
  return getDb().getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM items WHERE status = ? AND deletedAt IS NULL`,
    [status]
  )?.count ?? 0;
}

export function getAnytimeTaskItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = 'task' AND status = 'active' AND scheduledDate IS NULL
       AND deletedAt IS NULL ORDER BY createdAt DESC`
  );
}

export function getActiveTaskItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = 'task' AND status NOT IN ('inbox', 'completed', 'archived')
       AND deletedAt IS NULL ORDER BY createdAt DESC`
  );
}

export function getSomedayTaskItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = 'task' AND status = 'someday' AND deletedAt IS NULL ORDER BY createdAt DESC`
  );
}

export function getCompletedItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE status = 'completed' AND deletedAt IS NULL
       ORDER BY completedAt DESC, updatedAt DESC`
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

// Shared listKey for Home's Today view manual order (TodayCard.tsx reads
// this via applyManualOrder) — a single exported constant so callers never
// re-type the literal and risk drifting out of sync.
export const TODAY_LIST_KEY = 'home:today';

// Appends itemId to the end of listKey's manual order if it has no saved
// position yet — a no-op if it's already positioned (e.g. the user already
// dragged it once). Lets callers that add several items in a deliberate
// sequence (e.g. the assistant planning a batch of tasks into Today) get
// that sequence reflected immediately, without requiring a manual drag.
export function appendToManualOrderIfAbsent(listKey: string, itemId: string): void {
  const db = getDb();
  const existing = db.getAllSync<{ position: number }>(
    `SELECT position FROM itemOrder WHERE listKey = ? AND itemId = ?`,
    [listKey, itemId]
  );
  if (existing.length > 0) return;
  const maxRow = db.getAllSync<{ maxPos: number | null }>(
    `SELECT MAX(position) as maxPos FROM itemOrder WHERE listKey = ?`,
    [listKey]
  )[0];
  const position = (maxRow?.maxPos ?? -1) + 1;
  db.runSync(`INSERT INTO itemOrder (listKey, itemId, position) VALUES (?, ?, ?)`, [listKey, itemId, position]);
  const userId = getCurrentSyncUserId();
  if (userId) {
    const rows = db.getAllSync<{ itemId: string }>(
      `SELECT itemId FROM itemOrder WHERE listKey = ? ORDER BY position ASC`,
      [listKey]
    );
    pushItemOrderBatchToFirestore(userId, listKey, rows.map((r) => r.itemId)).catch(() => {});
  }
}

// ── Tasks screen view (grouping/sort/filter) ────────────────────────────
// A display preference, not app data — same appSettings-backed pattern as
// hasSeenRoutinesIntro/markRoutinesIntroSeen. Kept as a plain, versionless
// blob (see src/utils/taskViews.ts for the shape) rather than individual
// keys, since it's read/written as one unit from a single sheet.
export function getTasksViewConfig(): unknown {
  return getAppSetting<unknown>('tasksViewConfig', null);
}

export function setTasksViewConfig(config: unknown): void {
  setAppSetting('tasksViewConfig', config);
}

// Read-merge-write, same pattern as applyTaskTriage's priority write —
// updateItemMetadata replaces the whole blob, so existing metadata must be
// preserved. `priority: null` clears it (dropped into a "No Priority" group).
export function setTaskPriority(id: string, priority: 'low' | 'medium' | 'high' | null): void {
  const item = getItemWithMetadata(id);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  if (priority === null) delete meta.priority;
  else meta.priority = priority;
  updateItemMetadata(id, meta);
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

// Batched counterpart of getPotentialStatsForArea — one join query for every
// area instead of one query per area. Used by computeOverallPotential/
// computeAllDomainScores, which otherwise ran this query once per canonical
// Domain (8x) on every Home refresh.
export function getPotentialStatsForAreas(areaIds: string[]): Record<string, Item[]> {
  const result: Record<string, Item[]> = {};
  for (const areaId of areaIds) result[areaId] = [];
  if (areaIds.length === 0) return result;
  const placeholders = areaIds.map(() => '?').join(',');
  const rows = getDb().getAllSync<Item & { __areaId: string }>(
    `SELECT items.*, itemRelations.targetId as __areaId FROM items
     JOIN itemRelations ON itemRelations.sourceId = items.id
     WHERE itemRelations.targetId IN (${placeholders}) AND itemRelations.relationType = 'potentialStatArea'
       AND items.type = 'potential-stat' AND items.deletedAt IS NULL
     ORDER BY items.createdAt DESC`,
    areaIds
  );
  for (const row of rows) {
    const { __areaId, ...item } = row;
    result[__areaId].push(item as Item);
  }
  return result;
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

// ── Potential Attributes (Strength, Stamina, ... — see utils/attributes.ts)
// A separate developmental-stat system from the legacy Pillar
// (`potential-stat`) model above. The 2026-08-14 product direction is that
// these two should NOT remain two permanent parallel systems long-term —
// Pillars are legacy and expected to be retired once the Attribute scoring
// formula is designed — but no migration of existing Pillar data happens
// here: an inspection of the live account on 2026-08-14 found all 4 seeded
// Pillars (Physique/Skin/Oral Hygiene/Vitality) unlinked to any Domain with
// zero Habits assigned to any of them, so there was nothing real to migrate.
// A fresh account may differ; check before assuming this is a no-op forever.

const INITIAL_ATTRIBUTE_SEED: Record<string, string> = {
  strength: 'Strength',
  stamina: 'Stamina',
};

// One-time, idempotent — same seedKey pattern as migratePotentialStats
// above, so re-running never duplicates. Deliberately does NOT link these
// to any Domain by default (Attribute<->Domain association is many-to-many
// and left for the user/UI to configure, per the 2026-08-14 direction that
// association must not be assumed).
function seedInitialAttributes(): void {
  const existing = getAttributes();
  const seedKeyToId = new Set<string>();
  for (const attribute of existing) {
    if (!attribute.metadata) continue;
    try {
      const meta = JSON.parse(attribute.metadata);
      if (typeof meta.seedKey === 'string') seedKeyToId.add(meta.seedKey);
    } catch {
      // Malformed metadata — treated as unseeded below.
    }
  }
  for (const [key, label] of Object.entries(INITIAL_ATTRIBUTE_SEED)) {
    if (seedKeyToId.has(key)) continue;
    const id = createItem('potential-attribute', label, 'active');
    updateItemMetadata(id, { seedKey: key });
  }
}

export function getAttributes(): Item[] {
  return getItemsByType('potential-attribute');
}

export function createAttribute(title: string): string {
  return createItem('potential-attribute', title, 'active');
}

// ── Attribute <-> Domain association (many-to-many, context only) ────────
// Deliberately NOT itemRelations (which enforces one target per
// (sourceId, relationType) — wrong here, since e.g. Strength can relate to
// both Fitness & Performance and Health & Wellbeing at once). Association
// here is display/context only — it does not by itself cause any scoring
// effect anywhere (see the 2026-08-14 direction: "association does not
// automatically mean scoring contribution").

export function linkAttributeToDomain(attributeId: string, areaId: string): void {
  getDb().runSync(
    `INSERT OR IGNORE INTO attributeDomains (attributeId, areaId, createdAt) VALUES (?, ?, ?)`,
    [attributeId, areaId, Date.now()]
  );
}

export function unlinkAttributeFromDomain(attributeId: string, areaId: string): void {
  getDb().runSync(`DELETE FROM attributeDomains WHERE attributeId = ? AND areaId = ?`, [attributeId, areaId]);
}

export function getDomainsForAttribute(attributeId: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT items.* FROM items
     JOIN attributeDomains ON attributeDomains.areaId = items.id
     WHERE attributeDomains.attributeId = ? AND items.deletedAt IS NULL`,
    [attributeId]
  );
}

export function getAttributesForDomain(areaId: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT items.* FROM items
     JOIN attributeDomains ON attributeDomains.attributeId = items.id
     WHERE attributeDomains.areaId = ? AND items.deletedAt IS NULL`,
    [areaId]
  );
}

// ── Attribute evidence (attributeContributions) ───────────────────────────
// The event/history layer only — see utils/attributes.ts's
// computeAttributeValue for why nothing here turns this into a live score
// yet. sourceType/sourceId identify what produced the evidence (a Habit
// occurrence, a logged Action) so a source can be re-edited/deleted and its
// evidence rows found again (see excludeAttributeContributionsForSource).

function insertAttributeContribution(
  attributeId: string,
  sourceType: 'habit' | 'action',
  sourceId: string,
  weight: AttributeWeight,
  occurredAt: number,
  fraction?: number,
): string {
  const id = uuidv4();
  getDb().runSync(
    `INSERT INTO attributeContributions (id, attributeId, sourceType, sourceId, weight, fraction, occurredAt, excludedAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [id, attributeId, sourceType, sourceId, weight, fraction ?? null, occurredAt, Date.now()]
  );
  return id;
}

export function getContributionsForAttribute(attributeId: string): AttributeContributionRow[] {
  return getDb().getAllSync<AttributeContributionRow>(
    `SELECT * FROM attributeContributions WHERE attributeId = ? AND excludedAt IS NULL ORDER BY occurredAt DESC`,
    [attributeId]
  );
}

// Per-Attribute scoring configuration (weekly target, evidence weights,
// growth/decay rates, credit-curve shape — see utils/attributeScoring.ts).
// Lives on the Attribute item's own metadata so Strength and Stamina can
// diverge later without any schema change; unset fields fall back to
// DEFAULT_ATTRIBUTE_SCORING_CONFIG. weightMagnitude merges shallowly so
// overriding just one weight doesn't require repeating the other two.
export function getAttributeScoringConfig(attributeId: string): AttributeScoringConfig {
  const item = getItemWithMetadata(attributeId);
  const stored = item?.metadata ? JSON.parse(item.metadata).scoringConfig : undefined;
  if (!stored || typeof stored !== 'object') return DEFAULT_ATTRIBUTE_SCORING_CONFIG;
  return {
    ...DEFAULT_ATTRIBUTE_SCORING_CONFIG,
    ...stored,
    weightMagnitude: { ...DEFAULT_ATTRIBUTE_SCORING_CONFIG.weightMagnitude, ...(stored.weightMagnitude ?? {}) },
  };
}

export function setAttributeScoringConfig(attributeId: string, config: Partial<AttributeScoringConfig>): void {
  const item = getItemWithMetadata(attributeId);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  const current = getAttributeScoringConfig(attributeId);
  updateItemMetadata(attributeId, { ...meta, scoringConfig: { ...current, ...config } });
}

// The only place that turns evidence history into a live 0-100 value —
// always recomputed from getContributionsForAttribute, never cached/stored,
// so changing this Attribute's config (or the scoring model itself) takes
// effect immediately on the next read with no migration of past evidence.
export function computeAttributeScore(attributeId: string, now: number = Date.now()): number {
  const config = getAttributeScoringConfig(attributeId);
  const rows = getContributionsForAttribute(attributeId);
  const evidence: AttributeEvidence[] = rows.map((row) => ({
    attributeId: row.attributeId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    weight: row.weight,
    fraction: row.fraction,
    occurredAt: row.occurredAt,
  }));
  return computeAttributeValue(evidence, config, now);
}

// Soft-excludes (never hard-deletes) every active evidence row from a given
// source — used when an Action is deleted/edited (its old evidence must stop
// counting) or a Habit's Attribute config changes (old rows stay as history,
// matching how domainContributions treats achievements: history isn't
// rewritten, just excluded from the live calculation).
function excludeAttributeContributionsForSource(sourceType: 'habit' | 'action', sourceId: string): void {
  getDb().runSync(
    `UPDATE attributeContributions SET excludedAt = ? WHERE sourceType = ? AND sourceId = ? AND excludedAt IS NULL`,
    [Date.now(), sourceType, sourceId]
  );
}

// Narrower than the above — excludes only the active rows from a source that
// fall within a specific time window. Used by recordHabitProgressEvidence to
// replace *this period's* evidence without touching a measurable Habit's
// earlier, already-finished periods.
function excludeAttributeContributionsForSourceInWindow(sourceType: 'habit' | 'action', sourceId: string, startMs: number, endMs: number): void {
  getDb().runSync(
    `UPDATE attributeContributions SET excludedAt = ? WHERE sourceType = ? AND sourceId = ? AND occurredAt >= ? AND occurredAt <= ? AND excludedAt IS NULL`,
    [Date.now(), sourceType, sourceId, startMs, endMs]
  );
}

// Hard-deletes every evidence row from a given source, active or already
// excluded — used only when the source item itself is deleted (an Action
// being deleted), where keeping orphaned history rows around serves no
// purpose (unlike excludeAttributeContributionsForSource above, used for
// edits where the source item still exists).
function deleteAttributeContributionsForSource(sourceType: 'habit' | 'action', sourceId: string): void {
  getDb().runSync(`DELETE FROM attributeContributions WHERE sourceType = ? AND sourceId = ?`, [sourceType, sourceId]);
}

// ── Habit -> Attribute contribution config ────────────────────────────────
// A Habit's own metadata.attributeContributions — independent of and
// unrelated to metadata.potentialStat (the legacy single-Pillar field, see
// utils/potential.ts). A Habit may tap zero, one, or several Attributes.

export function getHabitAttributeContributions(habitId: string): AttributeContributionConfig[] {
  const item = getItemWithMetadata(habitId);
  if (!item?.metadata) return [];
  try {
    return parseAttributeContributions(JSON.parse(item.metadata).attributeContributions);
  } catch {
    return [];
  }
}

export function setHabitAttributeContributions(habitId: string, contributions: AttributeContributionConfig[]): void {
  const item = getItemWithMetadata(habitId);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  updateItemMetadata(habitId, { ...meta, attributeContributions: contributions });
}

// Called from every path that records a Habit occurrence (updateItemStatus's
// repeating-completion branch, toggleHabitOccurrence's add branch) — inserts
// one attributeContributions row per Attribute the Habit is configured to
// tap, timestamped at the occurrence itself so evidence decays from when the
// behaviour actually happened, not from whenever it's later queried.
function recordHabitCompletionEvidence(habitId: string, occurredAt: number): void {
  const contributions = getHabitAttributeContributions(habitId);
  for (const { attributeId, weight } of contributions) {
    insertAttributeContribution(attributeId, 'habit', habitId, weight, occurredAt);
  }
}

// Measurable (count/duration) Habit evidence — called from logHabitSample and
// undoLastHabitSample, i.e. every time a sample changes. Unlike
// recordHabitCompletionEvidence above (one-shot, full credit, for binary
// Habits), a quantified Habit's progress can be updated many times within
// the same period (2026-08-15: "3k -> 6k -> 9k -> 12k steps during one day"),
// and going 12k -> 6k should be able to happen too (undo). So this always
// recomputes the CURRENT period's completion fraction from scratch (never
// trusts a previously-passed value) and REPLACES that period's evidence
// rather than adding to it — excludes whatever this Habit already recorded
// within the current period window, then inserts one fresh row per
// configured Attribute at the freshly-computed fraction. Earlier, already-
// finished periods are untouched. No-ops for binary Habits (measurement ===
// 'binary'), which go through recordHabitCompletionEvidence instead.
//
// `samples` is supplied by the caller rather than fetched internally — on
// native this is a formality (SQLite writes are synchronous, so a fresh
// getHabitSamples() call would already reflect the change), but on web,
// Firestore writes are async with no local optimistic update, so a
// getHabitSamples() call made immediately after logActivity()/delete would
// read stale data. Callers construct the truthfully-current list themselves.
function recordHabitProgressEvidence(habitId: string, occurredAt: number, samples: ActivityLog[]): void {
  const item = getItemWithMetadata(habitId);
  if (!item) return;
  const meta = parseHabitMeta(item);
  if (meta.measurement === 'binary') return;

  const progress = computeHabitPeriodProgress(item, samples, new Date(occurredAt));
  const fraction = progress.target > 0 ? Math.max(0, Math.min(progress.current / progress.target, 1)) : 0;
  const { start, end } = periodWindow(meta.targetPeriod, meta.customPeriodDays, new Date(occurredAt));

  excludeAttributeContributionsForSourceInWindow('habit', habitId, start, end);
  if (fraction <= 0) return;

  const contributions = getHabitAttributeContributions(habitId);
  for (const { attributeId, weight } of contributions) {
    insertAttributeContribution(attributeId, 'habit', habitId, weight, occurredAt, fraction);
  }
}

// ── Alertness (Current State — see utils/alertness.ts) ────────────────────
// Deliberately NOT evidence/decay-based like Attributes — recomputed fresh
// from today's Daily Check-In every time, nothing stored.

export function computeAlertness(dateKey: string = formatDate(new Date())): number | null {
  const morning = getDailyCheckIn(dateKey, 'morning');
  if (!morning) return null;
  let answers: AlertnessInputs = {};
  try {
    const parsed = JSON.parse(morning.answers ?? '{}');
    answers = { sleepAmount: parsed.sleepAmount, sleepQuality: parsed.sleepQuality };
  } catch {
    return null;
  }
  return computeAlertnessValue(answers);
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

// Batched counterpart of getActiveContributionsForArea — one query for every
// area instead of one query per area (same rationale as
// getPotentialStatsForAreas above).
export function getActiveContributionsForAreas(areaIds: string[]): Record<string, DomainContributionRow[]> {
  const result: Record<string, DomainContributionRow[]> = {};
  for (const areaId of areaIds) result[areaId] = [];
  if (areaIds.length === 0) return result;
  const placeholders = areaIds.map(() => '?').join(',');
  const rows = getDb().getAllSync<DomainContributionRow>(
    `SELECT * FROM domainContributions WHERE areaId IN (${placeholders}) AND excludedAt IS NULL`,
    areaIds
  );
  for (const row of rows) result[row.areaId].push(row);
  return result;
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

// Deletes the trophy AND excludes its live scoring effect (if any) —
// deleteItem alone would leave a stale active domainContributions row still
// counting toward the Domain's score for a trophy that no longer exists.
export function deleteAchievement(achievementId: string): void {
  const contribution = getContributionForSource('achievement', achievementId);
  if (contribution && !contribution.excludedAt) {
    excludeDomainContribution(contribution.id);
  }
  deleteItem(achievementId);
}

// Creates, reactivates or excludes the achievement's domainContributions row
// to match `contributes`, and persists the flag on the item itself. This is
// the ONLY place that inserts a contribution for a manually-added
// achievement — createAchievement itself deliberately does not, since
// completeMission/setMissionAchievementEligible insert their own
// achievement-tier contribution and would double up if createAchievement
// did it too.
export function setAchievementContributesToScore(achievementId: string, contributes: boolean): void {
  const item = getItemWithMetadata(achievementId);
  if (!item) return;
  const existingMeta = item.metadata ? JSON.parse(item.metadata) : {};
  updateItemMetadata(achievementId, { ...existingMeta, contributesToScore: contributes });

  const areaId = getAreaForAchievement(achievementId);
  if (!areaId) return;
  const contribution = getContributionForSource('achievement', achievementId);

  if (contributes) {
    if (contribution) {
      reactivateDomainContribution(contribution.id);
    } else {
      const earnedAt = typeof existingMeta.earnedAt === 'string' ? new Date(`${existingMeta.earnedAt}T00:00:00`).getTime() : item.createdAt;
      insertDomainContribution(
        areaId,
        'achievement',
        achievementId,
        ACHIEVEMENT_CONTRIBUTION_DEFAULTS.magnitude,
        ACHIEVEMENT_CONTRIBUTION_DEFAULTS.halfLifeDays,
        Number.isFinite(earnedAt) ? earnedAt : item.createdAt,
      );
    }
  } else if (contribution && !contribution.excludedAt) {
    excludeDomainContribution(contribution.id);
  }
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

// ── Skills (capabilities you develop, distinct from Domains you maintain) ─
// A skill has ONE primary Domain (relationType 'skillArea', via setRelation
// — a real itemRelations row) and any number of secondary Domains, stored
// as metadata.secondaryAreaIds (a plain array) rather than itemRelations,
// since itemRelations only supports one target per (sourceId, relationType)
// and a skill can have several secondary Domains. Proficiency is a manual
// 0-100 rating — never derived — stored in metadata.proficiency.
//
// Habits/routines link to a skill purely for organization ('habitSkill'/
// 'routineSkill' relations) and keep contributing to Potential exactly as
// they already do via their own Potential Stat relation — the skill layer
// adds no second contribution for them.
//
// Missions ('missionSkill' relation) are the one exception: a Mission's own
// 'area' relation still wins when set, but a Mission with NO direct Domain
// inherits its linked Skill's primary Domain for scoring purposes (see
// getEffectiveAreaForMission) — e.g. one Mission per app, each linked to an
// "App Development" Skill, all scoring against that Skill's Domain without
// each Mission needing its own redundant Domain assignment. This is still
// exactly one contribution per completion event, just resolved through the
// Skill instead of a direct relation — not a second channel.
//
// The ONLY way a skill affects Domain scoring *directly* (i.e. without
// completing a Mission) is a skill-linked achievement/milestone
// (relationType 'achievementSkill', mutually exclusive with
// 'achievementArea' — an achievement targets either a Domain or a Skill,
// never both, which is what prevents double-counting).

export function createSkill(title: string, primaryAreaId?: string | null, secondaryAreaIds: string[] = []): string {
  const id = createItem('skill', title, 'active');
  updateItemMetadata(id, { proficiency: 0, secondaryAreaIds, unlocked: false });
  if (primaryAreaId) setRelation(id, 'skillArea', primaryAreaId);
  return id;
}

// A Skill starts locked ("still learning") — a manual, skill-tree-style gate
// distinct from proficiency. A locked skill can have milestones and linked
// habits/routines/missions like any other skill, but NONE of its milestones
// may affect Domain scoring while locked, no matter their own
// contributesToScore flag — see setSkillMilestoneContributesToScore below.
// Unlocking is manual only, never derived from proficiency or activity.
export function isSkillUnlocked(skillId: string): boolean {
  const item = getItemWithMetadata(skillId);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  return meta.unlocked === true;
}

export function setSkillUnlocked(skillId: string, unlocked: boolean): void {
  const item = getItemWithMetadata(skillId);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  updateItemMetadata(skillId, { ...meta, unlocked });

  // Re-sync every milestone's contribution rows against the new lock state:
  // unlocking activates rows for milestones the user already marked as
  // contributing; locking excludes any currently-active rows.
  for (const milestone of getMilestonesForSkill(skillId)) {
    const milestoneItem = getItemWithMetadata(milestone.id);
    const milestoneMeta = milestoneItem?.metadata ? JSON.parse(milestoneItem.metadata) : {};
    if (milestoneMeta.contributesToScore) {
      applySkillMilestoneContribution(milestone.id, skillId, unlocked);
    }
  }
}

export function getSkills(): Item[] {
  return getItemsByType('skill');
}

export function getSkillsForArea(areaId: string): Item[] {
  return getSkills().filter((skill) => {
    if (getRelation(skill.id, 'skillArea') === areaId) return true;
    const meta = skill.metadata ? JSON.parse(skill.metadata) : {};
    return Array.isArray(meta.secondaryAreaIds) && meta.secondaryAreaIds.includes(areaId);
  });
}

export function updateSkillProficiency(skillId: string, proficiency: number): void {
  const item = getItemWithMetadata(skillId);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  updateItemMetadata(skillId, { ...meta, proficiency: Math.max(0, Math.min(100, proficiency)) });
}

export function setPrimaryAreaForSkill(skillId: string, areaId: string | null): void {
  setRelation(skillId, 'skillArea', areaId);
}

export function getPrimaryAreaForSkill(skillId: string): string | null {
  return getRelation(skillId, 'skillArea');
}

export function setSkillSecondaryAreas(skillId: string, areaIds: string[]): void {
  const item = getItemWithMetadata(skillId);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  updateItemMetadata(skillId, { ...meta, secondaryAreaIds: areaIds });
}

export function getSecondaryAreasForSkill(skillId: string): string[] {
  const item = getItemWithMetadata(skillId);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  return Array.isArray(meta.secondaryAreaIds) ? meta.secondaryAreaIds : [];
}

export function linkHabitToSkill(habitId: string, skillId: string | null): void {
  setRelation(habitId, 'habitSkill', skillId);
}
export function getSkillForHabit(habitId: string): string | null {
  return getRelation(habitId, 'habitSkill');
}
export function getHabitsForSkill(skillId: string): Item[] {
  return getRelatedItemsByType(skillId, 'habitSkill', 'habit');
}

export function linkMissionToSkill(projectId: string, skillId: string | null): void {
  setRelation(projectId, 'missionSkill', skillId);
}
export function getSkillForMission(projectId: string): string | null {
  return getRelation(projectId, 'missionSkill');
}
export function getMissionsForSkill(skillId: string): Item[] {
  return getRelatedItemsByType(skillId, 'missionSkill', 'project');
}

// A Mission's own 'area' relation always wins when set (explicit beats
// inherited). Otherwise, a Mission linked to a Skill inherits that Skill's
// primary Domain — e.g. a "Ship v2" Mission linked to the "App Development"
// Skill scores against whatever Domain that Skill's primary is, with no need
// to also set the Mission's own Domain. Used by completeMission/
// setMissionAchievementEligible so Skill-linked Missions can score without
// redundant direct Domain assignment.
export function getEffectiveAreaForMission(projectId: string): string | null {
  const directAreaId = getRelation(projectId, 'area');
  if (directAreaId) return directAreaId;
  const skillId = getSkillForMission(projectId);
  if (!skillId) return null;
  return getPrimaryAreaForSkill(skillId);
}

export function linkRoutineToSkill(routineId: string, skillId: string | null): void {
  setRelation(routineId, 'routineSkill', skillId);
}
export function getSkillForRoutine(routineId: string): string | null {
  return getRelation(routineId, 'routineSkill');
}
export function getRoutinesForSkill(skillId: string): Item[] {
  return getRelatedItemsByType(skillId, 'routineSkill', 'routine');
}

export function getMilestonesForSkill(skillId: string): Item[] {
  return getRelatedItemsByType(skillId, 'achievementSkill', 'achievement');
}

// A skill milestone/achievement can create MULTIPLE domainContributions rows
// for one achievement (primary Domain + each secondary Domain), unlike the
// Mission/Area-achievement flows which only ever have one. getContributionForSource
// (singular, most-recent-row) doesn't fit here — this reads all of them.
function getSkillContributionRows(achievementId: string): DomainContributionRow[] {
  return getDb().getAllSync<DomainContributionRow>(
    `SELECT * FROM domainContributions WHERE sourceType = 'skill' AND sourceId = ?`,
    [achievementId]
  );
}

// Shared by setSkillMilestoneContributesToScore and setSkillUnlocked (the
// latter re-syncs every already-contributing milestone when the lock state
// flips, without touching each milestone's own contributesToScore flag).
function applySkillMilestoneContribution(achievementId: string, skillId: string, active: boolean): void {
  const item = getItemWithMetadata(achievementId);
  if (!item) return;
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  const primaryAreaId = getPrimaryAreaForSkill(skillId);
  const secondaryAreaIds = getSecondaryAreasForSkill(skillId);
  const existingRows = getSkillContributionRows(achievementId);
  const earnedAtMs = typeof meta.earnedAt === 'string' ? new Date(`${meta.earnedAt}T00:00:00`).getTime() : NaN;
  const occurredAt = Number.isFinite(earnedAtMs) ? earnedAtMs : item.createdAt;

  if (active) {
    const targets: Array<{ areaId: string; weight: number }> = [];
    if (primaryAreaId) targets.push({ areaId: primaryAreaId, weight: 1 });
    for (const areaId of secondaryAreaIds) targets.push({ areaId, weight: 0.5 });
    for (const target of targets) {
      const existing = existingRows.find((r) => r.areaId === target.areaId);
      if (existing) {
        reactivateDomainContribution(existing.id);
      } else {
        insertDomainContribution(
          target.areaId,
          'skill',
          achievementId,
          SKILL_CONTRIBUTION_DEFAULTS.magnitude * target.weight,
          SKILL_CONTRIBUTION_DEFAULTS.halfLifeDays,
          occurredAt,
        );
      }
    }
  } else {
    for (const row of existingRows) {
      if (!row.excludedAt) excludeDomainContribution(row.id);
    }
  }
}

export function setSkillMilestoneContributesToScore(achievementId: string, contributes: boolean): void {
  const item = getItemWithMetadata(achievementId);
  if (!item) return;
  const existingMeta = item.metadata ? JSON.parse(item.metadata) : {};
  updateItemMetadata(achievementId, { ...existingMeta, contributesToScore: contributes });

  const skillId = getRelation(achievementId, 'achievementSkill');
  if (!skillId) return;

  // A locked skill ("still learning") never affects Domain scoring, no
  // matter this milestone's own contributesToScore flag — the flag is still
  // recorded so unlocking the skill later can activate it retroactively.
  const active = contributes && isSkillUnlocked(skillId);
  applySkillMilestoneContribution(achievementId, skillId, active);
}

export function createSkillMilestone(skillId: string, title: string, earnedAt: string, contributesToScore: boolean): string {
  const id = createAchievement({ title, areaId: null, earnedAt, source: 'manual', contributesToScore });
  setRelation(id, 'achievementSkill', skillId);
  if (contributesToScore) setSkillMilestoneContributesToScore(id, true);
  return id;
}

export function deleteSkillMilestone(achievementId: string): void {
  for (const row of getSkillContributionRows(achievementId)) {
    if (!row.excludedAt) excludeDomainContribution(row.id);
  }
  deleteItem(achievementId);
}

export interface SkillPracticeSummary {
  habitCompletions30d: number;
  routineSessionsCompleted: number;
}

// Best-effort "practice and consistency" read — aggregates existing habit
// completion / routine session data for linked items rather than
// introducing a new tracking mechanism. Not itself a scoring input.
export function computeSkillPracticeSummary(skillId: string): SkillPracticeSummary {
  const since = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  let habitCompletions30d = 0;
  for (const habit of getHabitsForSkill(skillId)) {
    for (const date of getCompletedOccurrenceDates(habit.id)) {
      if (date >= since) habitCompletions30d++;
    }
  }
  const routineIds = new Set(getRoutinesForSkill(skillId).map((r) => r.id));
  let routineSessionsCompleted = 0;
  if (routineIds.size > 0) {
    const sessions = getDb().getAllSync<{ id: string }>(
      `SELECT id FROM items WHERE type = 'routine-session' AND status = 'completed' AND deletedAt IS NULL`
    );
    for (const session of sessions) {
      const routineId = getRelation(session.id, 'routine-template');
      if (routineId && routineIds.has(routineId)) routineSessionsCompleted++;
    }
  }
  return { habitCompletions30d, routineSessionsCompleted };
}

// One-time migration for a Domain that was really always a capability (e.g.
// "Music Production", "App Development" created before the app had a Skills
// layer) — creates a real Skill in its place, re-homes its Missions and
// Potential Stats onto a real Domain (`primaryAreaId`, required — Missions/
// Potential Stats need an actual Domain to keep contributing to Potential;
// a Skill itself never accepts either), moves its Achievements onto the new
// Skill as milestones (achievementArea -> achievementSkill), and retires the
// old Domain. Does not touch any domainContributions rows already recorded
// against the old areaId — those simply stop being read once the Domain
// item is gone from getItemsByType('area'), harmless orphans, not reused.
export function convertAreaToSkill(areaId: string, primaryAreaId: string): string {
  const area = getItemWithMetadata(areaId);
  const skillId = createSkill(area?.title ?? 'Skill', primaryAreaId);
  // A converted Domain already has real history — it isn't "still learning".
  setSkillUnlocked(skillId, true);

  for (const mission of getProjectsForArea(areaId)) {
    setRelation(mission.id, 'area', primaryAreaId);
    linkMissionToSkill(mission.id, skillId);
  }

  for (const stat of getPotentialStatsForArea(areaId)) {
    setPotentialStatArea(stat.id, primaryAreaId);
  }

  for (const achievement of getAchievementsForArea(areaId)) {
    setRelation(achievement.id, 'achievementArea', null);
    setRelation(achievement.id, 'achievementSkill', skillId);
  }

  deleteItem(areaId);
  return skillId;
}

// Consolidates a duplicate Domain into another — re-homes everything that
// pointed at it (Missions, Potential Stats, Achievements, Skills' primary/
// secondary Domain, and historical domainContributions rows so past scoring
// isn't orphaned) onto targetAreaId, then hard-deletes sourceAreaId. If the
// source was canonical (one of the 8 baseline Domains), the flag transfers
// to the target so the "always 8 canonical" guarantee doesn't silently drop
// — this is why the delete below bypasses deleteItem's canonical guard
// (deliberate user-initiated consolidation, not an accidental delete).
export function mergeAreaIntoArea(sourceAreaId: string, targetAreaId: string): void {
  if (sourceAreaId === targetAreaId) return;

  for (const mission of getProjectsForArea(sourceAreaId)) {
    setRelation(mission.id, 'area', targetAreaId);
  }
  for (const stat of getPotentialStatsForArea(sourceAreaId)) {
    setPotentialStatArea(stat.id, targetAreaId);
  }
  for (const achievement of getAchievementsForArea(sourceAreaId)) {
    setRelation(achievement.id, 'achievementArea', targetAreaId);
  }
  for (const skill of getSkillsForArea(sourceAreaId)) {
    if (getPrimaryAreaForSkill(skill.id) === sourceAreaId) {
      setPrimaryAreaForSkill(skill.id, targetAreaId);
    }
    const secondary = getSecondaryAreasForSkill(skill.id);
    if (secondary.includes(sourceAreaId)) {
      setSkillSecondaryAreas(skill.id, secondary.map((id) => (id === sourceAreaId ? targetAreaId : id)));
    }
  }
  getDb().runSync(`UPDATE domainContributions SET areaId = ? WHERE areaId = ?`, [targetAreaId, sourceAreaId]);

  const sourceItem = getItemWithMetadata(sourceAreaId);
  const sourceMeta = sourceItem?.metadata ? JSON.parse(sourceItem.metadata) : {};
  if (sourceMeta.canonical === true) {
    const targetItem = getItemWithMetadata(targetAreaId);
    const targetMeta = targetItem?.metadata ? JSON.parse(targetItem.metadata) : {};
    if (targetMeta.canonical !== true) updateItemMetadata(targetAreaId, { ...targetMeta, canonical: true });
  }

  getDb().runSync(`UPDATE items SET deletedAt = ?, updatedAt = ? WHERE id = ?`, [Date.now(), Date.now(), sourceAreaId]);
  syncItemToRemote(sourceAreaId);
}

// ── Mission completion (mutually exclusive Mission vs. Achievement tier) ──

// Completing a Mission always produces exactly one active domainContribution
// for this event — never both. Achievement-eligible Missions (metadata.
// achievementEligible) get the larger/slower Achievement tier plus a
// permanent trophy; ordinary Missions get the smaller/faster Mission tier.
// No-op for the score side if the Mission has no Domain (direct or inherited
// via a linked Skill's primary Domain, see getEffectiveAreaForMission) — a
// trophy/contribution needs somewhere to attach.
export function completeMission(missionId: string): void {
  updateItemStatus(missionId, 'completed');
  const item = getItemWithMetadata(missionId);
  const areaId = getEffectiveAreaForMission(missionId);
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
  const areaId = getEffectiveAreaForMission(missionId);
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

// Only habits that are actually assigned to a potential-stat need their
// occurrence history read at all — reading it for every habit regardless
// (the previous behavior) meant a full activityLogs scan per habit that
// never even factors into any Domain's maintenance score.
function getCompletedDatesForPotentialHabits(habits: Item[]): Record<string, Set<string>> {
  const completedDatesByHabitId: Record<string, Set<string>> = {};
  for (const habit of habits) {
    if (!parseHabitPotentialMeta(habit.metadata).potentialStat) continue;
    completedDatesByHabitId[habit.id] = getCompletedOccurrenceDates(habit.id);
  }
  return completedDatesByHabitId;
}

export function getPotentialStatResultsForArea(
  areaId: string,
  today: string,
  completedDatesByHabitId?: Record<string, Set<string>>,
  allHabits?: Item[],
  statsForArea?: Item[],
): Record<string, PotentialStatResult> {
  const stats = statsForArea ?? getPotentialStatsForArea(areaId);
  const habits = allHabits ?? getItemsByType('habit');
  const dates = completedDatesByHabitId ?? getCompletedDatesForPotentialHabits(habits);
  return computePotentialStats(habits, stats, dates, today);
}

export function computeDomainMaintenance(
  areaId: string,
  today: string,
  completedDatesByHabitId?: Record<string, Set<string>>,
  allHabits?: Item[],
  statsForArea?: Item[],
): number {
  const stats = statsForArea ?? getPotentialStatsForArea(areaId);
  if (stats.length === 0) return NO_PILLAR_MAINTENANCE_BASELINE;
  const results = getPotentialStatResultsForArea(areaId, today, completedDatesByHabitId, allHabits, stats);
  const percents = stats.map((stat) => results[stat.id]?.percent ?? 0);
  return domainMaintenance(percents);
}

export function computeDomainScore(
  areaId: string,
  now: number = Date.now(),
  completedDatesByHabitId?: Record<string, Set<string>>,
  allHabits?: Item[],
  statsForArea?: Item[],
  contributionsForArea?: DomainContributionRow[],
): number {
  const today = formatDate(new Date(now));
  const maintenance = computeDomainMaintenance(areaId, today, completedDatesByHabitId, allHabits, statsForArea);
  const rows = contributionsForArea ?? getActiveContributionsForArea(areaId);
  const contributions = rows.map((row) => ({
    magnitude: row.magnitude,
    halfLifeDays: row.halfLifeDays,
    occurredAt: row.occurredAt,
  }));
  return domainScore(maintenance, contributions, now);
}

// Screens that need both per-Domain scores AND the overall figure (AreasScreen,
// PotentialOverview) used to call computeDomainScore(area) in a loop and then
// separately call computeOverallPotential(), which reran that exact same loop
// again internally — doubling the per-habit activityLogs reads on top of the
// per-Domain redundancy computeOverallPotential itself already fixes below.
export function computeAllDomainScores(now: number = Date.now()): { scores: Record<string, number>; overall: number } {
  const areas = getItemsByType('area');
  if (areas.length === 0) return { scores: {}, overall: 0 };
  const focus = getFocus();
  const habits = getItemsByType('habit');
  const completedDatesByHabitId = getCompletedDatesForPotentialHabits(habits);
  const areaIds = areas.map((area) => area.id);
  const statsByArea = getPotentialStatsForAreas(areaIds);
  const contributionsByArea = getActiveContributionsForAreas(areaIds);
  const scores: Record<string, number> = {};
  const weights: Record<string, number> = {};
  for (const area of areas) {
    scores[area.id] = computeDomainScore(area.id, now, completedDatesByHabitId, habits, statsByArea[area.id], contributionsByArea[area.id]);
    weights[area.id] = focus?.weights?.[area.id] ?? 1;
  }
  return { scores, overall: overallPotential(scores, weights) };
}

export function computeOverallPotential(now: number = Date.now()): number {
  const areas = getItemsByType('area');
  if (areas.length === 0) return 0;
  const focus = getFocus();
  // Read every habit's occurrence history once, up front, instead of once
  // per Domain inside computeDomainScore's loop below — with 8 canonical
  // Domains this was previously an 8x redundant full activityLogs scan per
  // habit on every call (every Home focus, every item save app-wide).
  const habits = getItemsByType('habit');
  const completedDatesByHabitId = getCompletedDatesForPotentialHabits(habits);
  // Same batching for the per-Domain potential-stat and contribution reads
  // themselves — these used to be 2 queries per Domain (16 total across the
  // 8 canonical Domains) on every call; now 2 queries total regardless of
  // Domain count.
  const areaIds = areas.map((area) => area.id);
  const statsByArea = getPotentialStatsForAreas(areaIds);
  const contributionsByArea = getActiveContributionsForAreas(areaIds);
  const scores: Record<string, number> = {};
  const weights: Record<string, number> = {};
  for (const area of areas) {
    scores[area.id] = computeDomainScore(area.id, now, completedDatesByHabitId, habits, statsByArea[area.id], contributionsByArea[area.id]);
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
  appendToManualOrderIfAbsent(TODAY_LIST_KEY, itemId);
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

  const db = getDb();
  db.runSync(`DELETE FROM itemOrder WHERE listKey = ? AND itemId = ?`, [TODAY_LIST_KEY, itemId]);
  const userId = getCurrentSyncUserId();
  if (userId) {
    const rows = db.getAllSync<{ itemId: string }>(
      `SELECT itemId FROM itemOrder WHERE listKey = ? ORDER BY position ASC`,
      [TODAY_LIST_KEY]
    );
    pushItemOrderBatchToFirestore(userId, TODAY_LIST_KEY, rows.map((r) => r.itemId)).catch(() => {});
  }
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

// Active tasks tagged as Downtime tasks (metadata.interstitial) — worked on
// in short sessions whenever there's spare time, surfaced on Home. Same
// metadata-LIKE pattern as getPlannedTodayItems.
export function getInterstitialTasks(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE type = 'task' AND status NOT IN ('completed', 'inbox')
       AND deletedAt IS NULL AND metadata LIKE '%"interstitial":true%'`
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
    // Note: does not retract any attributeContributions evidence generated
    // when this occurrence was added — evidence rows aren't linked back to a
    // specific activityLogs row, only to the Habit itself, so a single
    // undone occurrence can't be cleanly un-recorded. Acceptable for v1
    // (this path is a rare calendar backfill/correction, not the common
    // completion flow); worth revisiting if that turns out to matter.
    getDb().runSync(`DELETE FROM activityLogs WHERE id = ?`, [existing.id]);
    const item = getItemWithMetadata(itemId);
    if (item?.scheduledDate && item.scheduledDate > date) {
      getDb().runSync(`UPDATE items SET scheduledDate = ?, updatedAt = ? WHERE id = ?`, [date, Date.now(), itemId]);
    }
  } else {
    logActivity(itemId, 'completed-occurrence', JSON.stringify({ occurrence: date }));
    recordHabitCompletionEvidence(itemId, new Date(`${date}T00:00:00`).getTime());
  }
}

// Quantified habit sample: one manual log entry (count/duration value +
// optional note) for a non-binary habit. Stored as 'habit-sample'
// activityLogs rows rather than a running total column, so period progress
// (utils/habitMeta.ts computeHabitPeriodProgress) is always recomputed from
// the actual events — no stale/duplicated counter to keep in sync.
export function logHabitSample(habitId: string, value: number, note?: string): void {
  logActivity(habitId, 'habit-sample', JSON.stringify({ value, note }));
  recordHabitProgressEvidence(habitId, Date.now(), getHabitSamples(habitId));
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
  recordHabitProgressEvidence(habitId, Date.now(), getHabitSamples(habitId));
}

// --- Actions --------------------------------------------------------------
// An Action is a lightweight event in the generic activityLogs table
// (actionType 'action'), NOT a new item type and NOT a scoring input — logging
// an action never writes domainContributions or touches proficiency. See
// utils/actions.ts for the pure types/helpers and the Actions page.

export function logAction(input: LogActionInput): string {
  const { occurredAt: _ignored, ...details } = input;
  const id = logActivity(primaryEntityId(details), 'action', JSON.stringify(details));
  const row = getDb().getAllSync<{ timestamp: number }>(`SELECT timestamp FROM activityLogs WHERE id = ?`, [id])[0];
  for (const { attributeId, weight } of parseAttributeContributions(details.attributeContributions)) {
    insertAttributeContribution(attributeId, 'action', id, weight, row?.timestamp ?? Date.now());
  }
  return id;
}

export function getActions(limit?: number): ActionRow[] {
  const rows = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE actionType = 'action' ORDER BY timestamp DESC${limit ? ' LIMIT ?' : ''}`,
    limit ? [limit] : []
  );
  return rows.map(parseActionRow);
}

// All logged sessions against one Downtime task, newest first — powers the
// task detail screen's session history. Same actionType='action' filter as
// getActions, narrowed by a LIKE on the stored details JSON (same pattern
// getPlannedTodayItems uses for metadata.plannedDate).
export function getActionsForTask(taskId: string): ActionRow[] {
  const rows = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE actionType = 'action' AND details LIKE ? ORDER BY timestamp DESC`,
    [`%"taskId":"${taskId}"%`]
  );
  return rows.map(parseActionRow);
}

export function updateAction(id: string, patch: Partial<ActionDetails>): void {
  const row = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE id = ? AND actionType = 'action'`,
    [id]
  )[0];
  if (!row) return;
  const current = parseActionRow(row);
  const { id: _i, entityId: _e, timestamp: _t, ...details } = { ...current, ...patch };
  getDb().runSync(`UPDATE activityLogs SET details = ?, entityId = ? WHERE id = ?`, [
    JSON.stringify(details),
    primaryEntityId(details),
    id,
  ]);
  // Re-derive evidence from the new config rather than diffing — exclude
  // whatever this Action previously recorded (same pattern deleteAchievement
  // uses before deleteItem: never leave a stale active row for a config that
  // no longer exists) and insert fresh rows for the current tags.
  excludeAttributeContributionsForSource('action', id);
  for (const { attributeId, weight } of parseAttributeContributions(details.attributeContributions)) {
    insertAttributeContribution(attributeId, 'action', id, weight, row.timestamp);
  }
}

export function deleteAction(id: string): void {
  getDb().runSync(`DELETE FROM activityLogs WHERE id = ? AND actionType = 'action'`, [id]);
  deleteAttributeContributionsForSource('action', id);
}

// Unified, read-only "everything I've done" feed: logged actions + habit
// check-ins + completed tasks + medication doses + routine steps, newest-first.
// Normalization/sort/limit is the pure buildActionFeed (utils/actions.ts).
export function getActionFeed(limit?: number): FeedEntry[] {
  const db = getDb();
  const entries: FeedEntry[] = [];

  for (const a of getActions()) {
    entries.push({ id: a.id, source: 'action', title: a.title, timestamp: a.timestamp, subtitle: actionSubtitle(a), entityId: a.entityId });
  }
  // Habit check-ins, medication doses, routine steps: activityLogs joined to
  // the entity's title. Task completions: items table by completedAt.
  const logRows = db.getAllSync<{ id: string; actionType: string; timestamp: number; title: string | null; entityId: string }>(
    `SELECT al.id, al.actionType, al.timestamp, al.entityId, i.title
       FROM activityLogs al LEFT JOIN items i ON i.id = al.entityId
      WHERE al.actionType IN ('completed-occurrence', 'medication-taken', 'routine-step-completed')`
  );
  for (const r of logRows) {
    const source: FeedSource = r.actionType === 'medication-taken' ? 'medication' : r.actionType === 'routine-step-completed' ? 'routine' : 'habit';
    const subtitle = source === 'medication' ? 'Dose taken' : source === 'routine' ? 'Routine step' : 'Habit check-in';
    entries.push({ id: r.id, source, title: r.title ?? subtitle, timestamp: r.timestamp, subtitle, entityId: r.entityId });
  }
  const taskRows = db.getAllSync<{ id: string; title: string; completedAt: number }>(
    `SELECT id, title, completedAt FROM items WHERE type = 'task' AND status = 'completed' AND completedAt IS NOT NULL AND deletedAt IS NULL`
  );
  for (const t of taskRows) {
    entries.push({ id: t.id, source: 'task', title: t.title, timestamp: t.completedAt, subtitle: 'Task completed', entityId: t.id });
  }
  return buildActionFeed(entries, limit);
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

// --- Plan Backwards -------------------------------------------------------
// A backward plan is an 'items' row (type='backward-plan') — title/scheduled-
// Date/notes use the standard item columns, Goal/Start/Expected/Latest/End
// time + location + an optional device-calendar reference live in metadata
// as BackwardPlanMeta (utils/backwardPlanMeta.ts). Its ordered plan blocks
// (routine/task/travel) are dedicated planBlocks/planBlockSteps rows, not
// items — see the schema comment in initSchema for why. A 'routine' block
// COPIES its steps from the routine template into planBlockSteps at add-time
// (never a live link), so completing a step in today's plan never mutates
// the reusable template, and editing the template later never retroactively
// changes an already-instantiated plan (spec: reusable routine vs instance).

export function createBackwardPlan(title: string, date: string, meta: BackwardPlanMeta = {}, notes?: string): string {
  const id = createItem('backward-plan', title, 'active', date, notes);
  updateItemMetadata(id, meta as unknown as Record<string, any>);
  return id;
}

export function getBackwardPlans(): Item[] {
  return getItemsByType('backward-plan')
    .filter((plan) => !plan.archivedAt && !plan.deletedAt)
    .sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''));
}

export function getBackwardPlan(planId: string): Item | null {
  return getItemWithMetadata(planId);
}

export function updateBackwardPlan(
  planId: string,
  updates: Partial<{ title: string; date: string | null; notes: string | null }>,
  metaUpdates?: Partial<BackwardPlanMeta>,
): void {
  if (updates.title !== undefined || updates.date !== undefined || updates.notes !== undefined) {
    updateItem(planId, { title: updates.title, scheduledDate: updates.date, notes: updates.notes });
  }
  if (metaUpdates) {
    const current = getItemWithMetadata(planId);
    const currentMeta = parseBackwardPlanMeta(current?.metadata);
    updateItemMetadata(planId, { ...currentMeta, ...metaUpdates });
  }
}

export function deleteBackwardPlan(planId: string): void {
  const blocks = getDb().getAllSync<{ id: string }>(`SELECT id FROM planBlocks WHERE planId = ?`, [planId]);
  for (const block of blocks) {
    getDb().runSync(`DELETE FROM planBlockSteps WHERE blockId = ?`, [block.id]);
  }
  getDb().runSync(`DELETE FROM planBlocks WHERE planId = ?`, [planId]);
  deleteItem(planId);
}

function nextPlanBlockOrderIndex(planId: string): number {
  const row = getDb().getFirstSync<{ maxOrder: number | null }>(
    `SELECT MAX(orderIndex) as maxOrder FROM planBlocks WHERE planId = ?`,
    [planId]
  );
  return (row?.maxOrder ?? -1) + 1;
}

// Copies the routine template's current steps into planBlockSteps — a
// snapshot, not a live link. durationSeconds (routine-step's native unit)
// converts to whole minutes since plan blocks work in minute granularity.
export function addPlanBlockRoutine(
  planId: string,
  routineTemplateId: string,
  opts?: { bufferMinutes?: number; placement?: PlacementBehavior },
): string {
  const routine = getItemWithMetadata(routineTemplateId);
  const templateSteps = getRoutineSteps(routineTemplateId);
  const now = Date.now();
  const blockId = uuidv4();
  getDb().runSync(
    `INSERT INTO planBlocks (id, planId, type, title, orderIndex, placement, bufferMinutes, durationMinutes, actualMinutes, routineTemplateId, linkedItemId, completedAt, travelConfig, notes, createdAt, updatedAt)
     VALUES (?, ?, 'routine', ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, ?, ?)`,
    [
      blockId,
      planId,
      routine?.title ?? 'Routine',
      nextPlanBlockOrderIndex(planId),
      opts?.placement ?? 'auto',
      opts?.bufferMinutes ?? null,
      routineTemplateId,
      now,
      now,
    ]
  );
  templateSteps.forEach((step, index) => {
    const meta = parseRoutineStepMeta(step.metadata);
    const estimatedMinutes = Math.max(1, Math.round((meta.durationSeconds ?? 300) / 60));
    getDb().runSync(
      `INSERT INTO planBlockSteps (id, blockId, templateStepId, title, estimatedMinutes, actualMinutes, orderIndex, placement, completedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 'auto', NULL, ?, ?)`,
      [uuidv4(), blockId, step.id, step.title, estimatedMinutes, index, now, now]
    );
  });
  return blockId;
}

export function addPlanBlockTask(
  planId: string,
  title: string,
  durationMinutes: number,
  opts?: { placement?: PlacementBehavior; bufferMinutes?: number; linkedItemId?: string },
): string {
  const now = Date.now();
  const blockId = uuidv4();
  getDb().runSync(
    `INSERT INTO planBlocks (id, planId, type, title, orderIndex, placement, bufferMinutes, durationMinutes, actualMinutes, routineTemplateId, linkedItemId, completedAt, travelConfig, notes, createdAt, updatedAt)
     VALUES (?, ?, 'task', ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, ?, ?)`,
    [
      blockId,
      planId,
      title,
      nextPlanBlockOrderIndex(planId),
      opts?.placement ?? 'auto',
      opts?.bufferMinutes ?? null,
      durationMinutes,
      opts?.linkedItemId ?? null,
      now,
      now,
    ]
  );
  return blockId;
}

export function getTravelBlockForPlan(planId: string): PlanBlockRow | null {
  return getDb().getAllSync<PlanBlockRow>(
    `SELECT * FROM planBlocks WHERE planId = ? AND type = 'travel' LIMIT 1`,
    [planId]
  )[0] ?? null;
}

// Travel is a single toggleable feature per plan (spec-adjacent: you travel
// once to the anchor event, not several times), not a repeatable "Add" item
// like Routine/Task — so this upserts the plan's one travel block instead of
// always inserting a new row. Duration/buffer live BOTH at the row's own
// columns (so calculateBlockRequiredDuration/buildBackwardsSchedule, which
// only look at PlanBlockCalc's generic fields, work without a type-specific
// carve-out) AND inside travelConfig (source/distanceMeters/estimatedAt,
// startLocation/destination/mode — fields no other block type has).
export function upsertPlanBlockTravel(
  planId: string,
  title: string,
  config: TravelConfig,
  opts?: { placement?: PlacementBehavior },
): string {
  const now = Date.now();
  const travelConfigJson = JSON.stringify(config);
  const placement = opts?.placement ?? 'keep-near-event';
  const existing = getTravelBlockForPlan(planId);
  if (existing) {
    getDb().runSync(
      `UPDATE planBlocks SET title = ?, placement = ?, bufferMinutes = ?, durationMinutes = ?, travelConfig = ?, updatedAt = ? WHERE id = ?`,
      [title, placement, config.bufferMinutes ?? 0, config.durationMinutes, travelConfigJson, now, existing.id]
    );
    return existing.id;
  }
  const blockId = uuidv4();
  getDb().runSync(
    `INSERT INTO planBlocks (id, planId, type, title, orderIndex, placement, bufferMinutes, durationMinutes, actualMinutes, routineTemplateId, linkedItemId, completedAt, travelConfig, notes, createdAt, updatedAt)
     VALUES (?, ?, 'travel', ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, NULL, ?, ?)`,
    [blockId, planId, title, nextPlanBlockOrderIndex(planId), placement, config.bufferMinutes ?? 0, config.durationMinutes, travelConfigJson, now, now]
  );
  return blockId;
}

export function updatePlanBlock(
  blockId: string,
  updates: Partial<{
    title: string;
    placement: PlacementBehavior;
    bufferMinutes: number | null;
    durationMinutes: number | null;
    travelConfig: string | null;
    notes: string | null;
  }>,
): void {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(Date.now());
  values.push(blockId);
  getDb().runSync(`UPDATE planBlocks SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deletePlanBlock(blockId: string): void {
  getDb().runSync(`DELETE FROM planBlockSteps WHERE blockId = ?`, [blockId]);
  getDb().runSync(`DELETE FROM planBlocks WHERE id = ?`, [blockId]);
}

export interface PlanBlockWithSteps extends PlanBlockRow {
  steps: PlanBlockStepRow[];
}

export function getPlanBlocks(planId: string): PlanBlockWithSteps[] {
  const blocks = getDb().getAllSync<PlanBlockRow>(
    `SELECT * FROM planBlocks WHERE planId = ? ORDER BY orderIndex ASC`,
    [planId]
  );
  return blocks.map((block) => ({
    ...block,
    steps:
      block.type === 'routine'
        ? getDb().getAllSync<PlanBlockStepRow>(
            `SELECT * FROM planBlockSteps WHERE blockId = ? ORDER BY orderIndex ASC`,
            [block.id]
          )
        : [],
  }));
}

export function togglePlanBlockComplete(blockId: string, completed: boolean): void {
  getDb().runSync(
    `UPDATE planBlocks SET completedAt = ?, updatedAt = ? WHERE id = ?`,
    [completed ? Date.now() : null, Date.now(), blockId]
  );
}

// Records actualMinutes (elapsed since the block/routine session started
// tracking, where available) alongside completion — the data model this
// leaves in place for a future duration-learning pass, per spec section 9.
export function togglePlanBlockStepComplete(stepId: string, completed: boolean, actualMinutes?: number): void {
  getDb().runSync(
    `UPDATE planBlockSteps SET completedAt = ?, actualMinutes = ?, updatedAt = ? WHERE id = ?`,
    [completed ? Date.now() : null, completed ? actualMinutes ?? null : null, Date.now(), stepId]
  );
}

export function reorderPlanBlocks(planId: string, orderedBlockIds: string[]): void {
  const now = Date.now();
  orderedBlockIds.forEach((id, index) => {
    getDb().runSync(`UPDATE planBlocks SET orderIndex = ?, updatedAt = ? WHERE id = ? AND planId = ?`, [index, now, id, planId]);
  });
}

export function reorderPlanBlockSteps(blockId: string, orderedStepIds: string[]): void {
  const now = Date.now();
  orderedStepIds.forEach((id, index) => {
    getDb().runSync(`UPDATE planBlockSteps SET orderIndex = ?, updatedAt = ? WHERE id = ? AND blockId = ?`, [index, now, id, blockId]);
  });
}

// Usual departure point, prefilled into a new Travel block's startLocation —
// stored as a plain app setting (not per-plan) so it's set once and reused.
export function getDefaultDeparturePoint(): string {
  return getAppSetting<string>('planBackwards.defaultDeparture', '');
}

export function setDefaultDeparturePoint(location: string): void {
  setAppSetting('planBackwards.defaultDeparture', location);
}

// Durable assistant conversation (survives app restart/crash) — stores the
// whole thread (display turns + raw Gemini history + any pending confirmation).
// Web mirrors this in localStorage (see database.web.ts).
export function getAssistantConversation<T>(): T | null {
  return getAppSetting<T | null>('assistant.conversation', null);
}

export function setAssistantConversation(data: unknown): void {
  setAppSetting('assistant.conversation', data);
}

export function clearAssistantConversation(): void {
  setAppSetting('assistant.conversation', null);
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

  // Focus timeline (opt-in, e.g. for stimulants): models onset -> peak -> fade
  // as hour ranges elapsed since the dose was taken, since real onset/peak/
  // wear-off varies dose to dose (food, tolerance, activity) rather than
  // landing on one fixed hour. All six must be set, each min <= max, and the
  // midpoints ordered onset <= peak <= fadeEnd — see `utils/focusCurve.ts`'s
  // `computeFocusState`.
  focusCurveEnabled?: boolean;
  onsetMinHours?: number;   // earliest hours until the effect starts building
  onsetMaxHours?: number;   // latest hours until the effect starts building
  peakMinHours?: number;    // earliest hours until peak effect
  peakMaxHours?: number;    // latest hours until peak effect
  fadeEndMinHours?: number; // earliest hours until fully worn off
  fadeEndMaxHours?: number; // latest hours until fully worn off
}

export type { NutrientProfile } from '../utils/nutrientTotals';

// Supplements are a lighter sibling of medications — no stock/timer/Live-Activity
// machinery, just dosing + a fixed-but-extensible micronutrient profile (see
// NutrientProfile) for daily electrolyte/micronutrient tracking.
export interface SupplementMeta {
  dose?: string;
  nutrients?: NutrientProfile;
}

export function getSupplements(): Item[] {
  return getItemsByType('supplement');
}

export function createSupplement(title: string, meta: SupplementMeta): string {
  const id = uuid();
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO items (id, type, title, status, metadata, createdAt, updatedAt)
     VALUES (?, 'supplement', ?, 'active', ?, ?, ?)`,
    [id, title, JSON.stringify(meta), now, now]
  );
  logActivity(id, 'created');
  syncItemToRemote(id);
  return id;
}

// Merges into existing metadata rather than replacing it outright, matching updateMedication.
export function updateSupplement(id: string, title: string, meta: SupplementMeta): void {
  const item = getItemWithMetadata(id);
  const existing: SupplementMeta = item?.metadata ? JSON.parse(item.metadata) : {};
  updateItem(id, { title });
  updateItemMetadata(id, { ...existing, ...meta });
  logActivity(id, 'edited');
}

// Nutrients are snapshotted into the log at the moment a dose is logged, so editing
// a supplement's nutrient values later never retroactively changes historical daily totals.
export function logSupplementTaken(itemId: string, takenAt: number = Date.now()): void {
  const item = getItemWithMetadata(itemId);
  if (!item) return;
  const meta: SupplementMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
     VALUES (?, ?, 'supplement-taken', ?, ?, ?)`,
    [uuid(), itemId, takenAt, JSON.stringify({ nutrients: meta.nutrients ?? {} }), now]
  );
}

export function getSupplementLogs(itemId: string, limit = 10): ActivityLog[] {
  return getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'supplement-taken' ORDER BY timestamp DESC LIMIT ?`,
    [itemId, limit]
  );
}

export function getTodayNutrientTotals(): NutrientProfile {
  const today = formatDate(new Date());
  const startOfDay = new Date(`${today}T00:00:00`).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  const logs = getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE actionType = 'supplement-taken' AND timestamp >= ? AND timestamp < ? ORDER BY timestamp DESC`,
    [startOfDay, endOfDay]
  );
  return sumNutrientLogs(logs);
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

export function logMedicationTaken(itemId: string, takenAt: number = Date.now(), startTimer = false, amount = 1, overrideReason?: string): void {
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
      // Set only when this dose was taken before `minHoursBetweenDoses`
      // elapsed and the user explicitly overrode the caution — see
      // `promptTooSoonOverride` in `utils/medicationOverride.ts`.
      overrideReason: overrideReason || undefined,
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
      // Attribute evidence only for actual Habits — this branch also covers
      // repeating Tasks, which have no attributeContributions config and
      // shouldn't generate any (getHabitAttributeContributions would just
      // return [] for them anyway, but the type check makes the intent explicit).
      if (item.type === 'habit') {
        recordHabitCompletionEvidence(id, now);
      }
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

// A canonical Domain (metadata.canonical, one of the 8 baseline Harada
// Domains every user gets from onboarding) is a mandatory minimum — never
// deletable, only renameable. Guarded here (not just in AreasScreen's UI)
// so no other code path — e.g. convertAreaToSkill — can drop below 8.
export function deleteItem(id: string): void {
  const item = getItemWithMetadata(id);
  if (item?.type === 'area') {
    const meta = item.metadata ? JSON.parse(item.metadata) : {};
    if (meta.canonical === true) return;
  }
  getDb().runSync(
    `UPDATE items SET deletedAt = ?, updatedAt = ? WHERE id = ?`,
    [Date.now(), Date.now(), id]
  );
  syncItemToRemote(id);
}

export type GtdDestination =
  | 'today' | 'morning' | 'evening'
  | 'project' | 'area' | 'habit' | 'medication' | 'supplement' | 'object'
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
    case 'supplement':
      db.runSync(
        'UPDATE items SET type = ?, status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['supplement', 'active', JSON.stringify({ ...meta, gtdContext: 'supplement' }), now, id]
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

// All completed workout-session createdAt timestamps since sinceMs, for the
// Trends frequency heatmap.
export function getWorkoutSessionDates(sinceMs: number): number[] {
  const rows = getDb().getAllSync<{ createdAt: number }>(
    `SELECT createdAt FROM items WHERE type = 'workout-session' AND status = 'completed' AND createdAt >= ? AND deletedAt IS NULL ORDER BY createdAt ASC`,
    [sinceMs]
  );
  return rows.map((r) => r.createdAt);
}

// All workout-set-logged rows for one exercise, oldest first — unlike
// getLastSessionSetsForExercise (capped at 200, most-recent-first, for "last
// time" lookups), this is uncapped and chronological for a full progression chart.
export function getExerciseSetLogHistory(exerciseId: string): ActivityLog[] {
  return getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'workout-set-logged' ORDER BY timestamp ASC`,
    [exerciseId]
  );
}

// All workout-set-logged rows across every exercise in a time window, for
// volume and muscle-group-balance aggregation.
export function getWorkoutSetLogsInRange(startMs: number, endMs: number): ActivityLog[] {
  return getDb().getAllSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE actionType = 'workout-set-logged' AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC`,
    [startMs, endMs]
  );
}
