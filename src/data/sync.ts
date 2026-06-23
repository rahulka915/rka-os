import Dexie from 'dexie';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import {
  activityFromRemote,
  activityToRemote,
  exerciseMediaFromRemote,
  exerciseMediaToRemote,
  exerciseSessionFromRemote,
  exerciseSessionToRemote,
  itemFromRemote,
  itemInstanceFromRemote,
  itemInstanceToRemote,
  itemTagFromRemote,
  itemTagToRemote,
  itemToRemote,
  linkFromRemote,
  linkToRemote,
  setEntryFromRemote,
  setEntryToRemote,
  tagFromRemote,
  tagToRemote,
  workoutSessionFromRemote,
  workoutSessionToRemote,
} from './serializers';
import type { ActivityLog, EntityLink, ExerciseMedia, ExerciseSession, Item, ItemInstance, ItemTag, SetEntry, Tag, WorkoutSession } from '../db/db';

type TableName =
  | 'items'
  | 'itemInstances'
  | 'tags'
  | 'itemTags'
  | 'entityLinks'
  | 'activityLogs'
  | 'workoutSessions'
  | 'exerciseSessions'
  | 'setEntries'
  | 'exerciseMedia';

type AnyRow = Item | ItemInstance | Tag | ItemTag | EntityLink | ActivityLog | WorkoutSession | ExerciseSession | SetEntry | ExerciseMedia;

type SyncAdapter = {
  remoteTable: string;
  toRemote: (row: AnyRow, userId: string) => Record<string, any>;
  fromRemote: (row: any) => AnyRow;
};

const adapters: Record<TableName, SyncAdapter> = {
  items: {
    remoteTable: 'items',
    toRemote: (row, userId) => itemToRemote(row as Item, userId),
    fromRemote: row => itemFromRemote(row),
  },
  itemInstances: {
    remoteTable: 'item_instances',
    toRemote: (row, userId) => itemInstanceToRemote(row as ItemInstance, userId),
    fromRemote: row => itemInstanceFromRemote(row),
  },
  tags: {
    remoteTable: 'tags',
    toRemote: (row, userId) => tagToRemote(row as Tag, userId),
    fromRemote: row => tagFromRemote(row),
  },
  itemTags: {
    remoteTable: 'item_tags',
    toRemote: (row, userId) => itemTagToRemote(row as ItemTag, userId, ((row as ItemTag).id ?? crypto.randomUUID()) as string),
    fromRemote: row => itemTagFromRemote(row),
  },
  entityLinks: {
    remoteTable: 'entity_links',
    toRemote: (row, userId) => linkToRemote(row as EntityLink, userId),
    fromRemote: row => linkFromRemote(row),
  },
  activityLogs: {
    remoteTable: 'activity_logs',
    toRemote: (row, userId) => activityToRemote(row as ActivityLog, userId),
    fromRemote: row => activityFromRemote(row),
  },
  workoutSessions: {
    remoteTable: 'workout_sessions',
    toRemote: (row, userId) => workoutSessionToRemote(row as WorkoutSession, userId),
    fromRemote: row => workoutSessionFromRemote(row),
  },
  exerciseSessions: {
    remoteTable: 'exercise_sessions',
    toRemote: (row, userId) => exerciseSessionToRemote(row as ExerciseSession, userId),
    fromRemote: row => exerciseSessionFromRemote(row),
  },
  setEntries: {
    remoteTable: 'set_entries',
    toRemote: (row, userId) => setEntryToRemote(row as SetEntry, userId),
    fromRemote: row => setEntryFromRemote(row),
  },
  exerciseMedia: {
    remoteTable: 'exercise_media',
    toRemote: (row, userId) => exerciseMediaToRemote(row as ExerciseMedia, userId),
    fromRemote: row => exerciseMediaFromRemote(row),
  },
};

const remoteWriteStats: Record<TableName, number> = {
  items: 0,
  itemInstances: 0,
  tags: 0,
  itemTags: 0,
  entityLinks: 0,
  activityLogs: 0,
  workoutSessions: 0,
  exerciseSessions: 0,
  setEntries: 0,
  exerciseMedia: 0,
};
let isProcessingQueue = false;

let installedDb: Dexie | null = null;
let activeUserId: string | null = null;
let activeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
let syncGeneration = 0;
let suppressRemoteWritesDepth = 0;
const originalTableMethods = new Map<TableName, {
  add?: (obj: AnyRow, key?: any) => Promise<any>;
  put?: (obj: AnyRow, key?: any) => Promise<any>;
  update?: (key: any, changes: Record<string, any>) => Promise<any>;
  delete?: (key: any) => Promise<any>;
  clear?: () => Promise<any>;
  bulkAdd?: (objs: AnyRow[]) => Promise<any>;
  bulkPut?: (objs: AnyRow[]) => Promise<any>;
  bulkDelete?: (keys: any[]) => Promise<any>;
}>();

