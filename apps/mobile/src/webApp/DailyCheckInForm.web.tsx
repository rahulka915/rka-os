import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getActiveTaskItems,
  getDailyCheckIn,
  getDailyCheckIns,
  getPlannedTodayItems,
  getRepeatingItemsForToday,
  getTodayItems,
  upsertDailyCheckIn,
} from '../db/database';
import {
  buildDailyPrioritySuggestions,
  parseDailyCheckInAnswers,
  type DailyCheckInAnswers,
  type DailyCheckInPhase,
  type DailyPriorityOutcome,
  type DailyPrioritySnapshot,
} from '../utils/dailyCheckIn';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

const SLEEP_AMOUNT = ['<4', '4-6', '6-8', '8+', 'not sure'];
const SLEEP_QUALITY = ['rough', 'broken', 'okay', 'deep', 'overslept'];
const ENERGY = ['drained', 'low', 'steady', 'charged', 'restless'];
const MOOD = ['heavy', 'flat', 'calm', 'good', 'bright'];
const STRESS = ['clear', 'mild', 'pressured', 'spiky', 'overloaded'];
const FOCUS = ['foggy', 'scattered', 'available', 'locked-in', 'avoidant'];
const DAY_SHAPE = ['survived', 'messy', 'steady', 'good', 'excellent'];
const FRICTION = ['time', 'energy', 'stress', 'distraction', 'unclear priorities', 'other'];
const HELPED = ['routine', 'movement', 'rest', 'clear plan', 'support', 'environment'];
const OUTCOMES: DailyPriorityOutcome[] = ['done', 'partly', 'carried', 'dropped'];

