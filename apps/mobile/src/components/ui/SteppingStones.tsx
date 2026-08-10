import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { getThemeColors } from '../../theme';

export interface SteppingStone {
  id: string;
  filled: boolean;
}

export interface SteppingStonesProps {
  stones: SteppingStone[];
  isDark: boolean;
  /** Highlights one stone (e.g. the current/next one) with a hollow outline instead of a dim fill. */
  currentId?: string | null;
  /** Overrides the auto-generated "N of M" text. */
  label?: string;
  showLabel?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Discrete-stage progress: one tile per stage (Harada Domain, onboarding
// step, etc.), filled once that stage clears a completion threshold. Use
// this instead of RiverStoneProgress when the underlying value is a count
// of discrete things, not a continuous percentage.
export function SteppingStones({
  stones,
  isDark,
  currentId = null,
  label,
  showLabel = true,
  accessibilityLabel = 'Progress',
  style,
  testID,
}: SteppingStonesProps) {
  const palette = getThemeColors(isDark);
  const filledCount = stones.filter((s) => s.filled).length;
  const text = label ?? `${filledCount} of ${stones.length}`;

  return (
    <View style={style} testID={testID}>
      <View
        style={styles.row}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: stones.length, now: filledCount, text }}
      >
        {stones.map((stone) => {
          const isCurrent = stone.id === currentId;
          const backgroundColor = stone.filled
            ? palette.vermilion
            : isDark
              ? palette.fillStrong
              : palette.separator;
          return (
            <View
              key={stone.id}
              style={[
                styles.tile,
                { backgroundColor },
                isCurrent && !stone.filled && { borderWidth: 2, borderColor: palette.antiqueBrass, backgroundColor: 'transparent' },
              ]}
            />
          );
        })}
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: palette.textSecondary }]} numberOfLines={1}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, aspectRatio: 1, borderRadius: 6, maxWidth: 28 },
  label: { marginTop: 6, fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
});
