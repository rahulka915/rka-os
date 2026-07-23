import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { RoninMood, RoninTimeOfDay } from '../../domain/ronin/types';
import { getRoninMoodConfig } from '../../domain/ronin/moodConfig';
import { KatanaProgress } from '../ui/KatanaProgress';
import { RiverStoneSurface } from '../riverstone';
import { useThemeContext } from '../../hooks/useThemeContext';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import {
  HeroEnvironment,
  type HeroFocusState,
  type HeroInboxState,
} from '../hero/environment';

interface RoninGreetingCardProps {
  mood: RoninMood;
  statusLine: string;
  greetingWord: string;
  name: string;
  timeOfDay: RoninTimeOfDay;
  completedCount: number;
  totalCount: number;
  inboxCount: number;
  focusActive: boolean;
  onPress?: () => void;
}

// The hero landscape follows the existing RoninTimeOfDay value. Mood remains
// a smaller accent axis: corner glow, status dot, hanko tint and progress fill.
//
// The chibi Ronin+cat illustration (getRoninAsset, 'base' outfit) was tried
// bleeding off the bottom-right corner in an earlier pass, but the current
// PNG cutouts have rough/dirty transparency edges — pulled until cleaner
// cutouts exist. Those PNGs are untouched on disk since RoninCharacter.tsx's
// static fallback and the Profile dev bench still use them.
const HERO_LANDSCAPES: Record<RoninTimeOfDay, number> = {
  morning: require('../../../assets/hero-card/morning-landscape.png'),
  day: require('../../../assets/hero-card/afternoon-landscape.png'),
  night: require('../../../assets/hero-card/night-landscape.png'),
};

function getHeroInboxState(inboxCount: number): HeroInboxState {
  if (inboxCount === 0) return 'empty';
  return inboxCount < 5 ? 'partial' : 'full';
}

function RegisteredHeroBackground({
  timeOfDay,
  inboxState,
  focusState,
}: {
  timeOfDay: RoninTimeOfDay;
  inboxState: HeroInboxState;
  focusState: HeroFocusState;
}) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => current.width === width && current.height === height
      ? current
      : { width, height });
  };

  return (
    <View pointerEvents="none" onLayout={onLayout} style={StyleSheet.absoluteFill}>
      <Image
        source={HERO_LANDSCAPES[timeOfDay]}
        resizeMode="cover"
        style={styles.landscape}
      />
      {viewport.width > 0 && viewport.height > 0 ? (
        <HeroEnvironment
          timeOfDay={timeOfDay}
          weather="clear"
          inboxState={inboxState}
          focusState={focusState}
          parallaxEnabled
          accessible={false}
          viewportWidth={viewport.width}
          viewportHeight={viewport.height}
          style={StyleSheet.absoluteFill}
          testID="home-hero-environment"
        />
      ) : null}
    </View>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function RoninGreetingCard({
  mood,
  statusLine,
  greetingWord,
  name,
  timeOfDay,
  completedCount,
  totalCount,
  inboxCount,
  focusActive,
  onPress,
}: RoninGreetingCardProps) {
  const { isDark } = useThemeContext();
  const moodConfig = getRoninMoodConfig(mood);
  const progressRatio = totalCount > 0 ? completedCount / totalCount : 0;
  const progressLabel = totalCount > 0 ? `${completedCount} of ${totalCount} done` : 'Nothing scheduled today';
  const inboxState = getHeroInboxState(inboxCount);
  const focusState: HeroFocusState = focusActive ? 'active' : 'idle';

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.9 : 1}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={moodConfig.accessibilityLabel}
    >
      {/* The landscape renders below River Stone's lighting layers so the
          supplied art becomes part of the material instead of a flat overlay. */}
      <RiverStoneSurface
        variant="hero"
        mode={isDark ? 'dark' : 'light'}
        background={
          <>
            {FEATURE_FLAGS.heroEnvironment ? (
              <RegisteredHeroBackground
                timeOfDay={timeOfDay}
                inboxState={inboxState}
                focusState={focusState}
              />
            ) : (
              <Image
                source={HERO_LANDSCAPES[timeOfDay]}
                resizeMode="cover"
                style={styles.landscape}
              />
            )}
            <LinearGradient
              colors={['rgba(8,9,16,0.92)', 'rgba(8,9,16,0.58)', 'rgba(8,9,16,0.10)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(8,9,16,0.04)', 'rgba(8,9,16,0.72)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              locations={[0.35, 1]}
              style={StyleSheet.absoluteFill}
            />
          </>
        }
      >
        <View style={styles.content}>
          <Svg width={180} height={180} style={styles.glow}>
            <Defs>
              <RadialGradient id="moodGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={moodConfig.accentColor} stopOpacity={0.24} />
                <Stop offset="1" stopColor={moodConfig.accentColor} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={90} cy={90} r={90} fill="url(#moodGlow)" />
          </Svg>

          <View style={[styles.hanko, { backgroundColor: hexToRgba(moodConfig.accentColor, 0.55) }]}>
            <Text style={styles.hankoText}>武</Text>
          </View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greetingTitle}>
              <Text style={styles.greetingJapanese}>{greetingWord}、</Text>
              <Text style={styles.greetingName}>{name}</Text>
            </Text>

            <View style={styles.statusRow}>
              <View style={[styles.moodDot, { backgroundColor: moodConfig.accentColor }]} />
              <Text style={styles.statusText} numberOfLines={2}>
                {statusLine}
              </Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Today</Text>
            <Text style={styles.progressCount}>{progressLabel}</Text>
          </View>
          <KatanaProgress
            progress={progressRatio}
            size="hero"
            accessibilityLabel="Today's completion"
          />
        </View>
      </RiverStoneSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  landscape: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  content: {
    width: '100%',
    padding: 16,
  },
  glow: {
    position: 'absolute',
    right: -60,
    top: -60,
  },
  hanko: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hankoText: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#f2ede6',
  },
  greetingBlock: {
    maxWidth: '78%',
  },
  greetingTitle: {
    fontSize: 21,
    color: '#ffffff',
  },
  // Reverted from the two-font Mincho/Cormorant split back to the original
  // single Georgia italic across both the Japanese phrase and the name —
  // preferred on reflection after seeing both options.
  greetingJapanese: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  greetingName: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  moodDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.85)',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 14,
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  progressCount: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
  },
});
