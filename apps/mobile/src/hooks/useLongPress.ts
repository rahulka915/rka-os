import { useRef, useState } from 'react';
import { GestureResponderEvent } from 'react-native';

export interface UseLongPressOptions {
  onTap?: () => void;
  onLongPress?: () => void;
  threshold?: number; // ms
  tolerance?: number; // pt
}

export function useLongPress(options: UseLongPressOptions = {}) {
  const {
    onTap,
    onLongPress,
    threshold = 420,
    tolerance = 12,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const handlePointerDown = (event: GestureResponderEvent) => {
    setIsPressed(true);
    const { pageX, pageY } = event.nativeEvent;
    startPosRef.current = { x: pageX, y: pageY };

    timerRef.current = setTimeout(() => {
      if (startPosRef.current && onLongPress) {
        onLongPress();
      }
    }, threshold);
  };

  const handlePointerMove = (event: GestureResponderEvent) => {
    if (!startPosRef.current) return;

    const { pageX, pageY } = event.nativeEvent;
    const dx = Math.abs(pageX - startPosRef.current.x);
    const dy = Math.abs(pageY - startPosRef.current.y);
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > tolerance) {
      // User moved too far, cancel long-press
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handlePointerUp = () => {
    setIsPressed(false);

    // If timer is still running, user released before 420ms → tap
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (onTap) {
        onTap();
      }
    }

    startPosRef.current = null;
  };

  return {
    getEventHandlers: () => ({
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerUp,
    }),
  };
}