function isRemoteWriteSuppressed() {
  return suppressRemoteWritesDepth > 0;
}

function pushRemoteWriteSuppression() {
  suppressRemoteWritesDepth += 1;
}

function popRemoteWriteSuppression() {
  suppressRemoteWritesDepth = Math.max(0, suppressRemoteWritesDepth - 1);
}

function getTable(name: TableName) {
  if (!installedDb) throw new Error('Supabase sync bridge was not installed');
  return ((installedDb as any)[name] ?? installedDb.table(name)) as Dexie.Table<AnyRow, string>;
}

async function remoteRead(name: TableName, userId: string) {
  if (!supabase) return [];
  const { remoteTable } = adapters[name];
  const { data, error } = await supabase
    .from(remoteTable)
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) throw error;
  return (data ?? []).map(row => adapters[name].fromRemote(row));
}

async function remoteBulkUpsert(name: TableName, rows: AnyRow[], userId: string) {
  if (!supabase || isRemoteWriteSuppressed() || rows.length === 0) return;
  remoteWriteStats[name] += rows.length;
  const payloads = rows.map(row => adapters[name].toRemote(row, userId));
  const { error } = await supabase.from(adapters[name].remoteTable).upsert(payloads, { onConflict: 'id' });
  if (error) throw error;
}

async function remoteBulkDelete(name: TableName, ids: string[]) {
  if (!supabase || isRemoteWriteSuppressed() || ids.length === 0) return;
  const { error } = await supabase.from(adapters[name].remoteTable).delete().in('id', ids);
  if (error) throw error;
}

async function remoteClear(name: TableName, userId: string) {
  if (!supabase || isRemoteWriteSuppressed()) return;
  const { error } = await supabase.from(adapters[name].remoteTable).delete().eq('user_id', userId);
  if (error) throw error;
}

export async function processSyncQueue() {
  if (isProcessingQueue || !supabase || !activeUserId || !navigator.onLine || !installedDb) return;
  isProcessingQueue = true;

  try {
    const queueTable = installedDb.table('syncQueue');
    const entries = await queueTable.orderBy('createdAt').toArray();
    
    let i = 0;
    while (i < entries.length) {
      if (!navigator.onLine) break;
      const entry = entries[i];
      const batch = [entry];

      // Batch consecutive operations of the same type and table
      while (i + 1 < entries.length && 
             entries[i + 1].operation === entry.operation && 
             entries[i + 1].tableName === entry.tableName) {
        batch.push(entries[i + 1]);
        i++;
      }

      try {
        if (entry.operation === 'upsert') {
          const table = getTable(entry.tableName as TableName);
          const recordIds = Array.from(new Set(batch.map(b => b.recordId)));
          const rows = (await table.bulkGet(recordIds)).filter(Boolean);
          if (rows.length > 0) {
            await remoteBulkUpsert(entry.tableName as TableName, rows as AnyRow[], activeUserId);
          }
        } else if (entry.operation === 'delete') {
          const recordIds = Array.from(new Set(batch.map(b => b.recordId)));
          await remoteBulkDelete(entry.tableName as TableName, recordIds);
        } else if (entry.operation === 'clear') {
          await remoteClear(entry.tableName as TableName, activeUserId);
        }

        // Delete all processed entries from the local sync queue
        await queueTable.bulkDelete(batch.map(b => b.id));
      } catch (error) {
        console.error('Failed to process sync queue batch', batch, error);
        break; // Stop processing to preserve order
      }
      i++;
    }
  } finally {
    isProcessingQueue = false;
  }
}

export function triggerSyncQueueProcessing() {
  if (!isProcessingQueue) {
    processSyncQueue().catch(console.error);
  }
}

export async function awaitPendingRemoteWrites() {
  await processSyncQueue();
}

function clearPendingRemoteWriteTracking() {
  // Queue is now persistent in Dexie.
}

export function resetRemoteSyncDebugState() {
  clearPendingRemoteWriteTracking();
  resetRemoteWriteStats();
}

