import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react-native';
import {
  getPotentialStats,
  getAreaForPotentialStat,
  createPotentialStat,
  setPotentialStatArea,
  updateItem,
  deleteItem,
  getItemsByType,
  getCompletedOccurrenceDates,
  formatDate,
} from '../db/database';
import { computePotentialStats, SUGGESTED_PILLARS, type PotentialStatResult } from '../utils/potential';
import { useDbRefresh } from '../hooks/useDb';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import type { Item } from '../db/types';

interface PillarRow {
  stat: Item;
  result: PotentialStatResult;
  domainTitle: string | null;
  domainId: string | null;
}

function usePillars() {
  const [rows, setRows] = useState<PillarRow[]>([]);
  const refresh = useCallback(() => {
    const stats = getPotentialStats();
    const habits = getItemsByType('habit');
    const today = formatDate(new Date());
    const completedDatesByHabitId: Record<string, Set<string>> = {};
    for (const h of habits) {
      completedDatesByHabitId[h.id] = getCompletedOccurrenceDates(h.id);
    }
    const statItems = stats.map((s) => ({ id: s.id, title: s.title }));
    const results = computePotentialStats(habits, statItems, completedDatesByHabitId, today);
    const areas = getItemsByType('area');
    const areaById = new Map<string, string>(areas.map((a) => [a.id, a.title]));
    setRows(
      stats.map((stat) => {
        const domainId = getAreaForPotentialStat(stat.id);
        return {
          stat,
          result: results[stat.id] ?? { stat: stat.id, percent: 0, contributions: [] },
          domainTitle: domainId ? (areaById.get(domainId) ?? null) : null,
          domainId,
        };
      }),
    );
  }, []);
  useDbRefresh(refresh);
  return { rows, refresh };
}

