import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getAttributes,
  computeAttributeScore,
  computeAlertness,
  getContributionsForAttribute,
} from '../db/database';
import { useDbRefresh } from '../hooks/useDb';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import type { Item, AttributeContributionRow } from '../db/types';

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

function useAttributes() {
  const [rows, setRows] = useState<AttributeRow[]>([]);
  const [alertness, setAlertness] = useState<number | null>(null);
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
  useDbRefresh(refresh);
  return { rows, alertness, refresh };
}

export function AttributesScreen() {
  const { rows, alertness } = useAttributes();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View style={sc.container}>
      <ScrollView contentContainerStyle={sc.scrollContent}>
        <View style={sc.header}>
          <Text style={sc.title}>Attributes</Text>
          <Text style={sc.subtitle}>Developmental stats, built from sustained evidence over time</Text>
        </View>

        <Text style={sc.sectionLabel}>DEVELOPMENTAL</Text>
        {rows.map(({ item, score, recentEvidence }) => {
          const expanded = expandedId === item.id;
          return (
            <Pressable
              key={item.id}
              style={[sc.card, webDepth.card]}
              onPress={() => setExpandedId(expanded ? null : item.id)}
            >
              <View style={sc.cardHeaderRow}>
                <Text style={sc.cardTitle}>{item.title}</Text>
                <Text style={sc.cardValue}>{Math.round(score)}</Text>
              </View>
              <View style={sc.track}>
                <View style={[sc.fill, { width: `${Math.min(Math.max(score, 0), 100)}%` }]} />
              </View>
              {expanded ? (
                <View style={sc.evidenceList}>
                  {recentEvidence.length === 0 ? (
                    <Text style={sc.emptyText}>
                      No evidence recorded yet — tag a Habit or Action to this Attribute to start building it.
                    </Text>
                  ) : (
                    recentEvidence.map((row) => (
                      <View key={row.id} style={sc.evidenceRow}>
                        <Text style={sc.evidenceWeight}>{row.weight}</Text>
                        <Text style={sc.evidenceSource}>
                          {row.sourceType} · {relativeTime(row.occurredAt)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </Pressable>
          );
        })}

        <Text style={[sc.sectionLabel, { marginTop: webSpacing[5] }]}>CURRENT STATE</Text>
        <View style={[sc.card, webDepth.card]}>
          <View style={sc.cardHeaderRow}>
            <Text style={sc.cardTitle}>Alertness</Text>
            <Text style={[sc.cardValue, { color: webColors.primary }]}>{alertness === null ? '—' : Math.round(alertness)}</Text>
          </View>
          <Text style={sc.currentStateNote}>
            {alertness === null
              ? 'No morning check-in logged today.'
              : "Derived from today's sleep check-in — not a developmental Attribute, resets each day."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const sc = StyleSheet.create({
  container: { flex: 1, backgroundColor: webColors.background },
  scrollContent: { padding: webSpacing[6], maxWidth: 640 },
  header: { marginBottom: webSpacing[5] },
  title: { fontSize: webFontSize.xl, fontWeight: '700', color: webColors.foreground },
  subtitle: { fontSize: webFontSize.sm, color: webColors.mutedForeground, marginTop: 2 },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: webColors.mutedForeground,
    marginBottom: webSpacing[2],
  },
  card: {
    backgroundColor: webColors.card,
    borderRadius: webRadius.lg,
    padding: webSpacing[4],
    marginBottom: webSpacing[3],
    // @ts-ignore
    cursor: 'pointer',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[2],
  },
  cardTitle: { fontSize: webFontSize.base, fontWeight: '700', color: webColors.foreground },
  cardValue: { fontSize: webFontSize.xl, fontWeight: '800', color: webColors.accent },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: webColors.muted,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999, backgroundColor: webColors.accent },
  evidenceList: { marginTop: webSpacing[3], gap: 4 },
  evidenceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  evidenceWeight: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground, textTransform: 'capitalize' },
  evidenceSource: { fontSize: webFontSize.sm, color: webColors.mutedForeground, textTransform: 'capitalize' },
  emptyText: { fontSize: webFontSize.sm, color: webColors.mutedForeground, marginTop: webSpacing[2] },
  currentStateNote: { fontSize: webFontSize.sm, color: webColors.mutedForeground, marginTop: 2 },
});
