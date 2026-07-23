import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { RiverStoneSurface } from '../components/riverstone';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, spacing } from '../theme';
import { Dumbbell, ChevronRight } from '../icons';
import { MedicationBottleIcon } from '../components/icons/MedicationBottleIcon';
import { TaskNoteIcon } from '../components/icons/TaskNoteIcon';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import { ProjectPortfolioIcon } from '../components/icons/ProjectPortfolioIcon';

const CALENDAR_GOLD = '#D4B078';
const MENU_MOTIF = require('../../assets/icons/nav/enso-menu.png');

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
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: Math.max(insets.top - 14, 0) }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
      >
        <RiverStoneSurface
          variant="header"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          style={styles.headerStone}
          contentStyle={styles.headerContent}
          background={
            <>
              <LinearGradient
                colors={['rgba(212,176,120,0.02)', 'rgba(212,176,120,0.13)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <Image source={MENU_MOTIF} resizeMode="contain" style={styles.headerMotif} />
            </>
          }
        >
          <View style={styles.headerCopy}>
            <View style={styles.eyebrowRow}>
              <View style={styles.bambooMark}>
                <View style={styles.bambooLine} />
                <View style={styles.bambooLine} />
              </View>
              <Text style={[styles.eyebrow, { color: CALENDAR_GOLD }]}>YOUR SYSTEM</Text>
            </View>
            <Text style={[styles.headerTitle, { color: palette.text }]}>More</Text>
            <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>Libraries, routines and records</Text>
          </View>
        </RiverStoneSurface>

        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingLeft}>
            <View style={styles.sectionRule} />
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>COLLECTIONS</Text>
          </View>
          <Text style={[styles.sectionCount, { color: palette.textTertiary }]}>6 destinations</Text>
        </View>

        <View style={styles.list}>
          {menuItems.map(({ route, label, sub, icon: Icon, accent, soft }) => (
            <TouchableOpacity
              key={route}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route as never);
              }}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`${label}. ${sub}`}
            >
              <RiverStoneSurface
                variant="list"
                mode={isDark ? 'dark' : 'light'}
                shape="regular"
                style={styles.rowStone}
                contentStyle={styles.rowContent}
              >
                <View style={[styles.iconFrame, { backgroundColor: soft, borderColor: `${accent}38` }]}>
                  <Icon
                    size={route === 'Areas' || route === 'Projects' || route === 'Tasks' ? 34 : 20}
                    color={accent}
                    strokeWidth={1.8}
                  />
                </View>

                <View style={styles.copy}>
                  <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
                  <Text style={[styles.sub, { color: palette.textSecondary }]} numberOfLines={1}>
                    {sub}
                  </Text>
                </View>

                <View style={styles.trailing}>
                  <View style={[styles.accentDot, { backgroundColor: accent }]} />
                  <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.7} />
                </View>
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
  headerStone: {
    minHeight: 94,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerMotif: {
    position: 'absolute',
    width: 108,
    height: 108,
    right: 8,
    top: -7,
    opacity: 0.1,
    tintColor: CALENDAR_GOLD,
  },
  headerCopy: {
    maxWidth: '78%',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  bambooMark: {
    flexDirection: 'row',
    gap: 3,
  },
  bambooLine: {
    width: 2,
    height: 12,
    borderRadius: 2,
    backgroundColor: CALENDAR_GOLD,
    opacity: 0.82,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: '500',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
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
  list: {
    gap: spacing[2],
  },
  rowStone: {
    minHeight: 68,
  },
  rowContent: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconFrame: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.15,
  },
  sub: {
    fontSize: 11.5,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginTop: 3,
  },
  trailing: {
    minWidth: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  accentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.75,
  },
});
