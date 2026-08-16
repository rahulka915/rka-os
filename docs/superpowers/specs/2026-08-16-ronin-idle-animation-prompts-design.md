# Ronin idle-animation generation prompts — design

**Status:** approved, ready for use.
**Scope:** three image-generation prompts only (external generation + a future slicing pass), no code in
this pass.

## Context

A brand-new canonical reference for the Ronin character was supplied on 2026-08-16
(`RONIN CHARACTER REFERENCE 16:08:2026/`: front, back, right-side, right-rear-¾ photos, plus
`RoninDescription.md`, the full character bible). This redesigns the character from the one used by the
existing walk-cycle/jump/bow sprite sheets (e.g. black leather boots instead of brown, silver necklace,
rudraksha bracelet, asymmetric red/glove vs cream/rings arms, spiral bedroll, South-Asian chibi identity)
— see `RoninDescription.md` §30 "Immutable Character Features" for the authoritative list.

The Home journey widget's idle state currently has no dedicated animation — it just holds frame 1 of the
walk cycle (`apps/mobile/src/components/home/RoninWalkCycleSprite.tsx`'s `SPRITE_STATES`, per
`docs/superpowers/specs/2026-08-16-ronin-jump-bow-buttons-design.md`). This project's goal is a real idle
loop, generated fresh against the new reference art, before any of the existing walk/jump/bow sheets are
redone against it.

## Decisions

- **Three idle sheets**, one per camera angle: side profile (facing right, matching the existing
  walk-cycle angle), front-¾, and straight-on front.
- **Same motion on all three**: subtle breathing/sway only — chest rise/fall, tiny weight shift, small
  delayed drift in hair, bandana tails, sash ends, and the utility bag. No steps, no large gestures.
  Matches `RoninDescription.md` §35 "Secondary Animation."
- **6 frames per sheet**, one full breath cycle, seamlessly looping (frame 6 flows back into frame 1).
- **Registration**: feet/hip stay planted — per §34 "Sprite Registration," idle motion happens through
  chest/shoulders/hair/cloth, not by moving the whole character or the ground plane.
- **Background**: flat `#00FF00` chroma-key, matching every other prompt in
  `docs/design-system/reference/prompt-library.md`, for the same downstream soft-matte/despill pipeline.
- **Straight-on front angle** must resolve arm asymmetry correctly per §32 "Camera-Angle Rule" — sword
  arm (red wrap + black glove) and jewellery arm (cream/charcoal wrap + rudraksha + two silver rings)
  must land on their correct, unswapped sides.

## Non-goals

- Not redoing the walk-cycle, jump, or bow sheets against the new reference (separate follow-up once
  idle is validated).
- No slicing script or component work yet — these prompts only produce the raw green-screen sheets. The
  crop/anchor/despill/integration pipeline (mirroring `build-ronin-walk-cycle-frames.py`) is a follow-up
  plan once sheets exist to slice.

## The three prompts

Each prompt is written for the built-in image-generation tool, using the four new reference photos in
`RONIN CHARACTER REFERENCE 16:08:2026/` as input/edit-target images, and should be run three times (once
per prompt) to produce three separate 6-frame sheets.

### 1. Side-profile idle (facing right)

> Use case: style-transfer. Asset type: 6-frame idle-breathing sprite sheet for a mobile-app character
> widget. Input image: the four supplied canonical reference photos (front, back, right-side,
> right-rear-¾) of the South Asian chibi ronin. Primary request: generate one full-body strict side
> profile view, facing right, showing six sequential frames of a subtle breathing/idle-sway loop —
> chest rising and falling gently, a tiny weight shift, hair and the two red bandana tails drifting
> slightly, the crimson sash ends and the soft charcoal utility bag settling with small delayed motion.
> The character must stay planted in place: feet, hips, and overall position do not move or step; only
> chest, shoulders, hair, cloth, and jewellery show motion. Frame 6 must flow seamlessly back into frame
> 1 for a perfect loop. Maintain exact character identity, proportions, and equipment from the reference
> images across every frame: warm medium-to-deep brown South Asian skin, enormous dark brown/black eyes,
> thick messy black/dark-brown textured hair, red forehead bandana with two asymmetric tails, dark navy
> wrap outfit, red waist sash, thin silver necklace with small ornate pendant, sword-side arm with red
> forearm wrap and black fingerless glove, opposite jewellery-side arm with cream/charcoal wrap, one
> rudraksha bracelet and exactly two simple silver rings, brown backpack with spiral-ended bedroll,
> sheathed katana with black/red diamond-pattern grip and antique brass guard, and chunky black leather
> boots. Compact chibi proportions: very large head, short torso, short limbs. Style: premium chibi
> anime/game illustration, confident dark outlines, subtly varied line weight, restrained cel shading,
> lightly hand-painted texture — matching the supplied reference exactly, not a redesign. Composition:
> arrange the six frames left to right in one row, each character centered in its own equal-width cell,
> consistent scale and head-top anchor across all six frames, generous even padding, fully visible, no
> crop. Background: perfectly flat uniform #00FF00 chroma-key green edge to edge across the whole sheet.
> No green in the subject. No ground line, shadow, scenery, text, labels, numbers, borders, or watermark.

### 2. Front-¾ idle

