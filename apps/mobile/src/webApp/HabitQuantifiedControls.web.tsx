import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, RotateCcw } from 'lucide-react-native';
import { getPotentialStats, logHabitSample, undoLastHabitSample, updateItemMetadata, getAttributes, getHabitAttributeContributions, setHabitAttributeContributions } from '../db/database';
import {
  parseHabitMeta,
  computeHabitPeriodProgress,
  type HabitMeasurement,
  type HabitTargetPeriod,
} from '../utils/habitMeta';
import { parseHabitPotentialMeta } from '../utils/potential';
import type { AttributeWeight } from '../utils/attributes';
import type { ActivityLog } from '../db/types';
import type { Item } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

const ATTRIBUTE_WEIGHTS: AttributeWeight[] = ['minor', 'moderate', 'major'];

// Independent of and additional to HabitPotentialEditor's single legacy
// Pillar assignment below — a Habit can tap zero, one, or several
// Potential Attributes at once, each at its own Minor/Moderate/Major weight.
export function HabitAttributeEditor({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const attributes = getAttributes();
  if (attributes.length === 0) return null;
  const contributions = getHabitAttributeContributions(item.id);

  const setWeight = (attributeId: string, weight: AttributeWeight | null) => {
    const next = contributions.filter((c) => c.attributeId !== attributeId);
    if (weight) next.push({ attributeId, weight });
    setHabitAttributeContributions(item.id, next);
    onChanged();
  };

  return (
    <View style={styles.editorSection}>
      <Text style={styles.editorHeader}>Attribute evidence</Text>
      {attributes.map((attribute) => {
        const current = contributions.find((c) => c.attributeId === attribute.id)?.weight ?? null;
        return (
          <View key={attribute.id} style={{ marginBottom: webSpacing[2] }}>
            <Text style={styles.editorFieldLabel}>{attribute.title}</Text>
            <View style={styles.chipRow}>
              <Pressable onPress={() => setWeight(attribute.id, null)} style={[styles.chip, !current && styles.chipActive]}>
                <Text style={[styles.chipText, !current && styles.chipTextActive]}>None</Text>
              </Pressable>
              {ATTRIBUTE_WEIGHTS.map((weight) => {
                const selected = current === weight;
                return (
                  <Pressable key={weight} onPress={() => setWeight(attribute.id, weight)} style={[styles.chip, selected && styles.chipActive]}>
                    <Text style={[styles.chipText, selected && styles.chipTextActive, { textTransform: 'capitalize' }]}>{weight}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Quick "+1" control for count habits, used inline in the list row.
export function QuickAddOneControl({ item, onLogged }: { item: Item; onLogged: () => void }) {
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        logHabitSample(item.id, 1);
        onLogged();
      }}
      style={styles.quickButton}
    >
      <Plus size={14} color={webColors.foreground} strokeWidth={2.5} />
    </Pressable>
  );
}

// Quick duration-entry control for duration habits, used inline in the list row.
export function QuickDurationControl({ item, onLogged }: { item: Item; onLogged: () => void }) {
  const [value, setValue] = useState('');

  const submit = () => {
    const n = Number(value);
    if (!n || n <= 0) return;
    logHabitSample(item.id, n);
    setValue('');
    onLogged();
  };

  return (
    <Pressable onPress={(event) => event.stopPropagation()} style={styles.durationRow}>
      <TextInput
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder="min"
        placeholderTextColor={webColors.mutedForeground}
        keyboardType="numeric"
        style={styles.durationInput}
      />
      <Pressable onPress={submit} style={styles.quickButton}>
        <Plus size={14} color={webColors.foreground} strokeWidth={2.5} />
      </Pressable>
    </Pressable>
  );
}

// Period progress + undo, shown in the detail panel for count/duration habits.
export function HabitProgressSection({
  item,
  samples,
  onChanged,
}: {
  item: Item;
  samples: ActivityLog[];
  onChanged: () => void;
}) {
  const meta = parseHabitMeta(item);
  const progress = useMemo(() => computeHabitPeriodProgress(item, samples, new Date()), [item, samples]);
  if (meta.measurement === 'binary') return null;

  const hasSamples = samples.some((s) => s.entityId === item.id && s.actionType === 'habit-sample');

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressHeaderRow}>
        <Text style={styles.progressLabel}>
          {progress.current}
          {progress.unit ? ` ${progress.unit}` : ''} / {progress.target}
          {progress.unit ? ` ${progress.unit}` : ''} this {progress.periodLabel === 'daily' ? 'day' : progress.periodLabel === 'custom' ? 'period' : progress.periodLabel.replace('ly', '')}
        </Text>
        <Pressable
          onPress={() => {
            undoLastHabitSample(item.id);
            onChanged();
          }}
          disabled={!hasSamples}
          style={[styles.undoButton, !hasSamples && styles.undoButtonDisabled]}
        >
          <RotateCcw size={14} color={webColors.mutedForeground} strokeWidth={2} />
          <Text style={styles.undoText}>Undo last</Text>
        </Pressable>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, progress.target > 0 ? (progress.current / progress.target) * 100 : 0)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const MEASUREMENTS: HabitMeasurement[] = ['binary', 'count', 'duration'];
const PERIODS: HabitTargetPeriod[] = ['daily', 'weekly', 'monthly', 'custom'];

// Collapsed "Measurement" disclosure for the edit surface, mirrors native's HabitDetailScreen.
export function HabitMeasurementEditor({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = parseHabitMeta(item);

  const patch = (next: Partial<typeof meta>) => {
    updateItemMetadata(item.id, { ...meta, ...next });
    onChanged();
  };

  return (
    <View style={styles.editorSection}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.editorHeaderRow}>
        <Text style={styles.editorHeader}>Measurement</Text>
        <Text style={styles.editorHeaderValue}>{meta.measurement}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.editorBody}>
          <Text style={styles.editorFieldLabel}>Type</Text>
          <View style={styles.chipRow}>
            {MEASUREMENTS.map((m) => (
              <Pressable
                key={m}
                onPress={() => patch({ measurement: m })}
                style={[styles.chip, meta.measurement === m && styles.chipActive]}
              >
                <Text style={[styles.chipText, meta.measurement === m && styles.chipTextActive]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          {meta.measurement !== 'binary' && (
            <>
              <Text style={styles.editorFieldLabel}>Target</Text>
              <View style={styles.targetRow}>
                <TextInput
                  value={String(meta.targetValue)}
                  onChangeText={(v) => patch({ targetValue: Number(v) || 0 })}
                  keyboardType="numeric"
                  style={styles.targetInput}
                />
                <TextInput
                  value={meta.targetUnit ?? ''}
                  onChangeText={(v) => patch({ targetUnit: v })}
                  placeholder="unit (e.g. reps, min)"
                  placeholderTextColor={webColors.mutedForeground}
                  style={styles.unitInput}
                />
              </View>

              <Text style={styles.editorFieldLabel}>Period</Text>
              <View style={styles.chipRow}>
                {PERIODS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => patch({ targetPeriod: p })}
                    style={[styles.chip, meta.targetPeriod === p && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, meta.targetPeriod === p && styles.chipTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>

              {meta.targetPeriod === 'custom' && (
                <>
                  <Text style={styles.editorFieldLabel}>Custom period (days)</Text>
                  <TextInput
                    value={String(meta.customPeriodDays ?? 1)}
                    onChangeText={(v) => patch({ customPeriodDays: Number(v) || 1 })}
                    keyboardType="numeric"
                    style={styles.targetInput}
                  />
                </>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

export function HabitPotentialEditor({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const stats = getPotentialStats();
  const potentialMeta = parseHabitPotentialMeta(item.metadata);
  const [targetDaysText, setTargetDaysText] = useState(String(potentialMeta.potentialTargetDays ?? 30));

  useEffect(() => {
    setTargetDaysText(String(potentialMeta.potentialTargetDays ?? 30));
  }, [item.id, potentialMeta.potentialTargetDays]);

  const patchPotential = (statId: string | null) => {
    const existing = item.metadata ? JSON.parse(item.metadata) : {};
    if (statId === null) {
      delete existing.potentialStat;
      delete existing.potentialTargetDays;
    } else {
      existing.potentialStat = statId;
      existing.potentialTargetDays = Number(targetDaysText) > 0 ? Number(targetDaysText) : 30;
    }
    updateItemMetadata(item.id, existing);
    onChanged();
  };

  const saveTargetDays = () => {
    if (!potentialMeta.potentialStat) return;
    const parsed = Number(targetDaysText);
    const existing = item.metadata ? JSON.parse(item.metadata) : {};
    existing.potentialTargetDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
    updateItemMetadata(item.id, existing);
    onChanged();
  };

  return (
    <View style={styles.editorSection}>
      <Text style={styles.editorHeader}>Potential</Text>
      <Text style={styles.editorFieldLabel}>Feeds Pillar</Text>
      <View style={styles.chipRow}>
        <Pressable
          onPress={() => patchPotential(null)}
          style={[styles.chip, !potentialMeta.potentialStat && styles.chipActive]}
        >
          <Text style={[styles.chipText, !potentialMeta.potentialStat && styles.chipTextActive]}>None</Text>
        </Pressable>
        {stats.map((stat) => {
          const selected = potentialMeta.potentialStat === stat.id;
          return (
            <Pressable
              key={stat.id}
              onPress={() => patchPotential(stat.id)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{stat.title}</Text>
            </Pressable>
          );
        })}
      </View>

      {potentialMeta.potentialStat ? (
        <>
          <Text style={styles.editorFieldLabel}>Target days for 100%</Text>
          <TextInput
            value={targetDaysText}
            onChangeText={setTargetDaysText}
            onBlur={saveTargetDays}
            keyboardType="numeric"
            style={styles.targetInput}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  quickButton: {
    width: 26,
    height: 26,
    borderRadius: webRadius.sm,
    backgroundColor: webColors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[1],
  },
  durationInput: {
    width: 44,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[2],
    paddingVertical: 4,
  },
  progressSection: {
    marginBottom: webSpacing[4],
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[2],
  },
  progressLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  undoButtonDisabled: {
    opacity: 0.4,
  },
  undoText: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  progressTrack: {
    height: 6,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: webColors.accent,
  },
  editorSection: {
    marginTop: webSpacing[4],
    borderTopWidth: 1,
    borderTopColor: webColors.border,
    paddingTop: webSpacing[3],
  },
  editorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorHeader: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.foreground,
  },
  editorHeaderValue: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    textTransform: 'capitalize',
  },
  editorBody: {
    marginTop: webSpacing[3],
    gap: webSpacing[2],
  },
  editorFieldLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: webSpacing[2],
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
    backgroundColor: webColors.muted,
  },
  chipActive: {
    backgroundColor: webColors.accent,
  },
  chipText: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: webColors.card,
    fontWeight: '600',
  },
  targetRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
  },
  targetInput: {
    width: 64,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[2],
    paddingVertical: 6,
  },
  unitInput: {
    flex: 1,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[2],
    paddingVertical: 6,
  },
});
