# Loading/Overlay System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a branded animated loading state for cold start, and a reusable status-banner primitive for async actions, starting with ProfileScreen's sign-in/backup/restore flow.

**Architecture:** One shared animated mark (`EnsoLoader`, SVG + Reanimated) is composed into two consumers: a full-screen `AppLoadingScreen` shown in `App.tsx` before fonts finish loading, and a `LoadingBanner` + `useLoadingBanner` hook that registers a bottom-anchored status card through the existing `OverlayHostProvider`. `ProfileScreen`'s `BackupSection` calls the hook around its three async actions.

**Tech Stack:** React Native + Expo SDK 54, `react-native-svg` 15.15.4, `react-native-reanimated` 4.5.0, Node's built-in test runner (`node --test`, no Jest/RTL in this repo — see Global Constraints).

## Global Constraints

- No 3D Ronin character in any loading state — minimal, brand-mark only.
- Animated mark is an ensō (zen circle) in `#4E9E86`, using a self-drawing-arc sweep, not a plain spin or breathing pulse.
- Splash is "mark + wordmark" only — no tagline. Wordmark styling is a placeholder; do not over-invest in typography polish here.
- Sync/backup feedback is a bottom status banner — no full-screen dimming overlay, no separate blocking variant.
- The overlay system is banner-only; do not add a blocking/full-dim variant.
- No reduced-motion handling (explicitly out of scope per spec).
- This repo's test runner is Node's native `--test` over plain `.ts` files matched by `src/**/*.test.ts` (`npm test`) — there is no component-rendering test setup (no Jest, no React Native Testing Library). Only pure, RN-free logic is unit tested; UI components are verified by running the app.
- Spec source of truth: `docs/superpowers/specs/2026-07-21-loading-overlay-system-design.md`.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/mobile/src/components/ui/ensoLoaderMath.ts` | Pure geometry/animation-phase math for the ensō ring (circumference, dash-offset triangle wave, rotation) — no RN imports, unit tested. |
| `apps/mobile/src/components/ui/ensoLoaderMath.test.ts` | Tests for the above. |
| `apps/mobile/src/components/ui/EnsoLoader.tsx` | The animated SVG mark component, built on the math module. |
| `apps/mobile/src/components/AppLoadingScreen.tsx` | Full-screen cold-start loading view (mark + wordmark). |
| `apps/mobile/App.tsx` (modify) | Render `AppLoadingScreen` while fonts load; hide native splash immediately on mount; remove dead `onRootLayout`. |
| `apps/mobile/src/components/ui/LoadingBanner.tsx` | Presentational bottom-anchored status card (small mark + message). |
| `apps/mobile/src/hooks/useLoadingBanner.ts` | Hook wrapping `useOverlayHost()` to show/hide the banner by message. |
| `apps/mobile/src/screens/ProfileScreen.tsx` (modify) | `BackupSection`'s `handleSignIn`, `backUpNow` call site, and `handleRestore` show/hide the banner around their async calls. |

---

### Task 1: Ensō animation math

**Files:**
- Create: `apps/mobile/src/components/ui/ensoLoaderMath.ts`
- Test: `apps/mobile/src/components/ui/ensoLoaderMath.test.ts`

**Interfaces:**
- Consumes: nothing (pure math, no RN imports — mirrors the existing `katanaProgressMath.ts` pattern in the same directory).
- Produces:
  - `ENSO_VIEWBOX_SIZE: number` (`100`)
  - `ENSO_RADIUS: number` (`40`)
  - `ENSO_STROKE_WIDTH: number` (`5`)
  - `ensoCircumference(radius: number): number`
  - `ensoDashOffset(phase: number, circumference: number): number` — `phase` is `0..1`; returns a value tracing a triangle wave from `circumference` (fully hidden) down to `circumference * 0.16` (mostly drawn) and back to `circumference` over one full phase cycle.
  - `ensoRotationDegrees(phase: number): number` — linear `phase * 360`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/components/ui/ensoLoaderMath.test.ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENSO_RADIUS,
  ensoCircumference,
  ensoDashOffset,
  ensoRotationDegrees,
} from './ensoLoaderMath.ts';

test('circumference matches 2*pi*radius', () => {
  const c = ensoCircumference(ENSO_RADIUS);
  assert.ok(Math.abs(c - 251.327) < 0.01);
});

test('dash offset starts and ends the cycle fully hidden', () => {
  const c = ensoCircumference(ENSO_RADIUS);
  assert.equal(ensoDashOffset(0, c), c);
  assert.ok(Math.abs(ensoDashOffset(1, c) - c) < 0.001);
});

test('dash offset is most-drawn at the midpoint of the cycle', () => {
  const c = ensoCircumference(ENSO_RADIUS);
  const atMid = ensoDashOffset(0.5, c);
  assert.ok(Math.abs(atMid - c * 0.16) < 0.001);
});

test('dash offset is symmetric around the midpoint', () => {
  const c = ensoCircumference(ENSO_RADIUS);
  assert.ok(Math.abs(ensoDashOffset(0.25, c) - ensoDashOffset(0.75, c)) < 0.001);
});

test('rotation is linear across the full cycle', () => {
  assert.equal(ensoRotationDegrees(0), 0);
  assert.equal(ensoRotationDegrees(0.5), 180);
  assert.equal(ensoRotationDegrees(1), 360);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npm test -- ensoLoaderMath`

