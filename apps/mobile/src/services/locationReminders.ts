import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

export const LOCATION_TASK = 'rka-location-task';

export interface LocationReminder {
  id: string;
  title: string;
  body: string;
  latitude: number;
  longitude: number;
  radius: number; // metres
  trigger: 'enter' | 'exit';
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const { eventType, region } = data;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: region.identifier,
      body: eventType === Location.LocationGeofencingEventType.Enter
        ? 'You arrived — check your tasks here.'
        : 'You left — any unfinished tasks?',
      sound: true,
    },
    trigger: null,
  });
});

export async function requestLocationPermission(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  return bg === 'granted';
}

export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
}

export async function addGeofence(reminder: LocationReminder): Promise<void> {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) return;

  await Location.startGeofencingAsync(LOCATION_TASK, [
    {
      identifier: reminder.id,
      latitude: reminder.latitude,
      longitude: reminder.longitude,
      radius: reminder.radius,
      notifyOnEnter: reminder.trigger === 'enter',
      notifyOnExit: reminder.trigger === 'exit',
    },
  ]);
}

export async function removeGeofence(reminderId: string): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (!isRegistered) return;
  const remaining: Location.LocationRegion[] = [];

  // Restart with empty set effectively stops geofencing for this region
  if (remaining.length === 0) {
    await Location.stopGeofencingAsync(LOCATION_TASK).catch(() => {});
  }
}

export async function stopAllGeofencing(): Promise<void> {
  await Location.stopGeofencingAsync(LOCATION_TASK).catch(() => {});
}
