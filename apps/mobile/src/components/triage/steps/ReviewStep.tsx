import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../../theme/spacing';
import { PRIORITY_LABELS, WHEN_LABELS } from '../triageLabels';
import type { TriagePriority, TriageWhen } from '../../../state/triageReducer';

interface ReviewStepProps {
  priority: TriagePriority;
  when: TriageWhen;
  projectTitle: string | null;
  onConfirm: () => void;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={[styles.row, { borderBottomColor: mat.rim }]}>
      <Text style={[styles.rowLabel, { color: mat.platinumMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: mat.platinum }]}>{value}</Text>
    </View>
  );
}

export function ReviewStep({ priority, when, projectTitle, onConfirm }: ReviewStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>Ready to process?</Text>
      <View style={[styles.card, { backgroundColor: mat.surfaceRaised, borderColor: mat.rim }]}>
        <ReviewRow label="Type" value="Task" />
        <ReviewRow label="Importance" value={PRIORITY_LABELS[priority]} />
        <ReviewRow label="When" value={WHEN_LABELS[when]} />
        <ReviewRow label="Mission" value={projectTitle ?? 'None'} />
      </View>
      <TouchableOpacity
        style={[styles.confirmButton, { backgroundColor: mat.accent }]}
        onPress={onConfirm}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Process item"
      >
        <Text style={[styles.confirmText, { color: mat.onAccent }]}>Process item</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontFamily: 'Inter_700Bold', fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[5] },
  card: { borderWidth: 1, borderRadius: radius.card, paddingHorizontal: spacing[4] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: fontSize.base },
  rowValue: { fontFamily: 'Inter_600SemiBold', fontSize: fontSize.base, fontWeight: '600' },
  confirmButton: {
    marginTop: spacing[6],
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontFamily: 'Inter_700Bold', fontSize: fontSize.base, fontWeight: '700' },
});
