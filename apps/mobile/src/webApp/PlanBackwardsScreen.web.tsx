import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Navigation, Plus, Trash2 } from 'lucide-react-native';
import { createBackwardPlan, deleteBackwardPlan, formatDate } from '../db/database';
import { useBackwardPlans } from '../hooks/useDb';
import { parseBackwardPlanMeta, formatClockTime } from '../utils/backwardPlanMeta';
import { DetailPanel } from './DetailPanel';
import { PlanBackwardsDetailPanel } from './PlanBackwardsDetailPanel.web';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';

export function PlanBackwardsScreen() {
  const { plans, refresh } = useBackwardPlans();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(() => formatDate(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const submitCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    const id = createBackwardPlan(title, newDate || formatDate(new Date()), {});
    setNewTitle('');
    setCreating(false);
    refresh();
    setSelectedId(id);
  };

  const removePlan = (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    deleteBackwardPlan(id);
    if (selectedId === id) setSelectedId(null);
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan Backwards</Text>
        <Text style={styles.count}>{plans.length}</Text>
        <Pressable style={styles.addButton} onPress={() => setCreating((v) => !v)}>
          <Plus size={16} color={webColors.card} strokeWidth={2.5} />
        </Pressable>
      </View>

      {creating ? (
        <View style={styles.createRow}>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={submitCreate}
            placeholder="Event title..."
            placeholderTextColor={webColors.mutedForeground}
            style={[styles.createInput, styles.flex1]}
            autoFocus
          />
          <TextInput
            value={newDate}
            onChangeText={setNewDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={webColors.mutedForeground}
            style={[styles.createInput, styles.dateInput]}
          />
          <Pressable style={styles.createSave} onPress={submitCreate}>
            <Text style={styles.createSaveText}>Add</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={plans}
        keyExtractor={(plan) => plan.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Navigation size={28} color={webColors.mutedForeground} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Work backwards from what matters</Text>
            <Text style={styles.emptySub}>Set a Goal Time, then figure out everything that needs to happen before it.</Text>
          </View>
        }
        renderItem={({ item: plan }) => {
          const meta = parseBackwardPlanMeta(plan.metadata);
          return (
            <Pressable style={styles.row} onPress={() => setSelectedId(plan.id)}>
              <Navigation size={18} color={webColors.primary} strokeWidth={1.8} />
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle} numberOfLines={1}>{plan.title}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {plan.scheduledDate ?? 'No date'}{meta.goalTime ? ` · Goal ${formatClockTime(meta.goalTime)}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  removePlan(plan.id, plan.title);
                }}
                style={styles.deleteButton}
              >
                <Trash2 size={14} color={webColors.mutedForeground} strokeWidth={1.75} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      <DetailPanel visible={!!selectedId} onClose={() => setSelectedId(null)} title="Plan Backwards">
        {selectedId ? (
          <PlanBackwardsDetailPanel
            planId={selectedId}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
            }}
          />
        ) : null}
      </DetailPanel>
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
    alignItems: 'center',
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
    flex: 1,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    backgroundColor: webColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    paddingHorizontal: webSpacing[6],
    marginBottom: webSpacing[4],
  },
  flex1: { flex: 1 },
  dateInput: { width: 130 },
  createInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  createSave: {
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[4],
    justifyContent: 'center',
  },
  createSaveText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.card,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    alignItems: 'center',
    gap: webSpacing[2],
    paddingVertical: webSpacing[10],
    paddingHorizontal: webSpacing[6],
  },
  emptyTitle: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    ...webDepth.list,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: webFontSize.base,
    fontWeight: '600',
    color: webColors.foreground,
  },
  rowSub: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  deleteButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
