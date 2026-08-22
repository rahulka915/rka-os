# Ronin full re-sheet against the "cuter" reference — generation prompts

**Status:** approved, ready for use.
**Scope:** five image-generation prompts only (external generation + a follow-up slicing/wiring pass),
no code in this pass.

## Context

On 2026-08-22 the user supplied a further-refined canonical reference,
`RONIN CHARACTER REFERENCE 16:08:2026/NEW CUTERR PNG RONIN REFERENCE (with personalised neckalce too) 16:08:26.png`
("the cuter reference"), superseding every reference used so far — including the "NEW PNG RONIN
REFERENCE" front/back/side/rear-¾ photos that the currently-shipped idle sheets
(`idle-front34`, `idle-front`) were generated against.

Decision: **all five sheets the app currently uses are redone against the cuter reference** — not just
the walk-cycle/jump/bow sheets that were already known to be pre-redesign old art. This supersedes the
"idle already validated, don't redo" note in `docs/superpowers/specs/2026-08-16-ronin-idle-animation-prompts-design.md`.

The five sheets, and what they currently back in code (`RoninWalkCycleSprite.tsx`):

| Sheet | Frames | Camera angle | Wired as |
|---|---|---|---|
| Walk cycle | 8 | strict side profile, facing right | `walking` |
| Idle front-¾ | 6 | front three-quarter | one of two `idle` variants |
| Idle front | 6 | straight-on front | one of two `idle` variants |
| Jump | 6 | matches walk-cycle's side-ish angle (see prompt) | `jump` |
| Bow | 6 | matches walk-cycle's side-ish angle (see prompt) | `bow` |

## Non-goals

- No side-profile **idle** sheet — it was already out of scope for the prior idle project (motion bug
  in the one-off attempt) and stays out of scope here; the app only ever wired front-¾ and front idle.
- No code changes in this pass. Slicing/wiring is a follow-up plan once all five raw sheets exist,
  mirroring `docs/superpowers/plans/2026-08-16-ronin-idle-animation-integration.md`'s pattern (reuse
  `build-ronin-walk-cycle-frames.py` for walk/idle at their respective frame counts; the jump/bow scripts
  already exist per `docs/superpowers/specs/2026-08-16-ronin-jump-bow-buttons-design.md`).
- Not touching `RONIN_RIVE.md` / the Rive rig project — unrelated, dormant track.

## Shared invariants (every prompt below)

Per `RoninDescription.md`'s character bible (`RONIN CHARACTER REFERENCE 16:08:2026/RoninDescription.md`,
§30 "Immutable Character Features", §33 "Sprite-Sheet Rules", §34 "Sprite Registration", §35 "Secondary
Animation", §36 "Flipbook Transparency"):

- **Identity**: South Asian medium/deep warm brown skin, enormous dark brown/black eyes, thick messy
  black/dark-brown textured hair, red forehead bandana with two red tails, dark navy wrap clothing, red
  waist sash, thin silver necklace with small ornate pendant, sword-side arm with red forearm wrap and
  black fingerless glove, opposite jewellery-side arm with cream/charcoal wrap plus one rudraksha
  bracelet and exactly two simple silver rings, soft charcoal drawstring utility bag on the jewellery
  side, brown backpack with spiral-ended bedroll, sheathed katana with black/red diamond-pattern grip and
  antique brass guard, chunky black leather boots, compact chibi proportions (very large head, short
  torso, short limbs).
- **Registration**: character scale, canvas size, and ground plane stay constant across all frames in a
  sheet — no zoom, no random grow/shrink. Only frames where locomotion specifically requires it should
  drift horizontally.
- **Secondary animation** (idle sheets only): hair, bandana tails, sash ends, and the utility bag get
  small delayed motion; the necklace and rudraksha bracelet move only very subtly.
- **Background**: flat `#00FF00` chroma-key, edge to edge, no green in the subject, no ground line,
  shadow, scenery, text, labels, numbers, borders, or watermark — matches the existing green-key/despill
  slicing pipeline (`apps/mobile/scripts/build-ronin-walk-cycle-frames.py`).
- **Input image**: `RONIN CHARACTER REFERENCE 16:08:2026/NEW CUTERR PNG RONIN REFERENCE (with personalised neckalce too) 16:08:26.png`
  is the primary visual authority — do not redesign the character, only reproduce it in a new pose/frame.

## The five prompts

### 1. Walk cycle (8 frames, side profile)

**Revision note (2026-08-22):** the first attempt at this prompt produced a sheet where frames 2-8 were
nearly identical mid-stride poses — only frame 1→2 showed a real leg-position change, so the sliced loop
held almost still for 7 of its 8 frames instead of cycling through a full gait. The fix is spelling out
each frame's leg/arm position explicitly rather than describing the cycle only in prose, mirroring how
the original (smooth) pre-redesign walk-cycle sheet visibly alternated leg extension every single frame.

