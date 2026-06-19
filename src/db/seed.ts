import { db } from './db';
import { createEntity, linkEntities, logActivity } from './actions';
import { v4 as uuidv4 } from 'uuid';
import generatedExercises from './generated-exercises.json';
import { getCurrentUserId } from '../data/runtime';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import {
  awaitPendingRemoteWrites,
  getRemoteWriteStats,
  getRemoteWriteSuppressionDepth,
  getSupabaseSyncUserId,
  resetRemoteSyncDebugState,
  withRemoteWritesSuppressedAsync,
} from '../data/sync';

type SeedCounts = {
  items: number;
  itemInstances: number;
  tags: number;
  itemTags: number;
  entityLinks: number;
  activityLogs: number;
  workoutSessions: number;
  exerciseSessions: number;
  setEntries: number;
  exerciseMedia: number;
};

export type SeedMockDataResult = {
  userId: string;
  syncUserId: string | null;
  remoteWriteSuppressionDepth: number;
  remoteWriteStats: Record<string, number>;
  localCounts: SeedCounts;
  remoteCounts: SeedCounts | null;
  remoteVerified: boolean;
};

type SeedProgressCallback = (message: string) => void;

const seedCountTables = [
  { local: 'items', remote: 'items' },
  { local: 'itemInstances', remote: 'item_instances' },
  { local: 'tags', remote: 'tags' },
  { local: 'itemTags', remote: 'item_tags' },
  { local: 'entityLinks', remote: 'entity_links' },
  { local: 'activityLogs', remote: 'activity_logs' },
  { local: 'workoutSessions', remote: 'workout_sessions' },
  { local: 'exerciseSessions', remote: 'exercise_sessions' },
  { local: 'setEntries', remote: 'set_entries' },
  { local: 'exerciseMedia', remote: 'exercise_media' },
] as const;

const remotePurgeOrder = [
  'set_entries',
  'exercise_sessions',
  'workout_sessions',
  'activity_logs',
  'item_instances',
  'item_tags',
  'entity_links',
  'exercise_media',
  'tags',
  'items',
] as const;

async function resolveSeedUserId() {
  const currentUserId = getCurrentUserId();
  if (currentUserId) return currentUserId;

  if (supabase) {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (data.user?.id) {
      throw new Error('You are signed into Supabase, but the app session has not hydrated yet. Please reload the app and try seeding again.');
    }
  }

  throw new Error('Please sign in before seeding demo data so it can persist through Supabase.');
}

async function countLocalRows(): Promise<SeedCounts> {
  const [items, itemInstances, tags, itemTags, entityLinks, activityLogs, workoutSessions, exerciseSessions, setEntries, exerciseMedia] = await Promise.all([
    db.items.count(),
    db.itemInstances.count(),
    db.tags.count(),
    db.itemTags.count(),
    db.entityLinks.count(),
    db.activityLogs.count(),
    db.workoutSessions.count(),
    db.exerciseSessions.count(),
    db.setEntries.count(),
    db.exerciseMedia.count(),
  ]);

  return { items, itemInstances, tags, itemTags, entityLinks, activityLogs, workoutSessions, exerciseSessions, setEntries, exerciseMedia };
}

async function countRemoteRows(userId: string): Promise<SeedCounts> {
  const client = supabase;
  if (!hasSupabaseConfig || !client) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before seeding.');
  }

  const results = await Promise.all(
    seedCountTables.map(async ({ remote, local }) => {
      const { count, error } = await client.from(remote).select('id', { count: 'exact', head: true }).eq('user_id', userId);
      if (error) throw error;
      return [local, count ?? 0] as const;
    })
  );

  return Object.fromEntries(results) as SeedCounts;
}

async function purgeRemoteRows(userId: string) {
  const client = supabase;
  if (!hasSupabaseConfig || !client) return;

  for (const table of remotePurgeOrder) {
    const { error } = await client.from(table).delete().eq('user_id', userId);
    if (error) throw error;
  }
}