Wait — the `test` script glob (`src/**/*.test.ts`) doesn't accept a filter argument; the whole suite runs each time. That's fine here since only the new (missing) file will fail, but the command is simply:

Run: `cd apps/mobile && npm test`
Expected: FAIL — `Cannot find module './ensoLoaderMath.ts'` (or similar) from the new test file.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/mobile/src/components/ui/ensoLoaderMath.ts
export const ENSO_VIEWBOX_SIZE = 100;
export const ENSO_RADIUS = 40;
export const ENSO_STROKE_WIDTH = 5;

const ENSO_MIN_DASH_RATIO = 0.16;

export function ensoCircumference(radius: number): number {
  return 2 * Math.PI * radius;
}

export function ensoDashOffset(phase: number, circumference: number): number {
  const triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2; // 0 -> 1 -> 0
  const minOffset = circumference * ENSO_MIN_DASH_RATIO;
  return circumference - (circumference - minOffset) * triangle;
}

export function ensoRotationDegrees(phase: number): number {
  return phase * 360;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: PASS (all suites, including the new one, green).

- [ ] **Step 5: Commit**

```bash
cd apps/mobile
git add src/components/ui/ensoLoaderMath.ts src/components/ui/ensoLoaderMath.test.ts
git commit -m "feat(mobile): add ensō loading-mark animation math"
```

---

### Task 2: `EnsoLoader` component

**Files:**
- Create: `apps/mobile/src/components/ui/EnsoLoader.tsx`

**Interfaces:**
- Consumes: `ENSO_VIEWBOX_SIZE`, `ENSO_RADIUS`, `ENSO_STROKE_WIDTH`, `ensoCircumference`, `ensoDashOffset`, `ensoRotationDegrees` from `./ensoLoaderMath` (Task 1). Reanimated's `useSharedValue`, `useAnimatedProps`, `withRepeat`, `withTiming`, `Easing`, `cancelAnimation` (same APIs already used in `src/components/ui/KatanaProgress.tsx` and `src/components/hero/environment/HeroEnvironment.tsx:160` for `withRepeat`). `react-native-svg`'s `Svg`, `Circle`, and `Reanimated.createAnimatedComponent` (same pattern as `KatanaProgress.tsx`'s `AnimatedCircle`).
- Produces: `EnsoLoader` component, default export not used (named export, matching repo convention) —

```typescript
export interface EnsoLoaderProps {
  size?: number;
  color?: string;
}
export function EnsoLoader({ size = 56, color = '#4E9E86' }: EnsoLoaderProps): JSX.Element
```

This is a pure UI component with no automated test (no RN component test runner in this repo — see Global Constraints). It's verified visually in Tasks 3 and 4/5 once mounted.

- [ ] **Step 1: Write the component**

```typescript
// apps/mobile/src/components/ui/EnsoLoader.tsx
import { useEffect } from 'react';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
  ENSO_RADIUS,
  ENSO_STROKE_WIDTH,
  ENSO_VIEWBOX_SIZE,
  ensoCircumference,
  ensoDashOffset,
  ensoRotationDegrees,
} from './ensoLoaderMath';

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const CIRCUMFERENCE = ensoCircumference(ENSO_RADIUS);
const CYCLE_DURATION_MS = 1600;
const CENTER = ENSO_VIEWBOX_SIZE / 2;

export interface EnsoLoaderProps {
  size?: number;
  color?: string;
}

export function EnsoLoader({ size = 56, color = '#4E9E86' }: EnsoLoaderProps) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: CYCLE_DURATION_MS, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
    return () => cancelAnimation(phase);
  }, [phase]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: ensoDashOffset(phase.value, CIRCUMFERENCE),
    // react-native-svg accepts a raw SVG transform string on any shape
    // (extractTransform.ts has a dedicated string branch) — `rotate(angle cx cy)`
    // rotates around the circle's own center rather than the canvas origin.
    transform: `rotate(${ensoRotationDegrees(phase.value)} ${CENTER} ${CENTER})`,
  }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${ENSO_VIEWBOX_SIZE} ${ENSO_VIEWBOX_SIZE}`}>
      <AnimatedCircle
        cx={CENTER}
        cy={CENTER}
        r={ENSO_RADIUS}
        stroke={color}
        strokeWidth={ENSO_STROKE_WIDTH}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
```

- [ ] **Step 2: Manual verification — mount it somewhere visible**

Temporarily add `<EnsoLoader />` to the top of `ProfileScreen`'s render (right after `<Text style={[styles.title,...]}>Me</Text>` in `apps/mobile/src/screens/ProfileScreen.tsx`), run the app (`cd apps/mobile && npx expo start --dev-client --port 8082`), open the Profile tab, and confirm the ring sweeps/retracts and rotates continuously without warnings in the Metro log.

Then remove the temporary mount — it was only for visual verification, `EnsoLoader` gets its real call sites in Tasks 3–5.

- [ ] **Step 3: Commit**

```bash
cd apps/mobile
git add src/components/ui/EnsoLoader.tsx
git commit -m "feat(mobile): add EnsoLoader animated loading mark"
```

---

### Task 3: `AppLoadingScreen` and cold-start wiring

**Files:**
- Create: `apps/mobile/src/components/AppLoadingScreen.tsx`
- Modify: `apps/mobile/App.tsx:231-311` (the `App` function's fonts-loading gate, splash-hide timing, and `onRootLayout`)

**Interfaces:**
- Consumes: `EnsoLoader` from `./components/ui/EnsoLoader` (Task 2).
- Produces: `AppLoadingScreen` component (no props) rendered directly by `App.tsx` in place of `return null`.

- [ ] **Step 1: Write `AppLoadingScreen`**

```typescript
// apps/mobile/src/components/AppLoadingScreen.tsx
import { StyleSheet, Text, View } from 'react-native';
import { EnsoLoader } from './ui/EnsoLoader';

// Matches app.json's expo-splash-screen backgroundColor so this screen reads
// as a continuation of the native splash, not a jump-cut to a new color.
const SPLASH_BACKGROUND = '#0F0F10';

export function AppLoadingScreen() {
  return (
    <View style={styles.container}>
      <EnsoLoader size={56} />
      <Text style={styles.wordmark}>
        RKA <Text style={styles.wordmarkAccent}>OS</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  wordmark: {
    // The app's global Text.defaultProps forces fontFamily: 'Inter_400Regular'
    // (see App.tsx), but this screen renders precisely when Inter hasn't
    // finished loading yet — using that font here would show blank/tofu
    // glyphs until the font swaps in. Explicitly fall back to the system
    // font for this one screen.
    fontFamily: undefined,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#f2f2f2',
  },
  wordmarkAccent: {
    fontFamily: undefined,
    color: '#4E9E86',
  },
});
```

- [ ] **Step 2: Wire it into `App.tsx`**

In `apps/mobile/App.tsx`, add the import near the other local imports (after the `PersistentTimerBanner` import at line 40):

```typescript
import { AppLoadingScreen } from './src/components/AppLoadingScreen';
```

Replace the fonts-gate return (currently `if (!fontsLoaded) { return null; }` at `App.tsx:309-311`) with:

```typescript
  if (!fontsLoaded) {
    return <AppLoadingScreen />;
  }
```

Remove the now-dead `onRootLayout` callback (`App.tsx:303-307` — it only calls `SplashScreen.hideAsync()`, gated on `fontsLoaded`) and its `onLayout={onRootLayout}` prop on `GestureHandlerRootView` (`App.tsx:319`). In its place, add a one-time effect right after the `useFonts` call (near `App.tsx:239`) that hides the native splash immediately on mount, independent of font-loading state — `AppLoadingScreen` now covers the wait, so the native splash only needs to cover the moment before React's first paint:

```typescript
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
```

- [ ] **Step 3: Manual verification**

Rebuild is not required for this change (it's pure JS, no new native deps) — reload via Metro (`cd apps/mobile && npx expo start --dev-client --port 8082`, then reload the app). Force-quit and relaunch the app on-device (a Metro reload alone won't re-trigger the native splash → JS handoff). Confirm:
- The native splash briefly shows, then `AppLoadingScreen` (ensō + "RKA OS") appears with no blank/flash gap.
- Once fonts finish loading, the real app renders normally.
- No console warnings about `SplashScreen.hideAsync()` being called multiple times or before `preventAutoHideAsync()`.

- [ ] **Step 4: Commit**

```bash
cd apps/mobile
git add src/components/AppLoadingScreen.tsx App.tsx
git commit -m "feat(mobile): add branded AppLoadingScreen for cold start"
```

---

### Task 4: `LoadingBanner` + `useLoadingBanner`

**Files:**
- Create: `apps/mobile/src/components/ui/LoadingBanner.tsx`
- Create: `apps/mobile/src/hooks/useLoadingBanner.ts`

**Interfaces:**
- Consumes: `EnsoLoader` from `../components/ui/EnsoLoader` (Task 2). `useOverlayHost` from `./useOverlayHost` (existing — `src/hooks/useOverlayHost.tsx`, exposes `{ setOverlay(id: string, node: ReactNode | null): void }`). `useSafeAreaInsets` from `react-native-safe-area-context` (same as `PersistentTimerBanner.tsx`). `useThemeContext` + `getThemeColors` (same as `ProfileScreen.tsx`) for surface/text colors.
- Produces:
  - `LoadingBanner` component: `{ message: string }` props.
  - `useLoadingBanner()` hook returning `{ showLoadingBanner(message: string): void; hideLoadingBanner(): void }`.

- [ ] **Step 1: Write `LoadingBanner`**

```typescript
// apps/mobile/src/components/ui/LoadingBanner.tsx
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors } from '../../theme';
import { EnsoLoader } from './EnsoLoader';

