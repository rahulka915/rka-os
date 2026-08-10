import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { RiverStoneSurface } from '../components/riverstone';
import { getActiveTaskItems, getDailyCheckIn, getDailyCheckIns, getPlannedTodayItems, getRepeatingItemsForToday, getTodayItems, upsertDailyCheckIn } from '../db/database';
import { getThemeColors, spacing } from '../theme';
import { useThemeContext } from '../hooks/useThemeContext';
import {
  buildDailyPrioritySuggestions,
  parseDailyCheckInAnswers,
  type DailyCheckInAnswers,
  type DailyCheckInPhase,
  type DailyPriorityOutcome,
  type DailyPrioritySnapshot,
} from '../utils/dailyCheckIn';

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

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.chip,
        { borderColor: selected ? palette.vermilion : palette.separator, backgroundColor: selected ? palette.vermilion : palette.surface },
      ]}
    >
      <Text style={{ color: selected ? '#fff' : palette.text, fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ChipGroup({ values, selected, onSelect, multi = false }: { values: string[]; selected?: string | string[]; onSelect: (value: string) => void; multi?: boolean }) {
  return (
    <View style={styles.chipWrap}>
      {values.map((value) => {
        const isSelected = multi ? Array.isArray(selected) && selected.includes(value) : selected === value;
        return <Chip key={value} label={value} selected={isSelected} onPress={() => onSelect(value)} />;
      })}
    </View>
  );
}

function setArrayValue(values: string[] | undefined, value: string): string[] {
  const current = values ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export function DailyCheckInFlowScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const phase = (route.params?.phase ?? 'morning') as DailyCheckInPhase;
  const dateKey = route.params?.dateKey as string;
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
  const [step, setStep] = useState(0);
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

  const steps = phase === 'morning'
    ? ['Sleep', 'Starting State', 'Intention', 'Priorities', 'Review']
    : ['Day Shape', 'Priorities', 'Friction', 'Reflection', 'Review'];
  const isLast = step === steps.length - 1;

  const update = (patch: Partial<DailyCheckInAnswers>) => setAnswers((current) => ({ ...current, ...patch }));
  const togglePriority = (priority: DailyPrioritySnapshot) => {
    setAnswers((current) => {
      const exists = current.priorities.some((item) => item.kind === priority.kind && item.taskId === priority.taskId && item.title === priority.title);
      return { ...current, priorities: exists ? current.priorities.filter((item) => !(item.kind === priority.kind && item.taskId === priority.taskId && item.title === priority.title)) : [...current.priorities, priority] };
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  const renderMorningStep = () => {
    if (step === 0) return (
      <>
        <Question title="How was your night?" />
        <Label text="Sleep amount" />
        <ChipGroup values={SLEEP_AMOUNT} selected={answers.sleepAmount} onSelect={(sleepAmount) => update({ sleepAmount })} />
        <Label text="Sleep quality" />
        <ChipGroup values={SLEEP_QUALITY} selected={answers.sleepQuality} onSelect={(sleepQuality) => update({ sleepQuality })} />
      </>
    );
    if (step === 1) return (
      <>
        <Question title="Where are you starting from?" />
        <Label text="Energy" /><ChipGroup values={ENERGY} selected={answers.energy} onSelect={(energy) => update({ energy })} />
        <Label text="Mood" /><ChipGroup values={MOOD} selected={answers.mood} onSelect={(mood) => update({ mood })} />
        <Label text="Stress" /><ChipGroup values={STRESS} selected={answers.stress} onSelect={(stress) => update({ stress })} />
        <Label text="Focus readiness" /><ChipGroup values={FOCUS} selected={answers.focusReadiness} onSelect={(focusReadiness) => update({ focusReadiness })} />
      </>
    );
    if (step === 2) return (
      <>
        <Question title="What kind of day are you trying to have?" />
        <TextInput value={answers.intention ?? ''} onChangeText={(intention) => update({ intention })} placeholder="A short intention..." placeholderTextColor={palette.textTertiary} multiline style={[styles.input, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.surface }]} />
      </>
    );
    if (step === 3) return (
      <>
        <Question title="What matters today?" />
        {suggestions.map((suggestion) => {
          const selected = answers.priorities.some((priority) => priority.taskId === suggestion.taskId);
          return (
            <TouchableOpacity key={suggestion.taskId} onPress={() => togglePriority({ kind: 'linked-task', taskId: suggestion.taskId, title: suggestion.title, reason: suggestion.reason })} style={[styles.suggestion, { borderColor: selected ? palette.vermilion : palette.separator, backgroundColor: palette.surface }]}>
              <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>{suggestion.title}</Text>
              <Text style={{ color: palette.textSecondary, fontSize: 12, marginTop: 3 }}>{suggestion.reason}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TextInput value={freeformPriority} onChangeText={setFreeformPriority} placeholder="Add your own priority" placeholderTextColor={palette.textTertiary} style={[styles.freeformInput, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.surface }]} />
          <TouchableOpacity onPress={addFreeformPriority} style={[styles.addButton, { backgroundColor: palette.vermilion }]}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Add</Text>
          </TouchableOpacity>
        </View>
      </>
    );
    return <Review answers={answers} phase={phase} />;
  };

  const renderEveningStep = () => {
    if (step === 0) return (
      <>
        <Question title="How did today land?" />
        <Label text="Day shape" /><ChipGroup values={DAY_SHAPE} selected={answers.dayShape} onSelect={(dayShape) => update({ dayShape })} />
        <Label text="Energy now" /><ChipGroup values={ENERGY} selected={answers.energyNow} onSelect={(energyNow) => update({ energyNow })} />
        <Label text="Mood now" /><ChipGroup values={MOOD} selected={answers.moodNow} onSelect={(moodNow) => update({ moodNow })} />
        <Label text="Stress now" /><ChipGroup values={STRESS} selected={answers.stressNow} onSelect={(stressNow) => update({ stressNow })} />
      </>
    );
    if (step === 1) {
      const priorities = answers.priorities.length ? answers.priorities : morningAnswers.priorities;
      return (
        <>
          <Question title="How did the priorities land?" />
          {priorities.length === 0 ? <Text style={{ color: palette.textSecondary }}>No morning priorities logged.</Text> : priorities.map((priority, index) => (
            <View key={`${priority.title}-${index}`} style={[styles.priorityReview, { borderColor: palette.separator, backgroundColor: palette.surface }]}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>{priority.title}</Text>
              <ChipGroup values={OUTCOMES} selected={priority.outcome} onSelect={(outcome) => setOutcome(index, outcome as DailyPriorityOutcome)} />
            </View>
          ))}
        </>
      );
    }
    if (step === 2) return (
      <>
        <Question title="What shaped the day?" />
        <Label text="Friction" /><ChipGroup values={FRICTION} selected={answers.friction} multi onSelect={(value) => update({ friction: setArrayValue(answers.friction, value) })} />
        <Label text="Helped" /><ChipGroup values={HELPED} selected={answers.helped} multi onSelect={(value) => update({ helped: setArrayValue(answers.helped, value) })} />
      </>
    );
    if (step === 3) return (
      <>
        <Question title="What should be remembered?" />
        <Label text="Win" />
        <TextInput value={answers.win ?? ''} onChangeText={(win) => update({ win })} placeholder="Something worth keeping..." placeholderTextColor={palette.textTertiary} multiline style={[styles.input, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.surface }]} />
        <Label text="Carry forward" />
        <TextInput value={answers.carryForward ?? ''} onChangeText={(carryForward) => update({ carryForward })} placeholder="Anything for tomorrow..." placeholderTextColor={palette.textTertiary} multiline style={[styles.input, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.surface }]} />
      </>
    );
    return <Review answers={answers} phase={phase} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}><Text style={{ color: palette.textSecondary }}>Cancel</Text></TouchableOpacity>
        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 16 }}>{phase === 'morning' ? 'Morning Check-In' : 'Evening Debrief'}</Text>
        <View style={styles.headerSide} />
      </View>
      <View style={styles.progressRow}>
        {steps.map((name, index) => <View key={name} style={[styles.progressDot, { backgroundColor: index <= step ? palette.vermilion : palette.separator }]} />)}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RiverStoneSurface variant="card" mode={isDark ? 'dark' : 'light'} shape="regular" contentStyle={{ padding: 18 }}>
          {phase === 'morning' ? renderMorningStep() : renderEveningStep()}
        </RiverStoneSurface>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14), borderTopColor: palette.separator }]}>
        <TouchableOpacity disabled={step === 0} onPress={() => setStep((s) => Math.max(0, s - 1))} style={styles.footerButton}>
          <Text style={{ color: step === 0 ? palette.textTertiary : palette.textSecondary, fontWeight: '700' }}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={isLast ? save : () => setStep((s) => Math.min(steps.length - 1, s + 1))} style={[styles.nextButton, { backgroundColor: palette.vermilion }]}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{isLast ? 'Save' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Question({ title }: { title: string }) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  return <Text style={{ color: palette.text, fontSize: 25, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', marginBottom: 18 }}>{title}</Text>;
}

function Label({ text }: { text: string }) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  return <Text style={{ color: palette.textTertiary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 }}>{text}</Text>;
}

function Review({ answers, phase }: { answers: DailyCheckInAnswers; phase: DailyCheckInPhase }) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const lines = phase === 'morning'
    ? [
      ['Sleep', [answers.sleepAmount, answers.sleepQuality].filter(Boolean).join(' · ')],
      ['State', [answers.energy, answers.mood, answers.stress, answers.focusReadiness].filter(Boolean).join(' · ')],
      ['Intention', answers.intention],
    ]
    : [
      ['Day', [answers.dayShape, answers.energyNow, answers.moodNow, answers.stressNow].filter(Boolean).join(' · ')],
      ['Friction', answers.friction?.join(' · ')],
      ['Helped', answers.helped?.join(' · ')],
      ['Win', answers.win],
      ['Carry', answers.carryForward],
    ];
  return (
    <>
      <Question title="Review" />
      {lines.filter(([, value]) => value).map(([label, value]) => (
        <View key={label} style={{ marginBottom: 14 }}>
          <Text style={{ color: palette.textTertiary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{label}</Text>
          <Text style={{ color: palette.text, fontSize: 15, marginTop: 3 }}>{value}</Text>
        </View>
      ))}
      <Label text="Priorities" />
      {answers.priorities.length === 0 ? <Text style={{ color: palette.textSecondary }}>None selected.</Text> : answers.priorities.map((priority, index) => (
        <Text key={`${priority.title}-${index}`} style={{ color: palette.text, fontSize: 15, marginBottom: 6 }}>
          {priority.title}{priority.outcome ? ` · ${priority.outcome}` : ''}
        </Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3] },
  headerSide: { width: 72, minHeight: 44, justifyContent: 'center' },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 8 },
  progressDot: { width: 28, height: 4, borderRadius: 2 },
  content: { padding: spacing[3], paddingBottom: 120 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: 13, justifyContent: 'center' },
  input: { minHeight: 110, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, textAlignVertical: 'top' },
  freeformInput: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15 },
  addButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center' },
  suggestion: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  priorityReview: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingHorizontal: spacing[3], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  nextButton: { minHeight: 44, minWidth: 112, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
