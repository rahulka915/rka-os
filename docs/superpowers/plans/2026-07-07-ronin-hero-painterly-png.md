# Ronin Hero Painterly PNG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Ronin Hero's vector-traced SVG character with the existing painterly PNG art (from `Ronin References/ronin1.png`), feathered at the edges so it melts into the card background, while preserving all existing "always alive" motion (breathing, glow pulse, mood crossfade, tap-poke).

**Architecture:** Container-animates-static-image pattern (Finch/Not Boring style). ImageMagick pre-processes 6 mood panels once into transparent-edge PNGs checked into the repo. `RoninHero.tsx` swaps its character layer from `SvgXml` to `Image`, keeping the same `Animated.View` wrapper that drives breathing. The code-drawn SVG aura is dimmed (not removed) since the glow is now baked into the pixels.

**Tech Stack:** React Native + Expo, `react-native-reanimated` (existing breathing/glow loops), `react-native-svg` (aura only), ImageMagick 7.1.2 (asset prep, one-time, not part of the app build).

## Global Constraints

- Do not redesign the mood system, animation timing values (`MOOD_MOTION` durations/amplitudes), or card layout — they are approved and working.
- Every Reanimated `withTiming`/`withRepeat` call must pass `reduceMotion: ReduceMotion.Never` (`NEVER_REDUCE` constant in `RoninHero.tsx`) — the character must never appear frozen even with the OS "Reduce Motion" setting on.
- No mood may have zero motion amplitude.
- Do not attempt background cutout / flood-fill on the mood panels — the rim-glow blends into the background and is unmaskable. Use edge feathering instead.
- All 6 mood panels are sourced from `Ronin References/ronin1.png` only (not `ronin2.png`) for visual consistency across crossfades.
- `npx tsc --noEmit` must pass after every code task.
- Metro runs on port 8082 for this project (`npx expo start --dev-client --clear --port 8082`); the user verifies visually on a physical device — the agent cannot see the device.

---

### Task 1: Extract and feather the 6 mood panels

**Files:**
- Create: `apps/mobile/assets/ronin/moods/normal.png`
- Create: `apps/mobile/assets/ronin/moods/alert.png`
- Create: `apps/mobile/assets/ronin/moods/tired.png`
- Create: `apps/mobile/assets/ronin/moods/focused.png`
- Create: `apps/mobile/assets/ronin/moods/overwhelmed.png`
- Create: `apps/mobile/assets/ronin/moods/resolved.png`
- Read only: `Ronin References/ronin1.png` (source, 1402x1122, do not modify)

**Interfaces:**
- Produces: 6 PNG files, each with a transparent-feathered border, same pixel dimensions as each other (record the exact width/height — Task 3 needs it for `aspectRatio`). Order left-to-right in the source sheet: normal, alert, tired, focused, overwhelmed, resolved.

- [ ] **Step 1: Crop the mood row from the source sheet**

The mood row (6 character panels) sits at approximately `y=225` to `y=555` (330px tall) across the full `1402`px width, verified visually during design. Run:

```bash
cd "apps/mobile/assets/ronin" || cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile/assets/ronin"
mkdir -p moods
magick "../../../../Ronin References/ronin1.png" -crop 1402x330+0+225 +repage /tmp/moodrow.png
magick identify /tmp/moodrow.png
```

Expected: `/tmp/moodrow.png PNG 1402x330 ...`

- [ ] **Step 2: Slice into 6 equal panels and verify no separator bleed**

```bash
magick /tmp/moodrow.png -crop 233x330 +repage +adjoin /tmp/panel_%d.png
magick identify /tmp/panel_*.png
```

Expected: `panel_0.png` through `panel_5.png`, each `233x330`, plus a small `panel_6.png` remainder (leftover ~4px strip — ignore/discard it).

