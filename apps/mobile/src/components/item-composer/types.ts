import type { Item, ItemType } from '../../db/types';
import type { TimeOfDay } from '../../utils/time';
import type { ChecklistItem } from '../../utils/checklist';

export type ItemPriority = 'low' | 'medium' | 'high';

export type ItemComposerContext = {
  status?: 'inbox' | 'active';
  scheduledDate?: string;
  scheduledTime?: string;
  projectId?: string;
  projectTitle?: string;
  lockScheduleDate?: boolean;
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
  durationMinutes?: number;
  preferredTimeBucket?: TimeOfDay;
};

export type ItemDraft = {
  mode: 'create' | 'edit';
  itemId?: string;
  itemType: ItemType;
  title: string;
  notes: string;
  status: 'inbox' | 'active' | 'scheduled';
  scheduledDate?: string;
  scheduledTime?: string;
  dueDate?: string;
  rrule?: string;
  projectId?: string;
  projectTitle?: string;
  tags: string[];
  checklist: ChecklistItem[];
  priority?: ItemPriority;
  interstitial?: boolean;
  durationMinutes: number;
  preferredTimeBucket: TimeOfDay;
  metadata: Record<string, unknown>;
  lockScheduleDate: boolean;
  minuteInterval: 1 | 5 | 10 | 15 | 20 | 30;
};

export type ComposerCompletion = {
  itemId?: string;
  action: 'saved' | 'completed' | 'deleted' | 'cancelled';
};

export type OpenComposerOptions = {
  context?: ItemComposerContext;
  onComplete?: (result: ComposerCompletion) => void;
};

export type OpenItemEditorOptions = OpenComposerOptions & {
  item: Item;
};
