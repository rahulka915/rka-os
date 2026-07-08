# Home Screen Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the mobile app's Home screen (`apps/mobile/src/screens/HomeScreen.tsx`) to be brighter, warmer, and calmer per the approved mockup, reusing all existing data and functionality.

**Architecture:** Restyle existing components in place (`RoninHero`, `InboxScrollCard`) rather than replacing them; add two small new files (a level/XP stub module, a Next-Up selection utility) and one new presentational component (`NextUpCard`); remove the unwired practice-cards placeholder row from `HomeScreen.tsx`; thread `navigation` into `HomeScreen` so the hero card can navigate to the Profile tab.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, Tamagui + RN StyleSheet, React Navigation bottom tabs, expo-haptics, react-native-reanimated, expo-linear-gradient, SQLite (expo-sqlite) via `src/db/database.ts`.

## Global Constraints

- Mobile-only change: touch only files under `apps/mobile/`. Do not touch the legacy web PWA (`src/` at repo root).
- No new DB tables/columns. The only new "data" is a hardcoded placeholder stub for level/XP, isolated in its own file and clearly commented as TODO.
- Do not remove or break: Quick Add FAB, bottom tab navigation, `PersistentTimerBanner`, swipe/long-press actions in `TimelineSection`, dark mode.
- No unit test framework covers RN screens in this repo — verification is manual via the Expo dev client / preview tooling, checked in both light and dark mode.
- Follow existing theme-token pattern: colors come from `getThemeColors(isDark)` (`src/theme/colors.ts`), spacing from literal pt values matching the existing scale (`$1=4pt … $6=24pt`).
- There is no exact scheduled-clock-time field in the `Item` model (only `metadata.timeOfDay: 'morning'|'afternoon'|'evening'` and `scheduledDate`). The "Next Up" card must not fabricate a fake time range (e.g. "10:00–11:30") — it shows the real time-of-day bucket label instead.
- The app is single-user; the greeting's name ("Rahul") is a literal string consistent with existing hardcoded single-user assumptions elsewhere (e.g. `AvatarCompanion` "R" initial), not fabricated data.

---

### Task 1: Ronin progress stub module

**Files:**
- Create: `apps/mobile/src/utils/roninProgress.ts`

**Interfaces:**
- Produces: `export interface RoninProgress { level: number; xp: number; xpToNext: number }` and `export function getRoninProgress(): RoninProgress`, consumed by Task 2.

- [ ] **Step 1: Write the stub module**

```typescript
// apps/mobile/src/utils/roninProgress.ts

// TODO: no real progression/XP system exists yet. This returns a fixed
// placeholder so the hero card has a real data slot to render, without
// presenting fabricated numbers as authoritative. Replace the body of
// getRoninProgress() with a real DB-backed calculation when the
// progression system is built — the RoninHero component consuming this
// does not need to change.
export interface RoninProgress {
  level: number;
  xp: number;
  xpToNext: number;
}

export function getRoninProgress(): RoninProgress {
  return { level: 1, xp: 0, xpToNext: 100 };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors referencing `roninProgress.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/utils/roninProgress.ts
git commit -m "feat: add ronin progress stub for hero card level/XP slot"
```

---

### Task 2: Restyle RoninHero — warmer scene, level/XP row, tap target

**Files:**
- Modify: `apps/mobile/src/components/home/RoninHero.tsx`

**Interfaces:**
- Consumes: `getRoninProgress()` from Task 1 (`RoninProgress` shape).
- Produces: `RoninHeroProps` gains `onPress?: () => void`. Consumed by Task 6 (`HomeScreen.tsx`) and Task 3 (navigation wiring).

- [ ] **Step 1: Replace the file with the restyled version**

```typescript
// apps/mobile/src/components/home/RoninHero.tsx
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';
import type { RoninMood } from '../../utils/roninMood';
import { getRoninProgress } from '../../utils/roninProgress';

