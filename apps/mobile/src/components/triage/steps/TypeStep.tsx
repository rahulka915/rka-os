import { StyleSheet, Text, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing } from '../../../theme/spacing';
import { TriageOptionRow } from '../TriageOptionRow';

interface TypeStepProps {
  itemTitle: string;
  onChooseTask: () => void;
  onChooseObject: () => void;
}

export function TypeStep({ itemTitle, onChooseTask, onChooseObject }: TypeStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>What is this?</Text>
      <Text style={[styles.itemTitle, { color: mat.platinumMuted }]} numberOfLines={2}>
        {itemTitle}
      </Text>
      <TriageOptionRow
        label="Task"
        hint="Something that needs an action"
        onPress={onChooseTask}
      />
      <TriageOptionRow
        label="Object"
        hint="Something to own, save, or collect"
        onPress={onChooseObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[2] },
  itemTitle: { fontSize: fontSize.base, marginBottom: spacing[5] },
});
