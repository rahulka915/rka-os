# Experimental Home scaffold

## Context

Today's session started with a functional/Mobbin audit of Home, moved through several
small fixes (swipe actions, block-header Add, row duration), and along the way corrected
three separate stale claims from `apps/mobile/FLOWS.md` (row-tap, per-item-complete, and
NextUp were all reported dead/stubbed but turned out to already work correctly — that doc
should not be trusted as source of truth going forward).

When we got to "what would actually fix Home," the user identified that the existing Home
was designed visually first, not from workflow — and wants to design the replacement the
other way around: start from a blank screen, narrate the actual daily workflow, and build
UI to match it step by step, rather than spec the whole new screen upfront.

This spec covers only the **scaffolding** needed to do that safely: a way to reach a
second, currently-blank Home screen on a real device, toggle-able like dark/light mode,
with zero risk to the current working Home. The actual content of the new screen is
explicitly not specified here — it doesn't exist yet by design, and will be built
iteratively in follow-up conversations once this scaffold is live.

## Goal

A toggle, reachable on-device, that swaps which screen renders in the Home tab between the
current `HomeScreen` (untouched) and a new, intentionally blank `HomeScreenExperimental`.

## Non-goals

- Any content for the experimental screen itself — out of scope, built iteratively later.
- Persisting the toggle across app restarts — dark/light mode (the pattern this mirrors)
  doesn't persist either; matching that precedent, not improving on it.
- Wiring an actual UI control for the *existing* dark/light toggle, discovered mid-session
  to have no visible switch anywhere despite `ThemeContext.toggle` existing — unrelated
  pre-existing gap, not fixed here.
- Any change to `HomeScreen.tsx`, `TimelineSection.tsx`, or any file touched earlier this
  session.

## Approach

### `UIModeContext` — mirrors `ThemeContext` exactly

New file `apps/mobile/src/hooks/useUIModeContext.ts`:

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

Same shape as `apps/mobile/src/hooks/useThemeContext.ts` (`isDark`/`toggle` →
`isExperimentalHome`/`toggle`) — same in-memory-only state pattern, no persistence, same
reason: it's a lightweight runtime toggle, not user data.

### `App.tsx` — state + provider + conditional Home render

Alongside the existing `manualDark` state (`App.tsx:266`), add:

```ts
const [isExperimentalHome, setIsExperimentalHome] = useState(false);
const uiModeCtx = useMemo(() => ({
  isExperimentalHome,
  toggle: () => setIsExperimentalHome((v) => !v),
}), [isExperimentalHome]);
```

Wrap the existing `<ThemeContext.Provider>` with `<UIModeContext.Provider value={uiModeCtx}>`
(order doesn't matter functionally — nested alongside it, not replacing it).

The `Home` tab (`App.tsx:221-230`, already a render-prop, not `component={}`) becomes:

```tsx
<Tab.Screen name="Home">
  {() => (isExperimentalHome ? <HomeScreenExperimental /> : (
    <HomeScreen
      {/* ...existing props, unchanged... */}
    />
  ))}
</Tab.Screen>
```

### `HomeScreenExperimental.tsx` — intentionally blank

New file `apps/mobile/src/screens/HomeScreenExperimental.tsx`:

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

Theme-aware from the start (so dark/light both look intentional, not broken) — everything
past this single label is what gets built in follow-up conversations.

### `ProfileScreen.tsx` — the toggle control

New section, added after the existing `ACCOUNT` section
(`ProfileScreen.tsx`, after the `<BackupSection />` call), following the same
`sectionHeading` + row pattern already used for `ACCOUNT`:

```tsx
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
    <Switch value={isExperimentalHome} onValueChange={toggle} />
  </RiverStoneSurface>
</View>
```

Uses React Native's built-in `Switch` (no new dependency) and the existing `Sparkles` icon
(already exported from `src/icons.tsx`, used nowhere else on this screen, fits "in
progress/experimental" better than reusing an icon with an established meaning elsewhere).
`isExperimentalHome`/`toggle` come from `useUIModeContext()`, called once at the top of
`ProfileScreen` alongside its existing `useThemeContext()` call.

## Data flow / component boundaries

`UIModeContext` is a pure UI-runtime flag — no DB writes, no `Item`/database interaction
at all. `HomeScreenExperimental` has zero dependency on `HomeScreen`'s hooks/data-fetching
(`useHomeData`, `usePersistentTimerState`, etc.) — it starts from nothing on purpose, so
each subsequent conversation adds exactly the data/hooks a described workflow step
actually needs, rather than inheriting the current screen's data shape by default.

## Error handling

None — this is a boolean UI toggle with no failure modes.

## Testing / verification

No automated coverage (same constraint as this session's other UI work). `npx tsc --noEmit`
clean, plus a manual device checklist:

1. Profile → DEVELOPER section → "Experimental Home" switch is visible and toggles.
2. Switching it on swaps the Home tab to a themed blank screen reading "Experimental Home".
3. Switching it off restores the exact current Home screen, unchanged.
4. Switching while on a different tab, then navigating to Home, shows the correct screen
   for the current toggle state.
5. Both light and dark mode render the blank screen and the Profile toggle row correctly.
6. The current Home screen's own functionality (everything built this session) is
   completely unaffected — this is a regression check on the *un-toggled* state.
