import { useSyncExternalStore } from 'react';
import { getSyncPhase, subscribeSyncStatus } from '../services/syncStatus';

// Subscribes a component to the background-sync phase (see services/syncStatus).
// Returns true while the initial post-cold-start catch-up is still in flight,
// so a subtle header indicator can show "syncing…" without ever blocking input.
export function useSyncStatus(): boolean {
  const phase = useSyncExternalStore(subscribeSyncStatus, getSyncPhase, getSyncPhase);
  return phase === 'syncing';
}
