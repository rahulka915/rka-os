import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMedications } from '../../hooks/useDb';
import { computeMedicationEligibility } from '../../utils/medicationState';
import { showActionSheet } from '../../utils/actionSheet';
import { computeMinutesUntilNextDose, promptTooSoonOverride } from '../../utils/medicationOverride';
import { MedicationBottleIcon } from '../icons/MedicationBottleIcon';
import { RiverStoneSurface } from '../riverstone';
import { getThemeColors } from '../../theme';
import type { Item } from '../../db/types';

interface MedicationQuickLogWidgetProps {
  isDark: boolean;
}

// Home-screen shortcut so logging a dose never requires navigating to the
// Medications screen: tap the card, pick a medication from an action sheet,
// confirm in the same Take / Take + Timer / Take Half alert
// MedicationsScreen's TodayRow already uses. Reuses useMedications()
// directly (not passed as props) so it's a true drop-in — HomeScreen doesn't
// need to know anything about medications to render it.
export function MedicationQuickLogWidget({ isDark }: MedicationQuickLogWidgetProps) {
  const { medications, takeMedication, takeHalfDose } = useMedications();
  const palette = getThemeColors(isDark);

  if (medications.length === 0) return null;

  const promptTake = (item: Item) => {
    const { meta, lastLog, stock, canTake, hasPendingHalf } = computeMedicationEligibility(item);

    if (meta.containers !== undefined || meta.stockRemaining !== undefined) {
      if (stock === 0) {
        Alert.alert('Out of stock', 'No doses remaining.', [{ text: 'OK' }]);
        return;
      }
    }

    const canTakeHalf = !!meta.splitDoseEnabled && !hasPendingHalf;
    const confirmTake = (overrideReason?: string) => {
      Alert.alert(`Take ${item.title}`, meta.dose ?? 'Record dose?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); takeMedication(item.id, undefined, false, overrideReason); } },
        { text: 'Take + Timer', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); takeMedication(item.id, undefined, true, overrideReason); } },
        ...(canTakeHalf ? [{ text: 'Take Half', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); takeHalfDose(item.id, undefined, false); } }] : []),
      ]);
    };

    // Too-soon is a caution, not a hard block — Override requires a typed
    // reason that travels with the dose log, same as MedicationsScreen.
    if (!canTake) {
      const minsLeft = computeMinutesUntilNextDose(meta.minHoursBetweenDoses!, lastLog!.timestamp);
      promptTooSoonOverride(minsLeft, (reason) => confirmTake(reason));
      return;
    }

    confirmTake();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showActionSheet(
      'Log Medication',
      medications.map((item) => {
        const meta = item.metadata ? JSON.parse(item.metadata) : {};
        return {
          label: `${item.title}${meta.dose ? ` ${meta.dose}` : ''}`,
          onPress: () => promptTake(item),
        };
      }),
    );
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={styles.touchWrap}>
      <RiverStoneSurface variant="card" mode={isDark ? 'dark' : 'light'} style={styles.squareCard} contentStyle={styles.fill}>
        <View style={styles.content}>
          <MedicationBottleIcon size={26} />
          <Text style={[styles.primaryText, { color: palette.text }]} numberOfLines={2}>
            Log Medication
          </Text>
        </View>
      </RiverStoneSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchWrap: {
    paddingVertical: 4,
  },
  fill: {
    flex: 1,
  },
  squareCard: {
    aspectRatio: 1.16,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  primaryText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
});