interface RoninHeroProps {
  mood: RoninMood;
  onPress?: () => void;
}

const MOOD_IMAGES: Record<RoninMood, number> = {
  normal: require('../../../assets/ronin/moods/normal.png'),
  alert: require('../../../assets/ronin/moods/alert.png'),
  tired: require('../../../assets/ronin/moods/tired.png'),
  focused: require('../../../assets/ronin/moods/focused.png'),
  overwhelmed: require('../../../assets/ronin/moods/overwhelmed.png'),
  resolved: require('../../../assets/ronin/moods/resolved.png'),
};

const MOOD_LABELS: Record<RoninMood, string> = {
  normal: 'Ronin is steady today.',
  alert: 'Ronin noticed a few things waiting.',
  tired: 'Ronin is winding down.',
  focused: 'Ronin is focused today.',
  overwhelmed: 'Ronin could use a hand today.',
  resolved: 'Ronin is glad that’s done.',
};

const CROSSFADE_MS = 350;

// Placeholder for the mood-based character until the animation system (breathing,
// aura, tap-poke) is redesigned — see docs/superpowers/specs. For now this is a
// plain image swap with a crossfade, not a static-forever asset.
export function RoninHero({ mood, onPress }: RoninHeroProps) {
  const [prevMood, setPrevMood] = useState<RoninMood | null>(null);
  const prevOpacity = useSharedValue(0);
  const currentOpacity = useSharedValue(1);
  const moodRef = useRef(mood);
  const progress = getRoninProgress();

  useEffect(() => {
    if (moodRef.current === mood) return;
    setPrevMood(moodRef.current);
    moodRef.current = mood;

    prevOpacity.value = 1;
    currentOpacity.value = 0;
    prevOpacity.value = withTiming(0, { duration: CROSSFADE_MS });
    currentOpacity.value = withTiming(1, { duration: CROSSFADE_MS });
  }, [mood]);

  const xpRatio = Math.min(1, progress.xp / progress.xpToNext);

  return (
    <TouchableOpacity activeOpacity={onPress ? 0.9 : 1} onPress={onPress} style={styles.card}>
      <LinearGradient
        colors={['#fef6e4', '#fbe8c8', '#f3d9a6']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.moodBubble}>
        <Text style={styles.moodText}>{MOOD_LABELS[mood]}</Text>
      </View>

      {prevMood && (
        <Animated.View style={[styles.character, { opacity: prevOpacity }]} pointerEvents="none">
          <Image source={MOOD_IMAGES[prevMood]} resizeMode="contain" style={styles.image} />
        </Animated.View>
      )}

      <Animated.View style={[styles.character, { opacity: currentOpacity }]} pointerEvents="none">
        <Image source={MOOD_IMAGES[mood]} resizeMode="contain" style={styles.image} />
      </Animated.View>

      <View style={styles.progressBar}>
        <Text style={styles.levelText}>Level {progress.level}</Text>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${xpRatio * 100}%` }]} />
        </View>
        <Text style={styles.xpText}>{progress.xp} / {progress.xpToNext} XP</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  moodBubble: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  moodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a2b12',
  },
  character: {
    position: 'absolute',
    width: '46%',
    aspectRatio: 234 / 330,
    maxHeight: '78%',
    bottom: 56,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  progressBar: {
    width: '100%',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3a2b12',
    marginBottom: 6,
  },
  xpTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(58,43,18,0.15)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#a41e34',
  },
  xpText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(58,43,18,0.65)',
    marginTop: 6,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: errors only at call sites still passing the removed `className` prop or missing `onPress` — none expected yet since Task 6 updates the call site. If `HomeScreen.tsx` errors on `className`, that's expected until Task 6.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/RoninHero.tsx
git commit -m "feat: restyle RoninHero with warm scene and level/XP row"
```

---

### Task 3: Thread navigation into HomeScreen for hero tap → Profile tab

**Files:**
- Modify: `apps/mobile/App.tsx:141-143`
- Modify: `apps/mobile/src/screens/HomeScreen.tsx:16`

**Interfaces:**
- Produces: `HomeScreen` accepts a new prop `onHeroPress: () => void`, consumed inside `HomeScreen.tsx` and passed to `RoninHero`'s `onPress`.

- [ ] **Step 1: Pass navigation through in App.tsx**

In `apps/mobile/App.tsx`, change:

```typescript
                <Tab.Screen name="Home">
                  {() => <HomeScreen onInboxPress={() => setInboxOpen(true)} inboxOpen={inboxOpen} />}
                </Tab.Screen>
```

to:

```typescript
                <Tab.Screen name="Home">
                  {({ navigation }) => (
                    <HomeScreen
                      onInboxPress={() => setInboxOpen(true)}
                      inboxOpen={inboxOpen}
                      onHeroPress={() => navigation.navigate('Profile')}
                    />
                  )}
                </Tab.Screen>
```

- [ ] **Step 2: Accept the prop in HomeScreen.tsx**

Change the function signature at `apps/mobile/src/screens/HomeScreen.tsx:16`:

```typescript
export function HomeScreen({ onInboxPress, inboxOpen }: { onInboxPress: () => void; inboxOpen: boolean }) {
```

to:

```typescript
export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress }: { onInboxPress: () => void; inboxOpen: boolean; onHeroPress: () => void }) {
```

(The JSX usage of `onHeroPress` on `<RoninHero />` is wired in Task 6, once the rest of the layout changes land in the same file.)

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors about `onHeroPress` being unused yet is fine (TS doesn't flag unused destructured props by default in this tsconfig — verify no new errors appear).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/App.tsx apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat: thread navigation into HomeScreen for hero tap target"
```

---

### Task 4: Fix InboxScrollCard theme bug and restyle to warm card language

**Files:**
- Modify: `apps/mobile/src/components/home/InboxScrollCard.tsx`

**Interfaces:**
- No signature change: still `InboxScrollCardProps { inboxCount: number; onPress: () => void; isDark: boolean }`, consumed unchanged by Task 6.

The existing component hardcodes `primaryText`/`secondaryText` colors for dark mode only (`#f2f2f2` text, `rgba(255,255,255,0.40)` secondary) regardless of the `isDark` prop — on light mode this renders near-invisible light-gray-on-white text. Fix this while restyling.

- [ ] **Step 1: Replace the file**

```typescript
// apps/mobile/src/components/home/InboxScrollCard.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Inbox, CheckCircle2, ChevronRight } from '../../icons';

interface InboxScrollCardProps {
  inboxCount: number;
  onPress: () => void;
  isDark: boolean;
}

export function InboxScrollCard({ inboxCount, onPress, isDark }: InboxScrollCardProps) {
  const hasItems = inboxCount > 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const cardBg = isDark ? '#1e1e1e' : '#ffffff';
  const textColor = isDark ? '#f2f2f2' : '#1c1c1e';
  const secondaryColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(60,60,67,0.5)';

  return (
    <View style={styles.container}>
      {/* Shadow cards — stacked paper effect */}
      <View style={[styles.shadowCard, styles.shadowCard3, { backgroundColor: isDark ? '#161616' : '#ece6da' }]} />
      <View style={[styles.shadowCard, styles.shadowCard2, { backgroundColor: isDark ? '#191919' : '#f5efe2' }]} />

      {/* Foreground card */}
      <TouchableOpacity
        onPress={hasItems ? handlePress : undefined}
        activeOpacity={hasItems ? 0.75 : 1}
        style={[styles.foregroundCard, { backgroundColor: cardBg }]}
      >
        {/* Icon bubble */}
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: hasItems ? 'rgba(164,30,52,0.12)' : 'rgba(52,168,83,0.14)' },
          ]}
        >
          {hasItems ? (
            <Inbox size={17} color="#a41e34" strokeWidth={1.5} />
          ) : (
            <CheckCircle2 size={17} color="#34a853" strokeWidth={1.5} />
          )}
        </View>

        {/* Text */}
        <View style={styles.textGroup}>
          <Text style={[styles.primaryText, { color: textColor }]}>
            {hasItems
              ? `${inboxCount} unopened scroll${inboxCount > 1 ? 's' : ''}`
              : 'All clear'}
          </Text>
          <Text style={[styles.secondaryText, { color: secondaryColor }]}>
            {hasItems ? 'Tap to review' : 'No unattended matters.'}
          </Text>
        </View>

        {/* Chevron */}
        {hasItems && <ChevronRight size={14} color="#a41e34" strokeWidth={2} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 78,
    position: 'relative',
  },
  shadowCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 14,
  },
  shadowCard3: {
    top: 6,
    marginHorizontal: 18,
    height: 66,
    opacity: 0.5,
  },
  shadowCard2: {
    top: 3,
    marginHorizontal: 10,
    height: 70,
    opacity: 0.7,
  },
  foregroundCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 62,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryText: {
    fontSize: 12,
    marginTop: 2,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/InboxScrollCard.tsx
git commit -m "fix: theme-aware text colors in InboxScrollCard, restyle to warm card language"
```

---

### Task 5: Next-Up selection utility and NextUpCard component

**Files:**
- Create: `apps/mobile/src/utils/nextUpItem.ts`
- Create: `apps/mobile/src/components/home/NextUpCard.tsx`

**Interfaces:**
- Consumes: `Item` type from `../db/types` (`id, type, title, status, metadata`), `PresentedMedicationTimer[]` shape (`{ med: Item }`) from `usePersistentTimerState()`.
- Produces: `export type NextUpActionLabel = 'Start' | 'Resume' | 'Take' | 'View' | 'Continue'`, `export interface NextUpResult { id: string; title: string; type: Item['type']; timeOfDayLabel: string; actionLabel: NextUpActionLabel }`, `export function findNextUpItem(todayItems: Item[], activeTimerItemIds: string[], hour?: number): NextUpResult | null`. Consumed by `NextUpCard` and Task 6 (`HomeScreen.tsx`).
- `NextUpCard` props: `{ result: NextUpResult | null; onAction: (result: NextUpResult) => void }`.

- [ ] **Step 1: Write `nextUpItem.ts`**

```typescript
// apps/mobile/src/utils/nextUpItem.ts
import type { Item } from '../db/types';

export type NextUpActionLabel = 'Start' | 'Resume' | 'Take' | 'View' | 'Continue';

export interface NextUpResult {
  id: string;
  title: string;
  type: Item['type'];
  timeOfDayLabel: string;
  actionLabel: NextUpActionLabel;
}

type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'anytime';

const BUCKET_LABELS: Record<TimeBucket, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

function bucketOf(item: Item): TimeBucket {
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  if (meta.timeOfDay === 'morning' || meta.timeOfDay === 'afternoon' || meta.timeOfDay === 'evening') {
    return meta.timeOfDay;
  }
  return 'anytime';
}

function bucketOrderFromHour(hour: number): TimeBucket[] {
  if (hour < 12) return ['morning', 'afternoon', 'evening', 'anytime'];
  if (hour < 17) return ['afternoon', 'evening', 'morning', 'anytime'];
  return ['evening', 'morning', 'afternoon', 'anytime'];
}

function actionLabelFor(item: Item, activeTimerItemIds: string[]): NextUpActionLabel {
  if (item.type === 'medication') {
    return activeTimerItemIds.includes(item.id) ? 'Resume' : 'Take';
  }
  if (item.type === 'workout-template') {
    return 'Start';
  }
  if (item.type === 'task' || item.type === 'habit') {
    return 'Start';
  }
  return 'View';
}

const PENDING_STATUSES: Item['status'][] = ['active', 'scheduled', 'due-today', 'overdue', 'inbox'];

export function findNextUpItem(
  todayItems: Item[],
  activeTimerItemIds: string[],
  hour: number = new Date().getHours()
): NextUpResult | null {
  const pending = todayItems.filter((item) => PENDING_STATUSES.includes(item.status));
  if (pending.length === 0) return null;

  const byBucket = new Map<TimeBucket, Item[]>();
  for (const item of pending) {
    const bucket = bucketOf(item);
    const list = byBucket.get(bucket) ?? [];
    list.push(item);
    byBucket.set(bucket, list);
  }

  for (const bucket of bucketOrderFromHour(hour)) {
    const list = byBucket.get(bucket);
    if (list && list.length > 0) {
      const item = list[0];
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        timeOfDayLabel: BUCKET_LABELS[bucket],
        actionLabel: actionLabelFor(item, activeTimerItemIds),
      };
    }
  }

  return null;
}
```

- [ ] **Step 2: Write `NextUpCard.tsx`**

```typescript
// apps/mobile/src/components/home/NextUpCard.tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sparkles, ListChecks, Pill, Dumbbell } from '../../icons';
import type { NextUpResult } from '../../utils/nextUpItem';
import { getThemeColors } from '../../theme';

interface NextUpCardProps {
  result: NextUpResult | null;
  onAction: (result: NextUpResult) => void;
  isDark: boolean;
}

function IconFor({ type, color }: { type: NextUpResult['type']; color: string }) {
  if (type === 'medication') return <Pill size={18} color={color} strokeWidth={1.75} />;
  if (type === 'workout-template') return <Dumbbell size={18} color={color} strokeWidth={1.75} />;
  return <ListChecks size={18} color={color} strokeWidth={1.75} />;
}

export function NextUpCard({ result, isDark, onAction }: NextUpCardProps) {
  const palette = getThemeColors(isDark);

  if (!result) {
    return (
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
        <Sparkles size={18} color={palette.textTertiary} strokeWidth={1.75} />
        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: palette.text }]}>Nothing pressing right now</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Enjoy the quiet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
      <View style={[styles.iconBubble, { backgroundColor: palette.maroonSoft }]}>
        <IconFor type={result.type} color={palette.maroon} />
      </View>
      <View style={styles.textGroup}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{result.title}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{result.timeOfDayLabel}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onAction(result)}
        style={[styles.actionButton, { backgroundColor: palette.maroon }]}
        activeOpacity={0.85}
      >
        <Text style={styles.actionText}>{result.actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  actionButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
```

- [ ] **Step 3: Verify the icons used exist in `src/icons.tsx`**

This project's icon module (`apps/mobile/src/icons.tsx`) re-exports from `react-native-heroicons`, not lucide. `Sparkles`, `Pill`, and `Dumbbell` already exist there. `ListChecks` does not — add it:

```typescript
export { default as ListChecks } from 'react-native-heroicons/outline/ListBulletIcon';
```

Run: `cd apps/mobile && grep -n "Sparkles\|ListChecks\|Pill\|Dumbbell" src/icons.tsx`
Expected: all four names present.

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors in `nextUpItem.ts` or `NextUpCard.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/nextUpItem.ts apps/mobile/src/components/home/NextUpCard.tsx
git commit -m "feat: add Next Up selection logic and card component"
```

---

### Task 6: Update HomeScreen — remove practice cards, add greeting, wire NextUpCard

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx` (full rewrite of the file body; imports and layout change throughout)

**Interfaces:**
- Consumes: `RoninHero` (`onPress` prop, Task 2), `InboxScrollCard` (unchanged props, Task 4), `NextUpCard` + `findNextUpItem` (Task 5), `HomeScreen` prop `onHeroPress` (Task 3), `usePersistentTimerState()` (existing, for `timers` used both by mood calc and Next Up's active-timer check).

- [ ] **Step 1: Replace `apps/mobile/src/screens/HomeScreen.tsx`**

```typescript
// apps/mobile/src/screens/HomeScreen.tsx
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Alert, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { TimelineSection } from '../components/TimelineSection';
import { RoninHero } from '../components/home/RoninHero';
import { InboxScrollCard } from '../components/home/InboxScrollCard';
import { NextUpCard } from '../components/home/NextUpCard';
import { useHomeData, completeAllInTimeBlock } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { usePersistentTimerState } from '../hooks/usePersistentTimerState';
import { getThemeColors } from '../theme';
import { updateItemStatus, deleteItem } from '../db/database';
import { getRoninMood } from '../utils/roninMood';
import { findNextUpItem } from '../utils/nextUpItem';

interface HomeScreenProps {
  onInboxPress: () => void;
  inboxOpen: boolean;
  onHeroPress: () => void;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning, Rahul';
  if (hour < 17) return 'Good afternoon, Rahul';
  return 'Good evening, Rahul';
}

export function HomeScreen({ onInboxPress, inboxOpen, onHeroPress }: HomeScreenProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { inboxCount, todayItems, anytime, morningItems, afternoonItems, eveningItems, refresh } = useHomeData();

  // useHomeData only fetches on mount — Inbox lives in a sibling modal (App.tsx), not a child
  // of this screen, so bulk actions there (delete, triage) never trigger a refetch here on
  // their own, and this isn't a navigation transition so useFocusEffect wouldn't fire either.
  // Refetch whenever the Inbox modal closes.
  useEffect(() => {
    if (!inboxOpen) refresh();
  }, [inboxOpen, refresh]);

  const { timers } = usePersistentTimerState();
  const [completedJustNow, setCompletedJustNow] = useState(false);
  const completedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashCompletedJustNow = () => {
    setCompletedJustNow(true);
    if (completedResetTimer.current) clearTimeout(completedResetTimer.current);
    completedResetTimer.current = setTimeout(() => setCompletedJustNow(false), 4000);
  };

  const overdueCount = todayItems.filter((item) => item.status === 'overdue').length;
  const hour = new Date().getHours();
  const roninMood = getRoninMood({
    isTimerRunning: timers.length > 0,
    overdueCount,
    inboxCount,
    completedJustNow,
    hour,
  });

  const activeTimerItemIds = timers.map((t) => t.med.id);
  const nextUp = findNextUpItem(todayItems, activeTimerItemIds, hour);

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Greeting */}
        <View style={s.greeting}>
          <Text style={[s.greetingTitle, { color: palette.text }]}>{greetingForHour(hour)} ✨</Text>
          <Text style={[s.greetingSubtitle, { color: palette.textSecondary }]}>Let's make today count.</Text>
        </View>

        {/* Ronin hero — mood-driven, tappable through to Profile for now */}
        <View style={{ marginHorizontal: 12, marginTop: 4, borderRadius: 28, overflow: 'hidden' }}>
          <RoninHero mood={roninMood} onPress={onHeroPress} />
        </View>

        {/* Next Up — single nearest pending item, or a calm empty state */}
        <View style={{ marginHorizontal: 12, marginTop: 16 }}>
          <NextUpCard
            result={nextUp}
            isDark={isDark}
            onAction={(result) => {
              console.log('Next Up action for:', result.id, result.actionLabel);
            }}
          />
        </View>

        {/* Contextual unattended-matters status */}
        <View style={{ marginHorizontal: 12, marginTop: 12 }}>
          <InboxScrollCard
            inboxCount={inboxCount}
            onPress={onInboxPress}
            isDark={isDark}
          />
        </View>

        {/* Today timeline */}
        <YStack marginTop="$5">
          <TimelineSection
            todayItems={todayItems}
            anytime={anytime}
            morning={morningItems}
            afternoon={afternoonItems}
            evening={eveningItems}
            onItemTap={(item) => {
              console.log('Navigate to item:', item.id);
            }}
            onItemComplete={(id) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateItemStatus(id, 'active');
              refresh();
            }}
            onItemArchive={(id) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateItemStatus(id, 'archived');
              refresh();
            }}
            onItemDelete={(id) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              deleteItem(id);
              refresh();
            }}
            onTimeBlockAction={(block, action) => {
              if (action === 'completeAll') {
                const blockName = block.charAt(0).toUpperCase() + block.slice(1);
                Alert.alert(
                  'Complete All',
                  `Complete all items in ${blockName}?`,
                  [
                    { text: 'Cancel', onPress: () => {}, style: 'cancel' },
                    {
                      text: 'Complete',
                      onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        completeAllInTimeBlock(block as 'anytime' | 'morning' | 'afternoon' | 'evening');
                        flashCompletedJustNow();
                        refresh();
                      },
                    },
                  ]
                );
              } else if (action === 'quickAdd') {
                console.log('Quick add for:', block);
              } else if (action === 'addItem') {
                console.log('Add item to:', block);
              } else if (action === 'moveItems') {
                console.log('Move items to:', block);
              } else if (action === 'sort') {
                console.log('Sort items in:', block);
              }
            }}
          />
        </YStack>

      </ScrollView>
    </YStack>
  );
}

