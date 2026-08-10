import { useCallback, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useBackwardPlan } from '../hooks/useDb';
import {
  createRoutine,
  addPlanBlockRoutine,
  addPlanBlockTask,
  updateBackwardPlan,
  updatePlanBlock,
  deletePlanBlock,
  togglePlanBlockComplete,
  togglePlanBlockStepComplete,
  type PlanBlockWithSteps,
} from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, spacing } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { AnchorEventEditSheet, type AnchorEventDraft } from '../components/AnchorEventEditSheet';
import { AddPlanBlockSheet, type NewPlanBlockInput } from '../components/AddPlanBlockSheet';
import { TravelToggleCard } from '../components/TravelToggleCard';
import { showActionSheet } from '../utils/actionSheet';
import { buildAppleMapsDirectionsUrl } from '../utils/appleMapsLink';
import {
  parseBackwardPlanMeta,
  parseTravelConfig,
  formatClockTime,
  PLACEMENT_LABELS,
  type PlacementBehavior,
} from '../utils/backwardPlanMeta';
import {
  calculateTimeRemaining,
  calculateUnallocatedTime,
  calculatePlanRequiredDuration,
  calculateBlockRequiredDuration,
  calculateRoutineRemainingDuration,
  calculateLeaveBy,
  buildBackwardsSchedule,
  formatDurationMinutes,
  dateTimeFromParts,
  planBlockRowToCalc,
} from '../utils/backwardPlanCalc';
import { Clock, MapPin, Plus, Check, ChevronDown, ChevronUp, Navigation, ListChecks, ClipboardList, AlertTriangle } from '../icons';

interface RouteParams {
  planId: string;
}

const BLOCK_ICON = { routine: ListChecks, task: ClipboardList, travel: Navigation } as const;

