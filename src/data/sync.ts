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

let installedDb: Dexie | null = null;
let activeUserId: string | null = null;
let activeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
let syncGeneration = 0;
let suppressRemoteWrites = false;

function getTable(name: TableName) {
  if (!installedDb) throw new Error('Supabase sync bridge was not installed');
  return installedDb.table(name);
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

async function remoteUpsert(name: TableName, row: AnyRow, userId: string) {
  if (!supabase || suppressRemoteWrites) return;
  const payload = adapters[name].toRemote(row, userId);
  const { error } = await supabase.from(adapters[name].remoteTable).upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function remoteDelete(name: TableName, id: string) {
  if (!supabase || suppressRemoteWrites) return;
  const { error } = await supabase.from(adapters[name].remoteTable).delete().eq('id', id);
  if (error) throw error;
}

async function remoteClear(name: TableName, userId: string) {
  if (!supabase || suppressRemoteWrites) return;
  const { error } = await supabase.from(adapters[name].remoteTable).delete().eq('user_id', userId);
  if (error) throw error;
}

async function hydrateUserCache(userId: string, generation: number) {
  if (!installedDb || !hasSupabaseConfig || !supabase) return;
  suppressRemoteWrites = true;
  try {
    const tableNames = Object.keys(adapters) as TableName[];
    for (const name of tableNames) {
      if (generation !== syncGeneration) return;
      const table = getTable(name);
      const rows = await remoteRead(name, userId);
      await table.clear();
      if (rows.length > 0) {
        await table.bulkPut(rows as AnyRow[]);
      }
    }
  } finally {
    suppressRemoteWrites = false;
  }
}

function stopRealtime() {
  if (activeChannel && supabase) {
    supabase.removeChannel(activeChannel);
  }
  activeChannel = null;
}

function applyRemotePayload(name: TableName, payload: { eventType: string; new: any; old: any }) {
  if (!installedDb) return;
  const table = getTable(name);
  const { eventType } = payload;
  if (eventType === 'DELETE') {
    const id = payload.old?.id;
    if (id) void table.delete(id);
    return;
  }

  const row = adapters[name].fromRemote(payload.new);
  void table.put(row as AnyRow);
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

  table.add = async (obj: AnyRow, key?: any) => {
    const result = await originalAdd(obj, key);
    const userId = activeUserId;
    if (userId && hasSupabaseConfig && supabase && !suppressRemoteWrites) {
      await remoteUpsert(name, obj, userId);
    }
    return result;
  };

  table.put = async (obj: AnyRow, key?: any) => {
    const result = await originalPut(obj, key);
    const userId = activeUserId;
    if (userId && hasSupabaseConfig && supabase && !suppressRemoteWrites) {
      await remoteUpsert(name, obj, userId);
    }
    return result;
  };

  table.update = async (key: any, changes: Record<string, any>) => {
    const result = await originalUpdate(key, changes);
    const userId = activeUserId;
    if (userId && hasSupabaseConfig && supabase && !suppressRemoteWrites) {
      const current = await table.get(key);
      if (current) await remoteUpsert(name, current, userId);
    }
    return result;
  };

  table.delete = async (key: any) => {
    const result = await originalDelete(key);
    if (activeUserId && hasSupabaseConfig && supabase && !suppressRemoteWrites) {
      await remoteDelete(name, String(key));
    }
    return result;
  };

  table.clear = async () => {
    const result = await originalClear();
    if (activeUserId && hasSupabaseConfig && supabase && !suppressRemoteWrites) {
      await remoteClear(name, activeUserId);
    }
    return result;
  };

  table.bulkAdd = async (objs: AnyRow[]) => {
    const result = await originalBulkAdd(objs);
    if (activeUserId && hasSupabaseConfig && supabase && !suppressRemoteWrites) {
      for (const obj of objs) await remoteUpsert(name, obj, activeUserId);
    }
    return result;
  };

  table.bulkPut = async (objs: AnyRow[]) => {
    const result = await originalBulkPut(objs);
    if (activeUserId && hasSupabaseConfig && supabase && !suppressRemoteWrites) {
      for (const obj of objs) await remoteUpsert(name, obj, activeUserId);
    }
    return result;
  };

  table.bulkDelete = async (keys: any[]) => {
    const result = await originalBulkDelete(keys);
    if (activeUserId && hasSupabaseConfig && supabase && !suppressRemoteWrites) {
      for (const key of keys) await remoteDelete(name, String(key));
    }
    return result;
  };
}

export function installSupabaseSyncBridge(db: Dexie) {
  if (installedDb) return;
  installedDb = db;
  (Object.keys(adapters) as TableName[]).forEach(patchTableMethods);
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
    suppressRemoteWrites = true;
    try {
      const tableNames = Object.keys(adapters) as TableName[];
      for (const name of tableNames) {
        await getTable(name).clear();
      }
    } finally {
      suppressRemoteWrites = false;
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
  suppressRemoteWrites = true;
  try {
    return run();
  } finally {
    suppressRemoteWrites = false;
  }
}
