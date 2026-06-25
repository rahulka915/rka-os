import * as TaskManager from 'expo-task-manager';
import { getInboxItems } from '../db/database';
import { setBadgeCount } from '../hooks/useNotifications';

export const BACKGROUND_SYNC_TASK = 'rka-background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const inboxCount = getInboxItems().length;
    await setBadgeCount(inboxCount);
    // TODO: sync with Supabase when online
    return 'newData';
  } catch {
    return 'failed';
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    // Dynamically import so Expo Go doesn't crash on missing module
    const BackgroundTask = await import('expo-background-task').catch(() => null);
    if (!BackgroundTask) return;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60,
      });
    }
  } catch {
    // silently skip in Expo Go
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const BackgroundTask = await import('expo-background-task').catch(() => null);
    if (!BackgroundTask) return;
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  } catch {}
}