export function PlanBackwardsDetailScreen() {
  const route = useRoute();
  const { planId } = route.params as RouteParams;
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { plan, blocks, now, refresh } = useBackwardPlan(planId);

  const [editingAnchor, setEditingAnchor] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  useFocusEffect(refresh);

  const meta = useMemo(() => parseBackwardPlanMeta(plan?.metadata), [plan?.metadata]);
  const goalDate = plan?.scheduledDate && meta.goalTime ? dateTimeFromParts(plan.scheduledDate, meta.goalTime) : null;

  const blockCalcs = useMemo(() => blocks.map(planBlockRowToCalc), [blocks]);
  const timeRemaining = goalDate ? calculateTimeRemaining(now, goalDate) : null;
  const timeRequired = calculatePlanRequiredDuration(blockCalcs);
  const unallocated = timeRemaining !== null ? calculateUnallocatedTime(timeRemaining, timeRequired) : null;
  const schedule = goalDate ? buildBackwardsSchedule(blockCalcs, goalDate) : [];
  const scheduleById = useMemo(() => new Map(schedule.map((s) => [s.block.id, s])), [schedule]);

  const handleSaveAnchor = (draft: AnchorEventDraft) => {
    updateBackwardPlan(planId, { title: draft.title, date: draft.date, notes: draft.notes || null }, draft.meta);
    refresh();
  };

  const handleAddBlock = (input: NewPlanBlockInput) => {
    if (input.kind === 'routine') {
      let templateId = input.routineTemplateId;
      if (!templateId && input.newRoutineTitle) {
        templateId = createRoutine(input.newRoutineTitle);
      }
      if (!templateId) return;
      addPlanBlockRoutine(planId, templateId, { bufferMinutes: input.bufferMinutes, placement: input.placement });
    } else {
      addPlanBlockTask(planId, input.title, input.durationMinutes, { placement: input.placement });
    }
    refresh();
  };

  const cyclePlacement = (block: PlanBlockWithSteps) => {
    const order: PlacementBehavior[] = ['auto', 'anytime-before', 'keep-near-event'];
    const next = order[(order.indexOf(block.placement) + 1) % order.length];
    updatePlanBlock(block.id, { placement: next });
    refresh();
  };

  const handleBlockLongPress = (block: PlanBlockWithSteps) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const travel = block.type === 'travel' ? parseTravelConfig(block.travelConfig) : null;
    const mapsUrl = travel ? buildAppleMapsDirectionsUrl(travel.startLocation ?? '', travel.destination ?? '', travel.mode) : null;
    showActionSheet(block.title, [
      { label: `Placement: ${PLACEMENT_LABELS[block.placement]} (tap to cycle)`, onPress: () => cyclePlacement(block) },
      ...(mapsUrl ? [{ label: 'Open in Maps', onPress: () => Linking.openURL(mapsUrl).catch(() => {}) }] : []),
      {
        label: 'Remove from plan',
        destructive: true,
        onPress: () => {
          deletePlanBlock(block.id);
          refresh();
        },
      },
    ]);
  };

  const toggleBlockComplete = (block: PlanBlockWithSteps) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    togglePlanBlockComplete(block.id, !block.completedAt);
    refresh();
  };

  const toggleStep = (stepId: string, currentlyComplete: boolean) => {
    Haptics.selectionAsync();
    togglePlanBlockStepComplete(stepId, !currentlyComplete);
    refresh();
  };

  const saveNotes = () => {
    if (notesDraft === null) return;
    updateBackwardPlan(planId, { notes: notesDraft || null });
    setNotesDraft(null);
    refresh();
  };

  if (!plan) {
    return (
      <LensSurface title="Plan Backwards">
        <View style={styles.empty}>
          <Text style={{ color: palette.textSecondary }}>Plan not found.</Text>
        </View>
      </LensSurface>
    );
  }

  const isOverCapacity = unallocated !== null && unallocated < 0;

  return (
    <LensSurface
      title={plan.title}
      headerRight={
        <TouchableOpacity onPress={() => setAddingBlock(true)} hitSlop={12} accessibilityLabel="Add to plan">
          <Plus size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Anchor event card */}
        <TouchableOpacity style={[styles.anchorCard, { backgroundColor: palette.surface, borderColor: palette.separator }]} onPress={() => setEditingAnchor(true)} activeOpacity={0.85}>
          <View style={styles.anchorRow}>
            <Clock size={16} color={palette.deeperBlue} strokeWidth={2} />
            <Text style={[styles.anchorGoalTime, { color: palette.deeperBlue }]}>
              Goal {meta.goalTime ? formatClockTime(meta.goalTime) : '—'}
            </Text>
          </View>
          <Text style={[styles.anchorTitle, { color: palette.text }]} numberOfLines={2}>{plan.title}</Text>
          {meta.location ? (
            <View style={styles.anchorRow}>
              <MapPin size={13} color={palette.textTertiary} strokeWidth={1.8} />
              <Text style={[styles.anchorMeta, { color: palette.textTertiary }]} numberOfLines={1}>{meta.location}</Text>
            </View>
          ) : null}
          {(meta.startTime || meta.expectedTime || meta.latestTime) ? (
            <Text style={[styles.anchorMeta, { color: palette.textTertiary }]}>
              {[
                meta.startTime && `Start ${formatClockTime(meta.startTime)}`,
                meta.expectedTime && `Expected ${formatClockTime(meta.expectedTime)}`,
                meta.latestTime && `Latest ${formatClockTime(meta.latestTime)}`,
              ].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </TouchableOpacity>

        <TravelToggleCard
          planId={planId}
          travelBlock={blocks.find((b) => b.type === 'travel') ?? null}
          anchorLocation={meta.location}
          onChange={refresh}
        />

        {/* Time budget */}
        {goalDate && (
          <View style={styles.budgetRow}>
            <View style={[styles.budgetTile, { backgroundColor: palette.surface }]}>
              <Text style={[styles.budgetLabel, { color: palette.textTertiary }]}>REMAINING</Text>
              <Text style={[styles.budgetValue, { color: palette.text }]}>{formatDurationMinutes(timeRemaining ?? 0)}</Text>
            </View>
            <View style={[styles.budgetTile, { backgroundColor: palette.surface }]}>
              <Text style={[styles.budgetLabel, { color: palette.textTertiary }]}>REQUIRED</Text>
              <Text style={[styles.budgetValue, { color: palette.text }]}>{formatDurationMinutes(timeRequired)}</Text>
            </View>
            <View style={[styles.budgetTile, { backgroundColor: isOverCapacity ? palette.redSoft : palette.greenSoft }]}>
              <Text style={[styles.budgetLabel, { color: isOverCapacity ? palette.red : palette.green }]}>UNALLOCATED</Text>
              <Text style={[styles.budgetValue, { color: isOverCapacity ? palette.red : palette.green }]}>
                {formatDurationMinutes(unallocated ?? 0)}
              </Text>
            </View>
          </View>
        )}

        {isOverCapacity && (
          <View style={[styles.warningBanner, { backgroundColor: palette.redSoft }]}>
            <AlertTriangle size={16} color={palette.red} strokeWidth={2} />
            <Text style={[styles.warningText, { color: palette.red }]}>
              {formatDurationMinutes(Math.abs(unallocated ?? 0))} short — the plan doesn't fit before Goal Time.
              {blockCalcs.some((b) => b.placement === 'anytime-before' && calculateBlockRequiredDuration(b) > 0)
                ? ' Anytime-before items and buffers below are the most flexible to adjust.'
                : ''}
            </Text>
          </View>
        )}

        {/* Backwards plan */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
            {goalDate ? 'EVENT ↑ WORKING BACKWARDS TO NOW' : 'PLAN BLOCKS'}
          </Text>

          {blocks.length === 0 ? (
            <View style={styles.blocksEmpty}>
              <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
                Add a Routine, Task, or Travel block to start building the plan.
              </Text>
            </View>
          ) : (
            (goalDate ? schedule.map((s) => s.block) : blockCalcs).map((calc) => {
              const block = blocks.find((b) => b.id === calc.id)!;
              const Icon = BLOCK_ICON[block.type];
              const requiredMinutes = calculateBlockRequiredDuration(calc);
              const isComplete = block.type === 'routine' ? requiredMinutes === 0 && block.steps.length > 0 : !!block.completedAt;
              const isExpanded = expanded[block.id] ?? false;
              const scheduled = scheduleById.get(block.id);
              const travel = block.type === 'travel' ? parseTravelConfig(block.travelConfig) : null;
              const leaveBy = travel && goalDate ? calculateLeaveBy(scheduled?.end ?? goalDate, travel.durationMinutes, travel.bufferMinutes ?? 0) : null;

              return (
                <View key={block.id} style={[styles.blockCard, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
                  <TouchableOpacity
                    style={styles.blockHeader}
                    activeOpacity={0.75}
                    onPress={() => (block.type === 'routine' ? setExpanded((prev) => ({ ...prev, [block.id]: !isExpanded })) : toggleBlockComplete(block))}
                    onLongPress={() => handleBlockLongPress(block)}
                    delayLongPress={400}
                  >
                    {block.type === 'routine' ? (
                      <Icon size={18} color={palette.textSecondary} strokeWidth={1.8} />
                    ) : (
                      <TouchableOpacity onPress={() => toggleBlockComplete(block)} hitSlop={8}>
                        <View style={[styles.checkbox, { borderColor: isComplete ? palette.green : palette.separatorStrong, backgroundColor: isComplete ? palette.green : 'transparent' }]}>
                          {isComplete && <Check size={12} color="#fff" strokeWidth={3} />}
                        </View>
                      </TouchableOpacity>
                    )}
                    <View style={styles.blockContent}>
                      <Text style={[styles.blockTitle, { color: palette.text, textDecorationLine: isComplete ? 'line-through' : 'none', opacity: isComplete ? 0.55 : 1 }]} numberOfLines={1}>
                        {block.title}
                      </Text>
                      <Text style={[styles.blockSub, { color: palette.textTertiary }]} numberOfLines={1}>
                        {block.type === 'routine'
                          ? isComplete
                            ? 'Complete'
                            : `${formatDurationMinutes(requiredMinutes)} remaining`
                          : formatDurationMinutes(requiredMinutes)}
                        {block.bufferMinutes ? ` (incl. ${block.bufferMinutes}m buffer)` : ''}
                        {block.placement !== 'auto' ? ` · ${PLACEMENT_LABELS[block.placement]}` : ''}
                        {scheduled && goalDate && requiredMinutes > 0 ? ` · ~${formatClockTime(`${String(scheduled.start.getHours()).padStart(2, '0')}:${String(scheduled.start.getMinutes()).padStart(2, '0')}`)}` : ''}
                      </Text>
                      {leaveBy && (
                        <Text style={[styles.leaveByText, { color: palette.deeperBlue }]}>
                          Leave by {formatClockTime(`${String(leaveBy.getHours()).padStart(2, '0')}:${String(leaveBy.getMinutes()).padStart(2, '0')}`)}
                          {travel?.source === 'live' ? ' · Live' : ''}
                          {travel?.source === 'live' && travel.distanceMeters ? ` · ${(travel.distanceMeters / 1000).toFixed(1)} km` : ''}
                        </Text>
                      )}
                    </View>
                    {block.type === 'routine' && (isExpanded ? <ChevronUp size={18} color={palette.textTertiary} /> : <ChevronDown size={18} color={palette.textTertiary} />)}
                  </TouchableOpacity>

                  {block.type === 'routine' && isExpanded && (
                    <View style={styles.stepList}>
                      {block.steps.map((step) => {
                        const stepDone = !!step.completedAt;
                        return (
                          <TouchableOpacity key={step.id} style={styles.stepRow} onPress={() => toggleStep(step.id, stepDone)} activeOpacity={0.7}>
                            <View style={[styles.checkboxSmall, { borderColor: stepDone ? palette.green : palette.separatorStrong, backgroundColor: stepDone ? palette.green : 'transparent' }]}>
                              {stepDone && <Check size={10} color="#fff" strokeWidth={3} />}
                            </View>
                            <Text style={[styles.stepTitle, { color: palette.text, textDecorationLine: stepDone ? 'line-through' : 'none', opacity: stepDone ? 0.5 : 1 }]} numberOfLines={1}>
                              {step.title}
                            </Text>
                            <Text style={[styles.stepDuration, { color: palette.textTertiary }]}>{step.estimatedMinutes}m</Text>
                          </TouchableOpacity>
                        );
                      })}
                      {block.steps.length === 0 && (
                        <Text style={[styles.stepEmpty, { color: palette.textTertiary }]}>No steps in this routine yet.</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>NOTES</Text>
          <TextInput
            style={[styles.notesInput, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.surface }]}
            placeholder="Add notes about this plan..."
            placeholderTextColor={palette.textTertiary}
            value={notesDraft ?? plan.notes ?? ''}
            onChangeText={setNotesDraft}
            onBlur={saveNotes}
            multiline
          />
        </View>
      </ScrollView>

      <AnchorEventEditSheet
        visible={editingAnchor}
        initialValue={{ title: plan.title, date: plan.scheduledDate ?? '', notes: plan.notes ?? '', meta }}
        onClose={() => setEditingAnchor(false)}
        onSubmit={handleSaveAnchor}
      />
      <AddPlanBlockSheet
        visible={addingBlock}
        onClose={() => setAddingBlock(false)}
        onSubmit={handleAddBlock}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  anchorCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6, marginTop: 4 },
  anchorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  anchorGoalTime: { fontSize: 13, fontFamily: 'Inter_700Bold', fontWeight: '700', letterSpacing: 0.2 },
  anchorTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', fontWeight: '700', letterSpacing: -0.3 },
  anchorMeta: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  budgetRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  budgetTile: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', gap: 4 },
  budgetLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', fontWeight: '700', letterSpacing: 0.4 },
  budgetValue: { fontSize: 18, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  warningBanner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, padding: 12, marginTop: 12 },
  warningText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', fontWeight: '500', lineHeight: 18 },
  section: { marginTop: 20, gap: 8 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', fontWeight: '700', letterSpacing: 0.4 },
  blocksEmpty: { paddingVertical: 24, alignItems: 'center' },
  blockCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  blockContent: { flex: 1, gap: 2 },
  blockTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  blockSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  leaveByText: { fontSize: 12, fontFamily: 'Inter_700Bold', fontWeight: '700', marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkboxSmall: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepList: { paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  stepTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', fontWeight: '500' },
  stepDuration: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  stepEmpty: { fontSize: 12, fontFamily: 'Inter_400Regular', paddingVertical: 4 },
  notesInput: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, minHeight: 72, fontSize: 14, fontFamily: 'Inter_400Regular', textAlignVertical: 'top' },
});
