import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { itemComposerMaterial } from '../../../theme/itemComposer';
import { fontSize, spacing } from '../../../theme/spacing';
import { TriageOptionRow } from '../TriageOptionRow';
import type { Item } from '../../../db/types';

interface ProjectStepProps {
  projects: Item[];
  selectedProjectId: string | null;
  onAnswer: (projectId: string | null) => void;
}

export function ProjectStep({ projects, selectedProjectId, onAnswer }: ProjectStepProps) {
  const mat = itemComposerMaterial.dark;
  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: mat.platinum }]}>Where does this belong?</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TriageOptionRow
          label="No mission"
          selected={selectedProjectId === null}
          onPress={() => onAnswer(null)}
        />
        {projects.map((project) => (
          <TriageOptionRow
            key={project.id}
            label={project.title}
            selected={selectedProjectId === project.id}
            onPress={() => onAnswer(project.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[6] },
  prompt: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing[5] },
});