function setArrayValue(values: string[] | undefined, value: string): string[] {
  const current = values ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ChipGroup({
  values,
  selected,
  onSelect,
  multi = false,
}: {
  values: string[];
  selected?: string | string[];
  onSelect: (value: string) => void;
  multi?: boolean;
}) {
  return (
    <View style={styles.chipWrap}>
      {values.map((value) => {
        const isSelected = multi ? Array.isArray(selected) && selected.includes(value) : selected === value;
        return <Chip key={value} label={value} selected={isSelected} onPress={() => onSelect(value)} />;
      })}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

interface DailyCheckInFormProps {
  phase: DailyCheckInPhase;
  dateKey: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function DailyCheckInForm({ phase, dateKey, onSaved, onCancel }: DailyCheckInFormProps) {
  const existing = getDailyCheckIn(dateKey, phase);
  const morning = phase === 'evening' ? getDailyCheckIn(dateKey, 'morning') : null;
  const morningAnswers = parseDailyCheckInAnswers(morning?.answers);
  const [answers, setAnswers] = useState<DailyCheckInAnswers>(() => {
    const parsed = parseDailyCheckInAnswers(existing?.answers);
    if (phase === 'evening' && parsed.priorities.length === 0) {
      return { ...parsed, priorities: morningAnswers.priorities };
    }
    return parsed;
  });
  const [freeformPriority, setFreeformPriority] = useState('');

  const suggestions = useMemo(() => {
    if (phase !== 'morning') return [];
    const recentCarried = new Set<string>();
    for (const row of getDailyCheckIns(20)) {
      const parsed = parseDailyCheckInAnswers(row.answers);
      for (const priority of parsed.priorities) {
        if (priority.kind === 'linked-task' && priority.taskId && priority.outcome === 'carried') recentCarried.add(priority.taskId);
      }
    }
    const seen = new Set<string>();
    const items = [...getTodayItems(), ...getPlannedTodayItems(), ...getRepeatingItemsForToday(), ...getActiveTaskItems()].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return buildDailyPrioritySuggestions(items, { today: dateKey, carriedForwardTaskIds: recentCarried }).slice(0, 8);
  }, [dateKey, phase]);

  const update = (patch: Partial<DailyCheckInAnswers>) => setAnswers((current) => ({ ...current, ...patch }));

  const togglePriority = (priority: DailyPrioritySnapshot) => {
    setAnswers((current) => {
      const exists = current.priorities.some((item) => item.kind === priority.kind && item.taskId === priority.taskId && item.title === priority.title);
      return {
        ...current,
        priorities: exists
          ? current.priorities.filter((item) => !(item.kind === priority.kind && item.taskId === priority.taskId && item.title === priority.title))
          : [...current.priorities, priority],
      };
    });
  };

  const addFreeformPriority = () => {
    const title = freeformPriority.trim();
    if (!title) return;
    togglePriority({ kind: 'freeform', title });
    setFreeformPriority('');
  };

  const setOutcome = (index: number, outcome: DailyPriorityOutcome) => {
    setAnswers((current) => ({
      ...current,
      priorities: current.priorities.map((priority, i) => (i === index ? { ...priority, outcome } : priority)),
    }));
  };

  const save = () => {
    upsertDailyCheckIn(dateKey, phase, answers);
    onSaved();
  };

  const priorities = phase === 'evening' && answers.priorities.length === 0 ? morningAnswers.priorities : answers.priorities;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {phase === 'morning' ? (
        <>
          <Label text="Sleep amount" />
          <ChipGroup values={SLEEP_AMOUNT} selected={answers.sleepAmount} onSelect={(sleepAmount) => update({ sleepAmount })} />
          <Label text="Sleep quality" />
          <ChipGroup values={SLEEP_QUALITY} selected={answers.sleepQuality} onSelect={(sleepQuality) => update({ sleepQuality })} />

          <Label text="Energy" />
          <ChipGroup values={ENERGY} selected={answers.energy} onSelect={(energy) => update({ energy })} />
          <Label text="Mood" />
          <ChipGroup values={MOOD} selected={answers.mood} onSelect={(mood) => update({ mood })} />
          <Label text="Stress" />
          <ChipGroup values={STRESS} selected={answers.stress} onSelect={(stress) => update({ stress })} />
          <Label text="Focus readiness" />
          <ChipGroup values={FOCUS} selected={answers.focusReadiness} onSelect={(focusReadiness) => update({ focusReadiness })} />

          <Label text="Intention" />
          <TextInput
            value={answers.intention ?? ''}
            onChangeText={(intention) => update({ intention })}
            placeholder="A short intention..."
            placeholderTextColor={webColors.mutedForeground}
            multiline
            style={styles.input}
          />

          <Label text="Priorities" />
          {suggestions.map((suggestion) => {
            const selected = answers.priorities.some((priority) => priority.taskId === suggestion.taskId);
            return (
              <Pressable
                key={suggestion.taskId}
                onPress={() => togglePriority({ kind: 'linked-task', taskId: suggestion.taskId, title: suggestion.title, reason: suggestion.reason })}
                style={[styles.suggestion, selected && styles.suggestionSelected]}
              >
                <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
              </Pressable>
            );
          })}
          <View style={styles.freeformRow}>
            <TextInput
              value={freeformPriority}
              onChangeText={setFreeformPriority}
              onSubmitEditing={addFreeformPriority}
              placeholder="Add your own priority"
              placeholderTextColor={webColors.mutedForeground}
              style={styles.freeformInput}
            />
            <Pressable onPress={addFreeformPriority} style={styles.addButton}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
          {answers.priorities.length > 0 ? (
            <View style={styles.selectedPriorities}>
              {answers.priorities.map((priority, index) => (
                <Text key={`${priority.title}-${index}`} style={styles.selectedPriorityText}>
                  · {priority.title}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Label text="Day shape" />
          <ChipGroup values={DAY_SHAPE} selected={answers.dayShape} onSelect={(dayShape) => update({ dayShape })} />
          <Label text="Energy now" />
          <ChipGroup values={ENERGY} selected={answers.energyNow} onSelect={(energyNow) => update({ energyNow })} />
          <Label text="Mood now" />
          <ChipGroup values={MOOD} selected={answers.moodNow} onSelect={(moodNow) => update({ moodNow })} />
          <Label text="Stress now" />
          <ChipGroup values={STRESS} selected={answers.stressNow} onSelect={(stressNow) => update({ stressNow })} />

          <Label text="Priority outcomes" />
          {priorities.length === 0 ? (
            <Text style={styles.empty}>No morning priorities logged.</Text>
          ) : (
            priorities.map((priority, index) => (
              <View key={`${priority.title}-${index}`} style={styles.priorityReview}>
                <Text style={styles.priorityTitle}>{priority.title}</Text>
                <ChipGroup values={OUTCOMES} selected={priority.outcome} onSelect={(outcome) => setOutcome(index, outcome as DailyPriorityOutcome)} />
              </View>
            ))
          )}

          <Label text="Friction" />
          <ChipGroup values={FRICTION} selected={answers.friction} multi onSelect={(value) => update({ friction: setArrayValue(answers.friction, value) })} />
          <Label text="Helped" />
          <ChipGroup values={HELPED} selected={answers.helped} multi onSelect={(value) => update({ helped: setArrayValue(answers.helped, value) })} />

          <Label text="Win" />
          <TextInput
            value={answers.win ?? ''}
            onChangeText={(win) => update({ win })}
            placeholder="Something worth keeping..."
            placeholderTextColor={webColors.mutedForeground}
            multiline
            style={styles.input}
          />
          <Label text="Carry forward" />
          <TextInput
            value={answers.carryForward ?? ''}
            onChangeText={(carryForward) => update({ carryForward })}
            placeholder="Anything for tomorrow..."
            placeholderTextColor={webColors.mutedForeground}
            multiline
            style={styles.input}
          />
        </>
      )}

      <View style={styles.footer}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={save} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: webSpacing[4],
    paddingBottom: webSpacing[8],
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: webColors.mutedForeground,
    marginTop: webSpacing[4],
    marginBottom: webSpacing[2],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
  },
  chip: {
    minHeight: 34,
    borderRadius: webRadius.pill,
    borderWidth: 1,
    borderColor: webColors.border,
    backgroundColor: webColors.card,
    paddingHorizontal: webSpacing[3],
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: webColors.accent,
    backgroundColor: webColors.accent,
  },
  chipText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
  },
  chipTextSelected: {
    color: '#fff',
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: webColors.border,
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    padding: webSpacing[3],
    fontSize: webFontSize.base,
    color: webColors.foreground,
    textAlignVertical: 'top',
  },
  suggestion: {
    borderWidth: 1,
    borderColor: webColors.border,
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    padding: webSpacing[3],
    marginBottom: webSpacing[2],
  },
  suggestionSelected: {
    borderColor: webColors.accent,
  },
  suggestionTitle: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
  },
  suggestionReason: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    marginTop: 2,
  },
  freeformRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginTop: webSpacing[2],
  },
  freeformInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: webColors.border,
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    paddingHorizontal: webSpacing[3],
    fontSize: webFontSize.sm,
    color: webColors.foreground,
  },
  addButton: {
    minHeight: 40,
    paddingHorizontal: webSpacing[3],
    borderRadius: webRadius.md,
    backgroundColor: webColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: webFontSize.sm,
  },
  selectedPriorities: {
    marginTop: webSpacing[2],
  },
  selectedPriorityText: {
    color: webColors.foreground,
    fontSize: webFontSize.sm,
    marginBottom: 4,
  },
  empty: {
    color: webColors.mutedForeground,
    fontSize: webFontSize.sm,
  },
  priorityReview: {
    borderWidth: 1,
    borderColor: webColors.border,
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    padding: webSpacing[3],
    marginBottom: webSpacing[2],
  },
  priorityTitle: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.foreground,
    marginBottom: webSpacing[2],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: webSpacing[2],
    marginTop: webSpacing[6],
  },
  cancelButton: {
    minHeight: 40,
    paddingHorizontal: webSpacing[4],
    borderRadius: webRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: webColors.mutedForeground,
    fontWeight: '600',
    fontSize: webFontSize.sm,
  },
  saveButton: {
    minHeight: 40,
    paddingHorizontal: webSpacing[5],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: webFontSize.sm,
  },
});
