import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { RiverStoneSurface } from '../components/riverstone';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, spacing } from '../theme';
import { Dumbbell, ShoppingBag, Archive, Flame } from '../icons';
import { MedicationBottleIcon } from '../components/icons/MedicationBottleIcon';
import { TaskNoteIcon } from '../components/icons/TaskNoteIcon';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import { ProjectPortfolioIcon } from '../components/icons/ProjectPortfolioIcon';

const CALENDAR_GOLD = '#D4B078';

export function MenuScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const menuItems = [
    {
      route: 'Areas',
      label: 'Domains',
      sub: 'Ongoing domains of responsibility',
      icon: AreaBonsaiIcon,
      accent: CALENDAR_GOLD,
      soft: 'rgba(212,176,120,0.12)',
    },
    {
      route: 'Projects',
      label: 'Missions',
      sub: 'Manage your missions and tasks',
      icon: ProjectPortfolioIcon,
      accent: palette.purple,
      soft: palette.purpleSoft,
    },
    {
      route: 'Tasks',
      label: 'Tasks',
      sub: 'All active and someday tasks',
      icon: TaskNoteIcon,
      accent: palette.blue,
      soft: palette.blueSoft,
    },
    {
      route: 'Habits',
      label: 'Habits',
      sub: 'Daily routines and streaks',
      icon: Flame,
      accent: palette.red,
      soft: palette.redSoft,
    },
    {
      route: 'Upcoming',
      label: 'Upcoming',
      sub: 'Everything scheduled ahead',
      icon: TaskNoteIcon,
      accent: CALENDAR_GOLD,
      soft: 'rgba(212,176,120,0.12)',
    },
    {
      route: 'Workouts',
      label: 'Workouts',
      sub: 'Templates and exercise library',
      icon: Dumbbell,
      accent: palette.orange,
      soft: palette.orangeSoft,
    },
    {
      route: 'Medications',
      label: 'Medications',
      sub: 'Inventory and schedules',
      icon: MedicationBottleIcon,
      accent: palette.green,
      soft: palette.greenSoft,
    },
    {
      route: 'ToGet',
      label: 'To Get',
      sub: 'Things you want to own',
      icon: ShoppingBag,
      accent: palette.pink,
      soft: palette.pinkSoft,
    },
    {
      route: 'Archive',
      label: 'Archive',
      sub: 'Everything you’ve tucked away',
      icon: Archive,
      accent: palette.silver,
      soft: palette.silverSoft,
    },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: Math.max(insets.top, 16) }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
      >
        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingLeft}>
            <View style={styles.sectionRule} />
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>COLLECTIONS</Text>
          </View>
          <Text style={[styles.sectionCount, { color: palette.textTertiary }]}>{menuItems.length} destinations</Text>
        </View>

        <View style={styles.grid}>
          {menuItems.map(({ route, label, sub, icon: Icon, accent, soft }) => (
            <TouchableOpacity
              key={route}
              style={styles.cardWrap}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route as never);
              }}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`${label}. ${sub}`}
            >
              <RiverStoneSurface
                variant="card"
                mode={isDark ? 'dark' : 'light'}
                shape="regular"
                style={styles.card}
                contentStyle={styles.cardContent}
              >
                <View style={[styles.iconFrame, { backgroundColor: soft, borderColor: `${accent}38` }]}>
                  <Icon
                    size={route === 'Areas' || route === 'Projects' || route === 'Tasks' ? 30 : 20}
                    color={accent}
                    strokeWidth={1.8}
                  />
                </View>
                <Text style={[styles.label, { color: palette.text }]} numberOfLines={2}>
                  {label}
                </Text>
              </RiverStoneSurface>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[2],
    gap: spacing[3],
  },
  sectionHeading: {
    minHeight: 24,
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeadingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionRule: {
    width: 18,
    height: StyleSheet.hairlineWidth,
    backgroundColor: CALENDAR_GOLD,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing[2],
  },
  cardWrap: {
    width: '31%',
  },
  card: {
    aspectRatio: 1,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
  },
  iconFrame: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
});