async function hydrateUserCache(userId: string, generation: number) {
  if (!installedDb || !hasSupabaseConfig || !supabase) return;
  pushRemoteWriteSuppression();
  try {
    const queueTable = installedDb.table('syncQueue');
    const tableNames = Object.keys(adapters) as TableName[];
    for (const name of tableNames) {
      if (generation !== syncGeneration) return;
      const table = getTable(name);
      try {
        const rows = await remoteRead(name, userId);
        const remoteIds = new Set(rows.map(r => r.id));

        const pendingOps = await queueTable.where('tableName').equals(name).toArray();
        const pendingUpserts = new Set(pendingOps.filter(q => q.operation === 'upsert').map(q => q.recordId));
        const pendingDeletes = new Set(pendingOps.filter(q => q.operation === 'delete').map(q => q.recordId));

        await installedDb.transaction('rw', table, async () => {
          const localKeys = await table.toCollection().primaryKeys();
          const keysToDelete = localKeys.filter(k => !remoteIds.has(k as string) && !pendingUpserts.has(k as string));
          
          if (keysToDelete.length > 0) {
            await table.bulkDelete(keysToDelete);
          }

          const rowsToPut = rows.filter(r => !pendingUpserts.has(r.id) && !pendingDeletes.has(r.id));
          if (rowsToPut.length > 0) {
            await table.bulkPut(rowsToPut as AnyRow[]);
          }
        });
      } catch (error) {
        console.error(`Supabase hydrate failed for table ${name}`, error);
        throw error;
      }
    }
  } finally {
    popRemoteWriteSuppression();
  }
  triggerSyncQueueProcessing();
}

function stopRealtime() {
  if (activeChannel && supabase) {
    supabase.removeChannel(activeChannel);
  }
  activeChannel = null;
}

async function applyRemotePayload(name: TableName, payload: { eventType: string; new: any; old: any }) {
  if (!installedDb) return;
  const original = originalTableMethods.get(name);
  const { eventType } = payload;

  const recordId = eventType === 'DELETE' ? payload.old?.id : payload.new?.id;
  if (!recordId) return;

  const queueTable = installedDb.table('syncQueue');
  const pending = await queueTable.where('recordId').equals(recordId).toArray();
  if (pending.length > 0) return;

  if (eventType === 'DELETE') {
    if (original?.delete) void original.delete(recordId);
    return;
  }

  const row = adapters[name].fromRemote(payload.new);
  if (original?.put) {
    void original.put(row as AnyRow);
  }
}

function startRealtime(userId: string) {
  if (!supabase) return;
  stopRealtime();
  activeChannel = supabase.channel(`rka-os-sync:${userId}`);

  (Object.keys(adapters) as TableName[]).forEach(name => {
    activeChannel!.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: adapters[name].remoteTable,
        filter: `user_id=eq.${userId}`,
      },
      payload => applyRemotePayload(name, payload as any)
    );
  });

  void activeChannel.subscribe();
}

function patchTableMethods(name: TableName) {
  if (!installedDb) return;
  const table = getTable(name) as any;
  const originalAdd = table.add.bind(table);
  const originalPut = table.put.bind(table);
  const originalUpdate = table.update.bind(table);
  const originalDelete = table.delete.bind(table);
  const originalClear = table.clear.bind(table);
  const originalBulkAdd = table.bulkAdd.bind(table);
  const originalBulkPut = table.bulkPut.bind(table);
  const originalBulkDelete = table.bulkDelete.bind(table);

  originalTableMethods.set(name, {
    add: originalAdd,
    put: originalPut,
    update: originalUpdate,
    delete: originalDelete,
    clear: originalClear,
    bulkAdd: originalBulkAdd,
    bulkPut: originalBulkPut,
    bulkDelete: originalBulkDelete,
  });

  const queueTable = installedDb.table('syncQueue');

  table.add = async (obj: AnyRow, key?: any) => {
    const result = await originalAdd(obj, key);
    const userId = activeUserId;
    if (userId && hasSupabaseConfig && supabase && !isRemoteWriteSuppressed()) {
      await queueTable.put({
        id: crypto.randomUUID(),
        tableName: name,
        operation: 'upsert',
        recordId: obj.id,
        createdAt: Date.now()
      });
      triggerSyncQueueProcessing();
    }
    return result;
  };

  table.put = async (obj: AnyRow, key?: any) => {
    const result = await originalPut(obj, key);
    const userId = activeUserId;
    if (userId && hasSupabaseConfig && supabase && !isRemoteWriteSuppressed()) {
      await queueTable.put({
        id: crypto.randomUUID(),
        tableName: name,
        operation: 'upsert',
        recordId: obj.id,
        createdAt: Date.now()
      });
      triggerSyncQueueProcessing();
    }
    return result;
  };

  table.update = async (key: any, changes: Record<string, any>) => {
    const result = await originalUpdate(key, changes);
    const userId = activeUserId;
    if (userId && hasSupabaseConfig && supabase && !isRemoteWriteSuppressed()) {
      const current = await table.get(key);
      if (current) {
        await queueTable.put({
          id: crypto.randomUUID(),
          tableName: name,
          operation: 'upsert',
          recordId: current.id,
          createdAt: Date.now()
        });
        triggerSyncQueueProcessing();
      }
    }
    return result;
  };

  table.delete = async (key: any) => {
    const result = await originalDelete(key);
    if (activeUserId && hasSupabaseConfig && supabase && !isRemoteWriteSuppressed()) {
      await queueTable.put({
        id: crypto.randomUUID(),
        tableName: name,
        operation: 'delete',
        recordId: String(key),
        createdAt: Date.now()
      });
      triggerSyncQueueProcessing();
    }
    return result;
  };

  table.clear = async () => {
    const result = await originalClear();
    if (activeUserId && hasSupabaseConfig && supabase && !isRemoteWriteSuppressed()) {
      await queueTable.put({
        id: crypto.randomUUID(),
        tableName: name,
        operation: 'clear',
        recordId: '',
        createdAt: Date.now()
      });
      triggerSyncQueueProcessing();
    }
    return result;
  };

  table.bulkAdd = async (objs: AnyRow[]) => {
    const result = await originalBulkAdd(objs);
    if (activeUserId && hasSupabaseConfig && supabase && !isRemoteWriteSuppressed()) {
      await queueTable.bulkPut(objs.map((obj: AnyRow) => ({
        id: crypto.randomUUID(),
        tableName: name,
        operation: 'upsert',
        recordId: obj.id,
        createdAt: Date.now()
      })));
      triggerSyncQueueProcessing();
    }
    return result;
  };

  table.bulkPut = async (objs: AnyRow[]) => {
    const result = await originalBulkPut(objs);
    if (activeUserId && hasSupabaseConfig && supabase && !isRemoteWriteSuppressed()) {
      await queueTable.bulkPut(objs.map((obj: AnyRow) => ({
        id: crypto.randomUUID(),
        tableName: name,
        operation: 'upsert',
        recordId: obj.id,
        createdAt: Date.now()
      })));
      triggerSyncQueueProcessing();
    }
    return result;
  };

  table.bulkDelete = async (keys: any[]) => {
    const result = await originalBulkDelete(keys);
    if (activeUserId && hasSupabaseConfig && supabase && !isRemoteWriteSuppressed()) {
      await queueTable.bulkPut(keys.map(key => ({
        id: crypto.randomUUID(),
        tableName: name,
        operation: 'delete',
        recordId: String(key),
        createdAt: Date.now()
      })));
      triggerSyncQueueProcessing();
    }
    return result;
  };
}