> Use case: style-transfer. Asset type: 8-frame side-profile walk-cycle sprite sheet for a mobile-app
> character widget. Input image: the supplied canonical chibi ronin reference photo. Primary request:
> generate one full-body strict side profile view, facing right, showing eight sequential frames of one
> complete walking stride cycle, with each frame's leg and arm positions clearly and visibly DIFFERENT
> from its neighbors — this is the most important requirement, more important than any single frame's
> polish. Follow this exact 8-frame pose breakdown, evenly spaced through one full stride (two steps):
> Frame 1 — front leg (nearer viewer) fully forward and straight, heel striking the ground, back leg
> fully extended backward and straight, opposite arm swung forward, near arm swung back. Frame 2 — front
> leg starting to bend and take weight, back leg beginning to lift off the ground and bend at the knee,
> torso dropped slightly lower (weight-bearing dip). Frame 3 — legs crossing at their closest together
> (passing position), body at its highest point, both knees bent, this is the vertical midpoint between
> the two extremes. Frame 4 — the leg that was back is now swinging forward and bent high underneath the
> body, the other leg straightening behind, arms swapped from frame 1's positions. Frame 5 — mirror of
> frame 1 with legs swapped: the leg that started back is now fully forward and straight striking the
> ground, the other leg fully extended backward, arms swapped to match. Frame 6 — mirror of frame 2 with
> legs swapped. Frame 7 — mirror of frame 3 (passing position again, legs crossing, body at its highest
> point). Frame 8 — mirror of frame 4 with legs swapped, flowing back into frame 1's exact pose for a
> seamless loop. Maintain exact character identity, proportions, and equipment from the reference image
> across every frame: warm medium-to-deep brown South Asian skin, enormous dark brown/black eyes, thick
> messy black/dark-brown textured hair, red forehead bandana with two asymmetric tails, dark navy wrap
> outfit, red waist sash, thin silver necklace with small ornate pendant, sword-side arm with red forearm
> wrap and black fingerless glove, opposite jewellery-side arm with cream/charcoal wrap, one rudraksha
> bracelet and exactly two simple silver rings, soft charcoal drawstring utility bag on the jewellery
> side, brown backpack with spiral-ended bedroll, sheathed katana with black/red diamond-pattern grip and
> antique brass guard, and chunky black leather boots. Compact chibi proportions: very large head, short
> torso, short limbs. Hair, bandana tails, sash ends, and the utility bag trail with the motion. Character
> stays at a constant scale and a shared ground-line baseline across all eight frames — no zooming or
> growing/shrinking, only the natural small vertical bob described in the frame breakdown above. Style:
> premium chibi anime/game illustration, confident dark outlines, subtly varied line weight, restrained
> cel shading, lightly hand-painted texture — matching the supplied reference exactly, not a redesign.
> Composition: arrange the eight frames left to right in one row, each character centered in its own
> equal-width cell, consistent scale and head-top anchor across all eight frames, generous even padding,
> fully visible, no crop. Background: perfectly flat uniform #00FF00 chroma-key green edge to edge across
> the whole sheet. No green in the subject. No ground line, shadow, scenery,
> text, labels, numbers, borders, or watermark.

### 2. Idle — front-¾ (6 frames)

> Use case: style-transfer. Asset type: 6-frame idle-breathing sprite sheet for a mobile-app character
> widget. Input image: the supplied canonical chibi ronin reference photo. Primary request: generate one
> full-body front-¾ view (three-quarter turn toward the viewer) showing six sequential frames of a
> subtle breathing/idle-sway loop — chest rising and falling gently, a tiny weight shift, hair and the
> two red bandana tails drifting slightly, the crimson sash ends and the soft charcoal utility bag
> settling with small delayed motion. The character must stay planted in place: feet, hips, and overall
> position do not move or step; only chest, shoulders, hair, cloth, and jewellery show motion. Frame 6
> must flow seamlessly back into frame 1 for a perfect loop. Maintain exact character identity,
> proportions, and equipment from the reference image across every frame: warm medium-to-deep brown
> South Asian skin, enormous dark brown/black eyes, thick messy black/dark-brown textured hair, red
> forehead bandana with two asymmetric tails, dark navy wrap outfit, red waist sash, thin silver necklace
> with small ornate pendant, sword-side arm with red forearm wrap and black fingerless glove, opposite
> jewellery-side arm with cream/charcoal wrap, one rudraksha bracelet and exactly two simple silver
> rings, soft charcoal drawstring utility bag on the jewellery side, brown backpack with spiral-ended
> bedroll, sheathed katana with black/red diamond-pattern grip and antique brass guard, and chunky black
> leather boots. Compact chibi proportions: very large head, short torso, short limbs. Preserve which
> side carries the sword versus the jewellery exactly as shown in the reference at this ¾ angle — do not
> mirror or swap them. Style: premium chibi anime/game illustration, confident dark outlines, subtly
> varied line weight, restrained cel shading, lightly hand-painted texture — matching the supplied
> reference exactly, not a redesign. Composition: arrange the six frames left to right in one row, each
> character centered in its own equal-width cell, consistent scale and head-top anchor across all six
> frames, generous even padding, fully visible, no crop. Background: perfectly flat uniform #00FF00
> chroma-key green edge to edge across the whole sheet. No green in the subject. No ground line, shadow,
> scenery, text, labels, numbers, borders, or watermark.

