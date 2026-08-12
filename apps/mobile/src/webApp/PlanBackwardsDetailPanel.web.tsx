import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, Check, ChevronDown, ChevronUp, ClipboardList, ListChecks, Navigation, Plus, Trash2 } from 'lucide-react-native';
import { useBackwardPlan } from '../hooks/useDb';
import {
  createRoutine,
  addPlanBlockRoutine,
  addPlanBlockTask,
  updateBackwardPlan,
  updatePlanBlock,
  deletePlanBlock,
  deleteBackwardPlan,
  togglePlanBlockComplete,
  togglePlanBlockStepComplete,
  upsertPlanBlockTravel,
  getItemsByType,
  getRoutineSteps,
  type PlanBlockWithSteps,
} from '../db/database';
import {
  parseBackwardPlanMeta,
  parseTravelConfig,
  formatClockTime,
  PLACEMENT_LABELS,
  type PlacementBehavior,
  type BackwardPlanMeta,
  type TravelMode,
} from '../utils/backwardPlanMeta';
import {
  calculateTimeRemaining,
  calculateUnallocatedTime,
  calculatePlanRequiredDuration,
  calculateBlockRequiredDuration,
  calculateLeaveBy,
  buildBackwardsSchedule,
  formatDurationMinutes,
  dateTimeFromParts,
  planBlockRowToCalc,
} from '../utils/backwardPlanCalc';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

const BLOCK_ICON = { routine: ListChecks, task: ClipboardList, travel: Navigation } as const;
const PLACEMENT_OPTIONS: PlacementBehavior[] = ['auto', 'anytime-before', 'keep-near-event'];
const TRAVEL_MODES: TravelMode[] = ['driving', 'walking', 'transit'];

export interface PlanBackwardsDetailPanelProps {
  planId: string;
  onDeleted: () => void;
}

