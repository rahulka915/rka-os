import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MedicationsScreen } from './MedicationsScreen';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { FolderKanban, Dumbbell, Pill, ChevronRight, X, Disc3 } from '../icons';

export function MenuScreen({ onAudioPlayerPress }: { onAudioPlayerPress: () => void }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [medOpen, setMedOpen] = useState(false);

  const menuItems = [
    { label: 'Audio Player', sub: 'Pick an MP3 and dock it into a mini-player', icon: Disc3, onPress: onAudioPlayerPress },
    { label: 'Projects', sub: 'Manage your projects and tasks', icon: FolderKanban, onPress: () => {} },
    { label: 'Workouts', sub: 'Templates and exercise library', icon: Dumbbell, onPress: () => {} },
    { label: 'Medications', sub: 'Inventory and schedules', icon: Pill, onPress: () => setMedOpen(true) },
  ];

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: palette.textTertiary }]}>APPS</Text>

      {menuItems.map(({ label, sub, icon: Icon, onPress }, i) => (
        <TouchableOpacity
          key={label}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          activeOpacity={0.5}
        >
          <View style={[styles.row, { paddingHorizontal: 16, paddingVertical: 12 }]}>
            <Icon size={16} color={palette.textSecondary} strokeWidth={1.5} />
            <View style={styles.content}>
              <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
              <Text style={[styles.sub, { color: palette.textSecondary }]} numberOfLines={1}>{sub}</Text>
            </View>
            <ChevronRight size={14} color={palette.textMuted} strokeWidth={1.5} />
          </View>
          {i < menuItems.length - 1 && (
            <View style={[styles.sep, { backgroundColor: palette.separator, marginLeft: 40 }]} />
          )}
        </TouchableOpacity>
      ))}

      {/* Medications modal */}
      <Modal visible={medOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMedOpen(false)}>
        <View style={[styles.modalContainer, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMedOpen(false)} hitSlop={12}>
              <X size={16} color={palette.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <MedicationsScreen />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