export function PillarsScreen() {
  const { rows, refresh } = usePillars();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [captureText, setCaptureText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createPotentialStat(trimmed);
    setCaptureText('');
    refresh();
  };

  const submitEdit = (statId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) updateItem(statId, { title: trimmed });
    setEditingId(null);
    refresh();
  };

  const handleDelete = (row: PillarRow) => {
    if (!window.confirm(`Delete "${row.stat.title}"? This cannot be undone.`)) return;
    deleteItem(row.stat.id);
    if (expandedId === row.stat.id) setExpandedId(null);
    refresh();
  };

  const handleUnlink = (row: PillarRow) => {
    setPotentialStatArea(row.stat.id, null);
    refresh();
  };

  const handleLinkDomain = (statId: string, domainId: string) => {
    setPotentialStatArea(statId, domainId);
    setLinkingId(null);
    refresh();
  };

  const handleAddSuggested = (title: string) => {
    createPotentialStat(title);
    refresh();
  };

  const areas = getItemsByType('area');
  const existingTitles = new Set(rows.map((r) => r.stat.title.toLowerCase()));
  const suggestions = SUGGESTED_PILLARS.flatMap((g) => g.pillars).filter(
    (t) => !existingTitles.has(t.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pillars</Text>
        <Text style={styles.count}>{rows.length > 0 ? rows.length : ''}</Text>
      </View>

      <View style={styles.captureRow}>
        <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
        <TextInput
          value={captureText}
          onChangeText={setCaptureText}
          onSubmitEditing={submit}
          placeholder="Add a Pillar..."
          placeholderTextColor={webColors.mutedForeground}
          style={styles.captureInput}
        />
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestionsRow}>
          <Text style={styles.suggestionsLabel}>Suggested:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {suggestions.slice(0, 8).map((s) => (
              <Pressable key={s} style={styles.chip} onPress={() => handleAddSuggested(s)}>
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {rows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Pillars yet</Text>
            <Text style={styles.emptyBody}>
              Pillars are optional maintenance areas (mostly Health & Fitness) like Sleep, Hydration, Strength.
            </Text>
          </View>
        ) : (
          rows.map((row) => {
            const percent = Math.round(row.result.percent);
            const expanded = expandedId === row.stat.id;
            const isEditing = editingId === row.stat.id;
            const isLinking = linkingId === row.stat.id;
            return (
              <View key={row.stat.id} style={styles.card}>
                <Pressable
                  style={styles.cardHeader}
                  onPress={() => setExpandedId(expanded ? null : row.stat.id)}
                >
                  <View style={styles.expandIcon}>
                    {expanded
                      ? <ChevronDown size={14} color={webColors.mutedForeground} strokeWidth={2} />
                      : <ChevronRight size={14} color={webColors.mutedForeground} strokeWidth={2} />}
                  </View>
                  <View style={styles.cardMeta}>
                    {isEditing ? (
                      <TextInput
                        value={editingTitle}
                        onChangeText={setEditingTitle}
                        onBlur={() => submitEdit(row.stat.id)}
                        onSubmitEditing={() => submitEdit(row.stat.id)}
                        autoFocus
                        style={styles.inlineInput}
                      />
                    ) : (
                      <Text style={styles.cardTitle} numberOfLines={1}>{row.stat.title}</Text>
                    )}
                    <Text style={styles.cardDomain}>{row.domainTitle ?? 'Unlinked'}</Text>
                  </View>
                  <View style={styles.cardStats}>
                    <Text style={styles.cardPercent}>{percent}%</Text>
                    <Text style={styles.cardHabitCount}>
                      {row.result.contributions.length} {row.result.contributions.length === 1 ? 'habit' : 'habits'}
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${percent}%` as any }]} />
                </View>

                {expanded && (
                  <View style={styles.expandedContent}>
                    {row.result.contributions.length > 0 ? (
                      <View style={styles.contributions}>
                        {row.result.contributions.map((c) => (
                          <View key={c.habitId} style={styles.contributionRow}>
                            <Text style={styles.contributionTitle} numberOfLines={1}>{c.habitTitle}</Text>
                            <Text style={styles.contributionPercent}>{Math.round(c.percent)}%</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.noContributions}>No habits assigned to this Pillar yet.</Text>
                    )}

                    <View style={styles.actions}>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => { setEditingId(row.stat.id); setEditingTitle(row.stat.title); }}
                      >
                        <Text style={styles.actionBtnText}>Rename</Text>
                      </Pressable>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => setLinkingId(isLinking ? null : row.stat.id)}
                      >
                        <Text style={styles.actionBtnText}>
                          {row.domainTitle ? 'Change Domain' : 'Link Domain'}
                        </Text>
                      </Pressable>
                      {row.domainTitle && (
                        <Pressable style={styles.actionBtn} onPress={() => handleUnlink(row)}>
                          <Text style={styles.actionBtnText}>Unlink</Text>
                        </Pressable>
                      )}
                      <Pressable style={[styles.actionBtn, styles.actionBtnDestructive]} onPress={() => handleDelete(row)}>
                        <Text style={styles.actionBtnTextDestructive}>Delete</Text>
                      </Pressable>
                    </View>

                    {isLinking && (
                      <View style={styles.domainPicker}>
                        <Text style={styles.domainPickerLabel}>Link to Domain:</Text>
                        {areas.map((area) => (
                          <Pressable
                            key={area.id}
                            style={[styles.domainOption, row.domainId === area.id && styles.domainOptionActive]}
                            onPress={() => handleLinkDomain(row.stat.id, area.id)}
                          >
                            <Text style={[styles.domainOptionText, row.domainId === area.id && styles.domainOptionTextActive]}>
                              {area.title}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: webColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[4],
    paddingHorizontal: webSpacing[5],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[3],
  },
  title: { fontSize: webFontSize.xl, fontWeight: '700', color: webColors.foreground },
  count: { fontSize: webFontSize.base, color: webColors.mutedForeground },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    marginHorizontal: webSpacing[5],
    marginBottom: webSpacing[3],
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
    backgroundColor: webColors.card,
    ...webDepth.list,
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    outlineStyle: 'none',
  } as any,
  suggestionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[5],
    marginBottom: webSpacing[3],
  },
  suggestionsLabel: { fontSize: webFontSize.xs, color: webColors.mutedForeground, flexShrink: 0 },
  chips: { flexDirection: 'row', gap: webSpacing[1] },
  chip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: 4,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.pill,
  },
  chipText: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
  list: { flex: 1 },
  listContent: { paddingHorizontal: webSpacing[5], paddingBottom: webSpacing[6], gap: webSpacing[3] },
  emptyState: { paddingTop: 64, alignItems: 'center', paddingHorizontal: webSpacing[6] },
  emptyTitle: { fontSize: webFontSize.lg, fontWeight: '600', color: webColors.foreground, marginBottom: webSpacing[3], textAlign: 'center' },
  emptyBody: { fontSize: webFontSize.sm, color: webColors.mutedForeground, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: webColors.card,
    overflow: 'hidden',
    ...webDepth.list,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
    gap: webSpacing[3],
  },
  expandIcon: { width: 16, alignItems: 'center' },
  cardMeta: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  cardDomain: { fontSize: webFontSize.xs, color: webColors.mutedForeground, marginTop: 2 },
  inlineInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    padding: 0,
    outlineStyle: 'none',
  } as any,
  cardStats: { alignItems: 'flex-end', flexShrink: 0 },
  cardPercent: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  cardHabitCount: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
  progressTrack: {
    height: 4,
    backgroundColor: webColors.muted,
    marginHorizontal: webSpacing[4],
    marginBottom: webSpacing[3],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: webColors.primary,
    borderRadius: 2,
  },
  expandedContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingTop: webSpacing[3],
    paddingBottom: webSpacing[4],
    gap: webSpacing[3],
  },
  contributions: { gap: 4 },
  contributionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contributionTitle: { fontSize: webFontSize.xs, color: webColors.mutedForeground, flex: 1, marginRight: 8 },
  contributionPercent: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
  noContributions: { fontSize: webFontSize.xs, color: webColors.mutedForeground, fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: webSpacing[1] },
  actionBtn: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: 4,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
  },
  actionBtnText: { fontSize: webFontSize.xs, color: webColors.foreground },
  actionBtnDestructive: { backgroundColor: 'transparent' },
  actionBtnTextDestructive: { fontSize: webFontSize.xs, color: webColors.destructive },
  domainPicker: { gap: webSpacing[1] },
  domainPickerLabel: { fontSize: webFontSize.xs, color: webColors.mutedForeground, marginBottom: 4 },
  domainOption: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: 6,
    borderRadius: webRadius.sm,
    backgroundColor: webColors.muted,
  },
  domainOptionActive: { backgroundColor: webColors.primary },
  domainOptionText: { fontSize: webFontSize.xs, color: webColors.foreground },
  domainOptionTextActive: { color: webColors.background, fontWeight: '600' },
});