> Use case: style-transfer. Asset type: 6-frame idle-breathing sprite sheet for a mobile-app character
> widget. Input image: the four supplied canonical reference photos (front, back, right-side,
> right-rear-¾) of the South Asian chibi ronin. Primary request: generate one full-body front-¾ view
> (three-quarter turn toward the viewer, matching the angle and orientation of the supplied front-¾-style
> reference photos) showing six sequential frames of a subtle breathing/idle-sway loop — chest rising and
> falling gently, a tiny weight shift, hair and the two red bandana tails drifting slightly, the crimson
> sash ends and the soft charcoal utility bag settling with small delayed motion. The character must stay
> planted in place: feet, hips, and overall position do not move or step; only chest, shoulders, hair,
> cloth, and jewellery show motion. Frame 6 must flow seamlessly back into frame 1 for a perfect loop.
> Maintain exact character identity, proportions, and equipment from the reference images across every
> frame: warm medium-to-deep brown South Asian skin, enormous dark brown/black eyes, thick messy
> black/dark-brown textured hair, red forehead bandana with two asymmetric tails, dark navy wrap outfit,
> red waist sash, thin silver necklace with small ornate pendant, sword-side arm with red forearm wrap
> and black fingerless glove, opposite jewellery-side arm with cream/charcoal wrap, one rudraksha
> bracelet and exactly two simple silver rings, brown backpack with spiral-ended bedroll, sheathed katana
> with black/red diamond-pattern grip and antique brass guard, and chunky black leather boots. Compact
> chibi proportions: very large head, short torso, short limbs. Preserve which side carries the sword
> versus the jewellery exactly as shown in the reference photos at this ¾ angle — do not mirror or swap
> them. Style: premium chibi anime/game illustration, confident dark outlines, subtly varied line weight,
> restrained cel shading, lightly hand-painted texture — matching the supplied reference exactly, not a
> redesign. Composition: arrange the six frames left to right in one row, each character centered in its
> own equal-width cell, consistent scale and head-top anchor across all six frames, generous even
> padding, fully visible, no crop. Background: perfectly flat uniform #00FF00 chroma-key green edge to
> edge across the whole sheet. No green in the subject. No ground line, shadow, scenery, text, labels,
> numbers, borders, or watermark.

### 3. Straight-on front idle

> Use case: style-transfer. Asset type: 6-frame idle-breathing sprite sheet for a mobile-app character
> widget. Input image: the four supplied canonical reference photos (front, back, right-side,
> right-rear-¾) of the South Asian chibi ronin. Primary request: generate one full-body straight-on
> front view (camera directly facing the character, matching the angle of the supplied front reference
> photo) showing six sequential frames of a subtle breathing/idle-sway loop — chest rising and falling
> gently, a tiny weight shift, hair and the two red bandana tails drifting slightly, the crimson sash
> ends and the soft charcoal utility bag settling with small delayed motion. The character must stay
> planted in place: feet, hips, and overall position do not move or step; only chest, shoulders, hair,
> cloth, and jewellery show motion. Frame 6 must flow seamlessly back into frame 1 for a perfect loop.
> Maintain exact character identity, proportions, and equipment from the reference images across every
> frame: warm medium-to-deep brown South Asian skin, enormous dark brown/black eyes, thick messy
> black/dark-brown textured hair, red forehead bandana with two asymmetric tails, dark navy wrap outfit,
> red waist sash, thin silver necklace with small ornate pendant, sword-side arm with red forearm wrap
> and black fingerless glove, opposite jewellery-side arm with cream/charcoal wrap, one rudraksha
> bracelet and exactly two simple silver rings, brown backpack with spiral-ended bedroll (visible only as
> shoulder straps from this angle, per the reference), sheathed katana with black/red diamond-pattern
> grip and antique brass guard visible at the hip, and chunky black leather boots. Compact chibi
> proportions: very large head, short torso, short limbs. Critical: resolve left/right arm asymmetry
> correctly for a straight-on view — verify against the reference photos which arm (viewer-left or
> viewer-right) carries the red wrap/black glove versus the cream/charcoal wrap/rudraksha/rings, and keep
> that assignment identical across all six frames. Style: premium chibi anime/game illustration,
> confident dark outlines, subtly varied line weight, restrained cel shading, lightly hand-painted
> texture — matching the supplied reference exactly, not a redesign. Composition: arrange the six frames
> left to right in one row, each character centered in its own equal-width cell, consistent scale and
> head-top anchor across all six frames, generous even padding, fully visible, no crop. Background:
> perfectly flat uniform #00FF00 chroma-key green edge to edge across the whole sheet. No green in the
> subject. No ground line, shadow, scenery, text, labels, numbers, borders, or watermark.

## Follow-up (not this pass)

Once the three raw sheets are generated and saved (suggested location:
`apps/mobile/assets/ronin/journey/idle/source/`), a follow-up plan is needed to slice/anchor/despill each
into 6 numbered transparent PNGs and wire a new `idle` sprite-state entry into
`RoninWalkCycleSprite.tsx`'s `SPRITE_STATES` (mirroring the jump/bow pipeline in
`docs/superpowers/specs/2026-08-16-ronin-jump-bow-buttons-design.md`) — including deciding whether all
three angle variants ship at once or the side-profile one lands first since it's a drop-in replacement
for the current static idle frame.
