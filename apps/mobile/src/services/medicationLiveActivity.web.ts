// Live Activities are an iOS-only system feature (ActivityKit via expo-widgets)
// with no web equivalent, and the native implementation's MedicationTimerActivity
// import pulls in @expo/ui/swift-ui at module load time regardless of any runtime
// Platform check — so this file exists purely to avoid that eager native import
// crashing the web bundle. Matches medicationLiveActivity.ts's own "fail silently
// when unsupported" behavior (its isSupported() already returns false off iOS).

const emptyIds = new Set<string>();

interface MedicationTimerState {
  medicationName: string;
  dose?: string;
  displayStartedAt: number;
  pausedAt?: number;
}

export function subscribeLiveActivityIds(_listener: () => void): () => void {
  return () => {};
}

export function getActiveLiveActivityIds(): Set<string> {
  return emptyIds;
}

export function startMedicationLiveActivity(_logId: string, _state: MedicationTimerState): void {}

export function updateMedicationLiveActivity(_logId: string, _state: MedicationTimerState): void {}

export function endMedicationLiveActivity(_logId: string, _state: MedicationTimerState): void {}
