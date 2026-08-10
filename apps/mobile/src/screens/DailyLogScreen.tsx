import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RiverStoneSurface } from '../components/riverstone';
import { getThemeColors, spacing } from '../theme';
import { useThemeContext } from '../hooks/useThemeContext';
import { useDailyCheckIns } from '../hooks/useDb';
import { formatDate } from '../db/database';
import { isDailyCheckInEditable, parseDailyCheckInAnswers } from '../utils/dailyCheckIn';

export function DailyLogScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const today = formatDate(new Date());
  const { recent } = useDailyCheckIns(today);

  const groups = useMemo(() => {
    const map = new Map<string, typeof recent>();
    for (const row of recent) {
      const rows = map.get(row.dateKey) ?? [];
      rows.push(row);
      map.set(row.dateKey, rows);
    }
    return [...map.entries()].map(([dateKey, rows]) => ({ dateKey, rows }));
  }, [recent]);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}>
          <Text style={{ color: palette.textSecondary }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800' }}>Daily Log</Text>
        <View style={styles.headerSide} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 80 }]} showsVerticalScrollIndicator={false}>
        {groups.length === 0 ? (
          <Text style={{ color: palette.textSecondary, fontSize: 15, marginHorizontal: spacing[2] }}>No check-ins yet.</Text>
        ) : groups.map((group) => {
          const morning = group.rows.find((row) => row.phase === 'morning');
          const evening = group.rows.find((row) => row.phase === 'evening');
          const morningAnswers = parseDailyCheckInAnswers(morning?.answers);
          const eveningAnswers = parseDailyCheckInAnswers(evening?.answers);
          const editable = isDailyCheckInEditable(group.dateKey);
          return (
            <RiverStoneSurface key={group.dateKey} variant="card" mode={isDark ? 'dark' : 'light'} shape="regular" contentStyle={{ padding: 14 }} style={{ marginBottom: 12 }}>
              <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>{formatLogDate(group.dateKey)}</Text>
              <LogLine
                label="Morning"
                value={[morningAnswers.sleepAmount, morningAnswers.sleepQuality, morningAnswers.energy, morningAnswers.mood].filter(Boolean).join(' · ') || 'Not logged'}
              />
              <LogLine
                label="Evening"
                value={[eveningAnswers.dayShape, eveningAnswers.energyNow, eveningAnswers.moodNow].filter(Boolean).join(' · ') || 'Not logged'}
              />
              {morningAnswers.priorities.length > 0 ? (
                <Text style={{ color: palette.textSecondary, fontSize: 13, marginTop: 8 }}>
                  {morningAnswers.priorities.length} declared priorit{morningAnswers.priorities.length === 1 ? 'y' : 'ies'}
                </Text>
              ) : null}
              {editable ? (
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => navigation.navigate('DailyCheckInFlow', { phase: 'morning', dateKey: group.dateKey })} style={[styles.action, { borderColor: palette.separator }]}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{morning ? 'Edit morning' : 'Add morning'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigation.navigate('DailyCheckInFlow', { phase: 'evening', dateKey: group.dateKey })} style={[styles.action, { borderColor: palette.separator }]}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{evening ? 'Edit evening' : 'Add evening'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </RiverStoneSurface>
          );
        })}
      </ScrollView>
    </View>
  );
}

function LogLine({ label, value }: { label: string; value: string }) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: palette.textTertiary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: palette.text, fontSize: 14, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function formatLogDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3] },
  headerSide: { width: 72, minHeight: 44, justifyContent: 'center' },
  content: { padding: spacing[3] },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderRadius: 19, paddingHorizontal: 12 },
});
