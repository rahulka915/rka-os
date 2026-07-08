# Ronin Hero — Build Plan (Tier 1: PNG-first, ship now)

Audience: an executing agent (Sonnet). Everything here is self-contained; do the tasks in order.
Do NOT redesign the mood system, animation values, or card layout — they are approved and working.

## Context (read first)

- The app already has a working mood-driven hero: [src/components/home/RoninHero.tsx](src/components/home/RoninHero.tsx)
  renders an SVG character with Reanimated breathing/glow loops; [src/utils/roninMood.ts](src/utils/roninMood.ts)
  maps app state → 6 moods; [src/screens/HomeScreen.tsx](src/screens/HomeScreen.tsx) wires real data in.
- The approved artwork is `assets/ronin/codex-vector/normal.png` — a 2172×724 character sheet with
  6 mood panels left→right in this order: **normal, alert, tired, focused, overwhelmed, resolved**.
- Vector-tracing this art loses fidelity. Tier 1 uses the PNG panels **directly** (Finch/Not Boring
  pattern: raster character, container-level animation). Keep the existing SVG aura/shadow in code.
- Hard-won gotchas already encoded in the codebase — do not regress them:
  - Every Reanimated `withTiming`/`withRepeat` must pass `ReduceMotion.Never` (character must never freeze).
  - No mood may have zero motion amplitude.
  - In generated SVG strings: no `rotate()` transforms; no fill+stroke on the same traced compound path;
    newlines between sibling top-level elements. (Less relevant once character is a PNG, but the aura
    layer still uses SvgXml.)

## Task 1 — Extract the 6 mood panels

Tools available: ImageMagick (`magick`) is installed.

1. Panels are equal-width sixths of the 2172×724 sheet (≈362px each). Verify visually before batch-cropping:
   crop panel 1 (`magick normal.png -crop 362x724+0+0 +repage /tmp/p1.png`), inspect, adjust x-offsets if
   the panel dividers (thin vertical gold lines) land inside a crop — trim a few px per side to exclude them
   and the corner diamonds / border frame.
2. For each panel: make the uniform dark background (#0d0d0e-ish) transparent via corner flood-fill,
   e.g. `magick panel.png -fuzz 6% -fill none -floodfill +2+2 "#0d0d0e" -floodfill +359+2 "#0d0d0e" ...` for
   all four corners. The character is enclosed by a gold outline, so the fill will not leak into the cloak
   (the cloak is nearly the same color as the bg — the outline is the boundary that protects it).
   Verify each result on a bright background to confirm the character is intact and bg is gone.
3. Trim transparent margins (`-trim +repage`) and save to `assets/ronin/moods/{normal,alert,tired,focused,overwhelmed,resolved}.png`.
4. Record the final pixel dimensions of a trimmed panel — needed for the aspectRatio in Task 2.

## Task 2 — Render PNGs in RoninHero

Edit [src/components/home/RoninHero.tsx](src/components/home/RoninHero.tsx):

1. Add a mood→require map:
   ```ts
   const MOOD_IMAGES: Record<RoninMood, number> = {
     normal: require('../../../assets/ronin/moods/normal.png'),
     // ... all 6
   };
   ```
2. Replace the character `<SvgXml xml={RONIN_STATE_XML[mood]} …>` with an `<Image source={MOOD_IMAGES[mood]} …>`
   (keep the same Animated.View wrapper + `characterStyle` so breathing keeps working; `resizeMode="contain"`).
3. Update `styles.character` aspectRatio to the trimmed panel dimensions from Task 1. Size the character
   to roughly 70–80% of the card height, centered.
4. Keep the aura `SvgXml` layer exactly as is (it must sit BEHIND the image; it will now show through the
   transparent panel background).
5. `shadowRoninStates.ts` keeps exporting `RONIN_GLOW_XML` (still used); `RONIN_STATE_XML` becomes unused —
   remove the import and delete the dead export only if nothing else references it.
6. `npx tsc --noEmit` must pass.

## Task 3 — Mood crossfade

Mood changes currently hard-swap the image. Add a crossfade:
- Render two stacked `<Image>`s (previous mood, current mood); on mood change animate opacities over ~350ms
  with Reanimated (`ReduceMotion.Never` as everywhere else). A simple `useState` for prevMood + shared value
  progress is fine. No spring/bounce — timing with easeInOut.

## Task 4 — Tap interaction

- Wrap the character in a `Pressable` (currently `pointerEvents="none"` — remove that from the character wrapper).
- On press: `Haptics.impactAsync(Light)` + briefly boost the glow shared value (pulse up to ~1.15 then settle),
  and scale the character to 0.97 → 1 over ~250ms. No mood change on tap (keep it a "poke" reaction).
- Keep hitSlop reasonable; do not intercept scroll gestures of the parent ScrollView beyond the character bounds.

## Task 5 — Verify

- `npx tsc --noEmit`.
- Metro runs on **port 8082** (8081 may be occupied by an unrelated project):
  `npx expo start --dev-client --clear --port 8082`. The user connects the dev client to
  `http://<mac-ip>:8082` and confirms visually — you cannot see the device.
- Check all 6 moods render (temporarily force each mood in HomeScreen if needed, then revert).

## Out of scope for this plan (Tier 2/3, do not start)

- Layered per-part transparent PNGs from Codex (scarf sway, blink) — needs new art first.
- Rive integration (`rive-react-native`, dev build) — end state, after look is locked.