export interface LoadingBannerProps {
  message: string;
}

export function LoadingBanner({ message }: LoadingBannerProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <View pointerEvents="none" style={[styles.anchor, { bottom: insets.bottom + 16 }]}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
        <EnsoLoader size={18} />
        <Text style={[styles.message, { color: palette.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same anchor shape as PersistentTimerBanner.tsx's `styles.anchor`
  // (position: absolute, left/right 0, high zIndex, centered) — this repo's
  // established idiom for a floating overlay above the tab bar — but
  // bottom-anchored instead of top-anchored, per the approved mockup.
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
  },
});
```

- [ ] **Step 2: Write `useLoadingBanner`**

```typescript
// apps/mobile/src/hooks/useLoadingBanner.ts
import { useCallback } from 'react';
import { LoadingBanner } from '../components/ui/LoadingBanner';
import { useOverlayHost } from './useOverlayHost';

const LOADING_BANNER_OVERLAY_ID = 'loading-banner';

export function useLoadingBanner() {
  const { setOverlay } = useOverlayHost();

  const showLoadingBanner = useCallback(
    (message: string) => {
      setOverlay(LOADING_BANNER_OVERLAY_ID, <LoadingBanner message={message} />);
    },
    [setOverlay]
  );

  const hideLoadingBanner = useCallback(() => {
    setOverlay(LOADING_BANNER_OVERLAY_ID, null);
  }, [setOverlay]);

  return { showLoadingBanner, hideLoadingBanner };
}
```

- [ ] **Step 3: Manual verification**

Temporarily call `showLoadingBanner('Testing…')` from a button press somewhere already mounted inside `OverlayHostProvider` (e.g. a throwaway `onPress` in `ProfileScreen`), run the app, confirm the banner appears at the bottom above the tab bar with the ensō mark animating and the message text, then remove the temporary call — real call sites come in Task 5.

- [ ] **Step 4: Commit**

```bash
cd apps/mobile
git add src/components/ui/LoadingBanner.tsx src/hooks/useLoadingBanner.ts
git commit -m "feat(mobile): add reusable LoadingBanner overlay primitive"
```

---

### Task 5: Wire `ProfileScreen`'s backup flow to the banner

**Files:**
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx:96-203` (the `BackupSection` component)

**Interfaces:**
- Consumes: `useLoadingBanner` from `../hooks/useLoadingBanner` (Task 4), producing `{ showLoadingBanner, hideLoadingBanner }`. Existing `useBackup()` return value (`signIn`, `backUpNow`, `restoreLatest`, `busy`, etc. — unchanged, from `../hooks/useBackup`).
- Produces: no new exports — `BackupSection`'s three async call sites (`handleSignIn`, the `backUpNow` button's `onPress`, `handleRestore`) each show a contextual banner message while their `useBackup()` call is in flight.

