# Ronin Jump/Bow Action Buttons — Design

## Problem

`RoninJourneyPrototype.tsx`'s Home widget currently overloads a single tap on
the character: `handlePress` simultaneously (a) plays the wrapper's hop/scale
"reaction" transform (`reaction.value` sequence — an upward bounce) and (b)
switches the sprite to its `tapReaction` frames, which are actually a
bow-down-to-pet-the-cat animation. Playing an upward hop and a downward bow at
the same time reads as a muddled, conflicting motion — confirmed against the
actual `tap-reaction/ronin-tap-0{1,3,6}.png` frames, which show idle → bow →
idle, not a jump.

There is currently no jump artwork at all. The fix is to stop conflating two
different actions under one ambiguous tap and instead give the character two
explicit, distinct actions — Jump and Bow — each triggered by its own small
button, with the character tap itself reduced to a light acknowledgment.

## Goals

- Character tap keeps a light reaction (hop/scale bounce only), decoupled
  from any sprite-state change.
- A Jump button plays a real jump sprite animation plus the hop transform.
- A Bow button plays the existing bow-down sprite animation, with no
  competing hop transform.
- Both buttons are small always-visible overlay controls on the journey
  widget itself (in-game HUD style), not a separate row below the card, and
  not gated behind a long-press reveal.
- Only one one-shot animation (jump or bow) plays at a time — a button press
  while one is already mid-animation is ignored.

## Non-goals

- No changes to the walk-cycle, idle, or hold-to-preview-walk behavior.
- No new npm dependencies.
- No web port in this pass (native/iOS only, matching the existing
  walk-cycle and tap-reaction work) — no `WEB_PARITY.md` update needed since
  this widget isn't on web.

## Design

### 1. Rename `tapReaction` → `bow`

`roninSpriteStates.ts`'s `RoninSpriteState` union changes from
`'idle' | 'walking' | 'tapReaction'` to `'idle' | 'walking' | 'jump' | 'bow'`.
`RoninWalkCycleSprite.tsx`'s `SPRITE_STATES` registry renames the
`tapReaction` entry to `bow` (same six `ronin-tap-0N.png` frames, same
`loopMode: 'once'`, same 90ms interval) and adds a new `jump` entry.

### 2. New jump asset pipeline (mirrors the existing tap-reaction/walk-cycle pattern)

- You generate a raw green-screen jump-pose sheet externally and save it to
  `apps/mobile/assets/ronin/journey/jump/source/ronin-jump-sheet-raw.png`.
- A new `apps/mobile/scripts/build-ronin-jump-frames.py`, adapted from the
  existing `build-ronin-walk-cycle-frames.py` slicing/alignment/despill
  approach (green-key + head-top anchor + shared canvas size), slices it into
  `ronin-jump-01.png` … `ronin-jump-0N.png` in
  `apps/mobile/assets/ronin/journey/jump/`. Frame count matches however many
  poses the generated sheet actually contains (the script's
  `FRAME_COUNT`/connected-component check is set to match, same as the walk
  cycle script's `FRAME_COUNT = 8` constant).
- `RoninWalkCycleSprite.tsx` requires the new frame files into a
  `JUMP_FRAMES` array and registers a `jump: { frames: JUMP_FRAMES,
  intervalMs: ..., loopMode: 'once' }` entry.

### 3. Decouple character tap from sprite state

`RoninJourneyPrototype.tsx`'s `handlePress` no longer sets `isTapReacting` or
otherwise changes `spriteState` — it only runs the existing `reaction.value`
`withSequence` hop/scale animation. `isTapReacting` and
`handleTapReactionComplete` are replaced by two new pieces of state,
`activeAction: 'jump' | 'bow' | null` and its completion handler:

- `spriteState` becomes: `activeAction === 'jump' ? 'jump' : activeAction ===
  'bow' ? 'bow' : isWalking ? 'walking' : 'idle'`.
- `handleActionComplete(action)` clears `activeAction` back to `null` when
  `RoninWalkCycleSprite`'s `onComplete` fires, but only if the completing
  action still matches the current one (guards against a stale timer from a
  superseded action).

### 4. Jump / Bow buttons

Two small (~34pt) circular semi-transparent icon buttons, top-right corner of
the journey card, above the sunset background/scrim but not overlapping the
heading text or blocking the main `Pressable`'s tap/hold area (they sit in
their own `Pressable`s, `zIndex` above the card's main Pressable, positioned
via `position: 'absolute'`). Icons: a simple up-arrow-style glyph for Jump, a
simple bowing-figure/down-chevron glyph for Bow — reuse `lucide-react-native`
(already a dependency) rather than new artwork; exact icon choice is an
implementation detail, not a design blocker.

Each button's `onPress`:
- No-ops if `activeAction !== null` (an animation is already playing) —
  prevents overlapping jump/bow.
- Otherwise: haptic tick (`Haptics.impactAsync(Light)`), set
  `activeAction` to `'jump'` or `'bow'`.
- Jump additionally re-triggers the existing `reaction.value` hop/scale
  sequence (same motion as a character tap, now bundled with the jump sprite
  instead of the bow sprite). Bow does not touch `reaction.value`.

### 5. Accessibility

Each button gets its own `accessibilityRole="button"` and
`accessibilityLabel` ("Jump" / "Bow"), independent of the main Pressable's
existing `accessibilityHint` ("Tap for a reaction, hold to preview the
walk") — that hint's copy is unchanged since the tap reaction itself still
exists, just lighter.

## Testing

Pure logic (frame registry membership, `activeAction` no-op-while-busy rule)
is small enough to fall under the existing manual-verification convention
already used for `RoninJourneyPrototype`'s tap/hold behavior — no new pure
helper functions are introduced by this change (unlike the walk-cycle plan's
`getNextSpriteFrame`, which already exists and is reused as-is for the new
`jump` state). Verification is on-device: confirm tap still hops without
switching sprite, confirm each button plays its full animation once and
reverts, confirm pressing one button while the other's animation is running
is ignored.
