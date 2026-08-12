import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { getMuscleGroupIcon } from '../utils/muscleGroupIcons';
import type { MuscleGroup } from '../utils/exerciseLibrary';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

interface MuscleGroupCardProps {
  label: string;
  count: number;
  muscleGroup: MuscleGroup;
  onPress: () => void;
}

export function MuscleGroupCard({ label, count, muscleGroup, onPress }: MuscleGroupCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={getMuscleGroupIcon(muscleGroup)} style={styles.icon} resizeMode="contain" />
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Text style={styles.count}>
        {count} exercise{count === 1 ? '' : 's'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '31%',
    alignItems: 'center',
    gap: webSpacing[1],
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    backgroundColor: webColors.card,
    paddingVertical: webSpacing[4],
    paddingHorizontal: webSpacing[2],
  },
  icon: { width: 72, height: 72 },
  label: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  count: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
});