const s = StyleSheet.create({
  greeting: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  greetingSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat: redesign Home screen layout — greeting, Next Up, remove practice cards"
```

---

### Task 7: Manual verification in the running app

**Files:** none (verification only)

- [ ] **Step 1: Start the dev client**

Run: `cd apps/mobile && npx expo start --dev-client --clear`
Expected: Metro bundler starts without errors; connect via the physical iPhone dev client per `docs/migration` / project `CLAUDE.md` instructions (enter `http://<mac-ip>:8081` manually if needed).

- [ ] **Step 2: Verify populated state (light mode)**

In the running app on the Home tab, confirm:
- Greeting shows "Good morning/afternoon/evening, Rahul ✨" matching current hour, with subtitle "Let's make today count."
- No practice-card placeholder row appears between the hero and Next Up.
- Hero card shows warm gradient background, mood label bubble, and a "Level 1 / 0 / 100 XP" row.
- Tapping the hero navigates to the Profile ("Me") tab.
- Next Up card shows a real pending item's title + time-of-day bucket + a context-sensitive action label (Take for medication, Start for task/workout, Resume if a medication timer is active for that item).
- Inbox card shows correct dark-on-light text (not washed out) and correct count/"All clear" state.
- Timeline section (Anytime/Morning/Afternoon/Evening) still displays counts and supports swipe actions as before.

- [ ] **Step 3: Verify empty states**

Temporarily clear all today-scheduled items (or test on a day with none) to confirm the Next Up card shows "Nothing pressing right now / Enjoy the quiet." instead of a blank or crashing card. Also confirm the Inbox card shows "All clear" when `inboxCount === 0`.

- [ ] **Step 4: Verify dark mode**

Toggle dark mode via the header sun/moon icon. Confirm: greeting text, Next Up card, and Inbox card text all remain legible (no washed-out or invisible text), hero card retains its warm gradient (unaffected by dark mode, per design — the hero background is intentionally warm regardless of theme).

- [ ] **Step 5: Verify unaffected functionality**

Confirm: Quick Add FAB still opens the capture sheet and saves items; bottom tab navigation (Home/Calendar/More/Me) still works; `PersistentTimerBanner` still renders above everything when a medication timer is active; swipe-to-complete/archive/delete on timeline items still works with haptics.

- [ ] **Step 6: Report findings**

If any check in Steps 2–5 fails, note the exact file/behavior and fix before considering this plan complete — do not mark the task done on an assumption.
