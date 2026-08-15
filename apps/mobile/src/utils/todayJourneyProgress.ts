export type PendingActionKind = 'complete' | 'delete' | 'move';

export interface TodayJourneyProgressItem {
  id: string;
  type: string;
  status: string;
}

export interface TodayJourneyProgress {
  completedCount: number;
  totalCount: number;
}

// 'complete' keeps a task counted as done immediately, matching HomeScreen's
// undo-grace-window behavior where the row hides right away but the action
// hasn't committed yet. 'delete'/'move' drop the item from the count
// entirely, same as they already drop it from the visible task list.
export function computeTodayJourneyProgress(
  items: TodayJourneyProgressItem[],
  pendingActions: Map<string, PendingActionKind>,
): TodayJourneyProgress {
  let completedCount = 0;
  let totalCount = 0;

  for (const item of items) {
    if (item.type !== 'task') continue;
    const pending = pendingActions.get(item.id);
    if (pending === 'delete' || pending === 'move') continue;
    totalCount += 1;
    if (item.status === 'completed' || pending === 'complete') {
      completedCount += 1;
    }
  }

  return { completedCount, totalCount };
}
