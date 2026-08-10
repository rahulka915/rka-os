// A tiny external store for "is background sync currently catching up?" — read
// by the header's subtle sync indicator (useSyncStatus) and written by
// firestoreSync as its initial full-collection snapshots land. Deliberately
// framework-free (no React import) so non-component code can mark start/end;
// components subscribe via useSyncStatus below (useSyncExternalStore).
//
// Semantics: "syncing" means the initial catch-up after a cold start is still
// in flight. Small steady-state deltas afterward don't flip it back on — the
// indicator is for the one moment that actually matters (relaunch, where data
// may briefly lag the UI), not a constant flicker on every tiny write.

type SyncPhase = 'idle' | 'syncing';

let phase: SyncPhase = 'idle';
let pendingInitial = 0;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const SAFETY_TIMEOUT_MS = 12000;

function emit(): void {
  for (const listener of listeners) listener();
}

function setPhase(next: SyncPhase): void {
  if (phase === next) return;
  phase = next;
  emit();
}

export function getSyncPhase(): SyncPhase {
  return phase;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Called once by startRealtimeSync with the number of listeners it's about to
// attach. Each listener calls markInitialSyncListenerDone() after its first
// snapshot is applied; when all have reported (or the safety timeout fires,
// so an offline/never-firing listener can't wedge the indicator on forever),
// the phase returns to idle.
export function beginInitialSync(listenerCount: number): void {
  pendingInitial = listenerCount;
  if (safetyTimer) clearTimeout(safetyTimer);
  safetyTimer = setTimeout(() => {
    pendingInitial = 0;
    safetyTimer = null;
    setPhase('idle');
  }, SAFETY_TIMEOUT_MS);
  setPhase(listenerCount > 0 ? 'syncing' : 'idle');
}

export function markInitialSyncListenerDone(): void {
  if (pendingInitial <= 0) return;
  pendingInitial -= 1;
  if (pendingInitial === 0) {
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    setPhase('idle');
  }
}

// Reset on sign-out / listener teardown so a subsequent sign-in starts clean.
export function resetSyncStatus(): void {
  pendingInitial = 0;
  if (safetyTimer) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
  setPhase('idle');
}
