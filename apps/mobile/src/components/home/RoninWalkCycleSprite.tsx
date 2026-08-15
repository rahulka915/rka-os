import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet } from 'react-native';
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
}

export function RoninWalkCycleSprite({ style }: RoninWalkCycleSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setFrameIndex((current) => getNextWalkCycleFrame(current, WALK_CYCLE_FRAME_COUNT));
    }, WALK_CYCLE_FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  return <Image source={WALK_CYCLE_FRAMES[frameIndex]} resizeMode="contain" style={[styles.image, style]} />;
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
