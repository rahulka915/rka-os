# Home Hero: 3D Stage Redesign

## Problem

`RoninHero` currently packs greeting text, mood status, XP, and the character into one
196px-tall card, with the character confined to a `190×64` platform sized for the old
static PNG stack. The 3D companion (`Ronin3DDom`) already renders correctly there — proven
on the Profile "Me" bench, where it gets a `380`-tall panel — but on Home it's too cramped
to read as 3D at all.

## Goal

Split the Home hero into two stacked blocks: a compact greeting/status card, and a large
full-width 3D stage below it, so the character has room to actually look like a 3D
companion rather than a cropped icon.

## Approach: Stacked greeting card + full-width stage

**Two components replace the current single card:**

- `RoninGreetingCard` — compact card (auto height, ~110–120px): greeting title/subtitle,
  mood dot + supporting copy, level + XP bar. Solid `palette`-backed card, matching the
  visual weight of `InboxScrollCard`/`NextUpCard` (no scrims-over-photo — there's no photo
  background anymore, since the scene art moves out of this block).
- `RoninStage` — full-width, **300px tall**, rounded corners (16–20px), houses `RoninCharacter`
  at a large size (~80% of stage height, centered). Backdrop is a **midtone gradient with a
  subtle time-of-day tint** (not the literal time-of-day photo) — the character is
  near-black, and the bench already proved a busy/bright background flattens him at this
  size. The gradient keeps a touch of morning/afternoon/evening/night flavor without
  fighting the character for contrast.

`RoninHero.tsx` becomes a thin composer rendering both blocks stacked, so `HomeScreen.tsx`
keeps a single import and its existing `mood`/`timeOfDay`/`greeting`/`onPress` props. Both
blocks are tappable through to Profile (same `onHeroPress` as today).

`RoninCharacter.tsx` (mood→asset resolution, static/3D crossfade) is unchanged — it just
renders into a much bigger box now. `RoninScene.tsx` (time-of-day photo backgrounds) is no
longer used by the hero; check whether anything else references it before deciding whether
it becomes dead code.

## Battery/perf: pause the WebGL loop when backgrounded

`Ronin3DDom`'s `requestAnimationFrame` loop runs continuously with no pause logic today.
That's a bigger concern now that the stage is prominent on the most-visited screen.

- Add a `useAppIsActive()` hook (`AppState` listener, returns boolean) in
  `apps/mobile/src/hooks/`.
- `Ronin3DDom` gains an optional `active` prop (default `true`). When `false`, the `animate()`
  loop stops calling `requestAnimationFrame` (skips scheduling, doesn't render) but keeps the
  renderer/scene alive — no dispose/remount, so returning to the app resumes instantly
  without a reload flicker.
- `RoninCharacter` reads `useAppIsActive()` and passes it through as `active`.

**Out of scope for this pass:** pausing when the stage scrolls off-screen within Home. RN
has no native intersection observer; doing this well means hand-rolling scroll-position math
against the `ScrollView`, which is real added complexity for a single hero block that sits
near the top of the scroll. AppState pause covers the main risk (backgrounded app, screen
still mounted) at much lower cost. Revisit if profiling shows scroll-idle drain matters.

## Non-goals

- No new animation clips or rig changes (separate track — see feasibility notes from
  brainstorming: current GLB has no skeleton, richer idle motion is a future follow-up).
- No changes to mood resolution (`getRoninMood`), XP/level logic, or the Profile bench.
- No interactive tap reactions beyond the existing navigate-to-Profile tap.

## Testing

- `npx tsc --noEmit` passes.
- Manual verification on device (Metro on port 8082): confirm the stage renders the 3D
  character at the new size across all 6 moods, static→3D crossfade still works, tap
  navigates to Profile, and backgrounding the app (Home still mounted) visibly stops the
  render loop (console log) and resumes cleanly on foreground.
