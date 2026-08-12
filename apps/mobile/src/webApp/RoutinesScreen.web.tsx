import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react-native';
import {
  getItemsByType,
  createRoutine,
  deleteItem,
  getRoutineSteps,
  addRoutineStep,
  updateItem,
  updateRoutineStep,
  setManualOrder,
} from '../db/database';
import { parseRoutineStepMeta, type RoutineStepMeta } from '../utils/routineMeta';
import { useDbRefresh } from '../hooks/useDb';
import { DetailPanel } from './DetailPanel';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import type { Item } from '../db/types';

function formatStepSummary(meta: RoutineStepMeta): string {
  if (!meta.durationSeconds) return 'Manual step';
  const minutes = Math.floor(meta.durationSeconds / 60);
  const seconds = meta.durationSeconds % 60;
  const time = minutes > 0 ? `${minutes}m ${seconds ? `${seconds}s` : ''}`.trim() : `${seconds}s`;
  return meta.autoAdvance ? `${time} · auto-advance` : time;
}

function useRoutines() {
  const [routines, setRoutines] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setRoutines(getItemsByType('routine'));
  }, []);
  useDbRefresh(refresh);
  return { routines, refresh };
}

export function RoutinesScreen() {
  const { routines, refresh } = useRoutines();
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRoutine = routines.find((r) => r.id === selectedId) ?? null;

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    const id = createRoutine(trimmed);
    setCaptureText('');
    refresh();
    setSelectedId(id);
  };

  const handleDelete = (routine: Item) => {
    deleteItem(routine.id);
    if (selectedId === routine.id) setSelectedId(null);
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Routines</Text>
        <Text style={styles.count}>{routines.length}</Text>
      </View>

      <View style={styles.captureRow}>
        <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
        <TextInput
          value={captureText}
          onChangeText={setCaptureText}
          onSubmitEditing={submit}
          placeholder="New routine..."
          placeholderTextColor={webColors.mutedForeground}
          style={styles.captureInput}
        />
      </View>

      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No routines yet.</Text>}
        renderItem={({ item: routine }) => (
          <Pressable style={styles.row} onPress={() => setSelectedId(routine.id)}>
            <ListChecks size={18} color={webColors.destructive} strokeWidth={1.8} />
            <Text style={styles.rowTitle} numberOfLines={1}>{routine.title}</Text>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                handleDelete(routine);
              }}
              hitSlop={8}
              style={styles.deleteButton}
            >
              <Trash2 size={15} color={webColors.mutedForeground} strokeWidth={1.8} />
            </Pressable>
          </Pressable>
        )}
      />

      <DetailPanel visible={!!selectedRoutine} onClose={() => setSelectedId(null)} title={selectedRoutine?.title ?? ''}>
        {selectedRoutine ? <RoutineDetailBody routine={selectedRoutine} onRoutineChanged={refresh} /> : null}
      </DetailPanel>
    </View>
  );
}

