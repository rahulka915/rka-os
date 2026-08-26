import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { getNextSpriteFrame } from '../../utils/walkCycle';
import type { RoninSpriteState, SpriteStateConfig } from './roninSpriteStates';
import { RONIN_SPRITE_CLIPS } from './roninSpriteRegistry';

// Single source of truth for every sprite state's playback: which frames,
// how fast, and whether it loops forever or plays once and holds. Adding a
// new state (celebration, time-of-day, ...) means adding one entry here and
// to RoninSpriteState — nothing else in this component changes.
const SPRITE_STATES: Record<RoninSpriteState, SpriteStateConfig> = {
  walking: { frames: RONIN_SPRITE_CLIPS.walking.frames, intervalMs: RONIN_SPRITE_CLIPS.walking.frameDurationMs, loopMode: 'loop' },
  idle: { frames: RONIN_SPRITE_CLIPS.calm.frames, intervalMs: RONIN_SPRITE_CLIPS.calm.frameDurationMs, loopMode: 'loop' },
  lookAround: { frames: RONIN_SPRITE_CLIPS.lookAround.frames, intervalMs: RONIN_SPRITE_CLIPS.lookAround.frameDurationMs, loopMode: 'once' },
  blinkDip: { frames: RONIN_SPRITE_CLIPS.blinkDip.frames, intervalMs: RONIN_SPRITE_CLIPS.blinkDip.frameDurationMs, loopMode: 'once' },
  yawn: { frames: RONIN_SPRITE_CLIPS.yawn.frames, intervalMs: RONIN_SPRITE_CLIPS.yawn.frameDurationMs, loopMode: 'once' },
  adjustWrap: { frames: RONIN_SPRITE_CLIPS.adjustWrap.frames, intervalMs: RONIN_SPRITE_CLIPS.adjustWrap.frameDurationMs, loopMode: 'once' },
  shoulderStretch: { frames: RONIN_SPRITE_CLIPS.shoulderStretch.frames, intervalMs: RONIN_SPRITE_CLIPS.shoulderStretch.frameDurationMs, loopMode: 'once' },
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
  useEffect(() => {
    setFrameIndex(0);
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

  const frames = SPRITE_STATES[state].frames;
  if (frames.length === 0) return null;
  return <Image source={frames[frameIndex]} resizeMode="contain" style={[styles.image, style]} />;
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
