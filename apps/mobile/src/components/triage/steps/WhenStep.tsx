import { StyleSheet, Text, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing } from '../../../theme/spacing';
import { TriageOptionRow } from '../TriageOptionRow';
import { WHEN_LABELS } from '../triageLabels';
import type { TriageWhen } from '../../../state/triageReducer';

interface WhenStepProps {
  onAnswer: (value: TriageWhen) => void;
}

const OPTIONS: TriageWhen[] = ['today', 'tomorrow', 'week', 'someday'];

export function WhenStep({ onAnswer }: WhenStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>When should this surface?</Text>
      {OPTIONS.map((value) => (
        <TriageOptionRow key={value} label={WHEN_LABELS[value]} onPress={() => onAnswer(value)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontFamily: 'Inter_700Bold', fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[5] },
});