Read (view) `panel_0.png` through `panel_5.png` and confirm: each shows one full character (normal, alert, tired, focused, overwhelmed, resolved in that order), no thin gold vertical separator line visible inside the frame, no adjacent character bleeding in from the next column. If a thin separator or sliver of the neighboring panel is visible, re-crop that panel with a few px trimmed off the affected side, e.g. `magick /tmp/moodrow.png -crop 228x330+3+0 +repage /tmp/panel_0_fixed.png` (adjust offset per panel as needed), and re-verify.

- [ ] **Step 3: Apply a feathered radial alpha vignette to each panel**

For each of the 6 verified panels, apply a radial alpha mask that is fully opaque in the center and fades to transparent over the outer ~12–15% of the panel on all sides:

```bash
W=233; H=330
for i in 0 1 2 3 4 5; do
  magick -size ${W}x${H} radial-gradient:white-black \
    -gravity center -crop ${W}x${H}+0+0 +repage \
    -level 0%,60% \
    /tmp/mask_$i.png
  magick /tmp/panel_$i.png /tmp/mask_$i.png -alpha off -compose CopyOpacity -composite /tmp/feathered_$i.png
done
magick identify /tmp/feathered_*.png
```

(`-level 0%,60%` pushes the falloff to start further from center, so only the outer ~12-15% actually fades — inspect the result in the next step and adjust the level percentage if the fade looks too aggressive or too subtle.)

- [ ] **Step 4: Visually verify the feathered result**

Read (view) `feathered_0.png` against a bright/contrasting temporary background to confirm the character is intact, the edges fade smoothly to transparent, and no hard rectangular edge remains:

```bash
magick /tmp/feathered_0.png -background "#3355ff" -flatten /tmp/feathered_0_preview.png
```

View `/tmp/feathered_0_preview.png`. Expected: character visible, corners/edges fade into the blue preview background rather than showing a hard black box edge. Repeat spot-check for at least one more panel (e.g. `overwhelmed`, which is the darkest/dimmest mood).

- [ ] **Step 5: Trim transparent margins and save final assets**

```bash
NAMES=(normal alert tired focused overwhelmed resolved)
for i in 0 1 2 3 4 5; do
  magick /tmp/feathered_$i.png -trim +repage "moods/${NAMES[$i]}.png"
done
magick identify moods/*.png
```

Record the printed width/height (they should all match, e.g. `NNNxMM`) — Task 3 needs this exact ratio for `aspectRatio`.

- [ ] **Step 6: Commit the assets**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/assets/ronin/moods/
git commit -m "feat: add feathered painterly PNG panels for Ronin Hero moods"
```

---

### Task 2: Retune the card background gradient

**Files:**
- Modify: `apps/mobile/src/components/home/RoninHero.tsx` (the `LinearGradient` `colors`/`locations` props, and the `styles.card` `backgroundColor` if needed)

**Interfaces:**
- Consumes: nothing new.
- Produces: no interface change — visual-only tuning of existing `LinearGradient`.

- [ ] **Step 1: Identify the panel background tone**

```bash
magick apps/mobile/assets/ronin/moods/normal.png -gravity NorthWest -crop 5x5+2+2 +repage -format "%[pixel:p{2,2}]" info:
```

This prints the approximate corner color of the panel (should read something close to a warm near-black, e.g. `srgb(13,13,14)` / `#0d0d0e`-ish). Note the hex value.

- [ ] **Step 2: Update the LinearGradient to converge on that tone**

Open `apps/mobile/src/components/home/RoninHero.tsx`. Find:

```tsx
<LinearGradient
  colors={['rgba(55,31,10,0.55)', 'rgba(7,7,7,0.92)', '#040404']}
  locations={[0, 0.58, 1]}
  style={StyleSheet.absoluteFillObject}
/>
```

Replace the trailing color stop with the hex value measured in Step 1 (fall back to `#0d0d0e` if the sampled value is within a few RGB points of it):

```tsx
<LinearGradient
  colors={['rgba(55,31,10,0.55)', 'rgba(13,13,14,0.92)', '#0d0d0e']}
  locations={[0, 0.58, 1]}
  style={StyleSheet.absoluteFillObject}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/RoninHero.tsx
git commit -m "fix: retune Ronin Hero card gradient to match painterly panel background"
```

