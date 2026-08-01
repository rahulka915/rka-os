import { useCallback } from 'react';
import { navigateTo } from '../navigation/rootNavigation';
import { useItemComposer } from '../components/item-composer';
import type { OpenItemEditorOptions } from '../components/item-composer/types';

// Shared "open this item" dispatcher — Object/Area/Project/Habit each have
// their own dedicated detail screen (richer than the generic task-shaped
// editor), so tapping one of those should land there instead of
// ItemEditorSheet. Every other type (task, medication, meal, workout-*)
// still has no dedicated screen, so it falls through to the generic editor
// unchanged.
export function useOpenItem() {
  const { openEditorForItem } = useItemComposer();

  return useCallback((options: OpenItemEditorOptions) => {
    const { item } = options;
    switch (item.type) {
      case 'object':
        navigateTo('ObjectDetail', { objectId: item.id });
        return;
      case 'area':
        navigateTo('AreaDetail', { areaId: item.id, title: item.title });
        return;
      case 'project':
        navigateTo('ProjectDetail', { projectId: item.id, title: item.title });
        return;
      case 'habit':
        navigateTo('HabitDetail', { habitId: item.id, title: item.title });
        return;
      default:
        openEditorForItem(options);
    }
  }, [openEditorForItem]);
}
