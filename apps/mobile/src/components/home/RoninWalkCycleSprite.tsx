import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { getNextSpriteFrame } from '../../utils/walkCycle';
import type { RoninSpriteState, SpriteStateConfig } from './roninSpriteStates';
import { RONIN_SPRITE_CLIPS } from './roninSpriteRegistry';

const IDLE_VARIANTS: number[][] = [RONIN_SPRITE_CLIPS.calm.frames];

// Single source of truth for every sprite state's playback: which frames,
// how fast, and whether it loops forever or plays once and holds. Adding a
// new state (celebration, time-of-day, ...) means adding one entry here and
// to RoninSpriteState — nothing else in this component changes.
const SPRITE_STATES: Record<RoninSpriteState, SpriteStateConfig> = {
  walking: { frames: RONIN_SPRITE_CLIPS.walking.frames, intervalMs: RONIN_SPRITE_CLIPS.walking.frameDurationMs, loopMode: 'loop' },
  // frames here is a placeholder used only for SPRITE_STATES.idle.frames.length
  // (both IDLE_VARIANTS arrays are the same length) — actual rendering for
  // 'idle' uses the randomly-picked variant in idleVariantFramesRef, set in
  // the state-change effect below, not this array directly.
  idle: { frames: RONIN_SPRITE_CLIPS.calm.frames, intervalMs: RONIN_SPRITE_CLIPS.calm.frameDurationMs, loopMode: 'loop' },
  bow: { frames: RONIN_SPRITE_CLIPS.bow.frames, intervalMs: RONIN_SPRITE_CLIPS.bow.frameDurationMs, loopMode: 'once' },
  jump: { frames: RONIN_SPRITE_CLIPS.jump.frames, intervalMs: RONIN_SPRITE_CLIPS.jump.frameDurationMs, loopMode: 'once' },
};

interface RoninWalkCycleSpriteProps {
  style?: StyleProp<ImageStyle>;
  /** Which animation to play right now — see SPRITE_STATES for the full registry. */
  state: RoninSpriteState;
  /** Fires once when a `loopMode: 'once'` state reaches its last frame. Never called for looping states. */
  onComplete?: () => void;
}

export function RoninWalkCycleSprite({ style, state, onComplete }: RoninWalkCycleSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  // Which idle variant is currently showing — rerolled only when freshly
  // entering 'idle' (the effect below), so it stays stable for the whole
  // duration of one idle stretch rather than reshuffling every frame.
  const idleVariantFramesRef = useRef<number[]>(IDLE_VARIANTS[0]);

  useEffect(() => {
    setFrameIndex(0);
    if (state === 'idle') {
      idleVariantFramesRef.current = IDLE_VARIANTS[Math.floor(Math.random() * IDLE_VARIANTS.length)];
    }
    const config = SPRITE_STATES[state];
    if (config.frames.length === 0) return;
    const interval = setInterval(() => {
      setFrameIndex((current) => {
        const { frame, didComplete } = getNextSpriteFrame(current, config.frames.length, config.loopMode);
        if (didComplete) clearInterval(interval);
        return frame;
      });
    }, config.intervalMs);
    return () => clearInterval(interval);
  }, [state]);

  // Fires the parent's onComplete (which sets RoninJourneyPrototype's
  // activeAction state) from its own effect pass, once frameIndex has
  // actually committed at the last frame of a 'once' state — calling it
  // synchronously inside the setFrameIndex updater above (the interval
  // callback) triggers React's "Cannot update a component while rendering a
  // different component" warning, since that updater can run during this
  // component's own render/reducer phase.
  useEffect(() => {
    const config = SPRITE_STATES[state];
    if (config.loopMode === 'once' && frameIndex === config.frames.length - 1) {
      onCompleteRef.current?.();
    }
  }, [frameIndex, state]);

  const frames = state === 'idle' ? idleVariantFramesRef.current : SPRITE_STATES[state].frames;
  if (frames.length === 0) return null;
  return <Image source={frames[frameIndex]} resizeMode="contain" style={[styles.image, style]} />;
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
