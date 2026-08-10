import { ScrollView, StyleSheet } from 'react-native';
import { LensSurface } from '../components/LensSurface';
import { PotentialOverview } from '../components/potential/PotentialOverview';

export function PotentialScreen() {
  return (
    <LensSurface title="Potential">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PotentialOverview />
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
});
