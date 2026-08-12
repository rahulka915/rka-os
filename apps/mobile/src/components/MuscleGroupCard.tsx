import { Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { getMuscleGroupIcon } from '../utils/muscleGroupIcons';
import type { MuscleGroup } from '../utils/exerciseLibrary';

interface MuscleGroupCardProps {
  label: string;
  count: number;
  muscleGroup: MuscleGroup;
  onPress: () => void;
}

export function MuscleGroupCard({ label, count, muscleGroup, onPress }: MuscleGroupCardProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <Image source={getMuscleGroupIcon(muscleGroup)} style={styles.icon} resizeMode="contain" />
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.count, { color: palette.textTertiary }]}>
        {count} exercise{count === 1 ? '' : 's'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  icon: { width: 96, height: 96 },
  label: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  count: { fontFamily: 'Inter_500Medium', fontSize: 12, fontWeight: '500' },
});
