import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { getMedications, createMedication, logMedicationTaken, getTotalStock } from '../db/database';
import { useDbRefresh } from '../hooks/useDb';
import { DetailPanel } from './DetailPanel';
import { MedicationDetailForm } from './MedicationDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

function parseMetadata(item: Item): Record<string, unknown> {
  if (!item.metadata) return {};
  try {
    return JSON.parse(item.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
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
  const selectedItem = medications.find((i) => i.id === selectedId) ?? null;

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createMedication(trimmed, {});
    setCaptureText('');
    refresh();
  };

  const logDose = (item: Item) => {
    logMedicationTaken(item.id);
    refresh();
  };

  return (
    <View style={styles.container}>
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

      <FlatList
        data={medications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No medications yet.</Text>}
        renderItem={({ item }) => {
          const meta = parseMetadata(item);
          const dose = typeof meta.dose === 'string' ? meta.dose : null;
          const stock = getTotalStock(meta as any);
          return (
            <Pressable style={styles.row} onPress={() => setSelectedId(item.id)}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowSub}>
                  {dose ? `${dose} · ` : ''}
                  {stock} remaining
                </Text>
              </View>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  logDose(item);
                }}
                style={styles.logChip}
              >
                <Text style={styles.logChipText}>Log dose</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Medication">
        {selectedItem ? (
          <MedicationDetailForm
            item={selectedItem}
            onChanged={refresh}
            onDeleted={() => {
              setSelectedId(null);
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
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
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
    marginHorizontal: webSpacing[6],
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[4],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
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
  logChip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  logChipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
});
