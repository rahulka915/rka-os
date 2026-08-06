import { StyleSheet, Text, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing } from '../../../theme/spacing';
import { TriageOptionRow } from '../TriageOptionRow';
import { PRIORITY_LABELS } from '../triageLabels';
import type { TriagePriority } from '../../../state/triageReducer';

interface ImportanceStepProps {
  onAnswer: (value: TriagePriority) => void;
}

const OPTIONS: TriagePriority[] = ['low', 'medium', 'high'];

export function ImportanceStep({ onAnswer }: ImportanceStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>How important is this?</Text>
      {OPTIONS.map((value) => (
        <TriageOptionRow key={value} label={PRIORITY_LABELS[value]} onPress={() => onAnswer(value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontFamily: 'Inter_700Bold', fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[5] },
});
