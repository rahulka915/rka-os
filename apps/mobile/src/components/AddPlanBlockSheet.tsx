import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { getItemsByType, getRoutineSteps } from '../db/database';
import { parseRoutineStepMeta } from '../utils/routineMeta';
import type { PlacementBehavior } from '../utils/backwardPlanMeta';
import { PLACEMENT_LABELS } from '../utils/backwardPlanMeta';
import { ListChecks, ClipboardList } from '../icons';
import type { Item } from '../db/types';

type BlockTab = 'routine' | 'task';

export interface NewTaskBlockInput {
  kind: 'task';
  title: string;
  durationMinutes: number;
  placement: PlacementBehavior;
  bufferMinutes?: number;
}
export interface NewRoutineBlockInput {
  kind: 'routine';
  routineTemplateId: string;
  newRoutineTitle?: string;
  bufferMinutes?: number;
  placement: PlacementBehavior;
}
// Travel isn't part of this sheet — it's a single toggleable feature per
// plan, not a repeatable "Add" item (you travel once to the anchor event,
// not several times) — see TravelToggleCard.tsx, embedded directly in the
// anchor card on PlanBackwardsDetailScreen.
export type NewPlanBlockInput = NewRoutineBlockInput | NewTaskBlockInput;

interface AddPlanBlockSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: NewPlanBlockInput) => void;
}

const TABS: Array<{ key: BlockTab; label: string; icon: typeof ListChecks }> = [
  { key: 'routine', label: 'Routine', icon: ListChecks },
  { key: 'task', label: 'Task', icon: ClipboardList },
];

const PLACEMENT_OPTIONS: PlacementBehavior[] = ['auto', 'anytime-before', 'keep-near-event'];

