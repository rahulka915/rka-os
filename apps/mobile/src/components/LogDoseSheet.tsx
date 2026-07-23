import { useState } from 'react';
import { TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack, XStack, Text, Input, View } from 'tamagui';
import { getMedicationLogs, deleteMedicationLog, editMedicationLog, resumeMedicationTimer, getPersistentMedicationTimers, pauseMedicationTimer, stopMedicationTimer, resetMedicationTimer } from '../db/database';
import type { ActivityLog } from '../db/types';
import { X, Clock, Calendar, Trash2, Pencil, Check, PlayCircle, StopCircle, Pause, TimerReset } from '../icons';
import { MedicationBottleIcon } from './icons/MedicationBottleIcon';
import { BottomSheet } from './ui/BottomSheet';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { presentMedicationTimer } from '../utils/timerPresentation';

interface LogDoseSheetProps {
  visible: boolean;
  medicationName: string;
  medicationId: string;
  onClose: () => void;
  onLog: (takenAt: number, startTimer?: boolean) => void;
}

type Mode = 'relative' | 'exact';

type MedicationLogDetails = {
  timerActive?: boolean;
  startedAt?: number;
  stoppedAt?: number;
  notified?: boolean;
};

function parseLogDetails(details?: string | null): MedicationLogDetails {
  if (!details) return {};
  try {
    return JSON.parse(details) as MedicationLogDetails;
  } catch {
    return {};
  }
}

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (hrs > 23) return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
  if (hrs > 0) return `${timeStr} · ${hrs}h ${mins % 60}m ago`;
  return `${timeStr} · ${mins}m ago`;
}

function parseTimeInput(hours: string, minutes: string, mode: Mode, exactHour: string, exactMin: string): number | null {
  if (mode === 'relative') {
    const h = parseFloat(hours || '0');
    const m = parseFloat(minutes || '0');
    if (h === 0 && m === 0) return null;
    return Date.now() - (h * 3600000) - (m * 60000);
  }

  const h = parseInt(exactHour);
  const m = parseInt(exactMin || '0');
  if (isNaN(h) || h < 0 || h > 23) return null;
  if (isNaN(m) || m < 0 || m > 59) return null;

  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
  return d.getTime();
}

function LogEntry({
  log,
  medicationId,
  onChanged,
  isDark,
}: {
  log: ActivityLog;
  medicationId: string;
  onChanged: () => void;
  isDark: boolean;
}) {
  const palette = getThemeColors(isDark);
  const [editing, setEditing] = useState(false);
  const [editHour, setEditHour] = useState(String(new Date(log.timestamp).getHours()));
  const [editMin, setEditMin] = useState(String(new Date(log.timestamp).getMinutes()).padStart(2, '0'));
  const details = parseLogDetails(log.details);
  const isTimerActive = Boolean(details.timerActive && (details.startedAt ?? log.timestamp));

  const handleDelete = () => {
    Alert.alert('Remove dose', `Remove the dose logged at ${formatLogTime(log.timestamp)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteMedicationLog(log.id, medicationId);
          onChanged();
        },
      },
    ]);
  };

  const handleSaveEdit = () => {
    const h = parseInt(editHour);
    const m = parseInt(editMin || '0');
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
      Alert.alert('Invalid time', 'Enter a valid hour (0–23) and minute (0–59).');
      return;
    }
    const d = new Date(log.timestamp);
    d.setHours(h, m, 0, 0);
    if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    editMedicationLog(log.id, medicationId, d.getTime());
    setEditing(false);
    onChanged();
  };

  const handleResumeTimer = () => {
    Alert.alert('Resume timer', `Start a timer from the ${formatLogTime(log.timestamp)} dose of this medication?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resume',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          resumeMedicationTimer(log.id, medicationId);
          onChanged();
        },
      },
    ]);
  };

  if (editing) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$2">
        <View width={6} height={6} borderRadius="$6" backgroundColor="$blue" flexShrink={0} />
        <XStack flex={1} alignItems="center" gap="$1">
          <View backgroundColor="$surface" borderRadius="$2" borderWidth={0.5} borderColor="$separator" paddingHorizontal="$2" width={44}>
            <Input unstyled fontSize="$2" color="$text" paddingVertical={4} keyboardType="numeric" value={editHour} onChangeText={setEditHour} selectTextOnFocus keyboardAppearance={isDark ? 'dark' : 'light'} />
          </View>
          <Text fontSize="$2" color="$textSecondary">:</Text>
          <View backgroundColor="$surface" borderRadius="$2" borderWidth={0.5} borderColor="$separator" paddingHorizontal="$2" width={44}>
            <Input unstyled fontSize="$2" color="$text" paddingVertical={4} keyboardType="numeric" value={editMin} onChangeText={setEditMin} selectTextOnFocus keyboardAppearance={isDark ? 'dark' : 'light'} />
          </View>
        </XStack>
        <TouchableOpacity onPress={handleSaveEdit} style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center' }} hitSlop={8}>
          <Check size={14} color="white" strokeWidth={3} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEditing(false)} style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: palette.fill, alignItems: 'center', justifyContent: 'center' }} hitSlop={8}>
          <X size={14} color={palette.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </XStack>
    );
  }

  return (
    <XStack alignItems="center" gap="$2" paddingVertical="$1">
      <View width={6} height={6} borderRadius="$6" backgroundColor="$blue" flexShrink={0} />
      <Text flex={1} fontSize="$2" color="$textSecondary">{formatLogTime(log.timestamp)}</Text>
      {!isTimerActive && (
        <TouchableOpacity onPress={handleResumeTimer} hitSlop={10} style={{ padding: 6 }}>
          <PlayCircle size={13} color={palette.blue} strokeWidth={1.5} />
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditing(true); }} hitSlop={10} style={{ padding: 6 }}>
        <Pencil size={13} color={palette.textTertiary} strokeWidth={1.5} />
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDelete} hitSlop={10} style={{ padding: 6 }}>
        <Trash2 size={13} color={palette.red} strokeWidth={1.5} />
      </TouchableOpacity>
    </XStack>
  );
}