function RoutineDetailBody({ routine, onRoutineChanged }: { routine: Item; onRoutineChanged: () => void }) {
  const [steps, setSteps] = useState<Item[]>(() => getRoutineSteps(routine.id));
  const [stepTitle, setStepTitle] = useState('');
  const [stepMinutes, setStepMinutes] = useState('');
  const [stepSeconds, setStepSeconds] = useState('');
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const listKey = `routine:${routine.id}`;

  const refreshSteps = useCallback(() => {
    setSteps(getRoutineSteps(routine.id));
  }, [routine.id]);
  useDbRefresh(refreshSteps);

  const resetForm = () => {
    setStepTitle('');
    setStepMinutes('');
    setStepSeconds('');
    setEditingStepId(null);
  };

  const startEdit = (step: Item) => {
    const meta = parseRoutineStepMeta(step.metadata);
    setEditingStepId(step.id);
    setStepTitle(step.title);
    setStepMinutes(meta.durationSeconds ? String(Math.floor(meta.durationSeconds / 60)) : '');
    setStepSeconds(meta.durationSeconds ? String(meta.durationSeconds % 60) : '');
  };

  const handleSubmit = () => {
    const trimmed = stepTitle.trim();
    if (!trimmed) return;
    const minutes = parseInt(stepMinutes, 10) || 0;
    const seconds = parseInt(stepSeconds, 10) || 0;
    const totalSeconds = minutes * 60 + seconds;
    const meta: RoutineStepMeta = {
      durationSeconds: totalSeconds > 0 ? totalSeconds : undefined,
      autoAdvance: false,
    };
    if (editingStepId) {
      updateItem(editingStepId, { title: trimmed });
      updateRoutineStep(editingStepId, meta);
    } else {
      addRoutineStep(routine.id, trimmed, meta);
    }
    resetForm();
    refreshSteps();
  };

  const handleDeleteStep = (step: Item) => {
    deleteItem(step.id);
    if (editingStepId === step.id) resetForm();
    refreshSteps();
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const from = steps.findIndex((s) => s.id === stepId);
    if (from === -1) return;
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= steps.length) return;
    const next = [...steps];
    [next[from], next[to]] = [next[to], next[from]];
    setSteps(next);
    setManualOrder(listKey, next.map((s) => s.id));
  };

  return (
    <View>
      <View style={detailStyles.stepsHeader}>
        <Text style={detailStyles.sectionLabel}>Steps</Text>
        <Text style={detailStyles.startTodo}>Start · coming soon</Text>
      </View>

      {steps.length === 0 ? (
        <Text style={detailStyles.empty}>No steps yet — add one below.</Text>
      ) : (
        <View style={detailStyles.stepList}>
          {steps.map((step, index) => {
            const meta = parseRoutineStepMeta(step.metadata);
            return (
              <View key={step.id} style={detailStyles.stepRow}>
                <View style={detailStyles.stepContent}>
                  <Text style={detailStyles.stepTitle} numberOfLines={1}>{step.title}</Text>
                  <Text style={detailStyles.stepSubtitle}>{formatStepSummary(meta)}</Text>
                </View>
                <View style={detailStyles.stepActions}>
                  <Pressable onPress={() => moveStep(step.id, 'up')} disabled={index === 0} hitSlop={6}>
                    <ChevronUp size={16} color={index === 0 ? webColors.border : webColors.mutedForeground} strokeWidth={2} />
                  </Pressable>
                  <Pressable onPress={() => moveStep(step.id, 'down')} disabled={index === steps.length - 1} hitSlop={6}>
                    <ChevronDown size={16} color={index === steps.length - 1 ? webColors.border : webColors.mutedForeground} strokeWidth={2} />
                  </Pressable>
                  <Pressable onPress={() => startEdit(step)} hitSlop={6}>
                    <Pencil size={15} color={webColors.mutedForeground} strokeWidth={1.8} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteStep(step)} hitSlop={6}>
                    <Trash2 size={15} color={webColors.destructive} strokeWidth={1.8} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={detailStyles.form}>
        <Text style={detailStyles.formLabel}>{editingStepId ? 'Edit step' : 'Add step'}</Text>
        <TextInput
          value={stepTitle}
          onChangeText={setStepTitle}
          placeholder="Step title..."
          placeholderTextColor={webColors.mutedForeground}
          style={detailStyles.input}
        />
        <View style={detailStyles.durationRow}>
          <TextInput
            value={stepMinutes}
            onChangeText={setStepMinutes}
            placeholder="min"
            placeholderTextColor={webColors.mutedForeground}
            keyboardType="numeric"
            style={detailStyles.durationInput}
          />
          <TextInput
            value={stepSeconds}
            onChangeText={setStepSeconds}
            placeholder="sec"
            placeholderTextColor={webColors.mutedForeground}
            keyboardType="numeric"
            style={detailStyles.durationInput}
          />
          <Pressable onPress={handleSubmit} style={detailStyles.submitButton}>
            <Text style={detailStyles.submitButtonText}>{editingStepId ? 'Save' : 'Add'}</Text>
          </Pressable>
          {editingStepId ? (
            <Pressable onPress={resetForm} style={detailStyles.cancelButton}>
              <Text style={detailStyles.cancelButtonText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    ...webDepth.list,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
  },
  deleteButton: {
    padding: webSpacing[1],
  },
});

const detailStyles = StyleSheet.create({
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[3],
  },
  sectionLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.foreground,
    textTransform: 'uppercase',
  },
  startTodo: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    marginBottom: webSpacing[4],
  },
  stepList: {
    gap: webSpacing[2],
    marginBottom: webSpacing[5],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: webFontSize.base,
    fontWeight: '600',
    color: webColors.foreground,
  },
  stepSubtitle: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  stepActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
  },
  form: {
    gap: webSpacing[2],
    paddingTop: webSpacing[3],
    borderTopWidth: 1,
    borderTopColor: webColors.border,
  },
  formLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.foreground,
  },
  input: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
  },
  durationInput: {
    width: 56,
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[2],
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[2],
  },
  submitButtonText: {
    color: webColors.card,
    fontWeight: '700',
    fontSize: webFontSize.sm,
  },
  cancelButton: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  cancelButtonText: {
    color: webColors.mutedForeground,
    fontSize: webFontSize.sm,
  },
});
