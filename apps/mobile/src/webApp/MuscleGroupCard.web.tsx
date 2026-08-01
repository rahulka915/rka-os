import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

interface MuscleGroupCardProps {
  label: string;
  count: number;
  imageKey?: string;
  onPress: () => void;
}

export function MuscleGroupCard({ label, count, imageKey, onPress }: MuscleGroupCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <ExerciseThumbnail imageKey={imageKey} size={72} />
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
  label: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  count: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
});
