import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { getNextSpriteFrame, WALK_CYCLE_FRAME_INTERVAL_MS } from '../../utils/walkCycle';
import type { RoninSpriteState, SpriteStateConfig } from './roninSpriteStates';

const WALK_CYCLE_FRAMES: number[] = [
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-01.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-02.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-03.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-04.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-05.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-06.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-07.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-08.png'),
];

// Two camera-angle variants of the same 6-frame breathing/sway loop
// (new-reference art, 2026-08-16) — RoninWalkCycleSprite randomly picks one
// each time it enters the 'idle' state, for visual variety. Both arrays
// must stay the same length (6) since SPRITE_STATES.idle.frames (below) is
// only used for that shared length/interval/loopMode, not for rendering.
const IDLE_FRONT34_FRAMES: number[] = [
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-01.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-02.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-03.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-04.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-05.png'),
  require('../../../assets/ronin/journey/idle-front34/ronin-idle-front34-06.png'),
];

const IDLE_FRONT_FRAMES: number[] = [
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-01.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-02.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-03.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-04.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-05.png'),
  require('../../../assets/ronin/journey/idle-front/ronin-idle-front-06.png'),
];

const IDLE_VARIANTS: number[][] = [IDLE_FRONT34_FRAMES, IDLE_FRONT_FRAMES];

// Bow-down-to-pet-the-cat animation, triggered by the Bow button (not by
// tapping the character — see RoninJourneyPrototype.tsx's triggerAction).
const BOW_FRAMES: number[] = [
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-01.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-02.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-03.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-04.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-05.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-06.png'),
];

const JUMP_FRAMES: number[] = [
  require('../../../assets/ronin/journey/jump/ronin-jump-01.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-02.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-03.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-04.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-05.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-06.png'),
];

// Single source of truth for every sprite state's playback: which frames,
// how fast, and whether it loops forever or plays once and holds. Adding a
// new state (celebration, time-of-day, ...) means adding one entry here and
// to RoninSpriteState — nothing else in this component changes.
const SPRITE_STATES: Record<RoninSpriteState, SpriteStateConfig> = {
  walking: { frames: WALK_CYCLE_FRAMES, intervalMs: WALK_CYCLE_FRAME_INTERVAL_MS, loopMode: 'loop' },
  // frames here is a placeholder used only for SPRITE_STATES.idle.frames.length
  // (both IDLE_VARIANTS arrays are the same length) — actual rendering for
  // 'idle' uses the randomly-picked variant in idleVariantFramesRef, set in
  // the state-change effect below, not this array directly.
  idle: { frames: IDLE_FRONT34_FRAMES, intervalMs: 420, loopMode: 'loop' },
  bow: { frames: BOW_FRAMES, intervalMs: 90, loopMode: 'once' },
  jump: { frames: JUMP_FRAMES, intervalMs: 90, loopMode: 'once' },
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
