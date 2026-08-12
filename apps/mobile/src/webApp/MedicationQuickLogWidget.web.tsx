import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pill } from 'lucide-react-native';
import { getMedications, logMedicationTaken } from '../db/database';
import { webColors, webRadius, webFontSize, webSpacing, webDepth } from '../theme/webTheme';
import type { Item } from '../db/types';

interface MedMeta {
  dose?: string;
  lastTakenAt?: number;
  minHoursBetweenDoses?: number;
}

function parseMeta(item: Item): MedMeta {
  return item.metadata ? JSON.parse(item.metadata) : {};
}

// Compact card version of native's MedicationQuickLogWidget: shows the
// medication most overdue (or least-recently-taken) and lets a single tap
// log it, instead of native's action-sheet-of-all-medications flow — web's
// widget slot is a single square card, not a full picker surface.
export function MedicationQuickLogWidget() {
  const [refreshTick, setRefreshTick] = useState(0);
  const medications = getMedications();

  const target = useCallback(() => {
    if (medications.length === 0) return null;
    return medications.slice().sort((a, b) => {
      const ma = parseMeta(a).lastTakenAt ?? 0;
      const mb = parseMeta(b).lastTakenAt ?? 0;
      return ma - mb;
    })[0];
  }, [medications])();

  if (!target) return null;
  const meta = parseMeta(target);

  const handleTake = () => {
    logMedicationTaken(target.id);
    setRefreshTick((t) => t + 1);
  };

  return (
    <View style={[styles.card, webDepth.card]}>
      <Pill size={20} color={webColors.accent} strokeWidth={2} />
      <Text style={styles.title} numberOfLines={1}>{target.title}</Text>
      {meta.dose ? <Text style={styles.dose} numberOfLines={1}>{meta.dose}</Text> : null}
      <Pressable onPress={handleTake} style={styles.takeButton}>
        <Text style={styles.takeLabel}>Take</Text>
      </Pressable>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  title: { fontSize: webFontSize.xs, fontWeight: '600', color: webColors.foreground, textAlign: 'center' },
  dose: { fontSize: 10, color: webColors.mutedForeground, textAlign: 'center' },
  takeButton: {
    marginTop: 2,
    backgroundColor: webColors.accent,
    borderRadius: webRadius.pill,
    paddingHorizontal: webSpacing[3],
    paddingVertical: 4,
  },
  takeLabel: { fontSize: 11, fontWeight: '700', color: webColors.card },
});
