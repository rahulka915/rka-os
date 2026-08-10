import { Alert } from 'react-native';

export function formatTimeLeftLabel(minsLeft: number): string {
  return minsLeft < 60 ? `${minsLeft}m` : `${Math.ceil(minsLeft / 60)}h`;
}

export function computeMinutesUntilNextDose(minHoursBetweenDoses: number, lastTakenAt: number): number {
  return Math.ceil(minHoursBetweenDoses * 60 - (Date.now() - lastTakenAt) / 60000);
}

// A too-soon dose is never silently blocked or silently allowed — the
// caution always shows the real wait time, and the only way past it is
// "Override…", which forces a typed reason (e.g. "advised by doctor",
// "exam tomorrow") before `onOverride` runs. That reason travels with the
// dose log (see `logMedicationTaken`'s `overrideReason`) so it's visible
// later, not just a one-time confirmation that vanishes.
export function promptTooSoonOverride(minsLeft: number, onOverride: (reason: string) => void): void {
  const timeLabel = formatTimeLeftLabel(minsLeft);
  Alert.alert(
    'Too soon',
    `Next dose in ${timeLabel}. You can override and take it early, but you'll need to note why.`,
    [
      { text: 'Wait', style: 'cancel' },
      { text: 'Override…', style: 'destructive', onPress: () => promptOverrideReason(onOverride) },
    ],
  );
}

function promptOverrideReason(onOverride: (reason: string) => void): void {
  Alert.prompt(
    'Reason for early dose',
    'e.g. "Advised by doctor" or "Exam tomorrow" — saved with the dose log.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: (value?: string) => {
          const reason = value?.trim();
          if (!reason) {
            Alert.alert('Reason required', "Please note why you're taking this early.", [
              { text: 'Try Again', onPress: () => promptOverrideReason(onOverride) },
              { text: 'Cancel', style: 'cancel' },
            ]);
            return;
          }
          onOverride(reason);
        },
      },
    ],
    'plain-text',
  );
}
