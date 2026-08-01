# Menu Grid Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `MenuScreen.tsx` drops its decorative header entirely and shows its 9 destinations as a 3-per-row grid of icon+label cards instead of a single-column list of subtitle rows.

**Architecture:** Single-file rewrite of `apps/mobile/src/screens/MenuScreen.tsx` — same `menuItems` data, same navigation/haptic behavior, new JSX/styles for the header removal and grid layout.

**Tech Stack:** React Native + Expo (apps/mobile), TypeScript, existing `RiverStoneSurface` component (`variant="card"`, already used by `InboxScrollCard.tsx`). No automated UI test suite — manual verification per project convention.

## Global Constraints

- Same 9 routes, same icons, same accent colors, same `navigation.navigate(route)` + haptic behavior as today — only the header and layout change.
- No changes to `MenuStack.tsx` or any other screen.
- Cards keep the full `label + sub` text in their `accessibilityLabel` even though `sub` is no longer rendered visually, so VoiceOver doesn't regress.
- 3 cards per row via percentage widths (`31%` + wrap), not fixed pixel widths, so it holds up across device sizes.

---

### Task 1: Rewrite `MenuScreen.tsx` — remove header, add grid

**Files:**
- Modify: `apps/mobile/src/screens/MenuScreen.tsx` (current full content below — the entire file as of the last commit)

**Interfaces:**
- Consumes: nothing new — same imports as today, minus `Image`/`LinearGradient` (no longer used).
- Produces: nothing consumed elsewhere — this is a self-contained screen rewrite.

The current full content of `apps/mobile/src/screens/MenuScreen.tsx`:

```tsx
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { RiverStoneSurface } from '../components/riverstone';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, spacing } from '../theme';
import { Dumbbell, ChevronRight, ShoppingBag, Archive, Flame } from '../icons';
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
          <Text style={[styles.sectionCount, { color: palette.textTertiary }]}>{menuItems.length} destinations</Text>
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
```

- [ ] **Step 1: Replace the entire file**

Write the full new content:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors other than the pre-existing, unrelated ones under `src/webApp/` (retired PWA code).

- [ ] **Step 3: Manual verification**

Run the app (RKA Launcher tool / `npx expo start --dev-client --port 8082`, per project convention). On the Menu tab:
- No header art, no "More" title — screen opens directly on the "COLLECTIONS · 9 destinations" line and the grid.
- 9 cards arranged 3 per row (3 full rows), icon + label only, no subtitle text, no chevron.
- Tap a few cards (e.g. Habits, Tasks, Archive) — confirm each navigates to its existing screen correctly.
- Confirm labels like "Medications" and "Domains" render legibly (wrapping to 2 lines if needed, not clipped).
- Toggle dark mode — confirm cards still read correctly (RiverStoneSurface's `mode` prop already handles this).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/MenuScreen.tsx
git commit -m "refactor: redesign Menu screen as a 3-column icon grid"
```

---

## Self-Review Notes

- **Spec coverage:** Header fully removed → Step 1 (no `RiverStoneSurface variant="header"` block, no `Image`/`LinearGradient` imports). Section label kept as first element → Step 1. 3-per-row grid via `width: '31%'` + `flexWrap` → Step 1's `grid`/`cardWrap` styles. Card = `RiverStoneSurface variant="card"` (matches `InboxScrollCard`'s pattern) + centered icon + label, no subtitle/chevron/dot → Step 1's card JSX. Accessibility label still includes `sub` text → Step 1's `accessibilityLabel={`${label}. ${sub}`}`, unchanged from the original.
- **Placeholder scan:** No TBD/TODO; complete code in the single step.
- **Type consistency:** `menuItems` shape (`route`, `label`, `sub`, `icon`, `accent`, `soft`) is unchanged from the current file — only the JSX consuming it changes, so no downstream type risk.
- **Scope check:** Single file, single task — self-contained, independently testable, matches the spec's single-subsystem scope.
