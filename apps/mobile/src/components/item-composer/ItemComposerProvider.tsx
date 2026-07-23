import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CaptureSheet } from './CaptureSheet';
import { ItemEditorSheet } from './ItemEditorSheet';
import { completeDraftItem, createDraft, createEditDraft, deleteDraftItem, saveItemDraft } from './itemComposerPersistence';
import type { ItemComposerContext, ItemDraft, OpenComposerOptions, OpenItemEditorOptions } from './types';

type Presentation = 'closed' | 'capture' | 'editor';

type ItemComposerApi = {
  revision: number;
  openCapture: (options?: OpenComposerOptions) => void;
  openEditorForCreate: (options?: OpenComposerOptions) => void;
  openEditorForItem: (options: OpenItemEditorOptions) => void;
  closeComposer: () => void;
};

const ItemComposerContextValue = createContext<ItemComposerApi | null>(null);

export function ItemComposerProvider({ children }: { children: React.ReactNode }) {
  const [presentation, setPresentation] = useState<Presentation>('closed');
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const completionRef = useRef<OpenComposerOptions['onComplete']>(undefined);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
    setPresentation('closed');
    setDraft(null);
    setBusy(false);
    setError(undefined);
    completionRef.current = undefined;
  }, []);

  const closeComposer = useCallback(() => {
    const completion = completionRef.current;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
    completion?.({ action: 'cancelled' });
  }, [reset]);

  const openCapture = useCallback((options: OpenComposerOptions = {}) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    completionRef.current = options.onComplete;
    setDraft(createDraft(options.context));
    setError(undefined);
    setBusy(false);
    setPresentation('capture');
  }, []);

  const openEditorForCreate = useCallback((options: OpenComposerOptions = {}) => {
    completionRef.current = options.onComplete;
    setDraft(createDraft(options.context));
    setError(undefined);
    setBusy(false);
    setPresentation('editor');
  }, []);

  const openEditorForItem = useCallback((options: OpenItemEditorOptions) => {
    completionRef.current = options.onComplete;
    setDraft(createEditDraft(options.item, options.context));
    setError(undefined);
    setBusy(false);
    setPresentation('editor');
  }, []);

  const updateDraft = useCallback((updates: Partial<ItemDraft>) => {
    setDraft((current) => current ? { ...current, ...updates } : current);
    setError(undefined);
  }, []);

  const showDetails = useCallback(() => {
    if (!draft || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setPresentation('closed');
    transitionTimerRef.current = setTimeout(() => {
      setPresentation('editor');
      transitionTimerRef.current = null;
    }, 260);
  }, [busy, draft]);

  const save = useCallback(() => {
    if (!draft || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const itemId = saveItemDraft(draft);
      const completion = completionRef.current;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRevision((current) => current + 1);
      reset();
      completion?.({ action: 'saved', itemId });
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : 'Unable to save this task.');
    }
  }, [busy, draft, reset]);

  const remove = useCallback(() => {
    if (!draft || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const itemId = deleteDraftItem(draft);
      const completion = completionRef.current;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setRevision((current) => current + 1);
      reset();
      completion?.({ action: 'deleted', itemId });
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : 'Unable to delete this task.');
    }
  }, [busy, draft, reset]);

  const complete = useCallback(() => {
    if (!draft || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const itemId = completeDraftItem(draft);
      const completion = completionRef.current;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRevision((current) => current + 1);
      reset();
      completion?.({ action: 'completed', itemId });
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : 'Unable to complete this item.');
    }
  }, [busy, draft, reset]);

  const value: ItemComposerApi = {
    revision,
    openCapture,
    openEditorForCreate,
    openEditorForItem,
    closeComposer,
  };

  return (
    <ItemComposerContextValue.Provider value={value}>
      {children}
      <CaptureSheet
        visible={presentation === 'capture'}
        draft={draft}
        busy={busy}
        error={error}
        onChange={updateDraft}
        onSave={save}
        onDetails={showDetails}
        onCancel={closeComposer}
      />
      <ItemEditorSheet
        visible={presentation === 'editor'}
        draft={draft}
        busy={busy}
        error={error}
        onChange={updateDraft}
        onSave={save}
        onComplete={complete}
        onDelete={remove}
        onCancel={closeComposer}
      />
    </ItemComposerContextValue.Provider>
  );
}

export function useItemComposer(): ItemComposerApi {
  const value = useContext(ItemComposerContextValue);
  if (!value) throw new Error('useItemComposer must be used inside ItemComposerProvider.');
  return value;
}
