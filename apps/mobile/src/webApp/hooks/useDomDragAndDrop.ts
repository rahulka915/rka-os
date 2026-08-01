import { useCallback, useEffect, useRef } from 'react';

// RNW's Pressable/View don't forward unrecognized props (draggable,
// onDragStart, ...) to the underlying DOM node — there's no first-class RN
// drag API — so drag source/target behavior is wired directly onto the real
// DOM element via a ref instead, in a plain useEffect.
export function useDraggableRef(itemId: string) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof node.addEventListener !== 'function') return;
    node.draggable = true;
    node.style.cursor = 'grab';
    const onDragStart = (event: DragEvent) => {
      event.dataTransfer?.setData('text/plain', itemId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };
    node.addEventListener('dragstart', onDragStart);
    return () => node.removeEventListener('dragstart', onDragStart);
  }, [itemId]);
  return ref;
}

export function useDropZoneRef(onDropItemId: (id: string) => void, onHoverChange: (hovering: boolean) => void) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof node.addEventListener !== 'function') return;
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      onHoverChange(true);
    };
    const onDragLeave = () => onHoverChange(false);
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      onHoverChange(false);
      const id = event.dataTransfer?.getData('text/plain');
      if (id) onDropItemId(id);
    };
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDrop);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

// Combines multiple refs onto one DOM node — used where a single element
// (e.g. a reorderable row) must be both a drag source and a drop target,
// which useDraggableRef/useDropZoneRef each expect their own ref for.
export function useMergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return useCallback(
    (node: T) => {
      for (const ref of refs) {
        if (typeof ref === 'function') ref(node);
        else if (ref && typeof ref === 'object') (ref as React.MutableRefObject<T | null>).current = node;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs,
  );
}
