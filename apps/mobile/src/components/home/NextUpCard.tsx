import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sparkles, ListChecks, Pill, Dumbbell } from '../../icons';
import type { NextUpResult } from '../../utils/nextUpItem';
import { getThemeColors } from '../../theme';

interface NextUpCardProps {
  result: NextUpResult | null;
  onAction: (result: NextUpResult) => void;
  isDark: boolean;
}

function IconFor({ type, color }: { type: NextUpResult['type']; color: string }) {
  if (type === 'medication') return <Pill size={18} color={color} strokeWidth={1.75} />;
  if (type === 'workout-template') return <Dumbbell size={18} color={color} strokeWidth={1.75} />;
  return <ListChecks size={18} color={color} strokeWidth={1.75} />;
}

export function NextUpCard({ result, isDark, onAction }: NextUpCardProps) {
  const palette = getThemeColors(isDark);

  if (!result) {
    return (
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
        <Sparkles size={18} color={palette.textTertiary} strokeWidth={1.75} />
        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: palette.text }]}>Nothing pressing right now</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Enjoy the quiet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
      <View style={[styles.iconBubble, { backgroundColor: palette.maroonSoft }]}>
        <IconFor type={result.type} color={palette.maroon} />
      </View>
      <View style={styles.textGroup}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{result.title}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{result.timeOfDayLabel}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onAction(result)}
        style={[styles.actionButton, { backgroundColor: palette.maroon }]}
        activeOpacity={0.85}
      >
        <Text style={styles.actionText}>{result.actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  actionButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
