import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAttributes,
  computeAttributeScore,
  computeAlertness,
  getContributionsForAttribute,
} from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, spacing, radius, fontSize } from '../theme';
import { RiverStoneSurface } from '../components/riverstone';
import { RiverStoneProgress } from '../components/ui/RiverStoneProgress';
import type { Item } from '../db/types';
import type { AttributeContributionRow } from '../db/types';

interface AttributeRow {
  item: Item;
  score: number;
  recentEvidence: AttributeContributionRow[];
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function AttributesScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [rows, setRows] = useState<AttributeRow[]>([]);
  const [alertness, setAlertness] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const attributes = getAttributes();
    setRows(
      attributes.map((item) => ({
        item,
        score: computeAttributeScore(item.id),
        recentEvidence: getContributionsForAttribute(item.id).slice(0, 5),
      })),
    );
    setAlertness(computeAlertness());
  }, []);

  useFocusEffect(refresh);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Attributes</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Developmental stats, built from sustained evidence over time
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DEVELOPMENTAL</Text>
        {rows.map(({ item, score, recentEvidence }) => {
          const expanded = expandedId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              onPress={() => setExpandedId(expanded ? null : item.id)}
            >
              <RiverStoneSurface
                variant="card"
                mode={isDark ? 'dark' : 'light'}
                style={styles.card}
                contentStyle={styles.cardContent}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{item.title}</Text>
                  <Text style={[styles.cardValue, { color: palette.vermilion }]}>{Math.round(score)}</Text>
                </View>
                <RiverStoneProgress progress={score / 100} isDark={isDark} height={8} showLabel={false} />
                {expanded ? (
                  <View style={styles.evidenceList}>
                    {recentEvidence.length === 0 ? (
                      <Text style={[styles.emptyText, { color: palette.textTertiary }]}>
                        No evidence recorded yet — tag a Habit or Action to this Attribute to start building it.
                      </Text>
                    ) : (
                      recentEvidence.map((row) => (
                        <View key={row.id} style={styles.evidenceRow}>
                          <Text style={[styles.evidenceWeight, { color: palette.textSecondary }]}>{row.weight}</Text>
                          <Text style={[styles.evidenceSource, { color: palette.textTertiary }]}>
                            {row.sourceType} · {relativeTime(row.occurredAt)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </RiverStoneSurface>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionLabel, { color: palette.textTertiary, marginTop: spacing[5] }]}>
          CURRENT STATE
        </Text>
        <RiverStoneSurface
          variant="card"
          mode={isDark ? 'dark' : 'light'}
          style={styles.card}
          contentStyle={styles.cardContent}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Alertness</Text>
            <Text style={[styles.cardValue, { color: palette.blue }]}>
              {alertness === null ? '—' : Math.round(alertness)}
            </Text>
          </View>
          <Text style={[styles.currentStateNote, { color: palette.textTertiary }]}>
            {alertness === null
              ? 'No morning check-in logged today.'
              : "Derived from today's sleep check-in — not a developmental Attribute, resets each day."}
          </Text>
        </RiverStoneSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
  },
  header: { marginBottom: spacing[4] },
  title: { fontSize: fontSize.xl, fontWeight: '700' },
  subtitle: { fontSize: fontSize.sm, marginTop: 2 },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: spacing[2],
  },
  card: { marginBottom: spacing[3] },
  cardContent: { padding: spacing[4] },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  cardTitle: { fontSize: fontSize.base, fontWeight: '700' },
  cardValue: { fontSize: fontSize.xl, fontWeight: '800' },
  evidenceList: { marginTop: spacing[3], gap: spacing[1] },
  evidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  evidenceWeight: { fontSize: fontSize.sm, fontWeight: '600', textTransform: 'capitalize' },
  evidenceSource: { fontSize: fontSize.sm, textTransform: 'capitalize' },
  emptyText: { fontSize: fontSize.sm, marginTop: spacing[2] },
  currentStateNote: { fontSize: fontSize.sm, marginTop: 2 },
});
