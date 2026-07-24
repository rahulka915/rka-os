# Experimental Home Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dark/light-mode-style toggle that swaps the Home tab between the current,
untouched `HomeScreen` and a new, intentionally blank `HomeScreenExperimental`.

**Architecture:** New `UIModeContext` mirrors the existing `ThemeContext` exactly
(in-memory boolean + toggle function, no persistence). `App.tsx` owns the state and
conditionally renders one of the two screens in the already-render-prop `Home` tab.
`ProfileScreen` gets one new row with a native `Switch` to flip it.

**Tech Stack:** React Native, React Context, TypeScript. No new dependencies.

## Global Constraints

- `npx tsc --noEmit` (run from `apps/mobile/`) must be clean after every task.
- No automated test coverage for this UI (same constraint as this session's other Home
  work) — verification is `tsc` plus a manual device checklist.
- `HomeScreen.tsx` and everything built earlier this session must not change at all —
  this plan only adds new files and small, additive edits to `App.tsx`/`ProfileScreen.tsx`.
- The toggle does not persist across app restarts — this matches `ThemeContext`'s existing
  behavior (`manualDark` is plain `useState`), not a gap to fix here.

---

### Task 1: `UIModeContext` + blank `HomeScreenExperimental` + wire into the tab navigator

**Files:**
- Create: `apps/mobile/src/hooks/useUIModeContext.ts`
- Create: `apps/mobile/src/screens/HomeScreenExperimental.tsx`
- Modify: `apps/mobile/App.tsx:36` (import), `App.tsx:266` (state), `App.tsx:285-288`
  (provider value), `App.tsx:221-230` (Home tab render), and the `<ThemeContext.Provider>`
  wrapper (`App.tsx:332`)

**Interfaces:**
- Produces: `UIModeContext` (React Context, default `{ isExperimentalHome: false, toggle:
  () => {} }`), `useUIModeContext(): { isExperimentalHome: boolean; toggle: () => void }`.
  Task 2 imports `useUIModeContext` from `'../hooks/useUIModeContext'`.

- [ ] **Step 1: Create the context hook**

```ts
import { createContext, useContext } from 'react';

interface UIModeContextValue {
  isExperimentalHome: boolean;
  toggle: () => void;
}

export const UIModeContext = createContext<UIModeContextValue>({
  isExperimentalHome: false,
  toggle: () => {},
});

export function useUIModeContext() {
  return useContext(UIModeContext);
}
```

Save as `apps/mobile/src/hooks/useUIModeContext.ts`.

- [ ] **Step 2: Create the blank experimental screen**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';

export function HomeScreenExperimental() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <Text style={[styles.label, { color: palette.textMuted }]}>Experimental Home</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});
```

Save as `apps/mobile/src/screens/HomeScreenExperimental.tsx`.

- [ ] **Step 3: Import both in `App.tsx`**

Find (`App.tsx:36`):
```ts
import { ThemeContext } from './src/hooks/useThemeContext';
```

Replace with:
```ts
import { ThemeContext } from './src/hooks/useThemeContext';
import { UIModeContext } from './src/hooks/useUIModeContext';
```

Find (`App.tsx:39`, the `HomeScreen` import):
```ts
import { HomeScreen } from './src/screens/HomeScreen';
```

Replace with:
```ts
import { HomeScreen } from './src/screens/HomeScreen';
import { HomeScreenExperimental } from './src/screens/HomeScreenExperimental';
```

- [ ] **Step 4: Add state and provider value**

Find (`App.tsx:265-288`, the existing `manualDark`/`themeCtx` block):
```ts
  const systemScheme = useColorScheme();
  const [manualDark, setManualDark] = useState<boolean | null>(true);
  const isDark = manualDark !== null ? manualDark : systemScheme === 'dark';
```

Leave this block as-is, but immediately after the `themeCtx` declaration (which ends at
line 288 with `}), [isDark, systemScheme]);`), add:

```ts
  const [isExperimentalHome, setIsExperimentalHome] = useState(false);
  const uiModeCtx = useMemo(() => ({
    isExperimentalHome,
    toggle: () => setIsExperimentalHome((v) => !v),
  }), [isExperimentalHome]);
```

- [ ] **Step 5: Wrap the provider tree**

Find (`App.tsx:332`):
```tsx
    <ThemeContext.Provider value={themeCtx}>
```

Replace with:
```tsx
    <ThemeContext.Provider value={themeCtx}>
      <UIModeContext.Provider value={uiModeCtx}>
```

Find the matching closing tag for `ThemeContext.Provider` (search for the last
`</ThemeContext.Provider>` in the file, which closes the tree opened above) and add a
matching `</UIModeContext.Provider>` immediately before it:

```tsx
      </UIModeContext.Provider>
    </ThemeContext.Provider>
```

(If your editor's indentation differs after this edit, that's fine — JSX doesn't require
matching indentation, only matching open/close tag nesting.)

- [ ] **Step 6: Conditionally render Home**

Find (`App.tsx:221-230`):
```tsx
                <Tab.Screen name="Home">
                  {({ navigation }) => (
                    <HomeScreen
                      onInboxPress={() => setInboxOpen(true)}
                      inboxOpen={inboxOpen}
                      onHeroPress={() => navigation.navigate('Profile')}
                      onSettingsPress={() => (navigation.getParent() as any)?.navigate('Settings')}
                    />
                  )}
                </Tab.Screen>
