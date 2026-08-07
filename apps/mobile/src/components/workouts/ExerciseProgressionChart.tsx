// apps/mobile/src/components/workouts/ExerciseProgressionChart.tsx
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { getThemeColors } from '../../theme';
import type { ExerciseProgressionPoint } from '../../utils/workoutTrends';
import type { Item } from '../../db/types';

const VIEW_W = 320;
const VIEW_H = 140;
const PAD = 16;

interface ExerciseOption {
  item: Item;
}

interface ExerciseProgressionChartProps {
  exercises: ExerciseOption[]; // exercises that have at least one set log, caller-filtered
  points: ExerciseProgressionPoint[]; // for the currently selected exercise
  selectedExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  weightUnit: string;
  isDark: boolean;
}

function buildLinePath(points: ExerciseProgressionPoint[]): { path: string; xs: number[]; ys: number[] } {
  if (points.length === 0) return { path: '', xs: [], ys: [] };
  const minDate = points[0].sessionDate;
  const maxDate = points[points.length - 1].sessionDate;
  const dateRange = Math.max(1, maxDate - minDate);
  const minWeight = Math.min(...points.map((p) => p.topWeight));
  const maxWeight = Math.max(...points.map((p) => p.topWeight));
  const weightRange = Math.max(1, maxWeight - minWeight);

  const xs = points.map((p) => PAD + ((p.sessionDate - minDate) / dateRange) * (VIEW_W - PAD * 2));
  const ys = points.map((p) => VIEW_H - PAD - ((p.topWeight - minWeight) / weightRange) * (VIEW_H - PAD * 2));

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
  return { path, xs, ys };
}

// Exercise picker (search over exercises with at least one set log) plus an
// SVG line chart of top-set-weight-per-session over time.
export function ExerciseProgressionChart({
  exercises,
  points,
  selectedExerciseId,
  onSelectExercise,
  weightUnit,
  isDark,
}: ExerciseProgressionChartProps) {
  const palette = getThemeColors(isDark);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => (query.trim() ? exercises.filter((e) => e.item.title.toLowerCase().includes(query.trim().toLowerCase())) : exercises),
    [exercises, query]
  );

  const { path, xs, ys } = useMemo(() => buildLinePath(points), [points]);
  const selectedTitle = exercises.find((e) => e.item.id === selectedExerciseId)?.item.title;

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>EXERCISE PROGRESSION</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={selectedTitle ?? 'Search exercises...'}
        placeholderTextColor={palette.textTertiary}
        style={[s.search, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.surface }]}
      />

      {query.trim().length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.item.id}
          style={s.suggestions}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.suggestionRow}
              onPress={() => {
                onSelectExercise(item.item.id);
                setQuery('');
              }}
            >
              <Text style={{ color: palette.text }}>{item.item.title}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {selectedExerciseId && points.length === 0 && (
        <Text style={[s.empty, { color: palette.textTertiary }]}>No logged sets for this exercise yet.</Text>
      )}

      {points.length > 0 && (
        <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Line x1={PAD} y1={VIEW_H - PAD} x2={VIEW_W - PAD} y2={VIEW_H - PAD} stroke={palette.separator} strokeWidth={1} />
          <Path d={path} fill="none" stroke={palette.vermilion} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {xs.map((x, i) => (
            <Circle key={i} cx={x} cy={ys[i]} r={3} fill={palette.vermilion} />
          ))}
        </Svg>
      )}

      {points.length > 0 && (
        <Text style={[s.caption, { color: palette.textSecondary }]}>
          Top set: {points[points.length - 1].topWeight}{weightUnit} (most recent session)
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  suggestions: { maxHeight: 160, marginBottom: 8 },
  suggestionRow: { paddingVertical: 8, paddingHorizontal: 4 },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 8 },
  caption: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 6 },
});
