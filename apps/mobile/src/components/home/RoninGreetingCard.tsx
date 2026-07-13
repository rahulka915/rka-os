import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RoninMood } from '../../domain/ronin/types';
import { getRoninMoodConfig } from '../../domain/ronin/moodConfig';
import { getRoninProgress } from '../../utils/roninProgress';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors } from '../../theme';
import { Sparkles } from '../../icons';
import { KatanaProgressBar } from './KatanaProgressBar';

interface RoninGreetingCardProps {
  mood: RoninMood;
  greeting: string;
  onPress?: () => void;
}

// Compact status card: greeting copy, mood status line, level + XP bar.
// Sibling of RoninStage — together they replace the old single hero card.
// No character or scene art here; this is text/status only.
export function RoninGreetingCard({ mood, greeting, onPress }: RoninGreetingCardProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const moodConfig = getRoninMoodConfig(mood);
  const progress = getRoninProgress();
  const xpRatio = Math.min(1, progress.xp / progress.xpToNext);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={[styles.card, { backgroundColor: palette.surface }]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={moodConfig.accessibilityLabel}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.greetingTitle, { color: palette.text }]}>{greeting}</Text>
        <Sparkles size={15} color={palette.deeperBlue} strokeWidth={1.75} />
      </View>
      <Text style={[styles.greetingSubtitle, { color: palette.textSecondary }]}>Let's make today count.</Text>

      <View style={styles.statusRow}>
        <View style={[styles.moodDot, { backgroundColor: moodConfig.accentColor }]} />
        <Text style={[styles.moodText, { color: palette.textSecondary }]} numberOfLines={2}>
          {moodConfig.supportingCopy}
        </Text>
      </View>

      <View style={styles.levelRow}>
        <Text style={[styles.levelText, { color: palette.text }]}>Level {progress.level}</Text>
        <Text style={[styles.xpText, { color: palette.textSecondary }]}>
          {progress.xp} / {progress.xpToNext} XP
        </Text>
      </View>
      <KatanaProgressBar progress={xpRatio} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greetingTitle: {
    fontSize: 21,
    fontWeight: '500',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  greetingSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
  },
  moodDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  moodText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 10,
    marginBottom: 6,
  },
  levelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  xpText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