(Visual verification of this happens together with Task 3's verification, since the panels aren't wired in yet.)

---

### Task 3: Swap the character layer from SvgXml to Image

**Files:**
- Modify: `apps/mobile/src/components/home/RoninHero.tsx`

**Interfaces:**
- Consumes: `apps/mobile/assets/ronin/moods/{normal,alert,tired,focused,overwhelmed,resolved}.png` (Task 1), panel dimensions recorded in Task 1 Step 5.
- Produces: `MOOD_IMAGES: Record<RoninMood, number>` map (used nowhere else yet, but Task 4 and Task 5 build on the same `RoninHero.tsx` render tree).

- [ ] **Step 1: Add the `Image` import and mood→asset map**

In `apps/mobile/src/components/home/RoninHero.tsx`, add to the imports:

```tsx
import { Image, StyleSheet, View } from 'react-native';
```

(replacing the existing `import { StyleSheet, View } from 'react-native';` line).

Add after the `NEVER_REDUCE` constant:

```tsx
const MOOD_IMAGES: Record<RoninMood, number> = {
  normal: require('../../../assets/ronin/moods/normal.png'),
  alert: require('../../../assets/ronin/moods/alert.png'),
  tired: require('../../../assets/ronin/moods/tired.png'),
  focused: require('../../../assets/ronin/moods/focused.png'),
  overwhelmed: require('../../../assets/ronin/moods/overwhelmed.png'),
  resolved: require('../../../assets/ronin/moods/resolved.png'),
};
```

- [ ] **Step 2: Replace the character SvgXml with Image**

Find:

```tsx
      <Animated.View style={[styles.character, characterStyle]} pointerEvents="none">
        <SvgXml
          xml={characterFailed ? FALLBACK_XML : RONIN_STATE_XML[mood]}
          width="100%"
          height="100%"
          onError={() => setCharacterFailed(true)}
        />
      </Animated.View>
```

Replace with:

```tsx
      <Animated.View style={[styles.character, characterStyle]} pointerEvents="none">
        <Image source={MOOD_IMAGES[mood]} style={styles.characterImage} resizeMode="contain" />
      </Animated.View>
```

- [ ] **Step 3: Update styles — aspectRatio and new characterImage style**

Find:

```tsx
  character: {
    // Matches the Codex-traced artwork's 1020x1680 viewBox (tall portrait — much narrower
    // than the old 932x1200 asset). Mismatched aspect here was letterboxing the SVG and
    // clipping the aura's soft fade-out, making it read as a hard-edged box.
    width: '46%',
    aspectRatio: 1020 / 1680,
    maxHeight: '92%',
  },
```

Replace with (substituting `<TRIMMED_W>` and `<TRIMMED_H>` with the exact values recorded in Task 1 Step 5 — e.g. if `magick identify` printed `205x298`, use `205 / 298`):

```tsx
  character: {
    width: '58%',
    aspectRatio: <TRIMMED_W> / <TRIMMED_H>,
    maxHeight: '92%',
  },
  characterImage: {
    width: '100%',
    height: '100%',
  },
```

