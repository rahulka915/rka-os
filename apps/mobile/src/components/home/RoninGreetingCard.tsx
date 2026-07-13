import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { RoninMood, RoninTimeOfDay } from '../../domain/ronin/types';
import { getRoninMoodConfig } from '../../domain/ronin/moodConfig';
import { TimeOfDayMotif } from '../icons/TimeOfDayMotif';
import { KatanaProgressBar } from './KatanaProgressBar';

interface RoninGreetingCardProps {
  mood: RoninMood;
  statusLine: string;
  greetingWord: string;
  name: string;
  timeOfDay: RoninTimeOfDay;
  completedCount: number;
  totalCount: number;
  onPress?: () => void;
}

// Two independent color axes, on purpose:
// - Base gradient is driven by time-of-day (TIME_OF_DAY_TINT), matching the
//   scene art / greeting already keyed off the same RoninTimeOfDay value —
//   subtle, on-brand, doesn't swing wildly like a full mood-hue swap did in
//   an earlier pass.
// - Mood only shows up as a small accent (corner glow, status dot, hanko
//   tint, progress-bar fill) via moodConfig.accentColor, layered on top.
//
// The chibi Ronin+cat illustration (getRoninAsset, 'base' outfit) was tried
// bleeding off the bottom-right corner in an earlier pass, but the current
// PNG cutouts have rough/dirty transparency edges — pulled until cleaner
// cutouts exist. Those PNGs are untouched on disk since RoninCharacter.tsx's
// static fallback and the Profile dev bench still use them.
const TIME_OF_DAY_TINT: Record<RoninTimeOfDay, [string, string]> = {
  morning: ['#40311f', '#1c150e'],
  day: ['#1e56a0', '#4fa8f5'],
  night: ['#1c1c32', '#0f0f1a'],
};

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
  onPress,
}: RoninGreetingCardProps) {
  const moodConfig = getRoninMoodConfig(mood);
  const progressRatio = totalCount > 0 ? completedCount / totalCount : 0;
  const progressLabel = totalCount > 0 ? `${completedCount} of ${totalCount} done` : 'Nothing scheduled today';

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.9 : 1}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={moodConfig.accessibilityLabel}
    >
      <LinearGradient
        colors={TIME_OF_DAY_TINT[timeOfDay]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0.15, 1]}
        style={styles.card}
      >
        <Svg width={180} height={180} style={styles.glow}>
          <Defs>
            <RadialGradient id="moodGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={moodConfig.accentColor} stopOpacity={0.24} />
              <Stop offset="1" stopColor={moodConfig.accentColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={90} cy={90} r={90} fill="url(#moodGlow)" />
        </Svg>

        <TimeOfDayMotif timeOfDay={timeOfDay} style={styles.motif} />

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
        <KatanaProgressBar progress={progressRatio} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    right: -60,
    top: -60,
  },
  motif: {
    position: 'absolute',
    right: -14,
    top: -8,
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
