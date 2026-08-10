import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  // getPermissionsAsync is a cheap status read; requestPermissionsAsync is the
  // heavier native round-trip that also surfaces the OS prompt. Once permission
  // is already decided (granted or denied) — which it is on every boot after the
  // first — re-requesting every launch just paid ~300ms to the notification
  // daemon for a status we could have read cheaply. Only escalate to a real
  // request while it's still undetermined.
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status !== 'undetermined') return existing.status === 'granted';
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleReminder(title: string, body: string, seconds: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

export async function scheduleDailyReminder(title: string, body: string, hour: number, minute: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

export async function cancelNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

export function useNotificationListener(onReceive?: (n: Notifications.Notification) => void) {
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!onReceive) return;
    listenerRef.current = Notifications.addNotificationReceivedListener(onReceive);
    return () => listenerRef.current?.remove();
  }, [onReceive]);
}
