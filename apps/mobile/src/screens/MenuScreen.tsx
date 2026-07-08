import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { Compass, FolderKanban, ListChecks, Dumbbell, Pill, ChevronRight } from '../icons';

export function MenuScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const menuItems = [
    { route: 'Areas', label: 'Areas', sub: 'Ongoing areas of responsibility', icon: Compass },
    { route: 'Projects', label: 'Projects', sub: 'Manage your projects and tasks', icon: FolderKanban },
    { route: 'Tasks', label: 'Tasks', sub: 'All active and someday tasks', icon: ListChecks },
    { route: 'Workouts', label: 'Workouts', sub: 'Templates and exercise library', icon: Dumbbell },
    { route: 'Medications', label: 'Medications', sub: 'Inventory and schedules', icon: Pill },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: palette.textTertiary }]}>MORE</Text>

      {menuItems.map(({ route, label, sub, icon: Icon }, i) => (
        <TouchableOpacity
          key={route}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(route as never);
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
});
