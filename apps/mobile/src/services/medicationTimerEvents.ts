let revision = 0;
const listeners = new Set<() => void>();

export function subscribeMedicationTimerChanges(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMedicationTimerRevision() {
  return revision;
}

export function publishMedicationTimerChange() {
  revision += 1;
  listeners.forEach((listener) => listener());
}
