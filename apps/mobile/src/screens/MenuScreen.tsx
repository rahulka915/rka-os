import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MedicationsScreen } from './MedicationsScreen';
import { ProjectsScreen } from './ProjectsScreen';
import { WorkoutsScreen } from './WorkoutsScreen';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { FolderKanban, Dumbbell, Pill, ChevronRight, X } from '../icons';

type ModalKey = 'projects' | 'workouts' | 'medications' | null;

export function MenuScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [openModal, setOpenModal] = useState<ModalKey>(null);

  const menuItems: { key: ModalKey; label: string; sub: string; icon: typeof FolderKanban }[] = [
    { key: 'projects', label: 'Projects', sub: 'Manage your projects and tasks', icon: FolderKanban },
    { key: 'workouts', label: 'Workouts', sub: 'Templates and exercise library', icon: Dumbbell },
    { key: 'medications', label: 'Medications', sub: 'Inventory and schedules', icon: Pill },
  ];

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: palette.textTertiary }]}>MORE</Text>

      {menuItems.map(({ key, label, sub, icon: Icon }, i) => (
        <TouchableOpacity
          key={label}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setOpenModal(key);
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

      <Modal visible={openModal === 'projects'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpenModal(null)}>
        <View style={[styles.modalContainer, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.separator }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Projects</Text>
            <TouchableOpacity onPress={() => setOpenModal(null)} hitSlop={12}>
              <X size={16} color={palette.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <ProjectsScreen />
        </View>
      </Modal>

      <Modal visible={openModal === 'workouts'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpenModal(null)}>
        <View style={[styles.modalContainer, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.separator }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Workouts</Text>
            <TouchableOpacity onPress={() => setOpenModal(null)} hitSlop={12}>
              <X size={16} color={palette.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <WorkoutsScreen />
        </View>
      </Modal>

      <Modal visible={openModal === 'medications'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpenModal(null)}>
        <View style={[styles.modalContainer, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.separator }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Medications</Text>
            <TouchableOpacity onPress={() => setOpenModal(null)} hitSlop={12}>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
});