(The width bump from `46%` to `58%` compensates for the feathered transparent margin added in Task 1 eating into the visible character's apparent size — adjust up/down after visual check in Step 5 if the character reads too small/large on the card.)

- [ ] **Step 4: Dim the code-drawn aura so it doesn't double the baked-in glow**

Find, in `apps/mobile/src/assets/ronin/shadowRoninStates.ts`:

```tsx
export const RONIN_GLOW_XML = svg([aura(0.8)]);
```

Replace with:

```tsx
export const RONIN_GLOW_XML = svg([aura(0.24)]);
```

(0.8 → 0.24 is roughly 30% of the original, per the design's "reduce to ~30% of current values" — the SVG aura should now read as a subtle pulse layered on top of the baked-in panel glow, not a second light source.)

- [ ] **Step 5: Remove the now-unused RONIN_STATE_XML import**

In `apps/mobile/src/components/home/RoninHero.tsx`, find:

```tsx
import { RONIN_GLOW_XML, RONIN_STATE_XML } from '../../assets/ronin/shadowRoninStates';
```

Replace with:

```tsx
import { RONIN_GLOW_XML } from '../../assets/ronin/shadowRoninStates';
```

Then check whether `RONIN_STATE_XML` is referenced anywhere else in the codebase:

```bash
grep -rn "RONIN_STATE_XML" "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile/src"
```

If the only remaining match is the `export const RONIN_STATE_XML = {...}` definition itself in `shadowRoninStates.ts`, delete that export block from `shadowRoninStates.ts`. If anything else still references it, leave the export in place and note it for a follow-up.

- [ ] **Step 6: Type-check**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Start Metro and visually verify all 6 moods**

```bash
npx expo start --dev-client --clear --port 8082
```

In `apps/mobile/src/screens/HomeScreen.tsx`, temporarily hardcode each of the 6 mood values in place of the computed mood (find where `getRoninMood(...)` result is passed to `<RoninHero mood={...} />` and swap in a literal like `'overwhelmed'`), reload, and ask the user to confirm on-device: character renders correctly, no hard box edge against the card background, glow doesn't look doubled. Repeat for all 6 moods, then revert the hardcode back to the real computed mood.

- [ ] **Step 8: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/components/home/RoninHero.tsx apps/mobile/src/assets/ronin/shadowRoninStates.ts
git commit -m "feat: render Ronin Hero character as painterly PNG instead of traced SVG"
```

---

### Task 4: Mood crossfade

**Files:**
- Modify: `apps/mobile/src/components/home/RoninHero.tsx`

**Interfaces:**
- Consumes: `MOOD_IMAGES` map (Task 3), `NEVER_REDUCE` constant (existing).
- Produces: no new exports — internal render behavior change only.

- [ ] **Step 1: Add previous-mood tracking state and a crossfade shared value**

Add imports for `useEffect` already exists; add `useRef` if not present. At the top of `RoninHero.tsx`, after the existing `useState` calls, add:

```tsx
  const [prevMood, setPrevMood] = useState<RoninMood>(mood);
  const crossfade = useSharedValue(1);
```

- [ ] **Step 2: Trigger the crossfade on mood change**

Add a new `useEffect` (separate from the existing breathing/glow effect, so it doesn't get tangled with those loops):

```tsx
  useEffect(() => {
    if (mood === prevMood) return;
    crossfade.value = 0;
    crossfade.value = withTiming(
      1,
      { duration: 350, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER_REDUCE },
      (finished) => {
        if (finished) runOnJS(setPrevMood)(mood);
      }
    );
  }, [mood]);
```

Add `runOnJS` to the `react-native-reanimated` import list at the top of the file:

```tsx
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
```

- [ ] **Step 3: Render two stacked Images and animate their opacity**

Add two new animated styles after `characterStyle`:

```tsx
  const prevImageStyle = useAnimatedStyle(() => ({ opacity: 1 - crossfade.value }));
  const nextImageStyle = useAnimatedStyle(() => ({ opacity: crossfade.value }));
```

Replace the Task 3 character block:

```tsx
      <Animated.View style={[styles.character, characterStyle]} pointerEvents="none">
        <Image source={MOOD_IMAGES[mood]} style={styles.characterImage} resizeMode="contain" />
      </Animated.View>
```

with:

```tsx
      <Animated.View style={[styles.character, characterStyle]} pointerEvents="none">
        <Animated.Image
          source={MOOD_IMAGES[prevMood]}
          style={[styles.characterImage, StyleSheet.absoluteFillObject, prevImageStyle]}
          resizeMode="contain"
        />
        <Animated.Image
          source={MOOD_IMAGES[mood]}
          style={[styles.characterImage, nextImageStyle]}
          resizeMode="contain"
        />
      </Animated.View>
```

`Animated.Image` comes from the same `Animated` default import already used for `Animated.View` — no new import needed.

- [ ] **Step 4: Type-check**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Visually verify the crossfade**

With Metro running (`npx expo start --dev-client --clear --port 8082` from Task 3, reuse if still running), hardcode a mood change in `HomeScreen.tsx` (e.g. toggle a button or change the literal and reload) and ask the user to confirm on-device: the transition dissolves smoothly over ~350ms with no flash/pop/flicker, and the character never disappears entirely mid-transition.

- [ ] **Step 6: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/components/home/RoninHero.tsx
git commit -m "feat: crossfade Ronin Hero between mood panels"
```

---

### Task 5: Tap-poke interaction

**Files:**
- Modify: `apps/mobile/src/components/home/RoninHero.tsx`

**Interfaces:**
- Consumes: `glow` shared value (existing), `breathe`/`characterStyle` pattern (existing), `NEVER_REDUCE` (existing).
- Produces: no new exports — internal interaction only.

- [ ] **Step 1: Add the Pressable and haptics imports**

```tsx
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { withSequence } from 'react-native-reanimated';
```

(add `withSequence` to the existing `react-native-reanimated` named-import block from Task 4 rather than as a separate import statement).

- [ ] **Step 2: Add a poke shared value and handler**

After the existing `glow` shared value declaration, add:

```tsx
  const poke = useSharedValue(0);

  const handlePoke = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    poke.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.ease), reduceMotion: NEVER_REDUCE }),
      withTiming(0, { duration: 130, easing: Easing.in(Easing.ease), reduceMotion: NEVER_REDUCE })
    );
  };
```

- [ ] **Step 3: Fold the poke value into the existing character and glow animated styles**

Modify `characterStyle`:

```tsx
  const characterStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -breathe.value * motion.breathe },
      { scale: 1 + breathe.value * 0.006 - poke.value * 0.03 },
    ],
  }));
```

Modify `glowStyle`:

```tsx
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + (glow.value - motion.glowLow) * 0.08 + poke.value * 0.15 }],
  }));
```

(scale dips to 0.97 at `poke.value === 1` per `1 - 0.03`, then eases back to baseline as `poke.value` returns to 0; glow flares by up to 0.15 extra scale at the peak of the poke, matching the "~1.15x boost" from the design.)

- [ ] **Step 4: Wrap the character in a Pressable**

Find:

```tsx
      <Animated.View style={[styles.character, characterStyle]} pointerEvents="none">
```

Replace with:

```tsx
      <Pressable onPress={handlePoke} hitSlop={16} style={styles.character}>
        <Animated.View style={[StyleSheet.absoluteFillObject, characterStyle]}>
```

And find the matching closing tag:

```tsx
      </Animated.View>
```

(the one closing the character block — it directly follows the two `Animated.Image` elements from Task 4) and replace with:

```tsx
        </Animated.View>
      </Pressable>
```

Since `characterStyle`'s transform now lives on the inner `Animated.View` (filling the `Pressable`), remove `styles.character`'s width/aspectRatio from that inner view and instead apply `styles.character` to the outer `Pressable`. Update `styles.character` usage: the `Pressable` takes `style={styles.character}` (sizing), the inner `Animated.View` takes `StyleSheet.absoluteFillObject` plus `characterStyle` (transform only, filling the sized parent).

- [ ] **Step 5: Type-check**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Verify tap interaction and scroll behavior on-device**

With Metro running, ask the user to: (a) tap the character and confirm a light haptic + brief scale-dip-and-settle + glow flare, with no mood change; (b) scroll the parent Home screen ScrollView by dragging from on top of and around the character, confirming the scroll still works and the tap doesn't swallow the scroll gesture.

- [ ] **Step 7: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/components/home/RoninHero.tsx
git commit -m "feat: add tap-poke reaction to Ronin Hero"
```

---

## Deferred (explicitly out of scope for this plan)

- **Phase B resolution upgrade** — regenerating the 6 mood panels at 1024×1024 via image-model generation is a separate follow-up once this pass is visually approved. No code changes are needed for that swap; only the files under `apps/mobile/assets/ronin/moods/` are replaced.
- **Tier 2/3 animation** (scarf sway, blinking, Rive) — not started, per the design doc.
