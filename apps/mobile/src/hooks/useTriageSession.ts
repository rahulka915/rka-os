import { useCallback, useMemo, useReducer } from 'react';
import {
  triageReducer,
  createInitialTriageState,
  buildTriageQueue,
  type TriageStep,
  type TriageAnswers,
  type TriagePriority,
  type TriageWhen,
} from '../state/triageReducer';
import { applyTaskTriage, processInboxItem, getItemsByType } from '../db/database';
import type { Item } from '../db/types';

export type UseTriageSessionReturn = {
  currentItem: Item | null;
  remaining: number;
  processedCount: number;
  step: TriageStep;
  answers: TriageAnswers;
  projects: Item[];
  chooseObject: () => void;
  chooseTask: () => void;
  answerImportance: (value: TriagePriority) => void;
  answerWhen: (value: TriageWhen) => void;
  answerProject: (projectId: string | null) => void;
  back: () => void;
  confirm: () => void;
};

export function useTriageSession(tappedItem: Item, allItems: Item[]): UseTriageSessionReturn {
  // Seeded once per session — allItems is the Inbox list snapshot at the
  // moment the session opened; items processed during the session are
  // removed from the reducer's own queue, not refetched from this list.
  const initialQueue = useMemo(
    () => buildTriageQueue(tappedItem, allItems),
    [tappedItem, allItems],
  );
  const [state, dispatch] = useReducer(triageReducer, initialQueue, createInitialTriageState);

  // Same picker source ItemEditorSheet's Mission picker already uses.
  const projects = useMemo(
    () => getItemsByType('project').filter((item) => !item.deletedAt),
    [],
  );

  const currentItem = state.queue[0] ?? null;

  const chooseObject = useCallback(() => {
    if (!currentItem) return;
    processInboxItem(currentItem.id, 'object');
    dispatch({ type: 'ADVANCE' });
  }, [currentItem]);

  const chooseTask = useCallback(() => {
    dispatch({ type: 'CHOOSE_TASK' });
  }, []);

  const answerImportance = useCallback((value: TriagePriority) => {
    dispatch({ type: 'ANSWER_IMPORTANCE', value });
  }, []);

  const answerWhen = useCallback((value: TriageWhen) => {
    dispatch({ type: 'ANSWER_WHEN', value });
  }, []);

  const answerProject = useCallback((projectId: string | null) => {
    dispatch({ type: 'ANSWER_PROJECT', value: projectId });
  }, []);

  const back = useCallback(() => {
    dispatch({ type: 'BACK' });
  }, []);

  const confirm = useCallback(() => {
    if (!currentItem || !state.answers.priority || !state.answers.when) return;
    applyTaskTriage(currentItem.id, {
      priority: state.answers.priority,
      when: state.answers.when,
      projectId: state.answers.projectId,
    });
    dispatch({ type: 'ADVANCE' });
  }, [currentItem, state.answers]);

  return {
    currentItem,
    remaining: state.queue.length,
    processedCount: state.processedCount,
    step: state.step,
    answers: state.answers,
    projects,
    chooseObject,
    chooseTask,
    answerImportance,
    answerWhen,
    answerProject,
    back,
    confirm,
  };
}
