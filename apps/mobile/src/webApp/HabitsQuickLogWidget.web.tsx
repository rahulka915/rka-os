import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { toggleHabitOccurrence, logHabitSample, formatDate } from '../db/database';
import { useTodayHabits } from '../hooks/useDb';
import { parseHabitMeta } from '../utils/habitMeta';
import { webColors, webRadius, webFontSize, webSpacing, webDepth } from '../theme/webTheme';

// Compact square-card equivalent of native's HabitsWidget row: lists today's
// still-incomplete habits with a one-tap complete (binary) or +1 (count/
// duration, via logHabitSample — same activity-log convention the native
// HabitsScreen quick-completion controls use). Renders nothing when every
// scheduled habit for today is already done.
export function HabitsQuickLogWidget() {
  const { habits, refresh } = useTodayHabits();
  const incomplete = habits.filter((h) => !h.isCompletedToday);

  if (incomplete.length === 0) return null;

  const today = formatDate(new Date());

  const complete = (habit: (typeof incomplete)[number]) => {
    const meta = parseHabitMeta(habit.item);
    if (meta.measurement === 'binary') {
      toggleHabitOccurrence(habit.item.id, today);
    } else {
      logHabitSample(habit.item.id, 1);
    }
    refresh();
  };

  return (
    <View style={[styles.card, webDepth.card]}>
      <Text style={styles.heading}>HABITS</Text>
      <View style={styles.list}>
        {incomplete.slice(0, 3).map((habit) => {
          const meta = parseHabitMeta(habit.item);
          return (
            <Pressable key={habit.item.id} onPress={() => complete(habit)} style={styles.row}>
              <Text style={styles.rowTitle} numberOfLines={1}>{habit.item.title}</Text>
              <View style={styles.checkGlyph}>
                {meta.measurement === 'binary' ? (
                  <Check size={11} color={webColors.mutedForeground} strokeWidth={2.5} />
                ) : (
                  <Text style={styles.plusOne}>+1</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: webColors.card,
    borderRadius: webRadius.lg,
    padding: webSpacing[3],
    justifyContent: 'center',
    gap: 6,
  },
  heading: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, color: webColors.mutedForeground },
  list: { gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  rowTitle: { flex: 1, fontSize: 11, fontWeight: '500', color: webColors.foreground },
  checkGlyph: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusOne: { fontSize: 9, fontWeight: '700', color: webColors.mutedForeground },
});
