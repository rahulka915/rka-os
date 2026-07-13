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

  // Rounded-card rows (Moonly-style list) instead of the old flat hairline
  // list — each item is its own surface with a soft icon bubble, matching
  // the card system already applied on Home.
  const cardBg = isDark ? palette.fillStrong : palette.surface;
  const cardBorder = isDark ? palette.separatorStrong : palette.separator;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: palette.textTertiary }]}>MORE</Text>

      <View style={styles.list}>
        {menuItems.map(({ route, label, sub, icon: Icon }) => (
          <TouchableOpacity
            key={route}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(route as never);
            }}
            activeOpacity={0.75}
            style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
          >
            <View style={[styles.iconBubble, { backgroundColor: palette.blueSoft }]}>
              <Icon size={17} color={palette.blue} strokeWidth={1.75} />
            </View>
            <View style={styles.content}>
              <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
              <Text style={[styles.sub, { color: palette.textSecondary }]} numberOfLines={1}>{sub}</Text>
            </View>
            <ChevronRight size={14} color={palette.textMuted} strokeWidth={1.5} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  list: {
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
});
