import { getLastTakenLog, getTotalStock, type MedicationMeta } from '../db/database';
import type { Item, ActivityLog } from '../db/types';

export interface MedicationEligibility {
  meta: MedicationMeta;
  lastLog: ActivityLog | null;
  stock: number;
  isTrackingStock: boolean;
  isLowStock: boolean;
  canTake: boolean;
  hasPendingHalf: boolean;
}

// Pure — no hooks — so it can be called both from a render (MedicationsScreen's
// useMedState) and at tap-time for an item chosen from an action sheet
// (HomeScreen's MedicationQuickLogWidget), where there is no component render
// to hook into.
export function computeMedicationEligibility(item: Item): MedicationEligibility {
  const meta: MedicationMeta = item.metadata ? JSON.parse(item.metadata) : {};
  const lastLog = getLastTakenLog(item.id);
  const isTrackingStock = meta.containers !== undefined || meta.stockRemaining !== undefined;
  const stock = getTotalStock(meta);
  const threshold = meta.refillThreshold ?? 5;
  const isLowStock = isTrackingStock && stock <= threshold;
  const hasPendingHalf = !!meta.pendingHalfDoseAt;
  const canTake = (() => {
    // Completing an already-started split dose is always allowed — that's the
    // whole point of splitting (no required gap between the two halves).
    if (hasPendingHalf) return true;
    if (!meta.minHoursBetweenDoses || !lastLog) return true;
    return (Date.now() - lastLog.timestamp) / 3600000 >= meta.minHoursBetweenDoses;
  })();
  return { meta, lastLog, stock, isTrackingStock, isLowStock, canTake, hasPendingHalf };
}
