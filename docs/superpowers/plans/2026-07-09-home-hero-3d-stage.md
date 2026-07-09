# Home Hero 3D Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Home hero into a compact greeting card and a large full-width 3D stage, and add an AppState pause to the 3D render loop.

**Architecture:** `RoninHero.tsx` becomes a thin composer rendering two new components — `RoninGreetingCard` (text/status/XP) and `RoninStage` (large 3D character stage with a gradient backdrop). `Ronin3DDom` gains an `active` prop wired from a new `useAppIsActive()` hook so the WebGL loop stops scheduling frames when the app is backgrounded.

**Tech Stack:** React Native (Expo SDK 54), Tamagui not used in this component tree (plain `StyleSheet`), `expo-linear-gradient`, `react-native` `AppState`.

## Global Constraints

- No test framework exists in `apps/mobile` — verification is `npx tsc --noEmit` plus manual on-device check (per spec's Testing section). No test-writing steps in this plan.
- Stage backdrop: midtone gradient with subtle time-of-day tint, not the literal photo scene (spec decision).
- Scroll-based pause is explicitly out of scope this pass — only `AppState` pause (spec decision).
- Keep `RoninCharacter.tsx`'s mood→asset resolution and static/3D crossfade logic unchanged — only the box it renders into changes.
- `getRoninMood`, XP/level logic (`roninProgress.ts`), and `ProfileScreen.tsx`'s bench are untouched.

---

### Task 1: `useAppIsActive` hook + `Ronin3DDom` pause support

**Files:**
- Create: `apps/mobile/src/hooks/useAppIsActive.ts`
- Modify: `apps/mobile/src/components/home/Ronin3DDom.tsx`

**Interfaces:**
- Produces: `useAppIsActive(): boolean` — `true` while `AppState.currentState === 'active'`, `false` otherwise.
- Produces: `Ronin3DDom` gains prop `active?: boolean` (default `true`). When `false`, the internal `animate()` loop stops calling `requestAnimationFrame` (no further frames scheduled or rendered) but the renderer/scene/mixer are NOT disposed — resuming `active` picks the loop back up from where it left off, same GL context.

- [ ] **Step 1: Write `useAppIsActive`**

```typescript
// apps/mobile/src/hooks/useAppIsActive.ts
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Tracks whether the app is in the foreground. Used to pause continuous
// render loops (e.g. the 3D companion's WebGL animate loop) when backgrounded.
export function useAppIsActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return active;
}
```

- [ ] **Step 2: Add `active` prop to `Ronin3DDomProps` and thread it through the animate loop**

In `apps/mobile/src/components/home/Ronin3DDom.tsx`, add to the props interface (after `blinkEnabled`):

```typescript
  /** Whether the WebGL render loop should keep scheduling frames. Defaults to true. */
  active?: boolean;
```

Add `active = true` to the destructured props in the component signature:

```typescript
export default function Ronin3DDom({
  glbBase64,
  animation,
  fallbackAnimation,
  oneShot,
  blinkEnabled,
  active = true,
  onSceneReady,
  onSceneError,
}: Ronin3DDomProps) {
```

Mirror the existing `targetRef` pattern for `active` so the render loop reads the latest value each frame without re-running the setup effect. Add alongside the existing `targetRef` declaration:

```typescript
  const activeRef = useRef(active);
  activeRef.current = active;
```

In the `animate` function inside the setup effect, gate the frame scheduling at the very top (before the `frame = requestAnimationFrame(animate)` line):

```typescript
        const animate = () => {
          if (disposed || !renderer) return;
          frame = requestAnimationFrame(animate);
          if (!activeRef.current) return;

          const target = targetRef.current;
```

(This keeps `requestAnimationFrame` itself scheduled — cheap, no-op callback churn — while skipping the mixer update and `renderer.render` call, which are the actual GPU/CPU cost, whenever the app is backgrounded.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors referencing `Ronin3DDom.tsx` or `useAppIsActive.ts`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/hooks/useAppIsActive.ts apps/mobile/src/components/home/Ronin3DDom.tsx
git commit -m "feat: pause Ronin 3D render loop when app is backgrounded"
```

---

### Task 2: Wire `active` through `RoninCharacter`

**Files:**
- Modify: `apps/mobile/src/components/home/RoninCharacter.tsx`

**Interfaces:**
- Consumes: `useAppIsActive(): boolean` (Task 1).
- Consumes: `Ronin3DDom`'s new `active?: boolean` prop (Task 1).

- [ ] **Step 1: Import the hook and pass `active` to `Ronin3DDom`**

In `apps/mobile/src/components/home/RoninCharacter.tsx`, add the import near the top (with the other domain/hook imports):

```typescript
import { useAppIsActive } from '../../hooks/useAppIsActive';
```

Inside the `RoninCharacter` function body, alongside the existing `const { glbBase64 } = useRoninGlbBase64(...)` line, add:

```typescript
  const appIsActive = useAppIsActive();
```

In the JSX where `<Ronin3DDom ... />` is rendered, add the `active` prop:

```tsx
          <Ronin3DDom
            glbBase64={glbBase64}
            animation={clip.animation}
            fallbackAnimation={clip.fallbackAnimation}
            oneShot={isOneShotClip(clip.animation)}
            blinkEnabled={mood !== 'resolved'}
            active={appIsActive}
            onSceneReady={async () => {
```

(Only the new `active={appIsActive}` line is added; everything else in that block is unchanged.)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/components/home/RoninCharacter.tsx
git commit -m "feat: pass app-foreground state into Ronin 3D companion"
```

---

### Task 3: `RoninGreetingCard` component

**Files:**
- Create: `apps/mobile/src/components/home/RoninGreetingCard.tsx`

**Interfaces:**
- Consumes: `RoninMood` (`../../domain/ronin/types`), `getRoninMoodConfig` (`../../domain/ronin/moodConfig`), `getRoninProgress` (`../../utils/roninProgress`), `useThemeContext` (`../../hooks/useThemeContext`), `getThemeColors` (`../../theme`).
- Produces: `RoninGreetingCard(props: { mood: RoninMood; greeting: string; onPress?: () => void }): JSX.Element` — compact card with greeting title/subtitle, mood dot + supporting copy, level + XP bar. No character, no scene art.

This extracts the non-character content currently in `RoninHero.tsx`'s `greetingBlock`/`footer` blocks into its own themed card (matching the visual weight of `InboxScrollCard`/`NextUpCard` — solid `palette`-backed background, not scrim-over-photo, since there's no photo behind it anymore).

- [ ] **Step 1: Check `InboxScrollCard.tsx` for the palette-card pattern to match**

Run: `cat apps/mobile/src/components/home/InboxScrollCard.tsx | head -40`

Note the `palette.surface`/`palette.bg` field names and border-radius convention used there — reuse the same `getThemeColors(isDark)` fields in this component so the new card looks consistent with its Home siblings.

- [ ] **Step 2: Write `RoninGreetingCard.tsx`**

```tsx
// apps/mobile/src/components/home/RoninGreetingCard.tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RoninMood } from '../../domain/ronin/types';
import { getRoninMoodConfig } from '../../domain/ronin/moodConfig';
import { getRoninProgress } from '../../utils/roninProgress';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors } from '../../theme';

interface RoninGreetingCardProps {
  mood: RoninMood;
  greeting: string;
  onPress?: () => void;
}

// Compact status card: greeting copy, mood status line, level + XP bar.
// Sibling of RoninStage — together they replace the old single hero card.
// No character or scene art here; this is text/status only.
export function RoninGreetingCard({ mood, greeting, onPress }: RoninGreetingCardProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const moodConfig = getRoninMoodConfig(mood);
  const progress = getRoninProgress();
  const xpRatio = Math.min(1, progress.xp / progress.xpToNext);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={[styles.card, { backgroundColor: palette.surface }]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={moodConfig.accessibilityLabel}
    >
      <Text style={[styles.greetingTitle, { color: palette.text }]}>{greeting} ✨</Text>
      <Text style={[styles.greetingSubtitle, { color: palette.textSecondary }]}>Let's make today count.</Text>

      <View style={styles.statusRow}>
        <View style={[styles.moodDot, { backgroundColor: moodConfig.accentColor }]} />
        <Text style={[styles.moodText, { color: palette.textSecondary }]} numberOfLines={2}>
          {moodConfig.supportingCopy}
        </Text>
      </View>

      <View style={styles.levelRow}>
        <Text style={[styles.levelText, { color: palette.text }]}>Level {progress.level}</Text>
        <Text style={[styles.xpText, { color: palette.textSecondary }]}>
          {progress.xp} / {progress.xpToNext} XP
        </Text>
      </View>
      <View style={[styles.xpTrack, { backgroundColor: palette.fill }]}>
        <View style={[styles.xpFill, { width: `${xpRatio * 100}%`, backgroundColor: moodConfig.accentColor }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  greetingSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
  },
  moodDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  moodText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 10,
    marginBottom: 6,
  },
  levelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  xpText: {
    fontSize: 11,
    fontWeight: '600',
  },
  xpTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 3,
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors (component isn't wired in yet, but must type-check standalone — check for `palette.surface`/`palette.fill` existing on the `getThemeColors` return type; if either field doesn't exist, use the actual matching field names found in Step 1 and adjust).

- [ ] **Step 4: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/components/home/RoninGreetingCard.tsx
git commit -m "feat: add RoninGreetingCard (status/XP, no character)"
```

---

### Task 4: `RoninStage` component

**Files:**
- Create: `apps/mobile/src/components/home/RoninStage.tsx`

**Interfaces:**
- Consumes: `RoninCharacter` (`./RoninCharacter`), `RoninMood`/`RoninOutfit`/`RoninTimeOfDay` (`../../domain/ronin/types`).
- Produces: `RoninStage(props: { mood: RoninMood; outfit?: RoninOutfit; timeOfDay: RoninTimeOfDay; onPress?: () => void }): JSX.Element` — full-width, 300px-tall stage with a gradient backdrop and a large-format `RoninCharacter`.

Time-of-day gradient tint (per design spec — midtone gradient, not the photo scene): a base slate gradient with a per-time-of-day accent stop, echoing the Profile bench's `#4a5261` slate backdrop (proven to read well against the near-black character) rather than the literal `RoninScene` photo.

- [ ] **Step 1: Check `roninScenes.ts` / `types.ts` for the exact `RoninTimeOfDay` union values**

Run: `cat apps/mobile/src/domain/ronin/types.ts | grep -A6 "RoninTimeOfDay"`

Use the exact union member names returned here for the `TIME_OF_DAY_TINTS` map in Step 2 (do not guess — copy them verbatim).

- [ ] **Step 2: Write `RoninStage.tsx`**

```tsx
// apps/mobile/src/components/home/RoninStage.tsx
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RoninMood, RoninOutfit, RoninTimeOfDay } from '../../domain/ronin/types';
import { RoninCharacter } from './RoninCharacter';

interface RoninStageProps {
  mood: RoninMood;
  outfit?: RoninOutfit;
  timeOfDay: RoninTimeOfDay;
  onPress?: () => void;
}

// Per-time-of-day accent layered over the base slate — same slate midtone
// the Profile bench uses (#4a5261-family), proven to read well against the
// near-black character. This is a tint, not the literal RoninScene photo:
// at this size a busy background flattens the character (see design spec).
const TIME_OF_DAY_TINTS: Record<RoninTimeOfDay, [string, string]> = {
  morning: ['#5b6478', '#3f4656'],
  afternoon: ['#4a5261', '#333947'],
  evening: ['#4b4560', '#2c2838'],
  night: ['#31344a', '#1c1e2c'],
};

// Large-format 3D stage — sibling of RoninGreetingCard. Full-width, tall
// enough for the character to read as 3D rather than a cropped icon.
export function RoninStage({ mood, outfit = 'base', timeOfDay, onPress }: RoninStageProps) {
  const [top, bottom] = TIME_OF_DAY_TINTS[timeOfDay] ?? TIME_OF_DAY_TINTS.afternoon;

  return (
    <View style={styles.stage} pointerEvents={onPress ? 'auto' : 'none'}>
      <LinearGradient colors={[top, bottom]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.characterBox} pointerEvents="none">
        <RoninCharacter mood={mood} outfit={outfit} style={styles.character} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
  },
  characterBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  character: {
    width: '90%',
    height: '80%',
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors. If `RoninTimeOfDay` has a different set of members than `morning`/`afternoon`/`evening`/`night`, fix `TIME_OF_DAY_TINTS` to match exactly what Step 1 found — the `Record<RoninTimeOfDay, ...>` type will fail to compile otherwise, which is the intended guardrail.

- [ ] **Step 4: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/components/home/RoninStage.tsx
git commit -m "feat: add RoninStage (large-format 3D character stage)"
```

---

### Task 5: Recompose `RoninHero` and clean up `RoninScene`

**Files:**
- Modify: `apps/mobile/src/components/home/RoninHero.tsx`
- Delete: `apps/mobile/src/components/home/RoninScene.tsx` (only consumer after this task)

**Interfaces:**
- Consumes: `RoninGreetingCard` (Task 3), `RoninStage` (Task 4).
- Produces: `RoninHero(props: { mood: RoninMood; outfit?: RoninOutfit; timeOfDay: RoninTimeOfDay; greeting: string; onPress?: () => void }): JSX.Element` — same public signature `HomeScreen.tsx` already uses, so no caller changes needed. Internally renders `RoninGreetingCard` then `RoninStage`, stacked with a 12px gap.

- [ ] **Step 1: Confirm no other file imports `RoninScene`**

Run: `grep -rn "RoninScene" apps/mobile/src --include="*.tsx" --include="*.ts"`
Expected: only `RoninHero.tsx` (about to be rewritten) and `RoninScene.tsx` itself. `NextUpCard.tsx` uses `getRoninSceneAsset` directly (the asset-lookup function in `roninScenes.ts`), not the `RoninScene` component — leave `roninScenes.ts` alone, only delete the component file.

- [ ] **Step 2: Rewrite `RoninHero.tsx` as a composer**

```tsx
// apps/mobile/src/components/home/RoninHero.tsx
import { StyleSheet, View } from 'react-native';
import type { RoninMood, RoninOutfit, RoninTimeOfDay } from '../../domain/ronin/types';
import { RoninGreetingCard } from './RoninGreetingCard';
import { RoninStage } from './RoninStage';

interface RoninHeroProps {
  mood: RoninMood;
  // No outfit progression system exists yet — always 'base' until one is built.
  outfit?: RoninOutfit;
  timeOfDay: RoninTimeOfDay;
  greeting: string;
  onPress?: () => void;
}

// Composer: stacks the compact status card (RoninGreetingCard) above the
// large-format 3D stage (RoninStage). Both are tappable through to the same
// destination (Profile, via onPress) — this component owns no layout logic
// beyond the stack itself; mood/status copy and character rendering are
// fully delegated to the two children.
export function RoninHero({ mood, outfit = 'base', timeOfDay, greeting, onPress }: RoninHeroProps) {
  return (
    <View style={styles.stack}>
      <RoninGreetingCard mood={mood} greeting={greeting} onPress={onPress} />
      <RoninStage mood={mood} outfit={outfit} timeOfDay={timeOfDay} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: '100%',
    gap: 12,
  },
});
```

- [ ] **Step 3: Delete `RoninScene.tsx`**

```bash
rm "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile/src/components/home/RoninScene.tsx"
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors, no dangling import errors for the deleted `RoninScene.tsx`.

- [ ] **Step 5: Verify `HomeScreen.tsx` needs no changes**

Run: `grep -n "RoninHero" apps/mobile/src/screens/HomeScreen.tsx`
Expected: the existing `<RoninHero mood={roninMood} timeOfDay={getTimeOfDay(hour)} greeting={greetingForHour(hour)} onPress={onHeroPress} />` call still matches the (unchanged) `RoninHero` prop signature — no edit needed here. Note `HomeScreen.tsx` also wraps the call in a `View` with `marginHorizontal: 12, marginTop: 8, borderRadius: 16, overflow: 'hidden'` — the `overflow: 'hidden'` clips corners, which is now redundant with each child owning its own `borderRadius`, but harmless; leave it as is (out of scope).

- [ ] **Step 6: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/components/home/RoninHero.tsx
git rm apps/mobile/src/components/home/RoninScene.tsx
git commit -m "refactor: split RoninHero into greeting card + 3D stage"
```

---

### Task 6: Manual on-device verification

**Files:** none (verification only).

- [ ] **Step 1: Start Metro on port 8082**

Run: `cd apps/mobile && npx expo start --dev-client --port 8082`

- [ ] **Step 2: On device, confirm the Home screen shows two stacked blocks**

Check: greeting card (text/status/XP, no character) sits above a 300px-tall stage with the 3D Ronin large and centered against the gradient backdrop.

- [ ] **Step 3: Confirm all 6 moods still render correctly**

Force each mood value temporarily in `HomeScreen.tsx` (`const roninMood = getRoninMood({...})` → replace with a hardcoded literal from `RoninMood`) if the current app state doesn't naturally hit all of them, check the stage crossfades/updates for each, then revert the hardcode.

- [ ] **Step 4: Confirm tap-to-Profile still works from both blocks**

Tap the greeting card, confirm navigation to Profile. Tap the stage, confirm the same.

- [ ] **Step 5: Confirm the AppState pause**

With the console visible (Metro logs), background the app (home button / app switcher) while Home is open, wait a couple seconds, foreground again. Expected: no crash, no visible reload/flicker of the 3D character, animation resumes smoothly (the `[RONIN3D_DOM] scene ready` log should NOT reprint — confirming the scene wasn't torn down and rebuilt).

- [ ] **Step 6: Final `tsc` check and wrap-up**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: clean. No commit needed for this task (verification only) — if any issue was found and fixed during verification, commit that fix separately with a `fix:` message describing what broke.