function Chip({ label, active, onPress, accent }: { label: string; active: boolean; onPress: () => void; accent: string }) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { borderColor: active ? accent : palette.separator, backgroundColor: active ? `${accent}22` : 'transparent' },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, { color: active ? accent : palette.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Add Routine / Add Task — kept as repeatable add flows, unlike Travel
// (see the module comment above). Routine always instantiates from a
// reusable template rather than taking free-text steps.
export function AddPlanBlockSheet({ visible, onClose, onSubmit }: AddPlanBlockSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [tab, setTab] = useState<BlockTab>('routine');

  const [routines, setRoutines] = useState<Item[]>([]);
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [routinePlacement, setRoutinePlacement] = useState<PlacementBehavior>('auto');
  const [routineBuffer, setRoutineBuffer] = useState('');

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState('15');
  const [taskPlacement, setTaskPlacement] = useState<PlacementBehavior>('anytime-before');

  useEffect(() => {
    if (!visible) return;
    setTab('routine');
    setRoutines(getItemsByType('routine'));
    setNewRoutineTitle('');
    setRoutinePlacement('auto');
    setRoutineBuffer('');
    setTaskTitle('');
    setTaskDuration('15');
    setTaskPlacement('anytime-before');
  }, [visible]);

  const close = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const submit = (input: NewPlanBlockInput) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(input);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      isDark={isDark}
      title="Add to Plan"
      fullHeight
      sheetStyle={{ backgroundColor: material.surface, borderColor: material.rim }}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={close} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.tabRow}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.tab,
              { borderColor: tab === key ? material.accent : material.rim, backgroundColor: tab === key ? material.accentSoft : 'transparent' },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setTab(key);
            }}
          >
            <Icon size={16} color={tab === key ? material.accent : palette.textSecondary} strokeWidth={1.8} />
            <Text style={[styles.tabText, { color: tab === key ? material.accent : palette.textSecondary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'routine' && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PLACEMENT</Text>
          <View style={styles.chipRow}>
            {PLACEMENT_OPTIONS.map((option) => (
              <Chip key={option} label={PLACEMENT_LABELS[option]} active={routinePlacement === option} accent={material.accent} onPress={() => setRoutinePlacement(option)} />
            ))}
          </View>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary, marginTop: 16 }]}>BUFFER (MIN, OPTIONAL)</Text>
          <TextInput
            style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
            placeholder="e.g. 5"
            placeholderTextColor={palette.textTertiary}
            value={routineBuffer}
            onChangeText={setRoutineBuffer}
            keyboardType="number-pad"
          />

          {routines.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary, marginTop: 16 }]}>EXISTING ROUTINES</Text>
              {routines.map((routine) => {
                const stepCount = getRoutineSteps(routine.id).length;
                return (
                  <TouchableOpacity
                    key={routine.id}
                    style={[styles.pickRow, { borderColor: material.rim }]}
                    onPress={() =>
                      submit({
                        kind: 'routine',
                        routineTemplateId: routine.id,
                        placement: routinePlacement,
                        bufferMinutes: routineBuffer ? parseInt(routineBuffer, 10) : undefined,
                      })
                    }
                  >
                    <Text style={[styles.pickRowTitle, { color: palette.text }]} numberOfLines={1}>{routine.title}</Text>
                    <Text style={[styles.pickRowSub, { color: palette.textTertiary }]}>{stepCount} step{stepCount === 1 ? '' : 's'}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <Text style={[styles.sectionLabel, { color: palette.textTertiary, marginTop: 16 }]}>OR CREATE A NEW ROUTINE</Text>
          <View style={styles.inlineRow}>
            <TextInput
              style={[styles.fieldInput, styles.inlineInput, { color: palette.text, borderColor: material.rim }]}
              placeholder="Routine name..."
              placeholderTextColor={palette.textTertiary}
              value={newRoutineTitle}
              onChangeText={setNewRoutineTitle}
            />
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: newRoutineTitle.trim() ? material.accent : material.fill }]}
              disabled={!newRoutineTitle.trim()}
              onPress={() =>
                submit({
                  kind: 'routine',
                  routineTemplateId: '',
                  newRoutineTitle: newRoutineTitle.trim(),
                  placement: routinePlacement,
                  bufferMinutes: routineBuffer ? parseInt(routineBuffer, 10) : undefined,
                })
              }
            >
              <Text style={[styles.addBtnText, { color: newRoutineTitle.trim() ? material.onAccent : palette.textTertiary }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {tab === 'task' && (
        <View style={styles.tabContent}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>TITLE</Text>
          <TextInput
            style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
            placeholder="e.g. Wrap present"
            placeholderTextColor={palette.textTertiary}
            value={taskTitle}
            onChangeText={setTaskTitle}
          />
          <Text style={[styles.sectionLabel, { color: palette.textTertiary, marginTop: 16 }]}>DURATION (MIN)</Text>
          <TextInput
            style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
            value={taskDuration}
            onChangeText={setTaskDuration}
            keyboardType="number-pad"
          />
          <Text style={[styles.sectionLabel, { color: palette.textTertiary, marginTop: 16 }]}>PLACEMENT</Text>
          <View style={styles.chipRow}>
            {PLACEMENT_OPTIONS.map((option) => (
              <Chip key={option} label={PLACEMENT_LABELS[option]} active={taskPlacement === option} accent={material.accent} onPress={() => setTaskPlacement(option)} />
            ))}
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: taskTitle.trim() ? material.accent : material.fill, marginTop: 20 }]}
            disabled={!taskTitle.trim()}
            onPress={() =>
              submit({
                kind: 'task',
                title: taskTitle.trim(),
                durationMinutes: Math.max(1, parseInt(taskDuration, 10) || 15),
                placement: taskPlacement,
              })
            }
          >
            <Text style={[styles.saveBtnText, { color: taskTitle.trim() ? material.onAccent : palette.textTertiary }]}>Add Task</Text>
          </TouchableOpacity>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: spacing[4], flex: 1 },
  actionText: { fontSize: 16, fontFamily: 'Inter_400Regular', fontWeight: '400' },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 10 },
  tabText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  tabContent: { flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.4, marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium', fontWeight: '500' },
  fieldInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'Inter_400Regular' },
  inlineRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inlineInput: { flex: 1 },
  addBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  addBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  pickRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  pickRowTitle: { fontSize: 15, fontFamily: 'Inter_500Medium', fontWeight: '500', flex: 1 },
  pickRowSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
});
