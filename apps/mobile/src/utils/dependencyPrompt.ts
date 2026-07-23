import { Alert } from 'react-native';
import { getBlockingTask, setRelation } from '../db/database';
import type { Item } from '../db/types';
import { showActionSheet } from './actionSheet';

// Shared "Depends on..." picker used by every screen that lets a task be
// linked to another as a hard-blocking dependency (ProjectDetailScreen,
// TasksScreen, InboxScreenV2, TimelineSection). `candidates` is whatever pool
// of other tasks makes sense for that screen (e.g. project siblings vs. every
// active task) — this just builds the picker/removal Alert around it.
export function promptSetDependency(item: Item, candidates: Item[], refresh: () => void): void {
  const others = candidates.filter(t => t.id !== item.id);
  const currentBlocker = getBlockingTask(item.id);
  if (others.length === 0) {
    Alert.alert('No other tasks yet', 'Create another task first, then link them.');
    return;
  }
  showActionSheet('Depends on', [
    ...(currentBlocker
      ? [{ label: 'Remove dependency', onPress: () => { setRelation(item.id, 'dependsOn', null); refresh(); } }]
      : []),
    ...others.map(t => ({
      label: t.title,
      onPress: () => {
        setRelation(item.id, 'dependsOn', t.id);
        refresh();
      },
    })),
  ]);
}
