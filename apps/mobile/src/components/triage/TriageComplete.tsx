import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { Check } from '../../icons';

interface TriageCompleteProps {
  processedCount: number;
  onDone: () => void;
}

export function TriageComplete({ processedCount, onDone }: TriageCompleteProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: mat.background, paddingBottom: insets.bottom + spacing[6] },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: mat.accentSoft, borderColor: mat.rimStrong }]}>
        <Check size={32} color={mat.accent} strokeWidth={2.5} />
      </View>
      <Text style={[styles.title, { color: mat.platinum }]}>Inbox zero</Text>
      <Text style={[styles.subtitle, { color: mat.platinumMuted }]}>
        {processedCount === 1 ? 'Processed 1 item.' : `Processed ${processedCount} items.`}
      </Text>
      <TouchableOpacity
        style={[styles.doneButton, { backgroundColor: mat.accent }]}
        onPress={onDone}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={[styles.doneText, { color: mat.onAccent }]}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[2] },
  subtitle: { fontSize: fontSize.base },
  doneButton: {
    marginTop: spacing[6],
    height: 52,
    minWidth: 160,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { fontFamily: 'Inter_700Bold', fontSize: fontSize.base, fontWeight: '700' },
});