export function installSupabaseSyncBridge(db: Dexie) {
  if (installedDb) return;
  installedDb = db;
  (Object.keys(adapters) as TableName[]).forEach(patchTableMethods);
  if (typeof window !== 'undefined') {
    window.addEventListener('online', triggerSyncQueueProcessing);
  }
}

export function getSupabaseSyncUserId() {
  return activeUserId;
}

export function getRemoteWriteSuppressionDepth() {
  return suppressRemoteWritesDepth;
}

export function getRemoteWriteStats() {
  return { ...remoteWriteStats };
}

export function resetRemoteWriteStats() {
  (Object.keys(remoteWriteStats) as TableName[]).forEach(name => {
    remoteWriteStats[name] = 0;
  });
}

export async function forceSyncAll() {
  if (!installedDb || !activeUserId || !supabase) return;
  
  // 1. Push all local data to remote
  pushRemoteWriteSuppression();
  try {
    const tableNames = Object.keys(adapters) as TableName[];
    for (const name of tableNames) {
      const table = getTable(name);
      const allLocal = await table.toArray();
      if (allLocal.length > 0) {
        await remoteBulkUpsert(name, allLocal as AnyRow[], activeUserId);
      }
    }
  } finally {
    popRemoteWriteSuppression();
  }

  // 2. Clear sync queue since everything is pushed
  await installedDb.table('syncQueue').clear();

  // 3. Pull all remote data
  syncGeneration++;
  await hydrateUserCache(activeUserId, syncGeneration);
}

export async function setSupabaseSyncUser(user: { id: string } | null) {
  activeUserId = user?.id ?? null;
  syncGeneration += 1;

  if (!installedDb || !hasSupabaseConfig || !supabase) {
    stopRealtime();
    return;
  }

  stopRealtime();

  if (!activeUserId) {
    pushRemoteWriteSuppression();
    try {
      await installedDb.table('syncQueue').clear();
      const tableNames = Object.keys(adapters) as TableName[];
      for (const name of tableNames) {
        await getTable(name).clear();
      }
    } finally {
      popRemoteWriteSuppression();
    }
    return;
  }

  const generation = syncGeneration;
  await hydrateUserCache(activeUserId, generation);
  if (generation === syncGeneration) {
    startRealtime(activeUserId);
  }
}

export function withRemoteWritesSuppressed<T>(run: () => T) {
  pushRemoteWriteSuppression();
  try {
    return run();
  } finally {
    popRemoteWriteSuppression();
  }
}

export async function withRemoteWritesSuppressedAsync<T>(run: () => Promise<T>) {
  pushRemoteWriteSuppression();
  try {
    return await run();
  } finally {
    popRemoteWriteSuppression();
  }
}
