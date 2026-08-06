import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { Check } from '../../icons';

interface TriageOptionRowProps {
  label: string;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
}

export function TriageOptionRow({ label, hint, selected, onPress }: TriageOptionRowProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <TouchableOpacity
      style={[
        styles.option,
        {
          backgroundColor: selected ? mat.accentSoft : mat.surfaceRaised,
          borderColor: selected ? mat.rimStrong : mat.rim,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, { color: mat.platinum }]}>{label}</Text>
        {hint ? <Text style={[styles.optionHint, { color: mat.platinumMuted }]}>{hint}</Text> : null}
      </View>
      {selected ? <Check size={18} color={mat.accent} strokeWidth={2.4} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    marginBottom: spacing[3],
  },
  optionText: { flex: 1 },
  optionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: fontSize.lg, fontWeight: '600' },
  optionHint: { fontSize: fontSize.sm, marginTop: 2 },
});
