# Prompt Library

Reusable prompts for generating on-style assets (icons, illustrations, UI mockups) in the established RKA.OS visual language. Empty today — `docs/design/RKA_CUSTOM_ICON_AUDIT.md` references "prompt history in conversation" for the current dock-icon set that was never actually captured anywhere, which is the exact gap this file exists to close.

**When you write a prompt that produces an asset that ships** (an icon, illustration, or mockup that gets committed and used), paste the actual prompt here alongside what it produced, so the next person/agent doesn't have to reverse-engineer the style from the output alone or re-derive it from scratch. Format:

```
## <asset name / concept>
**Produced:** <file path once shipped>
**Prompt:**
<verbatim prompt text>
**Notes:** <anything about iteration — what was rejected, what changed>
```

## Collection object set — Workout, Habit, To Get, Archive
**Produced:**
- `apps/mobile/assets/icons/collections/workout-kettlebell.png`
- `apps/mobile/assets/icons/collections/habit-prayer-beads.png`
- `apps/mobile/assets/icons/collections/to-get-furoshiki.png`
- `apps/mobile/assets/icons/collections/archive-scroll-chest.png`

**Prompt:**

Shared prompt used for all four separate generations:

> Use case: stylized-concept. Asset type: premium mobile collection icon, ultimately displayed at 28–34 pt. Input images: the supplied RKA.OS Task note, Project portfolio, and Medication bottle are strict style references. Style/medium: highly polished tactile miniature 3D object render; match the references' depth, material detail, rounded forms, subtle handcrafted texture, warm studio highlights, realistic occlusion, and premium game-inventory-icon finish. Composition/framing: one centered object, front three-quarter view, square canvas, generous even padding, strong readable silhouette, subject occupies about 72% of canvas. Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for removal; uniform color only, no gradient, texture, floor, cast shadow, reflection, or lighting variation. Constraints: no text, no letters, no watermark, no outer badge or app-icon tile, no circular background; object only; never use #00ff00 in the subject.

Workout subject:

> A distinctive Japanese-inspired workout/training object: a substantial black lacquer kettlebell with a warm bronze handle wrapped at the grip in cream athletic cord, a small deep-orange/red enamel accent, dimensional metal fittings, believable weight and fine surface texture. It must unmistakably read as workout equipment, not a handbag or padlock.

Habit subject:

> A distinctive habit/ritual object: a compact loop of polished Japanese prayer beads resting around a small dark lacquer tally tile, with a warm ivory check-shaped inlay and a restrained red silk tassel. The beads, wood grain, cord, knot, and tile must have rich dimensional depth. It must communicate repeated ritual and completion, not jewelry or a loading spinner.

To Get subject:

> A distinctive To Get/shopping object: a premium indigo-and-dusty-rose furoshiki-wrapped parcel with convincing folded cloth, tied top knot, a small cream washi tag without writing, subtle brass clasp detail, fine textile weave and rich soft shadows. It must unmistakably read as an item to acquire or wrapped purchase, not a generic flat shopping-bag glyph.

Archive subject:

> A distinctive archive destination object: a compact black lacquer Japanese document chest holding the visible ends of two rolled parchment scrolls, with warm brass corners, hinges and central clasp, subtle wood/lacquer texture and rich interior shadow. It must unmistakably read as stored records/archive, not a generic inbox or printer.

**Notes:** The first implementation was a hand-authored filled SVG set. It was rejected after on-device review because it looked flat beside the established Task, Project and Medication renders. These replacements were generated separately with the built-in image-generation tool, keyed on `#00ff00`, converted to transparent PNGs with the standard soft-matte/despill helper, and visually checked after extraction.

## Ronin journey walker prototype — active flat mascot
**Produced:** `apps/mobile/assets/ronin/journey/ronin-walker-flat-v3.png`

**Prompt:**

