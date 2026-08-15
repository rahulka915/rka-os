import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { RiverStoneSurface } from '../riverstone';
import { RoninWalkCycleSprite } from './RoninWalkCycleSprite';

// Warm off-white instead of pure #fff — softer against the sunset photo and
// consistent with the app's dark-mode text tone (theme/colors.ts `text`).
const JOURNEY_TEXT = '#f5efe4';

// JPEG, not PNG — this is a full-bleed photographic scene with no
// transparency, so lossless PNG was pure waste (1.7MB vs 278KB at q92
// with no visible banding in the gradient sky).
const sunsetTrail = require('../../../assets/ronin/journey/sunset-trail-background-v1.jpg');
const WALKER_SIZE = 164;
const REACTIONS = ['Onward.', 'One step at a time.', 'The path is yours.'];

interface RoninJourneyPrototypeProps {
  completedCount: number;
  totalCount: number;
  isDark: boolean;
  /**
   * Overall Potential (0-100), shown as a small secondary caption. Journey
   * itself stays the permanent visual framework — this is just it surfacing
   * today's live Potential/Domain data, not a renamed data object.
   */
  potentialPercent?: number;
}

export function RoninJourneyPrototype({ completedCount, totalCount, isDark, potentialPercent }: RoninJourneyPrototypeProps) {
  const ratio = totalCount > 0 ? Math.min(completedCount / totalCount, 1) : 0;
  const progress = useSharedValue(ratio);
  const walkCycle = useSharedValue(0);
  const reaction = useSharedValue(0);
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reactionIndex, setReactionIndex] = useState(0);
  const didMount = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    walkCycle.value = 0;
    walkCycle.value = withRepeat(
      withTiming(1, {
        duration: reduceMotion ? 1300 : 520,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [reduceMotion, walkCycle]);

  useEffect(() => {
    if (!didMount.current) {
      progress.value = ratio;
      didMount.current = true;
      return;
    }
    progress.value = withTiming(ratio, {
      duration: reduceMotion ? 1400 : 900,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
  }, [progress, ratio, reduceMotion]);

  const handlePress = () => {
    setReactionIndex((current) => (current + 1) % REACTIONS.length);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reaction.value = 0;
    reaction.value = withSequence(
      ReduceMotion.Never,
      withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      }),
      withTiming(0, {
        duration: 460,
        easing: Easing.out(Easing.bounce),
        reduceMotion: ReduceMotion.Never,
      }),
    );
  };

  const walkerStyle = useAnimatedStyle(() => {
    const travel = Math.max(0, width - WALKER_SIZE - 4);
    const pathRise = interpolate(progress.value, [0, 0.5, 1], [0, -4, -11]);
    const bob = interpolate(walkCycle.value, [0, 1], [2, reduceMotion ? 0 : -4]);
    return {
      transform: [
        { translateX: progress.value * travel },
        { translateY: pathRise + bob - reaction.value * 18 },
        { rotate: `${reduceMotion ? 0 : interpolate(walkCycle.value, [0, 1], [-1.2, 1.2])}deg` },
        { scale: 1 + reaction.value * 0.055 },
      ],
    };
  }, [reduceMotion, width]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reaction.value, [0, 0.15, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(reaction.value, [0, 1], [5, 0]) },
      { scale: interpolate(reaction.value, [0, 1], [0.9, 1]) },
    ],
  }));

  const progressLabel = totalCount === 0
    ? 'A clear path today'
    : completedCount === totalCount
      ? 'Today\u2019s path complete'
      : `${completedCount} of ${totalCount} complete`;

  return (
    <RiverStoneSurface
      variant="hero"
      mode={isDark ? 'dark' : 'light'}
      style={[styles.surface, styles.card]}
      background={<Image source={sunsetTrail} resizeMode="cover" style={styles.background} />}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="button"
        accessibilityLabel={`Today\u2019s path. ${progressLabel}. Ronin and cat.`}
        accessibilityHint="Tap for a reaction"
      >
        <View pointerEvents="none" style={styles.scrim} />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(7,10,28,0.55)', 'rgba(7,10,28,0)']}
          locations={[0, 1]}
          style={styles.headingScrim}
        />

        <View pointerEvents="none" style={styles.headingRow}>
          <View>
            <Text style={styles.eyebrow}>{'TODAY\u2019S PATH'}</Text>
            <Text style={styles.progressLabel}>{progressLabel}</Text>
          </View>
          <View style={styles.percentColumn}>
            <Text style={styles.percent}>{Math.round(ratio * 100)}%</Text>
            {potentialPercent !== undefined && (
              <Text style={styles.potentialCaption}>Potential {Math.round(potentialPercent)}%</Text>
            )}
          </View>
        </View>

        <Svg pointerEvents="none" width="100%" height={54} style={styles.progressPath} viewBox="0 0 360 54" preserveAspectRatio="none">
          <Path d="M8 38 C80 25 122 48 184 35 C246 22 296 40 352 18" stroke="rgba(7,17,40,0.48)" strokeWidth={8} strokeLinecap="round" fill="none" />
          <Path d="M8 38 C80 25 122 48 184 35 C246 22 296 40 352 18" stroke="#f2b35f" strokeWidth={3.5} strokeLinecap="round" fill="none" strokeDasharray={`${ratio * 390} 390`} />
        </Svg>

        <Animated.View pointerEvents="none" style={[styles.walker, walkerStyle]}>
          <RoninWalkCycleSprite style={styles.walkerImage} />
          <Animated.View style={[styles.reactionBubble, bubbleStyle]}>
            <Text style={styles.reactionText}>{REACTIONS[reactionIndex]}</Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </RiverStoneSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    marginHorizontal: 12,
    marginTop: 8,
  },
  card: {
    height: 270,
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: 468,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(7,12,34,0.09)',
  },
  // Extra top-down gradient specifically behind the heading text (on top of
  // the flat `scrim` above), so title/eyebrow/percent stay legible against
  // bright sky without needing heavier text shadows.
  headingScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 15,
  },
  eyebrow: {
    color: '#ffe1a6',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.15,
    textShadowColor: 'rgba(8,12,35,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Journey title only — Newsreader gives this one line of emotional
  // copy some character; everything else on Home stays practical Inter.
  progressLabel: {
    color: JOURNEY_TEXT,
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 19,
    fontWeight: '600',
    marginTop: 3,
    textShadowColor: 'rgba(8,12,35,0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  percentColumn: {
    alignItems: 'flex-end',
  },
  percent: {
    color: `${JOURNEY_TEXT}d6`,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(8,12,35,0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  potentialCaption: {
    color: `${JOURNEY_TEXT}ad`,
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    textShadowColor: 'rgba(8,12,35,0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  progressPath: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
  },
  walker: {
    position: 'absolute',
    left: 2,
    bottom: 10,
    width: WALKER_SIZE,
    height: WALKER_SIZE,
    zIndex: 4,
  },
  walkerImage: {
    width: '100%',
    height: '100%',
  },
  reactionBubble: {
    position: 'absolute',
    right: -28,
    top: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  reactionText: {
    color: '#26203c',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    fontWeight: '600',
  },
});
