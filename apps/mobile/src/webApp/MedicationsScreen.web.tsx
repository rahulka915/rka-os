import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pencil, Plus } from 'lucide-react-native';
import {
  getMedications,
  createMedication,
  logMedicationTaken,
  logHalfDoseTaken,
  getTotalStock,
  getContainerSummary,
  getMedicationDoseHistory,
  restockMedication,
} from '../db/database';
import { useDbRefresh } from '../hooks/useDb';
import { DetailPanel } from './DetailPanel';
import { MedicationLogPanel } from './MedicationLogPanel';
import { MedicationEditForm } from './MedicationEditForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { MedicationMeta } from '../db/database';
import type { Item } from '../db/types';

function parseMetadata(item: Item): MedicationMeta {
  if (!item.metadata) return {};
  try {
    return JSON.parse(item.metadata) as MedicationMeta;
  } catch {
    return {};
  }
}

function isTrackingStock(meta: MedicationMeta): boolean {
  return !!meta.containers || meta.stockRemaining !== undefined;
}

function timeSinceLabel(lastTakenAt: number | undefined, now: number): string {
  if (!lastTakenAt) return 'Never taken';
  const diffMs = now - lastTakenAt;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

function useMedications() {
  const [medications, setMedications] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setMedications(getMedications());
  }, []);
  useDbRefresh(refresh);
  return { medications, refresh };
}

export function MedicationsScreen() {
  const { medications, refresh } = useMedications();
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const selectedItem = medications.find((i) => i.id === selectedId) ?? null;
  const editingItem = medications.find((i) => i.id === editingId) ?? null;

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createMedication(trimmed, {});
    setCaptureText('');
    refresh();
  };

  const take = (item: Item, withTimer: boolean) => {
    const meta = parseMetadata(item);
    if (meta.splitDoseEnabled && meta.pendingHalfDoseAt) {
      logHalfDoseTaken(item.id, Date.now(), withTimer);
    } else {
      logMedicationTaken(item.id, Date.now(), withTimer);
    }
    refresh();
  };

  const restock = (item: Item) => {
    const meta = parseMetadata(item);
    const label = meta.containerLabel || 'container';
    const promptText = meta.containerSize
      ? `How many ${label}s (${meta.containerSize} each)?`
      : 'How many pills?';
    const defaultValue = String(meta.containersPerRestock ?? (meta.containerSize ? 1 : 30));
    const answer = window.prompt(promptText, defaultValue);
    if (!answer) return;
    const count = Number(answer);
    if (!Number.isFinite(count) || count <= 0) return;
    restockMedication(item.id, count);
    refresh();
  };

  const needsAttention = medications.filter((item) => {
    const meta = parseMetadata(item);
    return isTrackingStock(meta) && getTotalStock(meta) <= (meta.refillThreshold ?? 5);
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Medications</Text>
          <Text style={styles.count}>{medications.length}</Text>
        </View>

        <View style={styles.captureRow}>
          <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
          <TextInput
            value={captureText}
            onChangeText={setCaptureText}
            onSubmitEditing={submit}
            placeholder="Add a medication..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureInput}
          />
        </View>

        {needsAttention.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NEEDS ATTENTION</Text>
            {needsAttention.map((item) => {
              const meta = parseMetadata(item);
              const stock = getTotalStock(meta);
              return (
                <Pressable key={item.id} style={styles.attentionRow} onPress={() => setSelectedId(item.id)}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.attentionSub}>
                      {stock <= 0 ? 'No doses remaining' : `${stock} left — running low`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      restock(item);
                    }}
                    style={styles.restockChip}
                  >
                    <Text style={styles.restockChipText}>Restock</Text>
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TODAY</Text>
          {medications.length === 0 ? (
            <Text style={styles.empty}>No medications yet.</Text>
          ) : (
            medications.map((item) => {
              const meta = parseMetadata(item);
              const summary = getContainerSummary(meta);
              const pendingHalf = !!(meta.splitDoseEnabled && meta.pendingHalfDoseAt);
              return (
                <Pressable key={item.id} style={styles.row} onPress={() => setSelectedId(item.id)}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.rowSub}>
                      {meta.dose ? `${meta.dose} · ` : ''}
                      {timeSinceLabel(meta.lastTakenAt, now)}
                      {summary ? ` · ${summary}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      take(item, false);
                    }}
                    style={styles.takeChip}
                  >
                    <Text style={styles.takeChipText}>{pendingHalf ? 'Take other half' : 'Take'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      setEditingId(item.id);
                    }}
                    style={styles.iconButton}
                  >
                    <Pencil size={14} color={webColors.mutedForeground} strokeWidth={1.75} />
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </View>

        {medications.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>HISTORY</Text>
            {medications.map((item) => {
              const history = getMedicationDoseHistory(item.id, 5);
              return (
                <Pressable key={item.id} style={styles.historyRow} onPress={() => setSelectedId(item.id)}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.dotRow}>
                    {history.map((day) => (
                      <View
                        key={day.date}
                        style={[
                          styles.dot,
                          day.count === 1 && styles.dotLight,
                          day.count >= 2 && styles.dotFull,
                        ]}
                      >
                        {day.count > 0 ? (
                          <Text style={[styles.dotText, day.count >= 2 && styles.dotTextFull]}>{day.count}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title={selectedItem?.title ?? 'Medication'}>
        {selectedItem ? <MedicationLogPanel item={selectedItem} onChanged={refresh} /> : null}
      </DetailPanel>

      <DetailPanel visible={!!editingItem} onClose={() => setEditingId(null)} title="Edit Medication">
        {editingItem ? (
          <MedicationEditForm
            item={editingItem}
            onChanged={refresh}
            onDeleted={() => {
              setEditingId(null);
              refresh();
            }}
          />
        ) : null}
      </DetailPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  scrollContent: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[8],
    gap: webSpacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  section: {
    gap: webSpacing[2],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    letterSpacing: 0.5,
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: '#FEF3E2',
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: '#F5D8A8',
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  rowSub: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  attentionSub: {
    fontSize: webFontSize.xs,
    color: '#B45309',
    fontWeight: '600',
  },
  takeChip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
  },
  takeChipText: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.card,
  },
  restockChip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.card,
    borderWidth: 1,
    borderColor: '#F5D8A8',
  },
  restockChipText: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: '#B45309',
  },
  iconButton: {
    width: 26,
    height: 26,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  historyTitle: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    flex: 1,
  },
  dotRow: {
    flexDirection: 'row',
    gap: webSpacing[1],
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: webColors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLight: {
    backgroundColor: `${webColors.accent}40`,
  },
  dotFull: {
    backgroundColor: webColors.accent,
  },
  dotText: {
    fontSize: 10,
    fontWeight: '700',
    color: webColors.foreground,
  },
  dotTextFull: {
    color: webColors.card,
  },
});
