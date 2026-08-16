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

const IDLE_CYCLE_FRAMES: number[] = [
  require('../../../assets/ronin/journey/idle/ronin-idle-01.png'),
  require('../../../assets/ronin/journey/idle/ronin-idle-02.png'),
  require('../../../assets/ronin/journey/idle/ronin-idle-03.png'),
  require('../../../assets/ronin/journey/idle/ronin-idle-04.png'),
];

// Populated by a later task once the tap-reaction sheet is sliced. Kept as
// its own registry entry now (rather than added later) so every consumer of
// SPRITE_STATES already handles an arbitrary state count.
const TAP_REACTION_FRAMES: number[] = [
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-01.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-02.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-03.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-04.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-05.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-06.png'),
];

// Single source of truth for every sprite state's playback: which frames,
// how fast, and whether it loops forever or plays once and holds. Adding a
// new state (celebration, time-of-day, ...) means adding one entry here and
// to RoninSpriteState — nothing else in this component changes.
const SPRITE_STATES: Record<RoninSpriteState, SpriteStateConfig> = {
  walking: { frames: WALK_CYCLE_FRAMES, intervalMs: WALK_CYCLE_FRAME_INTERVAL_MS, loopMode: 'loop' },
  idle: { frames: IDLE_CYCLE_FRAMES, intervalMs: 650, loopMode: 'loop' },
  tapReaction: { frames: TAP_REACTION_FRAMES, intervalMs: 90, loopMode: 'once' },
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
        if (didComplete) {
          clearInterval(interval);
          onCompleteRef.current?.();
        }
        return frame;
      });
    }, config.intervalMs);
    return () => clearInterval(interval);
  }, [state]);

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