export function PlanBackwardsDetailPanel({ planId, onDeleted }: PlanBackwardsDetailPanelProps) {
  const { plan, blocks, now, refresh } = useBackwardPlan(planId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [addingBlock, setAddingBlock] = useState(false);

  const meta = useMemo(() => parseBackwardPlanMeta(plan?.metadata), [plan?.metadata]);
  const goalDate = plan?.scheduledDate && meta.goalTime ? dateTimeFromParts(plan.scheduledDate, meta.goalTime) : null;

  const blockCalcs = useMemo(() => blocks.map(planBlockRowToCalc), [blocks]);
  const timeRemaining = goalDate ? calculateTimeRemaining(now, goalDate) : null;
  const timeRequired = calculatePlanRequiredDuration(blockCalcs);
  const unallocated = timeRemaining !== null ? calculateUnallocatedTime(timeRemaining, timeRequired) : null;
  const schedule = goalDate ? buildBackwardsSchedule(blockCalcs, goalDate) : [];
  const scheduleById = useMemo(() => new Map(schedule.map((s) => [s.block.id, s])), [schedule]);
  const isOverCapacity = unallocated !== null && unallocated < 0;

  const travelBlock = blocks.find((b) => b.type === 'travel') ?? null;

  const saveField = (updates: Partial<{ title: string; date: string | null; notes: string | null }>) => {
    updateBackwardPlan(planId, updates);
    refresh();
  };

  const saveMeta = (metaUpdates: Partial<BackwardPlanMeta>) => {
    updateBackwardPlan(planId, {}, metaUpdates);
    refresh();
  };

  const cyclePlacement = (block: PlanBlockWithSteps) => {
    const order: PlacementBehavior[] = ['auto', 'anytime-before', 'keep-near-event'];
    const next = order[(order.indexOf(block.placement) + 1) % order.length];
    updatePlanBlock(block.id, { placement: next });
    refresh();
  };

  const removeBlock = (block: PlanBlockWithSteps) => {
    if (!window.confirm(`Remove "${block.title}" from the plan?`)) return;
    deletePlanBlock(block.id);
    refresh();
  };

  const toggleBlockComplete = (block: PlanBlockWithSteps) => {
    togglePlanBlockComplete(block.id, !block.completedAt);
    refresh();
  };

  const toggleStep = (stepId: string, currentlyComplete: boolean) => {
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
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Plan not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Anchor event fields */}
      <View style={styles.anchorCard}>
        <Text style={styles.fieldLabel}>TITLE</Text>
        <TextInput
          style={styles.fieldInput}
          value={plan.title}
          onChangeText={(v) => saveField({ title: v })}
          placeholder="Event title..."
          placeholderTextColor={webColors.mutedForeground}
        />

        <View style={styles.fieldRow}>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>DATE</Text>
            <TextInput
              style={styles.fieldInput}
              value={plan.scheduledDate ?? ''}
              onChangeText={(v) => saveField({ date: v || null })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={webColors.mutedForeground}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>GOAL TIME (REQUIRED)</Text>
            <TextInput
              style={styles.fieldInput}
              value={meta.goalTime ?? ''}
              onChangeText={(v) => saveMeta({ goalTime: v || undefined })}
              placeholder="HH:MM"
              placeholderTextColor={webColors.mutedForeground}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>START</Text>
            <TextInput
              style={styles.fieldInput}
              value={meta.startTime ?? ''}
              onChangeText={(v) => saveMeta({ startTime: v || undefined })}
              placeholder="HH:MM"
              placeholderTextColor={webColors.mutedForeground}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>EXPECTED</Text>
            <TextInput
              style={styles.fieldInput}
              value={meta.expectedTime ?? ''}
              onChangeText={(v) => saveMeta({ expectedTime: v || undefined })}
              placeholder="HH:MM"
              placeholderTextColor={webColors.mutedForeground}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>LATEST</Text>
            <TextInput
              style={styles.fieldInput}
              value={meta.latestTime ?? ''}
              onChangeText={(v) => saveMeta({ latestTime: v || undefined })}
              placeholder="HH:MM"
              placeholderTextColor={webColors.mutedForeground}
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>LOCATION</Text>
        <TextInput
          style={styles.fieldInput}
          value={meta.location ?? ''}
          onChangeText={(v) => saveMeta({ location: v || undefined })}
          placeholder="e.g. 123 Main St"
          placeholderTextColor={webColors.mutedForeground}
        />
      </View>

      <TravelSection planId={planId} travelBlock={travelBlock} anchorLocation={meta.location} onChange={refresh} />

      {/* Time budget */}
      {goalDate && (
        <View style={styles.budgetRow}>
          <View style={styles.budgetTile}>
            <Text style={styles.budgetLabel}>REMAINING</Text>
            <Text style={styles.budgetValue}>{formatDurationMinutes(timeRemaining ?? 0)}</Text>
          </View>
          <View style={styles.budgetTile}>
            <Text style={styles.budgetLabel}>REQUIRED</Text>
            <Text style={styles.budgetValue}>{formatDurationMinutes(timeRequired)}</Text>
          </View>
          <View style={[styles.budgetTile, isOverCapacity ? styles.budgetTileWarn : styles.budgetTileOk]}>
            <Text style={[styles.budgetLabel, isOverCapacity ? styles.textWarn : styles.textOk]}>UNALLOCATED</Text>
            <Text style={[styles.budgetValue, isOverCapacity ? styles.textWarn : styles.textOk]}>
              {formatDurationMinutes(unallocated ?? 0)}
            </Text>
          </View>
        </View>
      )}

      {isOverCapacity && (
        <View style={styles.warningBanner}>
          <AlertTriangle size={16} color={webColors.destructive} strokeWidth={2} />
          <Text style={styles.warningText}>
            {formatDurationMinutes(Math.abs(unallocated ?? 0))} short — the plan doesn't fit before Goal Time.
          </Text>
        </View>
      )}

      {/* Blocks */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>{goalDate ? 'EVENT ↑ WORKING BACKWARDS TO NOW' : 'PLAN BLOCKS'}</Text>
          <Pressable style={styles.addBlockButton} onPress={() => setAddingBlock((v) => !v)}>
            <Plus size={14} color={webColors.card} strokeWidth={2.5} />
          </Pressable>
        </View>

        {addingBlock && (
          <AddBlockForm
            planId={planId}
            onAdded={() => {
              setAddingBlock(false);
              refresh();
            }}
            onCancel={() => setAddingBlock(false)}
          />
        )}

        {blocks.filter((b) => b.type !== 'travel').length === 0 ? (
          <Text style={styles.emptySub}>Add a Routine or Task block to start building the plan.</Text>
        ) : (
          (goalDate ? schedule.map((s) => s.block) : blockCalcs)
            .filter((calc) => calc.type !== 'travel')
            .map((calc) => {
              const block = blocks.find((b) => b.id === calc.id)!;
              const Icon = BLOCK_ICON[block.type];
              const requiredMinutes = calculateBlockRequiredDuration(calc);
              const isComplete = block.type === 'routine' ? requiredMinutes === 0 && block.steps.length > 0 : !!block.completedAt;
              const isExpanded = expanded[block.id] ?? false;
              const scheduled = scheduleById.get(block.id);

              return (
                <View key={block.id} style={styles.blockCard}>
                  <Pressable
                    style={styles.blockHeader}
                    onPress={() => (block.type === 'routine' ? setExpanded((prev) => ({ ...prev, [block.id]: !isExpanded })) : toggleBlockComplete(block))}
                  >
                    {block.type === 'routine' ? (
                      <Icon size={16} color={webColors.mutedForeground} strokeWidth={1.8} />
                    ) : (
                      <Pressable onPress={(e) => { e.stopPropagation(); toggleBlockComplete(block); }} style={[styles.checkbox, isComplete && styles.checkboxDone]}>
                        {isComplete && <Check size={11} color={webColors.card} strokeWidth={3} />}
                      </Pressable>
                    )}
                    <View style={styles.blockContent}>
                      <Text style={[styles.blockTitle, isComplete && styles.blockTitleDone]} numberOfLines={1}>{block.title}</Text>
                      <Text style={styles.blockSub} numberOfLines={1}>
                        {block.type === 'routine'
                          ? isComplete
                            ? 'Complete'
                            : `${formatDurationMinutes(requiredMinutes)} remaining`
                          : formatDurationMinutes(requiredMinutes)}
                        {block.bufferMinutes ? ` (incl. ${block.bufferMinutes}m buffer)` : ''}
                        {scheduled && goalDate && requiredMinutes > 0
                          ? ` · ~${formatClockTime(`${String(scheduled.start.getHours()).padStart(2, '0')}:${String(scheduled.start.getMinutes()).padStart(2, '0')}`)}`
                          : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => cyclePlacement(block)} style={styles.placementChip}>
                      <Text style={styles.placementChipText}>{PLACEMENT_LABELS[block.placement]}</Text>
                    </Pressable>
                    {block.type === 'routine' && (isExpanded ? <ChevronUp size={16} color={webColors.mutedForeground} /> : <ChevronDown size={16} color={webColors.mutedForeground} />)}
                    <Pressable onPress={() => removeBlock(block)} style={styles.blockDelete}>
                      <Trash2 size={13} color={webColors.mutedForeground} strokeWidth={1.75} />
                    </Pressable>
                  </Pressable>

                  {block.type === 'routine' && isExpanded && (
                    <View style={styles.stepList}>
                      {block.steps.map((step) => {
                        const stepDone = !!step.completedAt;
                        return (
                          <Pressable key={step.id} style={styles.stepRow} onPress={() => toggleStep(step.id, stepDone)}>
                            <View style={[styles.checkboxSmall, stepDone && styles.checkboxDone]}>
                              {stepDone && <Check size={9} color={webColors.card} strokeWidth={3} />}
                            </View>
                            <Text style={[styles.stepTitle, stepDone && styles.blockTitleDone]} numberOfLines={1}>{step.title}</Text>
                            <Text style={styles.stepDuration}>{step.estimatedMinutes}m</Text>
                          </Pressable>
                        );
                      })}
                      {block.steps.length === 0 && <Text style={styles.stepEmpty}>No steps in this routine yet.</Text>}
                    </View>
                  )}
                </View>
              );
            })
        )}
      </View>

      {/* Leave By, derived from travel + schedule */}
      {travelBlock && goalDate && (() => {
        const travel = parseTravelConfig(travelBlock.travelConfig);
        const scheduled = scheduleById.get(travelBlock.id);
        const leaveBy = calculateLeaveBy(scheduled?.end ?? goalDate, travel.durationMinutes, travel.bufferMinutes ?? 0);
        return (
          <View style={styles.leaveByCard}>
            <Text style={styles.leaveByLabel}>LEAVE BY</Text>
            <Text style={styles.leaveByValue}>
              {formatClockTime(`${String(leaveBy.getHours()).padStart(2, '0')}:${String(leaveBy.getMinutes()).padStart(2, '0')}`)}
            </Text>
          </View>
        );
      })()}

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NOTES</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add notes about this plan..."
          placeholderTextColor={webColors.mutedForeground}
          value={notesDraft ?? plan.notes ?? ''}
          onChangeText={setNotesDraft}
          onBlur={saveNotes}
          multiline
        />
      </View>

      <Pressable
        style={styles.deletePlanButton}
        onPress={() => {
          if (!window.confirm(`Delete "${plan.title}"? This removes the whole plan.`)) return;
          deleteBackwardPlan(planId);
          onDeleted();
        }}
      >
        <Trash2 size={14} color={webColors.destructive} strokeWidth={1.8} />
        <Text style={styles.deletePlanText}>Delete plan</Text>
      </Pressable>
    </ScrollView>
  );
}

function TravelSection({
  planId,
  travelBlock,
  anchorLocation,
  onChange,
}: {
  planId: string;
  travelBlock: PlanBlockWithSteps | null;
  anchorLocation?: string;
  onChange: () => void;
}) {
  const enabled = !!travelBlock;
  const travel = travelBlock ? parseTravelConfig(travelBlock.travelConfig) : { mode: 'driving' as TravelMode, durationMinutes: 20 };

  const save = (updates: Partial<{ startLocation: string; destination: string; mode: TravelMode; durationMinutes: number; bufferMinutes: number }>) => {
    const next = {
      ...travel,
      ...updates,
      destination: updates.destination ?? travel.destination ?? anchorLocation,
      source: 'manual' as const,
    };
    upsertPlanBlockTravel(planId, 'Travel', next);
    onChange();
  };

  const toggleEnabled = () => {
    if (enabled && travelBlock) {
      deletePlanBlock(travelBlock.id);
    } else {
      upsertPlanBlockTravel(planId, 'Travel', { mode: 'driving', durationMinutes: 20, destination: anchorLocation });
    }
    onChange();
  };

  return (
    <View style={styles.anchorCard}>
      <Pressable style={styles.travelToggleRow} onPress={toggleEnabled}>
        <Navigation size={16} color={webColors.primary} strokeWidth={1.8} />
        <Text style={styles.fieldLabelInline}>Travel to this event</Text>
        <View style={[styles.switchTrack, enabled && styles.switchTrackOn]}>
          <View style={[styles.switchThumb, enabled && styles.switchThumbOn]} />
        </View>
      </Pressable>

      {enabled && (
        <>
          <View style={styles.fieldRow}>
            <View style={styles.flex1}>
              <Text style={styles.fieldLabel}>FROM</Text>
              <TextInput
                style={styles.fieldInput}
                value={travel.startLocation ?? ''}
                onChangeText={(v) => save({ startLocation: v })}
                placeholder="Starting point"
                placeholderTextColor={webColors.mutedForeground}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.fieldLabel}>TO</Text>
              <TextInput
                style={styles.fieldInput}
                value={travel.destination ?? ''}
                onChangeText={(v) => save({ destination: v })}
                placeholder="Destination"
                placeholderTextColor={webColors.mutedForeground}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>MODE</Text>
          <View style={styles.chipRow}>
            {TRAVEL_MODES.map((mode) => (
              <Pressable key={mode} onPress={() => save({ mode })} style={[styles.chip, travel.mode === mode && styles.chipActive]}>
                <Text style={[styles.chipText, travel.mode === mode && styles.chipTextActive]}>{mode}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.flex1}>
              <Text style={styles.fieldLabel}>DURATION (MIN)</Text>
              <TextInput
                style={styles.fieldInput}
                value={String(travel.durationMinutes)}
                onChangeText={(v) => save({ durationMinutes: Math.max(0, parseInt(v, 10) || 0) })}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.fieldLabel}>BUFFER (MIN)</Text>
              <TextInput
                style={styles.fieldInput}
                value={String(travel.bufferMinutes ?? 0)}
                onChangeText={(v) => save({ bufferMinutes: Math.max(0, parseInt(v, 10) || 0) })}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function AddBlockForm({ planId, onAdded, onCancel }: { planId: string; onAdded: () => void; onCancel: () => void }) {
  const [tab, setTab] = useState<'routine' | 'task'>('routine');
  const [placement, setPlacement] = useState<PlacementBehavior>('auto');
  const [buffer, setBuffer] = useState('');
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState('15');

  const routines = useMemo(() => getItemsByType('routine'), []);

  const addRoutine = (templateId: string, title?: string) => {
    let id = templateId;
    if (!id && title) id = createRoutine(title);
    if (!id) return;
    addPlanBlockRoutine(planId, id, { bufferMinutes: buffer ? parseInt(buffer, 10) : undefined, placement });
    onAdded();
  };

  const addTask = () => {
    const title = taskTitle.trim();
    if (!title) return;
    addPlanBlockTask(planId, title, Math.max(1, parseInt(taskDuration, 10) || 15), { placement });
    onAdded();
  };

  return (
    <View style={styles.addForm}>
      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === 'routine' && styles.tabActive]} onPress={() => setTab('routine')}>
          <Text style={[styles.tabText, tab === 'routine' && styles.tabTextActive]}>Routine</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'task' && styles.tabActive]} onPress={() => setTab('task')}>
          <Text style={[styles.tabText, tab === 'task' && styles.tabTextActive]}>Task</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={styles.tabCancel}>
          <Text style={styles.tabCancelText}>Cancel</Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>PLACEMENT</Text>
      <View style={styles.chipRow}>
        {PLACEMENT_OPTIONS.map((option) => (
          <Pressable key={option} onPress={() => setPlacement(option)} style={[styles.chip, placement === option && styles.chipActive]}>
            <Text style={[styles.chipText, placement === option && styles.chipTextActive]}>{PLACEMENT_LABELS[option]}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'routine' ? (
        <>
          <Text style={styles.fieldLabel}>BUFFER (MIN, OPTIONAL)</Text>
          <TextInput style={styles.fieldInput} value={buffer} onChangeText={setBuffer} placeholder="e.g. 5" placeholderTextColor={webColors.mutedForeground} keyboardType="number-pad" />

          {routines.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>EXISTING ROUTINES</Text>
              {routines.map((routine: Item) => {
                const stepCount = getRoutineSteps(routine.id).length;
                return (
                  <Pressable key={routine.id} style={styles.pickRow} onPress={() => addRoutine(routine.id)}>
                    <Text style={styles.pickRowTitle} numberOfLines={1}>{routine.title}</Text>
                    <Text style={styles.pickRowSub}>{stepCount} step{stepCount === 1 ? '' : 's'}</Text>
                  </Pressable>
                );
              })}
            </>
          )}

          <Text style={styles.fieldLabel}>OR CREATE A NEW ROUTINE</Text>
          <View style={styles.inlineRow}>
            <TextInput
              style={[styles.fieldInput, styles.flex1]}
              value={newRoutineTitle}
              onChangeText={setNewRoutineTitle}
              placeholder="Routine name..."
              placeholderTextColor={webColors.mutedForeground}
            />
            <Pressable
              style={[styles.inlineAddButton, !newRoutineTitle.trim() && styles.buttonDisabled]}
              disabled={!newRoutineTitle.trim()}
              onPress={() => addRoutine('', newRoutineTitle.trim())}
            >
              <Text style={styles.inlineAddButtonText}>Add</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>TITLE</Text>
          <TextInput style={styles.fieldInput} value={taskTitle} onChangeText={setTaskTitle} placeholder="e.g. Wrap present" placeholderTextColor={webColors.mutedForeground} />
          <Text style={styles.fieldLabel}>DURATION (MIN)</Text>
          <TextInput style={styles.fieldInput} value={taskDuration} onChangeText={setTaskDuration} keyboardType="number-pad" />
          <Pressable style={[styles.saveButton, !taskTitle.trim() && styles.buttonDisabled]} disabled={!taskTitle.trim()} onPress={addTask}>
            <Text style={styles.saveButtonText}>Add Task</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: { padding: webSpacing[6], alignItems: 'center' },
  emptyText: { color: webColors.mutedForeground, fontSize: webFontSize.sm },
  flex1: { flex: 1 },
  anchorCard: {
    backgroundColor: webColors.muted,
    borderRadius: webRadius.md,
    padding: webSpacing[4],
    marginBottom: webSpacing[4],
    gap: webSpacing[2],
  },
  fieldLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.mutedForeground,
    letterSpacing: 0.4,
    marginTop: webSpacing[2],
    marginBottom: webSpacing[1],
  },
  fieldLabelInline: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
    flex: 1,
  },
  fieldInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.card,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  fieldRow: {
    flexDirection: 'row',
    gap: webSpacing[3],
  },
  travelToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
  },
  switchTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: webColors.border,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: webColors.accent,
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: webColors.card,
  },
  switchThumbOn: {
    marginLeft: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
  },
  chip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.card,
    borderWidth: 1,
    borderColor: webColors.border,
  },
  chipActive: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  chipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: webColors.card,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginBottom: webSpacing[4],
  },
  budgetTile: {
    flex: 1,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.md,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
    gap: 4,
  },
  budgetTileWarn: {
    backgroundColor: webColors.warningBackground,
  },
  budgetTileOk: {},
  budgetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: webColors.mutedForeground,
    letterSpacing: 0.4,
  },
  budgetValue: {
    fontSize: webFontSize.lg,
    fontWeight: '700',
    color: webColors.foreground,
  },
  textWarn: { color: webColors.destructive },
  textOk: { color: webColors.foreground },
  warningBanner: {
    flexDirection: 'row',
    gap: webSpacing[2],
    alignItems: 'flex-start',
    backgroundColor: webColors.warningBackground,
    borderRadius: webRadius.sm,
    padding: webSpacing[3],
    marginBottom: webSpacing[4],
  },
  warningText: {
    flex: 1,
    fontSize: webFontSize.sm,
    color: webColors.destructive,
    lineHeight: 18,
  },
  section: {
    marginBottom: webSpacing[5],
    gap: webSpacing[2],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.mutedForeground,
    letterSpacing: 0.4,
  },
  addBlockButton: {
    width: 22,
    height: 22,
    borderRadius: webRadius.sm,
    backgroundColor: webColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addForm: {
    backgroundColor: webColors.muted,
    borderRadius: webRadius.md,
    padding: webSpacing[4],
    gap: webSpacing[1],
  },
  tabRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    alignItems: 'center',
    marginBottom: webSpacing[2],
  },
  tab: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.card,
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
  tabCancel: {
    marginLeft: 'auto',
  },
  tabCancelText: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: webColors.card,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginTop: webSpacing[1],
  },
  pickRowTitle: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    flex: 1,
  },
  pickRowSub: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    alignItems: 'center',
  },
  inlineAddButton: {
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  inlineAddButtonText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.card,
  },
  saveButton: {
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
    marginTop: webSpacing[3],
  },
  saveButtonText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.card,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  emptySub: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  blockCard: {
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    overflow: 'hidden',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  blockContent: {
    flex: 1,
    gap: 2,
  },
  blockTitle: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
  },
  blockTitleDone: {
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },
  blockSub: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  placementChip: {
    paddingHorizontal: webSpacing[2],
    paddingVertical: 3,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  placementChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  blockDelete: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  stepList: {
    paddingHorizontal: webSpacing[3],
    paddingBottom: webSpacing[3],
    gap: webSpacing[2],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
  },
  stepTitle: {
    flex: 1,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
  },
  stepDuration: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  stepEmpty: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[1],
  },
  leaveByCard: {
    backgroundColor: webColors.warningBackground,
    borderRadius: webRadius.md,
    padding: webSpacing[3],
    marginBottom: webSpacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaveByLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.warningForeground,
    letterSpacing: 0.4,
  },
  leaveByValue: {
    fontSize: webFontSize.lg,
    fontWeight: '700',
    color: webColors.warningForeground,
  },
  notesInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[3],
    minHeight: 72,
    textAlignVertical: 'top',
  },
  deletePlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: webSpacing[2],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[6],
  },
  deletePlanText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.destructive,
  },
});