### 3. Idle — straight-on front (6 frames)

> Use case: style-transfer. Asset type: 6-frame idle-breathing sprite sheet for a mobile-app character
> widget. Input image: the supplied canonical chibi ronin reference photo. Primary request: generate one
> full-body straight-on front view (facing directly at the viewer) showing six sequential frames of a
> subtle breathing/idle-sway loop — chest rising and falling gently, a tiny weight shift, hair and the
> two red bandana tails drifting slightly, the crimson sash ends and the soft charcoal utility bag
> settling with small delayed motion. The character must stay planted in place: feet, hips, and overall
> position do not move or step; only chest, shoulders, hair, cloth, and jewellery show motion. Frame 6
> must flow seamlessly back into frame 1 for a perfect loop. Maintain exact character identity,
> proportions, and equipment from the reference image across every frame: warm medium-to-deep brown
> South Asian skin, enormous dark brown/black eyes, thick messy black/dark-brown textured hair, red
> forehead bandana with two asymmetric tails, dark navy wrap outfit, red waist sash, thin silver necklace
> with small ornate pendant, sword-side arm with red forearm wrap and black fingerless glove, opposite
> jewellery-side arm with cream/charcoal wrap, one rudraksha bracelet and exactly two simple silver
> rings, soft charcoal drawstring utility bag on the jewellery side, brown backpack with spiral-ended
> bedroll, sheathed katana with black/red diamond-pattern grip and antique brass guard, and chunky black
> leather boots. Compact chibi proportions: very large head, short torso, short limbs. At this
> straight-on angle, resolve arm asymmetry correctly per the reference: the sword arm (red wrap, black
> glove) and the jewellery arm (cream/charcoal wrap, bracelet, rings) must land on their correct,
> unswapped sides — do not mirror the character. Style: premium chibi anime/game illustration, confident
> dark outlines, subtly varied line weight, restrained cel shading, lightly hand-painted texture —
> matching the supplied reference exactly, not a redesign. Composition: arrange the six frames left to
> right in one row, each character centered in its own equal-width cell, consistent scale and head-top
> anchor across all six frames, generous even padding, fully visible, no crop. Background: perfectly flat
> uniform #00FF00 chroma-key green edge to edge across the whole sheet. No green in the subject. No
> ground line, shadow, scenery, text, labels, numbers, borders, or watermark.

### 4. Jump (6 frames)

> Use case: style-transfer. Asset type: 6-frame jump sprite sheet for a mobile-app character widget.
> Input image: the supplied canonical chibi ronin reference photo. Primary request: generate one
> full-body view at roughly the same camera angle as a strict side-profile walk-cycle (a slight
> front-of-side angle is acceptable if it reads more naturally for a jump), showing six sequential frames
> of one complete vertical hop: crouch/anticipation, launch, apex (airborne, both feet off the ground,
> arms slightly out for balance), descent, landing/impact, and a brief settle back to the standing idle
> pose, so the sheet plays once and ends back at a normal standing pose (does not need to loop back to
> frame 1). Maintain exact character identity, proportions, and equipment from the reference image across
> every frame: warm medium-to-deep brown South Asian skin, enormous dark brown/black eyes, thick messy
> black/dark-brown textured hair, red forehead bandana with two asymmetric tails, dark navy wrap outfit,
> red waist sash, thin silver necklace with small ornate pendant, sword-side arm with red forearm wrap
> and black fingerless glove, opposite jewellery-side arm with cream/charcoal wrap, one rudraksha
> bracelet and exactly two simple silver rings, soft charcoal drawstring utility bag on the jewellery
> side, brown backpack with spiral-ended bedroll, sheathed katana with black/red diamond-pattern grip and
> antique brass guard, and chunky black leather boots. Compact chibi proportions: very large head, short
> torso, short limbs. Hair, bandana tails, sash ends, and the utility bag react energetically to the hop
> (more motion than the idle sheets, since this is an intentional celebratory gesture). Character stays
> at a consistent scale within its own cell across all six frames — only the character's vertical
> position within its cell should change to depict the hop, the canvas/ground reference itself does not
> zoom. Style: premium chibi anime/game illustration, confident dark outlines, subtly varied line weight,
> restrained cel shading, lightly hand-painted texture — matching the supplied reference exactly, not a
> redesign. Composition: arrange the six frames left to right in one row, each character centered
> horizontally in its own equal-width cell with enough vertical headroom in the cell for the character to
> rise during the jump, consistent scale across all six frames, generous even padding, fully visible, no
> crop. Background: perfectly flat uniform #00FF00 chroma-key green edge to edge across the whole sheet.
> No green in the subject. No ground line, shadow, scenery, text, labels, numbers, borders, or watermark.

