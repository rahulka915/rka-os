import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUp, ChevronsDown } from 'lucide-react-native';
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
import type { RoninSpriteState } from './roninSpriteStates';

// Warm off-white instead of pure #fff — softer against the sunset photo and
// consistent with the app's dark-mode text tone (theme/colors.ts `text`).
const JOURNEY_TEXT = '#f5efe4';

// JPEG, not PNG — this is a full-bleed photographic scene with no
// transparency, so lossless PNG was pure waste (1.7MB vs 278KB at q92
// with no visible banding in the gradient sky).
const sunsetTrail = require('../../../assets/ronin/journey/sunset-trail-background-v1.jpg');
const WALKER_SIZE = 164;

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
  // Fraction (0-1) of the *remaining* distance to the path's end covered by
  // an active press-and-hold preview — never written to progress/ratio
  // itself, purely a temporary visual offset (see the walking-Ronin spec's
  // "hold-to-preview-walk" addendum).
  const previewProgress = useSharedValue(0);
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  // True only while progress.value is actually animating toward a new ratio
  // (see the progress useEffect below) — the walk-cycle should play while
  // the character is really moving, not sit in a standing pose while its
  // position visibly slides.
  const [isProgressAnimating, setIsProgressAnimating] = useState(false);
  // Which one-shot sprite animation (if any) is currently playing — takes
  // priority over walking/idle until RoninWalkCycleSprite's onComplete
  // fires and reverts it to null. Only one plays at a time: triggerAction
  // no-ops while this is already non-null.
  const [activeAction, setActiveAction] = useState<'jump' | 'bow' | null>(null);
  const didMount = useRef(false);
  const progressAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (progressAnimationTimeoutRef.current) clearTimeout(progressAnimationTimeoutRef.current);
  }, []);

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
    const duration = reduceMotion ? 1400 : 900;
    progress.value = withTiming(ratio, {
      duration,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
    setIsProgressAnimating(true);
    if (progressAnimationTimeoutRef.current) clearTimeout(progressAnimationTimeoutRef.current);
    progressAnimationTimeoutRef.current = setTimeout(() => setIsProgressAnimating(false), duration);
  }, [progress, ratio, reduceMotion]);

  const playHopReaction = () => {
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

  // Character tap keeps only a light acknowledgment (the hop) — it no
  // longer switches the sprite to a one-shot animation. Jump/Bow buttons
  // are the explicit way to trigger those.
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playHopReaction();
  };

  // Ignores the press if an action is already playing, so a jump and a bow
  // can never run at once. Jump also plays the hop transform (it's an
  // upward motion, consistent with the hop); Bow does not (it's a downward
  // motion that would visually fight an upward hop).
  const triggerAction = (action: 'jump' | 'bow') => {
    if (activeAction !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveAction(action);
    if (action === 'jump') playHopReaction();
  };

  const handleActionComplete = () => setActiveAction(null);

  const handlePressIn = () => {
    setIsHolding(true);
    previewProgress.value = withTiming(1, {
      duration: 1800,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    });
  };

  const handlePressOut = () => {
    setIsHolding(false);
    previewProgress.value = withTiming(0, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
  };

  const isWalking = isHolding || isProgressAnimating;
  const spriteState: RoninSpriteState = activeAction ?? (isWalking ? 'walking' : 'idle');

  const walkerStyle = useAnimatedStyle(() => {
    const travel = Math.max(0, width - WALKER_SIZE - 4);
    const displayProgress = progress.value + previewProgress.value * (1 - progress.value);
    const pathRise = interpolate(displayProgress, [0, 0.5, 1], [0, -4, -11]);
    // The idle/walking breathing bob+rotate runs continuously (it's not
    // gated by isWalking, it's always cycling) — freeze it at 0 while a
    // one-shot Jump/Bow animation is playing, or it visibly bleeds into
    // those poses (most noticeable as a residual bounce during a bow).
    const bob = activeAction ? 0 : interpolate(walkCycle.value, [0, 1], [2, reduceMotion ? 0 : -4]);
    return {
      transform: [
        { translateX: displayProgress * travel },
        { translateY: pathRise + bob - reaction.value * 18 },
        { rotate: `${activeAction || reduceMotion ? 0 : interpolate(walkCycle.value, [0, 1], [-1.2, 1.2])}deg` },
        { scale: 1 + reaction.value * 0.055 },
      ],
    };
  }, [reduceMotion, width, activeAction]);

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
      // RiverStoneSurface's content layer has no explicit size, so it
      // collapses to zero height when its only child is position:absolute
      // (as this widget's Pressable is) — Yoga excludes absolute children
      // from a parent's auto-size calculation. flex:1 makes the content
      // layer actually fill the card so the absoluteFill Pressable inside
      // it has a real box to fill instead of a 0x0 one.
      contentStyle={styles.content}
      background={<Image source={sunsetTrail} resizeMode="cover" style={styles.background} />}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="button"
        accessibilityLabel={`Today\u2019s path. ${progressLabel}. Ronin and cat.`}
        accessibilityHint="Tap for a reaction, hold to preview the walk"
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
          <RoninWalkCycleSprite style={styles.walkerImage} state={spriteState} onComplete={handleActionComplete} />
        </Animated.View>

        <View style={styles.actionButtonRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => triggerAction('jump')}
            disabled={activeAction !== null}
            accessibilityRole="button"
            accessibilityLabel="Jump"
          >
            <ArrowUp size={16} color={JOURNEY_TEXT} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => triggerAction('bow')}
            disabled={activeAction !== null}
            accessibilityRole="button"
            accessibilityLabel="Bow"
          >
            <ChevronsDown size={16} color={JOURNEY_TEXT} strokeWidth={2.5} />
          </Pressable>
        </View>
      </Pressable>
    </RiverStoneSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    marginHorizontal: 12,
    marginTop: 8,
  },
  content: {
    flex: 1,
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
  // In-game HUD-style action buttons, top-right of the card — above the
  // heading scrim/text (zIndex) but out of the way of both the heading copy
  // and the walker's path along the bottom.
  actionButtonRow: {
    position: 'absolute',
    top: 15,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,12,34,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(245,239,228,0.28)',
  },
});