> Use case: style-transfer. Asset type: tiny animated mobile-app progress mascot, displayed around 80 points. Input image: edit target. Keep only the core identity: one cheerful young Ronin, full-body strict side profile facing right, mid-walk, straw hat, indigo top, cream legs, coral sash, tiny sheathed sword. Primary request: simplify radically into an unmistakably app-native mascot in the visual spirit of contemporary playful walking/fitness apps. This must feel like a motion-design vector character, not a finished character illustration. Style: ultra-simple flat 2D vector. Oversized round head and eye, tiny compact torso, short chunky limbs, playful proportions, broad smooth geometric shapes, clean silhouette. Use only 6 flat colors total. No texture. No realistic shading. No gradients. No fabric folds. No patterns. No stitching. No individual hair strands. No fingers or toes. No backpack straps, knots, buckles, tassels, hat weave, sword-wrap diamonds, or tiny decoration. Avoid detailed outlines; use one consistent dark-plum outline only where separation is necessary. One tiny cheek/nose mark maximum. The hat, sash and miniature sword should read as simple symbols made from basic shapes. Pose: lively exaggerated walking stride, one arm forward and one back, one leg forward and one back, suitable for a gentle looping bob animation. Composition: character occupies about 72% of a square canvas, centered, fully visible, generous clean padding, no crop. Palette: dark plum, indigo, warm cream, coral, straw yellow, warm peach only. High contrast on dark navy. Background: perfectly flat uniform #00FF00 chroma-key green edge to edge. No green in subject. No scenery, floor, shadow, badge, border, text, watermark, or extra objects.

**Notes:** The first new walker was a highly detailed tactile 3D render and was rejected as too intricate. A flatter second pass still read as a polished character illustration rather than an app mascot. This third pass deliberately removes realistic materials, garment detail, small accessories, and most shading. The built-in image-generation tool produced the keyed source; the standard soft-matte/despill helper converted it to transparent PNG.

## User-supplied Fuji journey scene — active background and walkers
**Produced:**
- `apps/mobile/assets/ronin/journey/sunset-trail-background-v1.png`
- `apps/mobile/assets/ronin/journey/ronin-cat-walkers-v1.png`

**Background prompt:**

> Use case: precise-object-edit. Asset type: mobile-app animated journey background. Input image: edit target supplied by the user. Primary request: remove only the walking Ronin character and the small cat beside him from the foreground path. Reconstruct the path, grass silhouettes, hill, and distant scenery naturally behind their former positions. Invariants: preserve the exact original portrait composition, dimensions, crop, painterly illustrated style, blue-to-pink sunset gradient, Mount Fuji, pine tree, clouds, birds, sun, pagoda, torii gate, distant hills, foreground vegetation, lighting, colors, and texture. Do not redesign, recolor, reframe, add a new route, or move any scenery. Constraints: background landscape only; no people, no animals, no text, no watermark.

**Walker prompt:**

> Use case: background-extraction. Asset type: transparent animated mobile-app character group. Input image: edit target supplied by the user. Primary request: isolate the walking Ronin and the small walking cat beside him as one grouped character asset. Preserve their exact original designs, proportions, poses, expressions, colors, outlines, painterly cartoon style, relative scale, spacing, and right-facing direction. Composition: place the Ronin and cat together, fully visible and uncropped, centered in a square canvas with generous even padding. Preserve the ground alignment between their feet but do not include any path, grass, scenery, or cast shadow. Background: perfectly flat uniform #00FF00 chroma-key green edge to edge, with crisp clean character edges. Do not use green in the subjects. Constraints: Ronin and cat only. No Mount Fuji, tree, sun, sky, landscape, torii, pagoda, path, grass, text, badge, border, watermark, floor, or shadow.

**Notes:** Built-in image editing preserved the supplied art direction while separating animation layers. The grouped-character output was keyed to alpha with the standard soft-matte/despill helper. This supersedes the generated SVG landscape and standalone flat mascot in the active component; those earlier assets remain as iteration history only.
