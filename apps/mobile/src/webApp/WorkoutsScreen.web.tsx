import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useWorkouts } from '../hooks/useDb';
import { createItem } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { WorkoutTemplateDetailPanel } from './WorkoutTemplateDetailPanel.web';
import { ExerciseLibraryScreen } from './ExerciseLibraryScreen.web';
import { WorkoutTrendsScreen } from './WorkoutTrendsScreen.web';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';

type WorkoutsTab = 'templates' | 'exercises' | 'trends';

export function WorkoutsScreen() {
  const { workouts, refresh } = useWorkouts();
  const [activeTab, setActiveTab] = useState<WorkoutsTab>('templates');
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'detail' | 'edit'>('detail');
  const selectedItem = workouts.find((i) => i.id === selectedId) ?? null;

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createItem('workout-template', trimmed, 'active');
    setCaptureText('');
    refresh();
  };

  const openTemplate = (templateId: string, _title: string) => {
    setActiveTab('templates');
    setSelectedId(templateId);
    setMode('detail');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
        {activeTab === 'templates' ? <Text style={styles.count}>{workouts.length}</Text> : null}
      </View>

      <View style={styles.tabRow}>
        <Pressable onPress={() => setActiveTab('templates')} style={[styles.tab, activeTab === 'templates' && styles.tabActive]}>
          <Text style={[styles.tabText, activeTab === 'templates' && styles.tabTextActive]}>Templates</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('exercises')} style={[styles.tab, activeTab === 'exercises' && styles.tabActive]}>
          <Text style={[styles.tabText, activeTab === 'exercises' && styles.tabTextActive]}>Exercises</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('trends')} style={[styles.tab, activeTab === 'trends' && styles.tabActive]}>
          <Text style={[styles.tabText, activeTab === 'trends' && styles.tabTextActive]}>Trends</Text>
        </Pressable>
      </View>

      {activeTab === 'templates' ? (
        <>
          <View style={styles.captureRow}>
            <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
            <TextInput
              value={captureText}
              onChangeText={setCaptureText}
              onSubmitEditing={submit}
              placeholder="New workout template..."
              placeholderTextColor={webColors.mutedForeground}
              style={styles.captureInput}
            />
          </View>

          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No workout templates yet.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => { setSelectedId(item.id); setMode('detail'); }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              </Pressable>
            )}
          />

          <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title={mode === 'edit' ? 'Edit Details' : 'Workout Template'}>
            {selectedItem ? (
              mode === 'edit' ? (
                <ItemDetailForm
                  item={selectedItem}
                  onChanged={() => { refresh(); setMode('detail'); }}
                  onDeleted={() => {
                    setSelectedId(null);
                    refresh();
                  }}
                />
              ) : (
                <WorkoutTemplateDetailPanel item={selectedItem} onEditDetails={() => setMode('edit')} />
              )
            ) : null}
          </DetailPanel>
        </>
      ) : activeTab === 'exercises' ? (
        <ExerciseLibraryScreen onOpenTemplate={openTemplate} />
      ) : (
        <WorkoutTrendsScreen />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  tabRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginHorizontal: webSpacing[6],
    marginBottom: webSpacing[4],
  },
  tab: {
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  tabActive: {
    backgroundColor: webColors.accent,
  },
  tabText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  tabTextActive: {
    color: webColors.card,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    marginHorizontal: webSpacing[6],
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[4],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  row: {
    backgroundColor: webColors.card,
    ...webDepth.list,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
});
