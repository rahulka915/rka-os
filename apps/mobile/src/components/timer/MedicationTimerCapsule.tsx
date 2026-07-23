import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronDown, Pause, Play } from '../../icons';
import { getThemeColors } from '../../theme';
import type { PresentedMedicationTimer } from '../../utils/timerPresentation';

interface Props {
  timer: PresentedMedicationTimer;
  additionalCount: number;
  isDark: boolean;
  onOpen: () => void;
  onTogglePause: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onLongPress: () => void;
  minimized: boolean;
}

export function MedicationTimerCapsule({
  timer,
  additionalCount,
  isDark,
  onOpen,
  onTogglePause,
  onMinimize,
  onRestore,
  onLongPress,
  minimized,
}: Props) {
  const palette = getThemeColors(isDark);

  if (minimized) {
    return (
      <TouchableOpacity
        style={[styles.minimized, { backgroundColor: palette.surfaceRaised, borderColor: palette.separatorStrong }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onRestore();
        }}
        onLongPress={onLongPress}
        delayLongPress={350}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`Restore ${timer.title} stopwatch, ${timer.compactElapsedLabel}`}
        accessibilityHint="Long press for stopwatch options"
      >
        <View style={[styles.dot, { backgroundColor: timer.isPaused ? palette.orange : palette.blue }]} />
        <Text style={[styles.minimizedElapsed, { color: palette.text }]}>{timer.compactElapsedLabel}</Text>
        {additionalCount > 0 ? <Text style={[styles.minimizedCount, { color: palette.textMuted }]}>+{additionalCount}</Text> : null}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.shell, { backgroundColor: palette.surfaceRaised, borderColor: palette.separatorStrong }]}>
      <TouchableOpacity
        style={styles.copy}
        onPress={onOpen}
        onLongPress={onLongPress}
        delayLongPress={350}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`Open ${timer.title} stopwatch, ${timer.compactElapsedLabel}`}
        accessibilityHint="Long press for stopwatch options"
      >
        <View style={[styles.dot, { backgroundColor: timer.isPaused ? palette.orange : palette.blue }]} />
        <View style={styles.labels}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{timer.title}</Text>
          {additionalCount > 0 ? (
            <Text style={[styles.more, { color: palette.textMuted }]}>+{additionalCount} more</Text>
          ) : null}
        </View>
        <Text style={[styles.elapsed, { color: palette.text }]}>{timer.compactElapsedLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.minimizeAction}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onMinimize();
        }}
        accessibilityRole="button"
        accessibilityLabel="Minimize stopwatch"
      >
        <ChevronDown size={16} color={palette.textMuted} strokeWidth={2.2} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: palette.fillStrong }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onTogglePause();
        }}
        accessibilityRole="button"
        accessibilityLabel={timer.isPaused ? 'Resume stopwatch' : 'Pause stopwatch'}
      >
        {timer.isPaused
          ? <Play size={17} color={palette.blue} strokeWidth={2.2} />
          : <Pause size={17} color={palette.textSecondary} strokeWidth={2.2} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: 332,
    minHeight: 58,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  minimized: {
    minWidth: 112,
    height: 44,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  minimizedElapsed: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  minimizedCount: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  copy: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  labels: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  more: { fontSize: 10, fontWeight: '500', fontFamily: 'Inter_500Medium', marginTop: 1 },
  elapsed: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  minimizeAction: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  action: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
