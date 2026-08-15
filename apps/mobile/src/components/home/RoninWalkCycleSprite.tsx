import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { getNextWalkCycleFrame, WALK_CYCLE_FRAME_COUNT, WALK_CYCLE_FRAME_INTERVAL_MS } from '../../utils/walkCycle';

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

interface RoninWalkCycleSpriteProps {
  style?: StyleProp<ImageStyle>;
  /**
   * Whether the character is actually translating right now (real progress
   * transitioning, or a hold-to-preview in progress). Cycles frames only
   * while true; holds a single standing pose (frame 1) otherwise, so the
   * character doesn't appear to jog in place while stationary. Always
   * cycles regardless of Reduce Motion when true — a small in-place sprite
   * swap isn't the large-scale/parallax motion that setting targets.
   */
  isWalking: boolean;
}

export function RoninWalkCycleSprite({ style, isWalking }: RoninWalkCycleSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!isWalking) {
      setFrameIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setFrameIndex((current) => getNextWalkCycleFrame(current, WALK_CYCLE_FRAME_COUNT));
    }, WALK_CYCLE_FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isWalking]);

  return <Image source={WALK_CYCLE_FRAMES[frameIndex]} resizeMode="contain" style={[styles.image, style]} />;
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