- [ ] **Step 1: Add the hook and wrap the three call sites**

In `apps/mobile/src/screens/ProfileScreen.tsx`, add the import alongside the existing `useBackup` import (near line 12):

```typescript
import { useLoadingBanner } from '../hooks/useLoadingBanner';
```

Inside `BackupSection` (starts at line 96), add the hook call alongside the existing `useBackup()` call (line 99):

```typescript
  const { showLoadingBanner, hideLoadingBanner } = useLoadingBanner();
```

Replace `handleSignIn` (lines 103–114) with:

```typescript
  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password to sign in.');
      return;
    }
    showLoadingBanner('Signing in…');
    try {
      await backup.signIn(email.trim(), password);
      setPassword('');
    } catch (err) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      hideLoadingBanner();
    }
  };
```

Add a new handler for the backup button (it currently calls `backup.backUpNow` directly as the `onPress` — line 152 — replace that direct reference with a wrapping handler). Add this function next to `handleSignIn`:

```typescript
  const handleBackUpNow = async () => {
    showLoadingBanner('Backing up…');
    try {
      await backup.backUpNow();
    } finally {
      hideLoadingBanner();
    }
  };
```

Update the button's `onPress` (line 152, inside the `isSignedIn` branch's first `<Pressable>`) from `onPress={backup.backUpNow}` to `onPress={handleBackUpNow}`.

