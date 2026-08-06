# Iconography

Full branded-asset inventory and priorities live in [`docs/design/RKA_CUSTOM_ICON_AUDIT.md`](../../design/RKA_CUSTOM_ICON_AUDIT.md) — this page states the rule and links out rather than duplicating the inventory table.

## The rule

Use commissioned RKA artwork for entities, destinations, time-of-day identity, and major branded states. Keep simple system-style vector glyphs for universal actions (back, close, delete, play, pause, upload, disclosure, etc.) — these benefit from familiar, accessible symbols and should never be replaced with detailed PNG illustrations.

## Illustration art style

There are **two** commissioned illustration languages, and which one a piece uses is decided by the
role it plays — not by taste, and not by what the last asset happened to look like.

| Language | Looks like | Use it for | Examples |
|---|---|---|---|
| **Flat-vector chibi** | Flat vector, single subject, bold silhouette, warm/parchment palette | Small, repeated, functional UI furniture — dock icons, row icons, badges. Anything that appears many times or is tapped often. | `scroll-stack.png`, `zen-garden-scene.png`, the dock icon set |
| **Painterly atmospheric** | Painted scenery, muted/atmospheric, depth and lighting, full scene | Large, low-frequency, emotional surfaces — hero cards, empty states, celebration moments. Appears once per screen at most. | `assets/ronin/scenes/{morning,day,night}.png`, the Home hero card |

### Choosing between them

**Decoration scales inversely with information density and interaction frequency.** A hero card is
seen once and carries feeling, so it can be lush. A row icon is repeated four times, sits beside a
label and a count, and gets tapped constantly — it has to read instantly, so it must be flat-vector.

This isn't only an aesthetic call, it's a legibility one. Painterly detail collapses at row scale: a
set of painted scenes that differ mainly by colour tint all reduce to the same dark blob at ~100pt,
because the eye keys on silhouette long before it keys on hue. Flat-vector shapes stay distinct at
any size. If a repeated icon set is hard to tell apart, reach for a stronger silhouette before
reaching for new art.

### Why this section exists

These two languages were previously stated as one, which produced a direct contradiction: this page
called the house style "flat-vector", while
[`apps/mobile/ART_HANDOFF_home_illustrations.md`](../../../apps/mobile/ART_HANDOFF_home_illustrations.md)
both rejected 3D-rendered candidates *and* told new pieces to read as siblings of the painterly
`ronin/scenes` set. Neither was wrong — they were describing different roles. The table above is the
resolution. Do not "unify" them back into a single style; the split is deliberate.

### Known exception

The time-of-day row icons (`assets/icons/time/time-{anytime,morning,afternoon,evening}.png`) are
currently **painterly** but sit in repeated rows, so by the rule above they belong in flat-vector.
They are the reason the four Home time blocks are hard to tell apart. Slated for redraw; treat them
as a known deviation rather than a style precedent.

### Before commissioning anything

Match, don't invent: supply existing in-language assets as reference images rather than describing
the style in words. Generate one piece, view it in place next to its siblings, and only then commit
to a set. Export a whole set on an identical canvas with consistent subject scale — mismatched aspect
ratios make a row look ragged no matter how good the individual pieces are. Then paste the prompt
that worked into [`prompt-library.md`](prompt-library.md), which exists specifically so the style
stops being re-derived from scratch every round.

## Motif → meaning (concept vs. shipped)

| Motif | Color | Meaning | Status |
|---|---|---|---|
| Torii gate | red `#c23b3b` | Milestones / unlocks | Concept only — feature doesn't exist yet |
| Blossom | pink `#ed93b1` | Streaks / habit wins | Concept only — feature doesn't exist yet |
| Wave / mountain | deep blue `#1a4d7a` | Long-term / weekly views | Concept only — feature doesn't exist yet |
| Katana silhouette | platinum `#dfe1e4` | Companion level/XP | **Shipped** — `KatanaProgressBar.tsx` |
| Rolled scroll | silver/deeperBlue | Inbox / unopened items | **Shipped** — `scroll-stack.png` illustration |
| Zen-garden circles + stone | silver `#808080` | Empty/calm states | **Shipped** — `zen-garden-scene.png` illustration |

Don't treat the concept-only rows as real features when writing copy or building UI around them — streaks, journaling, weekly-reflection, and real XP/level progression don't exist yet (`roninProgress.ts`'s progress bar is driven by real today's-progress counts now, not a hardcoded placeholder — see [`decision-log.md`](decision-log.md)).

## Two live meanings, same motif

The torii gate currently has two live contexts with the same color (red) but different meanings: the Home tab dock icon (navigation) and the still-unbuilt "milestones/unlocks" illustration-card concept above. Not a conflict — just worth knowing both exist before assuming a torii reference means one specific thing.

## Icon generations (dock icons)

First generation: simple stroke silhouettes (Codex handoff). Second generation (current, shipped): commissioned filled-path redraws delivered as SVG + multi-size PNG packs — bolder redraws of Home/Calendar, and two icons reimagined entirely (Menu: "layers" → ensō/Zen circle; Profile: "personal seal" hexagon → ronin mon/portrait silhouette). At true 22px deployed size the torii and mon-portrait read cleanly; the sundial and ensō are softer/blobbier but still functional given fixed tab position + distinct color. The FAB preserves its commissioned brush/washi/lacquer identity as independent vector layers in `FabControl.tsx`; its older registered PNG sequence is retained only as source/reference art.

The reusable collection-entity artwork lives under `assets/icons/collections/` and is exposed through `CollectionIcons.tsx`: a black lacquer kettlebell for Workout, wooden prayer-bead loop with tally for Habit, tied furoshiki parcel for To Get, and lacquer scroll chest for the Archive destination. These are transparent high-detail 3D object renders matching the material depth, studio lighting and handcrafted texture of Task, Project and Medication. The chest is destination identity only; archive buttons and swipe actions keep the universal system glyph. A flatter SVG version was tried first and rejected on-device because it did not belong beside the established object artwork.