```

Replace with:
```tsx
                <Tab.Screen name="Home">
                  {({ navigation }) => (
                    isExperimentalHome ? (
                      <HomeScreenExperimental />
                    ) : (
                      <HomeScreen
                        onInboxPress={() => setInboxOpen(true)}
                        inboxOpen={inboxOpen}
                        onHeroPress={() => navigation.navigate('Profile')}
                        onSettingsPress={() => (navigation.getParent() as any)?.navigate('Settings')}
                      />
                    )
                  )}
                </Tab.Screen>
```

- [ ] **Step 7: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/hooks/useUIModeContext.ts apps/mobile/src/screens/HomeScreenExperimental.tsx apps/mobile/App.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add UIModeContext + blank HomeScreenExperimental

Groundwork for redesigning Home from workflow outward instead of
visual-first. Mirrors ThemeContext's exact pattern (in-memory boolean
+ toggle, no persistence). No control to flip it yet — that's next.
Toggled off by default, so current HomeScreen behavior is completely
unaffected until Task 2 adds a way to turn it on.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add the toggle switch to Profile

**Files:**
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `useUIModeContext` from Task 1.

- [ ] **Step 1: Import `Switch`, `Sparkles`, and `useUIModeContext`**

Find (line 2):
```tsx
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
```

Replace with:
```tsx
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
```

Find (line 11):
```tsx
import { Archive, CheckCircle2, ChevronRight, Lock, LogOut, Mail, Upload } from '../icons';
```

Replace with:
```tsx
import { Archive, CheckCircle2, ChevronRight, Lock, LogOut, Mail, Sparkles, Upload } from '../icons';
```

Find (line 7):
```tsx
import { useThemeContext } from '../hooks/useThemeContext';
```

Replace with:
```tsx
import { useThemeContext } from '../hooks/useThemeContext';
import { useUIModeContext } from '../hooks/useUIModeContext';
```

- [ ] **Step 2: Read the context in `ProfileScreen`**

Find (inside `export function ProfileScreen()`):
```tsx
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const backup = useBackup();
```

Replace with:
```tsx
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const { isExperimentalHome, toggle: toggleExperimentalHome } = useUIModeContext();
  const palette = getThemeColors(isDark);
  const backup = useBackup();
```

- [ ] **Step 3: Add the DEVELOPER section**

Find:
```tsx
        <BackupSection />
      </ScrollView>
```

Replace with:
```tsx
        <BackupSection />

        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingLeft}>
            <View style={[styles.sectionRule, { backgroundColor: palette.purple }]} />
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>DEVELOPER</Text>
          </View>
        </View>
        <View style={styles.list}>
          <RiverStoneSurface variant="list" mode={isDark ? 'dark' : 'light'} shape="regular" contentStyle={styles.rowContent}>
            <View style={[styles.iconFrame, { backgroundColor: palette.purpleSoft }]}>
              <Sparkles size={19} color={palette.purple} strokeWidth={1.8} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.rowLabel, { color: palette.text }]}>Experimental Home</Text>
              <Text style={[styles.rowSub, { color: palette.textSecondary }]}>Try the new Home screen in progress</Text>
            </View>
            <Switch value={isExperimentalHome} onValueChange={toggleExperimentalHome} />
          </RiverStoneSurface>
        </View>
      </ScrollView>
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/ProfileScreen.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add Experimental Home toggle to Profile

New DEVELOPER section, one row with a native Switch bound to
UIModeContext. This is the first working control for the scaffold
added in the previous commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Confirm `HomeScreen.tsx` is untouched**

Run: `cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os" && git diff --stat HEAD~3 -- apps/mobile/src/screens/HomeScreen.tsx`

(Adjust `HEAD~3` if more or fewer commits landed by this point in the session — the intent
is to diff from before Task 1 of this plan started.) Expected: no output — zero changes to
this file from this plan.

- [ ] **Step 3: Run the pure-logic test suite (sanity check nothing else broke)**

Run: `cd apps/mobile && npm test`
Expected: all existing tests pass — this plan doesn't touch any file `npm test` covers.

- [ ] **Step 4: Report the manual verification checklist to the user**

Requires the EAS dev client on a physical iPhone or the iOS Simulator — not reachable from
this session's tools. Report this checklist and wait for confirmation:

1. Profile → DEVELOPER section → "Experimental Home" switch is visible and toggles.
2. Switching it on and going to the Home tab shows a themed blank screen reading
   "Experimental Home".
3. Switching it off restores the exact current Home screen, unchanged.
4. Toggle while on a different tab, then navigate to Home — correct screen for the current
   toggle state shows immediately.
5. Both light and dark mode render the blank screen and the Profile toggle row correctly.
6. The current Home screen's own functionality (everything built earlier this session) is
   completely unaffected in the un-toggled state.
