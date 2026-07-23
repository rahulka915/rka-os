import { Platform } from 'react-native';
import MedicationTimerActivity from '../liveActivities/MedicationTimerActivity';

type ActivityHandle = ReturnType<typeof MedicationTimerActivity.start>;

// Tracked in-memory only, keyed by the activityLogs row id (the same id the
// in-app timer state machine in src/db/database.ts already uses). This does
// NOT survive a full app kill — if the app is killed while a timer is
// running, the Live Activity chrome won't reappear automatically on
// relaunch (no documented way to reconnect to an already-running system
// Activity via expo-widgets). PersistentTimerBanner uses activeLiveActivityIds
// (below) to suppress itself per-timer once a Live Activity is confirmed
// running, falling back to showing itself if the Live Activity never started.
const activeActivities = new Map<string, ActivityHandle>();

// Replaced (not mutated) on every change so useSyncExternalStore snapshot
// comparisons in PersistentTimerBanner see a new reference and re-render.
let activeLiveActivityIds = new Set<string>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function subscribeLiveActivityIds(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveLiveActivityIds(): Set<string> {
  return activeLiveActivityIds;
}

interface MedicationTimerState {
  medicationName: string;
  dose?: string;
  displayStartedAt: number;
  pausedAt?: number;
}

function endOtherActivities(logId: string, state: MedicationTimerState) {
  for (const [activeLogId, instance] of activeActivities) {
    if (activeLogId === logId) continue;
    try { instance.end('immediate', state); } catch { /* ignore */ }
    activeActivities.delete(activeLogId);
  }
  activeLiveActivityIds = new Set(activeActivities.keys());
  notifyListeners();
}

function isSupported(): boolean {
  return Platform.OS === 'ios';
}

export function startMedicationLiveActivity(logId: string, state: MedicationTimerState): void {
  if (!isSupported() || activeActivities.has(logId)) return;
  try {
    endOtherActivities(logId, state);
    const instance = MedicationTimerActivity.start(state, `rkaos://medications?timer=${encodeURIComponent(logId)}`);
    if (instance) {
      activeActivities.set(logId, instance);
      activeLiveActivityIds = new Set(activeLiveActivityIds).add(logId);
      notifyListeners();
    }
  } catch {
    // Live Activities unavailable (iOS <16.2, simulator quirks, etc.) — fail silently.
  }
}

export function updateMedicationLiveActivity(logId: string, state: MedicationTimerState): void {
  if (!isSupported()) return;
  const instance = activeActivities.get(logId);
  if (!instance) return;
  try {
    instance.update(state);
  } catch {
    // ignore
  }
}

export function endMedicationLiveActivity(logId: string, state: MedicationTimerState): void {
  if (!isSupported()) return;
  const instance = activeActivities.get(logId);
  activeActivities.delete(logId);
  if (activeLiveActivityIds.has(logId)) {
    activeLiveActivityIds = new Set(activeLiveActivityIds);
    activeLiveActivityIds.delete(logId);
    notifyListeners();
  }
  if (!instance) return;
  try {
    instance.end('immediate', state);
  } catch {
    // ignore
  }
}
