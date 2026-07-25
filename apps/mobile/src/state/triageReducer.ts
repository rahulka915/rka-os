import type { Item } from '../db/types';

export type TriageStep = 'type' | 'importance' | 'when' | 'project' | 'review';

export type TriageWhen = 'today' | 'tomorrow' | 'week' | 'someday';

export type TriagePriority = 'low' | 'medium' | 'high';

export type TriageAnswers = {
  priority: TriagePriority | null;
  when: TriageWhen | null;
  projectId: string | null;
};

export type TriageSessionState = {
  queue: Item[];
  step: TriageStep;
  answers: TriageAnswers;
  processedCount: number;
};

export type TriageAction =
  | { type: 'CHOOSE_TASK' }
  | { type: 'ANSWER_IMPORTANCE'; value: TriagePriority }
  | { type: 'ANSWER_WHEN'; value: TriageWhen }
  | { type: 'ANSWER_PROJECT'; value: string | null }
  | { type: 'BACK' }
  | { type: 'ADVANCE' };

const STEP_ORDER: TriageStep[] = ['type', 'importance', 'when', 'project', 'review'];

const initialTriageAnswers: TriageAnswers = {
  priority: null,
  when: null,
  projectId: null,
};

// Session queue = the current Inbox list order, with the tapped item moved to
// the front — so the card the user actually tapped is the first one shown,
// and the rest of the queue still follows the list's existing order.
export function buildTriageQueue(tappedItem: Item, allItems: Item[]): Item[] {
  const rest = allItems.filter((item) => item.id !== tappedItem.id);
  return [tappedItem, ...rest];
}

export function createInitialTriageState(queue: Item[]): TriageSessionState {
  return {
    queue,
    step: 'type',
    answers: { ...initialTriageAnswers },
    processedCount: 0,
  };
}

export function triageReducer(s: TriageSessionState, a: TriageAction): TriageSessionState {
  switch (a.type) {
    case 'CHOOSE_TASK':
      if (s.step !== 'type') return s;
      return { ...s, step: 'importance' };

    case 'ANSWER_IMPORTANCE':
      if (s.step !== 'importance') return s;
      return { ...s, step: 'when', answers: { ...s.answers, priority: a.value } };

    case 'ANSWER_WHEN':
      if (s.step !== 'when') return s;
      return { ...s, step: 'project', answers: { ...s.answers, when: a.value } };

    case 'ANSWER_PROJECT':
      if (s.step !== 'project') return s;
      return { ...s, step: 'review', answers: { ...s.answers, projectId: a.value } };

    case 'BACK': {
      const index = STEP_ORDER.indexOf(s.step);
      if (index <= 0) return s;
      return { ...s, step: STEP_ORDER[index - 1] };
    }

    // The Object branch never touches this reducer (see useTriageSession) —
    // it writes straight to the DB, then dispatches ADVANCE like any
    // confirmed Task card.
    case 'ADVANCE':
      return {
        ...s,
        queue: s.queue.slice(1),
        step: 'type',
        answers: { ...initialTriageAnswers },
        processedCount: s.processedCount + 1,
      };

    default:
      return s;
  }
}