export async function seedMockData(onProgress?: SeedProgressCallback): Promise<SeedMockDataResult> {
  const userId = await resolveSeedUserId();
  const now = new Date();
  const reportProgress = (message: string) => onProgress?.(message);

  reportProgress('Preparing Supabase sync state...');
  resetRemoteSyncDebugState();
  await awaitPendingRemoteWrites();
  reportProgress('Clearing previous demo data from Supabase...');
  await purgeRemoteRows(userId);

  reportProgress('Resetting local cache...');
  await withRemoteWritesSuppressedAsync(async () => {
    await db.items.clear();
    await db.itemInstances.clear();
    await db.tags.clear();
    await db.itemTags.clear();
    await db.entityLinks.clear();
    await db.activityLogs.clear();
    await db.workoutSessions.clear();
    await db.exerciseSessions.clear();
    await db.setEntries.clear();
    await db.exerciseMedia.clear();
  });

  // Helper: Get a date string offset by days
  const getDateStr = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  // ==========================================
  // 1. Areas
  // ==========================================
  reportProgress('Seeding areas and projects...');
  const healthArea = await createEntity('area', 'Health & Fitness', { color: '#10B981' }, 'active');
  const personalArea = await createEntity('area', 'Personal Growth', { color: '#8B5CF6' }, 'active');
  const workArea = await createEntity('area', 'Work & Career', { color: '#3B82F6' }, 'active');

  // ==========================================
  // 2. Projects
  // ==========================================
  const hypertrophyProject = await createEntity('project', 'Hypertrophy Block 1', { color: '#10B981' }, 'active');
  await linkEntities(healthArea, hypertrophyProject, 'contains');

  const readingProject = await createEntity('project', 'Read 12 Books', { color: '#8B5CF6' }, 'active');
  await linkEntities(personalArea, readingProject, 'contains');

  const startupProject = await createEntity('project', 'Launch MVP', { color: '#3B82F6' }, 'active');
  await linkEntities(workArea, startupProject, 'contains');

  // ==========================================
  // 3. Medications & History (Past 14 Days)
  // ==========================================
  reportProgress('Seeding medications and daily history...');
  const elvanse = await createEntity('medication', 'Elvanse', { dose: '50mg', frequency: 'daily', maxPerDay: 1, initialStock: 45, refillThreshold: 5 }, 'active', undefined, ['ADHD', 'Medicine']);
  const vitaminD = await createEntity('medication', 'Vitamin D3', { dose: '4000 IU', frequency: 'daily', maxPerDay: 1, initialStock: 90, refillThreshold: 10 }, 'active', undefined, ['Supplements']);

  // Log medication history for the past 14 days
  for (let i = -14; i <= 0; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(8, 30, 0, 0); // taken around 8:30am
    
    // Elvanse
    await db.activityLogs.add({
      id: uuidv4(),
      entityId: elvanse,
      actionType: 'medication-taken',
      timestamp: d.getTime(),
      details: { dose: '50mg', amountTaken: 1 }
    });
    
    // Vitamin D (skipped a few days)
    if (i !== -5 && i !== -2) {
      await db.activityLogs.add({
        id: uuidv4(),
        entityId: vitaminD,
        actionType: 'medication-taken',
        timestamp: d.getTime() + 1000 * 60 * 5, // taken 5 mins later
        details: { dose: '4000 IU', amountTaken: 1 }
      });
    }
  }

  // ==========================================
  // 4. Habits & Instances (Past 14 Days)
  // ==========================================
  reportProgress('Seeding habits and calendar instances...');
  const habitReading = await createEntity('habit', 'Read 20 pages', { rrule: 'FREQ=DAILY', timeOfDay: 'evening' }, 'active', undefined, ['Reading']);
  const habitWater = await createEntity('habit', 'Drink 2.5L Water', { rrule: 'FREQ=DAILY' }, 'active', undefined, ['Health']);

  for (let i = -14; i <= 0; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    // Read 20 pages (completed most days)
    const readInstance = uuidv4();
    await db.itemInstances.add({
      id: readInstance,
      itemId: habitReading,
      scheduledDate: dateStr,
      status: i !== -3 ? 'completed' : 'skipped',
      createdAt: d.getTime(),
      updatedAt: d.getTime()
    });
    if (i !== -3) await logActivity(habitReading, 'habit-completed', { date: dateStr });

    // Water (completed every day)
    const waterInstance = uuidv4();
    await db.itemInstances.add({
      id: waterInstance,
      itemId: habitWater,
      scheduledDate: dateStr,
      status: 'completed',
      createdAt: d.getTime(),
      updatedAt: d.getTime()
    });
    await logActivity(habitWater, 'habit-completed', { date: dateStr });
  }

  // ==========================================
  // 5. Workout Templates, Exercises & History
  // ==========================================
  reportProgress('Seeding exercise library...');
  // Load comprehensive exercise database from JSON
  const exerciseIds = new Map<string, string>();
  for (const ex of generatedExercises) {
    const id = await createEntity('exercise', ex.title, { 
      muscles: ex.metadata.muscles, 
      equipment: ex.metadata.equipment,
      image: ex.image
    });
    exerciseIds.set(ex.title, id);
  }

  // Fallbacks for the mock templates if not exactly matched in the generated list
  const getExId = async (title: string, fallbackMuscles: string[], fallbackEquipment: string) => {
    if (exerciseIds.has(title)) return exerciseIds.get(title)!;
    // Try to find a partial match
    for (const [key, id] of exerciseIds.entries()) {
      if (key.toLowerCase().includes(title.toLowerCase())) return id;
    }
    // Create it if totally missing
    const id = await createEntity('exercise', title, { muscles: fallbackMuscles, equipment: fallbackEquipment });
    exerciseIds.set(title, id);
    return id;
  };

  reportProgress('Seeding workout templates and history...');
  const benchId = await getExId('Barbell Bench Press', ['chest', 'shoulders', 'triceps'], 'barbell');
  const inclinePressId = await getExId('Incline Dumbbell Bench Press', ['chest', 'shoulders', 'triceps'], 'dumbbell');
  const ohpId = await getExId('Barbell Overhead', ['shoulders', 'triceps'], 'barbell');
  const lateralRaiseId = await getExId('Lateral Raise', ['shoulders'], 'dumbbell');
  const tricepPushdownId = await getExId('Tricep Pushdown Machine', ['triceps'], 'cable');
  
  const pullupId = await getExId('Pull Ups', ['back', 'biceps'], 'bodyweight');
  const latPulldownId = await getExId('Lat Pulldown', ['back', 'biceps'], 'cable');
  const barbellRowId = await getExId('Barbell Bent Over Row', ['back', 'biceps'], 'barbell');
  const curlId = await getExId('Dumbbell Biceps Curl', ['biceps'], 'dumbbell');
  
  const squatId = await getExId('Squat', ['legs', 'core'], 'barbell');
  const legPressId = await getExId('Leg Press', ['legs'], 'machine');
  const legExtensionId = await getExId('Leg Extension', ['legs'], 'machine');
  const legCurlId = await getExId('Leg Curl', ['legs'], 'machine');
  const deadliftId = await getExId('Deadlift', ['back', 'legs', 'core'], 'barbell');
  const rdlId = await getExId('Romanian Deadlift', ['legs', 'back'], 'barbell');
  const calfRaiseId = await getExId('Calf Raises', ['legs'], 'machine');

  const pushDay = await createEntity('workout-template', 'Push Day', { duration: '1h', timeOfDay: 'morning' }, 'active', undefined, ['Gym']);
  await linkEntities(hypertrophyProject, pushDay, 'contains');
  const pushChest = await createEntity('workout-block', 'Chest Block', { order: 0 }, 'active');
  await linkEntities(pushDay, pushChest, 'contains');
  await linkEntities(pushChest, benchId, 'includes_exercise');
  await linkEntities(pushChest, inclinePressId, 'includes_exercise');
  
  const pushShoulder = await createEntity('workout-block', 'Shoulder Block', { order: 1 }, 'active');
  await linkEntities(pushDay, pushShoulder, 'contains');
  await linkEntities(pushShoulder, ohpId, 'includes_exercise');
  await linkEntities(pushShoulder, lateralRaiseId, 'includes_exercise');

  const pushTricep = await createEntity('workout-block', 'Triceps Block', { order: 2 }, 'active');
  await linkEntities(pushDay, pushTricep, 'contains');
  await linkEntities(pushTricep, tricepPushdownId, 'includes_exercise');

  const pullDay = await createEntity('workout-template', 'Pull Day', { duration: '1h', timeOfDay: 'morning' }, 'active', undefined, ['Gym']);
  await linkEntities(hypertrophyProject, pullDay, 'contains');
  const pullBack = await createEntity('workout-block', 'Back Block', { order: 0 }, 'active');
  await linkEntities(pullDay, pullBack, 'contains');
  await linkEntities(pullBack, pullupId, 'includes_exercise');
  await linkEntities(pullBack, latPulldownId, 'includes_exercise');
  await linkEntities(pullBack, barbellRowId, 'includes_exercise');
  await linkEntities(pullBack, deadliftId, 'includes_exercise');

  const pullBiceps = await createEntity('workout-block', 'Biceps Block', { order: 1 }, 'active');
  await linkEntities(pullDay, pullBiceps, 'contains');
  await linkEntities(pullBiceps, curlId, 'includes_exercise');

  const legsDay = await createEntity('workout-template', 'Legs Day', { duration: '1h', timeOfDay: 'morning' }, 'active', undefined, ['Gym']);
  await linkEntities(hypertrophyProject, legsDay, 'contains');
  const legsMain = await createEntity('workout-block', 'Main Lifts', { order: 0 }, 'active');
  await linkEntities(legsDay, legsMain, 'contains');
  await linkEntities(legsMain, squatId, 'includes_exercise');
  await linkEntities(legsMain, rdlId, 'includes_exercise');

  const legsAccessory = await createEntity('workout-block', 'Accessories', { order: 1 }, 'active');
  await linkEntities(legsDay, legsAccessory, 'contains');
  await linkEntities(legsAccessory, legPressId, 'includes_exercise');
  await linkEntities(legsAccessory, legExtensionId, 'includes_exercise');
  await linkEntities(legsAccessory, legCurlId, 'includes_exercise');
  await linkEntities(legsAccessory, calfRaiseId, 'includes_exercise');

  // Log workout history for the past 2 weeks (Push on Mon/Thu, Pull on Tue/Fri, Legs on Wed/Sat)
  for (let i = -14; i <= 0; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon...
    
    if (dayOfWeek === 1 || dayOfWeek === 4) {
      // Push Day completed
      const sessionId = uuidv4();
      await db.workoutSessions.add({ id: sessionId, templateId: pushDay, date: d.getTime(), duration: 55 * 60, createdAt: now.getTime() });
      const exSessionId = uuidv4();
      await db.exerciseSessions.add({ id: exSessionId, workoutSessionId: sessionId, exerciseId: benchId, order: 0 });
      await db.setEntries.add({ id: uuidv4(), exerciseSessionId: exSessionId, setNumber: 1, reps: 8, weight: 80, completed: true });
      await db.setEntries.add({ id: uuidv4(), exerciseSessionId: exSessionId, setNumber: 2, reps: 8, weight: 80, completed: true });
      await db.setEntries.add({ id: uuidv4(), exerciseSessionId: exSessionId, setNumber: 3, reps: 6, weight: 85, completed: true });
    } else if (dayOfWeek === 2 || dayOfWeek === 5) {
      // Pull Day completed
      const sessionId = uuidv4();
      await db.workoutSessions.add({ id: sessionId, templateId: pullDay, date: d.getTime(), duration: 65 * 60, createdAt: now.getTime() });
      const exSessionId = uuidv4();
      await db.exerciseSessions.add({ id: exSessionId, workoutSessionId: sessionId, exerciseId: pullupId, order: 0 });
      await db.setEntries.add({ id: uuidv4(), exerciseSessionId: exSessionId, setNumber: 1, reps: 10, weight: 0, completed: true });
      await db.setEntries.add({ id: uuidv4(), exerciseSessionId: exSessionId, setNumber: 2, reps: 9, weight: 0, completed: true });
    } else if (dayOfWeek === 3 || dayOfWeek === 6) {
      // Legs Day completed
      const sessionId = uuidv4();
      await db.workoutSessions.add({ id: sessionId, templateId: legsDay, date: d.getTime(), duration: 60 * 60, createdAt: now.getTime() });
      const exSessionId = uuidv4();
      await db.exerciseSessions.add({ id: exSessionId, workoutSessionId: sessionId, exerciseId: squatId, order: 0 });
      await db.setEntries.add({ id: uuidv4(), exerciseSessionId: exSessionId, setNumber: 1, reps: 5, weight: 100, completed: true });
      await db.setEntries.add({ id: uuidv4(), exerciseSessionId: exSessionId, setNumber: 2, reps: 5, weight: 105, completed: true });
      await db.setEntries.add({ id: uuidv4(), exerciseSessionId: exSessionId, setNumber: 3, reps: 5, weight: 110, completed: true });
      
      const exSession2Id = uuidv4();
      await db.exerciseSessions.add({ id: exSession2Id, workoutSessionId: sessionId, exerciseId: legPressId, order: 1 });
      await db.setEntries.add({ id: uuidv4(), exerciseSessionId: exSession2Id, setNumber: 1, reps: 10, weight: 120, completed: true });
    }
  }

  // ==========================================
  // 6. Calendar Tasks (Past, Today, Future)
  // ==========================================
  reportProgress('Seeding tasks across past, present, and future...');
  // Past tasks (completed)
  for (let i = -7; i < 0; i++) {
    const pastTask = await createEntity('task', `Task from ${Math.abs(i)} days ago`, { timeOfDay: 'afternoon' }, 'completed', getDateStr(i), ['Work']);
    await linkEntities(startupProject, pastTask, 'contains');
    
    // Add instance
    await db.itemInstances.add({
      id: uuidv4(),
      itemId: pastTask,
      scheduledDate: getDateStr(i),
      status: 'completed',
      createdAt: now.getTime(),
      updatedAt: now.getTime()
    });
  }

  // Today tasks (mix of pending/completed)
  const today1 = await createEntity('task', 'Draft Architecture Doc', { timeOfDay: 'morning', duration: '2h' }, 'scheduled', getDateStr(0), ['Work']);
  await linkEntities(startupProject, today1, 'contains');
  await db.itemInstances.add({ id: uuidv4(), itemId: today1, scheduledDate: getDateStr(0), status: 'pending', createdAt: now.getTime(), updatedAt: now.getTime() });

  const today2 = await createEntity('task', 'Buy Groceries', { timeOfDay: 'afternoon', duration: '30m' }, 'scheduled', getDateStr(0), ['Personal']);
  await db.itemInstances.add({ id: uuidv4(), itemId: today2, scheduledDate: getDateStr(0), status: 'completed', createdAt: now.getTime(), updatedAt: now.getTime() });

  const today3 = await createEntity('task', 'Read Chapter 4', { timeOfDay: 'evening', duration: '1h' }, 'scheduled', getDateStr(0), ['Reading']);
  await linkEntities(readingProject, today3, 'contains');
  await db.itemInstances.add({ id: uuidv4(), itemId: today3, scheduledDate: getDateStr(0), status: 'pending', createdAt: now.getTime(), updatedAt: now.getTime() });

  // Future tasks
  for (let i = 1; i <= 14; i++) {
    // 1-2 tasks per day
    const future1 = await createEntity('task', `Future Action Item ${i}A`, { timeOfDay: 'morning' }, 'scheduled', getDateStr(i), ['Work']);
    await linkEntities(startupProject, future1, 'contains');
    
    if (i % 3 === 0) {
      const future2 = await createEntity('task', `Read Book Chapter ${i + 4}`, { timeOfDay: 'evening' }, 'scheduled', getDateStr(i), ['Reading']);
      await linkEntities(readingProject, future2, 'contains');
    }
  }

  reportProgress('Waiting for pending sync writes...');
  const localCounts = await countLocalRows();
  await awaitPendingRemoteWrites();
  reportProgress('Verifying Supabase row counts...');
  const remoteCounts = await countRemoteRows(userId);
  const remoteVerified = seedCountTables.every(({ local }) => localCounts[local] === remoteCounts[local]);

  console.log('Seeded DB with rich v2 graph objects & historical logs!', {
    userId,
    localCounts,
    remoteCounts,
    remoteVerified,
  });

  if (!remoteVerified) {
    console.warn('Seed finished, but local and remote counts do not match exactly yet.', { localCounts, remoteCounts });
  }

  reportProgress(
    remoteVerified
      ? `Seeded ${localCounts.items} items and confirmed Supabase sync.`
      : 'Seed finished locally, but Supabase verification is still catching up.'
  );

  return {
    userId,
    syncUserId: getSupabaseSyncUserId(),
    remoteWriteSuppressionDepth: getRemoteWriteSuppressionDepth(),
    remoteWriteStats: getRemoteWriteStats(),
    localCounts,
    remoteCounts,
    remoteVerified,
  };
}
