import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';

interface SetLogRowProps {
  setNumber: number;
  initialReps?: string;
  initialWeight?: string;
  onLog: (reps: number, weight: number) => void;
}

export function SetLogRow({ setNumber, initialReps, initialWeight, onLog }: SetLogRowProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [reps, setReps] = useState(initialReps ?? '');
  const [weight, setWeight] = useState(initialWeight ?? '');

  const repsNum = Number(reps);
  const weightNum = Number(weight);
  const canLog = reps.trim() !== '' && weight.trim() !== '' && Number.isFinite(repsNum) && repsNum > 0 && Number.isFinite(weightNum) && weightNum >= 0;

  const handleLog = () => {
    if (!canLog) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLog(repsNum, weightNum);
    setReps('');
    setWeight('');
  };

  return (
    <View style={styles.row}>
      <Text style={[styles.setNumber, { color: palette.textTertiary }]}>{setNumber}</Text>
      <TextInput
        style={[styles.input, { color: palette.text, borderColor: palette.separator }]}
        placeholder="Reps"
        placeholderTextColor={palette.textTertiary}
        value={reps}
        onChangeText={setReps}
        keyboardType="number-pad"
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />
      <TextInput
        style={[styles.input, { color: palette.text, borderColor: palette.separator }]}
        placeholder="kg"
        placeholderTextColor={palette.textTertiary}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />
      <TouchableOpacity
        style={[styles.logButton, { backgroundColor: canLog ? palette.deeperBlue : palette.fill }]}
        onPress={handleLog}
        disabled={!canLog}
        hitSlop={8}
      >
        <Text style={[styles.logButtonText, { color: canLog ? '#ffffff' : palette.textTertiary }]}>Log</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setNumber: { width: 20, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, fontSize: 15, paddingVertical: 8, paddingHorizontal: 10 },
  logButton: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, justifyContent: 'center' },
  logButtonText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
