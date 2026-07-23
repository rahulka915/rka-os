import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '../ui/BottomSheet';
import { Pause, Play, StopCircle, TimerReset } from '../../icons';
import { getThemeColors } from '../../theme';
import { getAutoStopState } from '../../domain/medicationTimer/timerMath';
import type { PresentedMedicationTimer } from '../../utils/timerPresentation';

interface Props {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  timers: PresentedMedicationTimer[];
  onTogglePause: (logId: string, paused: boolean) => void;
  onStop: (logId: string) => void;
  onReset: (logId: string) => void;
}

function remainingLabel(timer: PresentedMedicationTimer) {
  const { remainingMs } = getAutoStopState(timer.details, Date.now());
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `Auto-stops in ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
}

export function MedicationTimerSheet({ visible, onClose, isDark, timers, onTogglePause, onStop, onReset }: Props) {
  const palette = getThemeColors(isDark);
  const primary = timers[0];

  if (!primary) return null;

  const confirmReset = (timer: PresentedMedicationTimer) => {
    Alert.alert('Reset stopwatch?', `${timer.title} will return to 00:00:00.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => onReset(timer.log.id) },
    ]);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} isDark={isDark} title="Stopwatches" scrollable>
      <View style={styles.hero}>
        <Text style={[styles.name, { color: palette.text }]}>{primary.title}</Text>
        <Text style={[styles.time, { color: palette.text }]}>{primary.compactElapsedLabel}</Text>
        <Text style={[styles.status, { color: primary.isPaused ? palette.orange : palette.textSecondary }]}>
          {primary.isPaused ? 'Paused' : `Running · ${remainingLabel(primary)}`}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: palette.blueSoft }]}
            onPress={() => onTogglePause(primary.log.id, primary.isPaused)}
          >
            {primary.isPaused ? <Play size={18} color={palette.blue} /> : <Pause size={18} color={palette.blue} />}
            <Text style={[styles.actionText, { color: palette.blue }]}>{primary.isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: palette.redSoft }]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              onStop(primary.log.id);
            }}
          >
            <StopCircle size={18} color={palette.red} />
            <Text style={[styles.actionText, { color: palette.red }]}>Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.resetButton, { backgroundColor: palette.fill }]} onPress={() => confirmReset(primary)}>
            <TimerReset size={17} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {timers.length > 1 ? <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>OTHER STOPWATCHES</Text> : null}
      {timers.slice(1).map((timer) => (
        <View key={timer.log.id} style={[styles.row, { borderColor: palette.separator }]}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{timer.title}</Text>
            <Text style={[styles.rowTime, { color: palette.textSecondary }]}>{timer.compactElapsedLabel} · {timer.isPaused ? 'Paused' : remainingLabel(timer)}</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => onTogglePause(timer.log.id, timer.isPaused)}>
            {timer.isPaused ? <Play size={16} color={palette.blue} /> : <Pause size={16} color={palette.textSecondary} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => onStop(timer.log.id)}>
            <StopCircle size={17} color={palette.red} />
          </TouchableOpacity>
        </View>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  name: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  time: { fontSize: 42, lineHeight: 50, marginTop: 8, fontWeight: '300', fontFamily: 'Inter_300Light', fontVariant: ['tabular-nums'] },
  status: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
  primaryButton: { flex: 1, minHeight: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  resetButton: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  sectionLabel: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginHorizontal: 16, marginBottom: 8 },
  row: { minHeight: 60, marginHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center' },
  rowCopy: { flex: 1, paddingVertical: 10 },
  rowTitle: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowTime: { fontSize: 11, marginTop: 3, fontVariant: ['tabular-nums'] },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