export function LogDoseSheet({ visible, medicationName, medicationId, onClose, onLog }: LogDoseSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [mode, setMode] = useState<Mode>('relative');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [exactHour, setExactHour] = useState('');
  const [exactMin, setExactMin] = useState('');
  const [, setTick] = useState(0);

  const recentLogs: ActivityLog[] = visible ? getMedicationLogs(medicationId, 10) : [];
  const activeTimer = visible
    ? getPersistentMedicationTimers()
        .filter((timer) => timer.med.id === medicationId)
        .map((timer) => presentMedicationTimer(timer, Date.now()))[0]
    : null;
  const refresh = () => setTick((tick) => tick + 1);

  const handleLog = (startTimer = false) => {
    const ts = parseTimeInput(hours, minutes, mode, exactHour, exactMin);
    if (!ts) {
      Alert.alert('Invalid time', mode === 'relative' ? 'Enter hours or minutes ago.' : 'Enter a valid hour (0–23).');
      return;
    }

    const timeStr = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    Alert.alert('Log dose', `Record ${medicationName} taken at ${timeStr}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onLog(ts, startTimer);
          setHours('');
          setMinutes('');
          setExactHour('');
          setExactMin('');
          onClose();
        },
      },
    ]);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      contentContainerStyle={{ flex: 0, paddingHorizontal: 0 }}
      title={medicationName}
      subtitle="Dose Log"
      headerLeft={
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text fontSize={16} color="$textSecondary" fontWeight="400">Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={() => handleLog(false)} hitSlop={12}>
          <Text fontSize={16} color="$blue" fontWeight="600">Log</Text>
        </TouchableOpacity>
      }
    >
      <YStack>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
        >
          {activeTimer ? (
            <YStack
              marginHorizontal="$4"
              marginBottom="$4"
              backgroundColor="$surface"
              borderRadius="$4"
              padding="$4"
              gap="$3"
              borderWidth={0.5}
              borderColor="$separator"
            >
              <XStack alignItems="center" gap="$3">
                <View width={36} height={36} borderRadius="$6" backgroundColor="$blueSoft" alignItems="center" justifyContent="center">
                  <MedicationBottleIcon size={20} />
                </View>
                <YStack flex={1} gap={2}>
                  <Text fontSize="$3" fontWeight="700" color="$text">
                    {activeTimer.isPaused ? 'Timer paused' : 'Timer running'}
                  </Text>
                  <Text fontSize="$2" color="$textSecondary">
                    {activeTimer.isPaused ? `Paused at ${activeTimer.compactElapsedLabel}` : activeTimer.isReady ? 'Ready for next dose' : activeTimer.elapsedLabel}
                  </Text>
                </YStack>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (activeTimer.isPaused) {
                      resumeMedicationTimer(activeTimer.log.id, medicationId);
                    } else {
                      pauseMedicationTimer(activeTimer.log.id, medicationId);
                    }
                    refresh();
                  }}
                  style={{ height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: palette.fillStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                >
                  {activeTimer.isPaused
                    ? <PlayCircle size={14} color={palette.blue} strokeWidth={1.8} />
                    : <Pause size={14} color={palette.textSecondary} strokeWidth={1.8} />
                  }
                  <Text fontSize="$2" fontWeight="700" color={activeTimer.isPaused ? '$blue' : '$textSecondary'}>
                    {activeTimer.isPaused ? 'Resume' : 'Pause'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    resetMedicationTimer(activeTimer.log.id, medicationId);
                    refresh();
                  }}
                  style={{ height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: palette.fill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                >
                  <TimerReset size={14} color={palette.textSecondary} strokeWidth={1.8} />
                  <Text fontSize="$2" fontWeight="700" color="$textSecondary">Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    stopMedicationTimer(activeTimer.log.id, medicationId);
                    refresh();
                  }}
                  style={{ height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: palette.redSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                >
                  <StopCircle size={14} color={palette.red} strokeWidth={1.8} />
                  <Text fontSize="$2" fontWeight="700" color="$red">Stop</Text>
                </TouchableOpacity>
              </XStack>
              <Text fontSize={11} fontWeight="600" color="$textTertiary">
                Logging another dose can start a fresh timer, and older dose entries can still resume one from history.
              </Text>
            </YStack>
          ) : null}

          <XStack marginHorizontal="$4" marginBottom="$4" backgroundColor="$fill" borderRadius="$3" padding={3} gap={2}>
            {(['relative', 'exact'] as Mode[]).map((nextMode) => (
              <TouchableOpacity
                key={nextMode}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode(nextMode); }}
                style={{ flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: mode === nextMode ? palette.surface : 'transparent' }}
              >
                <XStack alignItems="center" gap="$1">
                  {nextMode === 'relative'
                    ? <Clock size={13} color={mode === nextMode ? palette.blue : palette.textSecondary} />
                    : <Calendar size={13} color={mode === nextMode ? palette.blue : palette.textSecondary} />
                  }
                  <Text fontSize={13} fontWeight="600" color={mode === nextMode ? '$blue' : '$textSecondary'}>
                    {nextMode === 'relative' ? 'How long ago' : 'Exact time'}
                  </Text>
                </XStack>
              </TouchableOpacity>
            ))}
          </XStack>

          <YStack paddingHorizontal="$4" gap="$3">
            {mode === 'relative' ? (
              <XStack gap="$3">
                {[
                  { label: 'Hours ago', val: hours, set: setHours },
                  { label: 'Minutes ago', val: minutes, set: setMinutes },
                ].map(({ label, val, set }) => (
                  <YStack key={label} flex={1} gap="$1">
                    <Text fontSize="$2" fontWeight="600" color="$textSecondary">{label}</Text>
                    <View backgroundColor="$surface" borderRadius="$3" borderWidth={0.5} borderColor="$separator" paddingHorizontal="$3">
                      <Input unstyled fontSize="$3" color="$text" paddingVertical="$3" placeholder="0" placeholderTextColor={palette.textTertiary} keyboardType="numeric" value={val} onChangeText={set} keyboardAppearance={isDark ? 'dark' : 'light'} />
                    </View>
                  </YStack>
                ))}
              </XStack>
            ) : (
              <XStack gap="$3" alignItems="flex-end">
                <YStack flex={1} gap="$1">
                  <Text fontSize="$2" fontWeight="600" color="$textSecondary">Hour (0–23)</Text>
                  <View backgroundColor="$surface" borderRadius="$3" borderWidth={0.5} borderColor="$separator" paddingHorizontal="$3">
                    <Input unstyled fontSize="$3" color="$text" paddingVertical="$3" placeholder="14" placeholderTextColor={palette.textTertiary} keyboardType="numeric" value={exactHour} onChangeText={setExactHour} keyboardAppearance={isDark ? 'dark' : 'light'} />
                  </View>
                </YStack>
                <Text fontSize="$5" fontWeight="700" color="$textSecondary" paddingBottom="$3">:</Text>
                <YStack flex={1} gap="$1">
                  <Text fontSize="$2" fontWeight="600" color="$textSecondary">Minute</Text>
                  <View backgroundColor="$surface" borderRadius="$3" borderWidth={0.5} borderColor="$separator" paddingHorizontal="$3">
                    <Input unstyled fontSize="$3" color="$text" paddingVertical="$3" placeholder="30" placeholderTextColor={palette.textTertiary} keyboardType="numeric" value={exactMin} onChangeText={setExactMin} keyboardAppearance={isDark ? 'dark' : 'light'} />
                  </View>
                </YStack>
              </XStack>
            )}
          </YStack>

          <XStack gap="$3" paddingHorizontal="$4" marginTop="$5" paddingBottom="$3">
            <TouchableOpacity onPress={() => handleLog(false)} style={{ flex: 1, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.fillStrong, borderRadius: 14 }}>
              <Text fontSize="$3" fontWeight="600" color="$textSecondary">Log only</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleLog(true)} style={{ flex: 1, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.text, borderRadius: 14 }}>
              <Text fontSize="$3" fontWeight="700" color={isDark ? '#0d0d0d' : 'white'}>Log + Timer</Text>
            </TouchableOpacity>
          </XStack>

          {recentLogs.length > 0 && (
            <YStack marginHorizontal="$4" marginTop="$5" gap="$1">
              <YStack marginBottom="$1">
                <Text fontSize="$2" fontWeight="700" color="$textSecondary">
                  DOSE HISTORY
                </Text>
                <Text fontSize={11} color="$textTertiary">
                  Tap resume on a prior dose if you want the timer to continue from that exact taken time.
                </Text>
              </YStack>
              <YStack backgroundColor="$surface" borderRadius="$3" paddingHorizontal="$3" paddingVertical="$1">
                {recentLogs.map((log, index) => (
                  <View key={log.id}>
                    {index > 0 && <View height={0.5} backgroundColor="$separator" />}
                    <LogEntry log={log} medicationId={medicationId} onChanged={refresh} isDark={isDark} />
                  </View>
                ))}
              </YStack>
            </YStack>
          )}
        </ScrollView>
      </YStack>
    </BottomSheet>
  );
}
