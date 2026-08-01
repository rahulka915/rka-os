import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { ExerciseThumbnail } from './ExerciseThumbnail';

interface MuscleGroupCardProps {
  label: string;
  count: number;
  imageKey?: string;
  onPress: () => void;
}

export function MuscleGroupCard({ label, count, imageKey, onPress }: MuscleGroupCardProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <ExerciseThumbnail imageKey={imageKey} size={96} />
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.count, { color: palette.textTertiary }]}>
        {count} exercise{count === 1 ? '' : 's'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  label: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  count: { fontSize: 12, fontWeight: '500' },
});
