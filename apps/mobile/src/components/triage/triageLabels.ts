import type { TriagePriority, TriageWhen } from '../../state/triageReducer';

export const PRIORITY_LABELS: Record<TriagePriority, string> = {
  low: 'Low',
  medium: 'Normal',
  high: 'High',
};

export const WHEN_LABELS: Record<TriageWhen, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  someday: 'Someday',
};