### 5. Bow (6 frames)

> Use case: style-transfer. Asset type: 6-frame bowing-down sprite sheet for a mobile-app character
> widget. Input image: the supplied canonical chibi ronin reference photo. Primary request: generate one
> full-body view at roughly the same camera angle as a strict side-profile walk-cycle (a slight
> front-of-side angle is acceptable if it reads more naturally for a bow), showing six sequential frames
> of one complete gentle bowing-down gesture: standing idle, beginning to bend forward at the waist,
> deepest point of the bow (torso leaned forward, knees slightly bent, head lowered, one hand reaching
> down as if to gently pet something small on the ground), holding briefly, then straightening back up to
> the standing idle pose. Maintain exact character identity, proportions, and equipment from the
> reference image across every frame: warm medium-to-deep brown South Asian skin, enormous dark
> brown/black eyes, thick messy black/dark-brown textured hair, red forehead bandana with two asymmetric
> tails, dark navy wrap outfit, red waist sash, thin silver necklace with small ornate pendant, sword-side
> arm with red forearm wrap and black fingerless glove, opposite jewellery-side arm with cream/charcoal
> wrap, one rudraksha bracelet and exactly two simple silver rings, soft charcoal drawstring utility bag
> on the jewellery side, brown backpack with spiral-ended bedroll, sheathed katana with black/red
> diamond-pattern grip and antique brass guard, and chunky black leather boots. Compact chibi
> proportions: very large head, short torso, short limbs. Hair, bandana tails, the necklace, and the
> utility bag swing forward slightly with the bow's momentum. Character's feet stay roughly planted (the
> bow is a torso-bend, not a step) and stays at a consistent scale within its own cell across all six
> frames. Style: premium chibi anime/game illustration, confident dark outlines, subtly varied line
> weight, restrained cel shading, lightly hand-painted texture — matching the supplied reference exactly,
> not a redesign. Composition: arrange the six frames left to right in one row, each character centered
> in its own equal-width cell, consistent scale and a shared top-of-cell reference point across all six
> frames, generous even padding, fully visible, no crop. Background: perfectly flat uniform #00FF00
> chroma-key green edge to edge across the whole sheet. No green in the subject. No ground line, shadow,
> scenery, text, labels, numbers, borders, or watermark.

## Follow-up (separate plan, once all five raw sheets exist)

1. Drop each raw sheet at:
   - `apps/mobile/assets/ronin/journey/walk-cycle/source/ronin-walk-sheet-raw.png` (replacing the current
     old-art source)
   - `apps/mobile/assets/ronin/journey/idle-front34/source/ronin-idle-front34-sheet-raw.png` (replace)
   - `apps/mobile/assets/ronin/journey/idle-front/source/ronin-idle-front-sheet-raw.png` (replace)
   - `apps/mobile/assets/ronin/journey/jump/source/ronin-jump-sheet-raw.png` (replace)
   - `apps/mobile/assets/ronin/journey/tap-reaction/source/ronin-tap-sheet-raw.png` (replace — this is the
     `bow` sheet, named `tap-reaction`/`ronin-tap-*` in code/assets for historical reasons)
2. Re-run the existing slicing scripts against each (same frame counts as today: 8/6/6/6/6) to overwrite
   the numbered frame PNGs in place — no code changes needed, since `RoninWalkCycleSprite.tsx` already
   `require()`s these exact paths/filenames.
3. Visual spot-check per sheet (loop continuity for walk/idle, natural start→end for jump/bow, no green
   fringe) and an on-device pass confirming all five states still play correctly together (matches
   `docs/superpowers/plans/2026-08-16-ronin-idle-animation-integration.md` Task 4's checklist).
4. Commit each sheet's replacement frames separately, same convention as the existing per-sheet commits
   (e.g. `feat: reslice Ronin walk-cycle sprite sheet against cuter reference`).
