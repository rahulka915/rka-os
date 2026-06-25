import { useState } from 'react';
import { TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack, XStack, Text, Input, View } from 'tamagui';
import { getMedicationLogs, deleteMedicationLog, editMedicationLog, resumeMedicationTimer } from '../db/database';
import type { ActivityLog } from '../db/types';
import { X, Clock, Calendar, Trash2, Pencil, Check, PlayCircle } from '../icons';
import { BottomSheet } from './ui/BottomSheet';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';

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
            <Input unstyled fontSize="$2" color="$text" paddingVertical={4} keyboardType="numeric" value={editHour} onChangeText={setEditHour} selectTextOnFocus autoFocus />
          </View>
          <Text fontSize="$2" color="$textSecondary">:</Text>
          <View backgroundColor="$surface" borderRadius="$2" borderWidth={0.5} borderColor="$separator" paddingHorizontal="$2" width={44}>
            <Input unstyled fontSize="$2" color="$text" paddingVertical={4} keyboardType="numeric" value={editMin} onChangeText={setEditMin} selectTextOnFocus />
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
      <YStack backgroundColor="$bg">
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
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
                  { label: 'Hours ago', val: hours, set: setHours, auto: true },
                  { label: 'Minutes ago', val: minutes, set: setMinutes, auto: false },
                ].map(({ label, val, set, auto }) => (
                  <YStack key={label} flex={1} gap="$1">
                    <Text fontSize="$2" fontWeight="600" color="$textSecondary">{label}</Text>
                    <View backgroundColor="$surface" borderRadius="$3" borderWidth={0.5} borderColor="$separator" paddingHorizontal="$3">
                      <Input unstyled fontSize="$3" color="$text" paddingVertical="$3" placeholder="0" placeholderTextColor={palette.textTertiary} keyboardType="numeric" value={val} onChangeText={set} autoFocus={auto} />
                    </View>
                  </YStack>
                ))}
              </XStack>
            ) : (
              <XStack gap="$3" alignItems="flex-end">
                <YStack flex={1} gap="$1">
                  <Text fontSize="$2" fontWeight="600" color="$textSecondary">Hour (0–23)</Text>
                  <View backgroundColor="$surface" borderRadius="$3" borderWidth={0.5} borderColor="$separator" paddingHorizontal="$3">
                    <Input unstyled fontSize="$3" color="$text" paddingVertical="$3" placeholder="14" placeholderTextColor={palette.textTertiary} keyboardType="numeric" value={exactHour} onChangeText={setExactHour} autoFocus />
                  </View>
                </YStack>
                <Text fontSize="$5" fontWeight="700" color="$textSecondary" paddingBottom="$3">:</Text>
                <YStack flex={1} gap="$1">
                  <Text fontSize="$2" fontWeight="600" color="$textSecondary">Minute</Text>
                  <View backgroundColor="$surface" borderRadius="$3" borderWidth={0.5} borderColor="$separator" paddingHorizontal="$3">
                    <Input unstyled fontSize="$3" color="$text" paddingVertical="$3" placeholder="30" placeholderTextColor={palette.textTertiary} keyboardType="numeric" value={exactMin} onChangeText={setExactMin} />
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
              <Text fontSize="$2" fontWeight="700" color="$textSecondary" marginBottom="$1">
                DOSE HISTORY
              </Text>
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