Replace `handleRestore` (lines 116–136) with:

```typescript
  const handleRestore = () => {
    Alert.alert(
      'Restore latest backup',
      'This replaces all data currently on this device with your last backup. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: async () => {
            showLoadingBanner('Restoring…');
            try {
              const restored = await backup.restoreLatest();
              if (restored) {
                Alert.alert('Restore complete', 'Close and reopen the app to see the restored data.');
              } else {
                Alert.alert('No backup found', 'There is no backup to restore yet.');
              }
            } finally {
              hideLoadingBanner();
            }
          },
        },
      ]
    );
  };
```

- [ ] **Step 2: Manual verification**

Run the app (`cd apps/mobile && npx expo start --dev-client --port 8082`), open the Profile tab. Without valid Supabase credentials configured, `hasSupabaseConfig` is `false` and `signIn` throws synchronously with "Supabase is not configured" — confirm the banner still appears briefly and then clears (proving the `finally` path works) and the existing `Alert.alert('Sign in failed', ...)` still fires with that message. If Supabase credentials are available, sign in with a real account and confirm "Signing in…" shows, then "Backing up…" is triggered automatically by `useBackup`'s post-sign-in `pushBackup` call is internal to the hook and won't show a banner (only the explicit `backUpNow`/`restoreLatest`/`signIn` call sites in `ProfileScreen` do) — confirm "Back up now" and "Restore latest backup" each show their own banner text while pressed.

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

Run: `cd apps/mobile && npm test`
Expected: PASS (all suites green, including Task 1's new `ensoLoaderMath.test.ts`).

- [ ] **Step 4: Commit**

```bash
cd apps/mobile
git add src/screens/ProfileScreen.tsx
git commit -m "feat(mobile): show loading banner during sign-in/backup/restore"
```
