# Iconography

Full branded-asset inventory and priorities live in [`docs/design/RKA_CUSTOM_ICON_AUDIT.md`](../../design/RKA_CUSTOM_ICON_AUDIT.md) — this page states the rule and links out rather than duplicating the inventory table.

## The rule

Use commissioned RKA artwork for entities, destinations, time-of-day identity, and major branded states. Keep simple system-style vector glyphs for universal actions (back, close, delete, play, pause, upload, disclosure, etc.) — these benefit from familiar, accessible symbols and should never be replaced with detailed PNG illustrations.

## Illustration art style

Commissioned illustrations (dock icons, home cards, motif art) follow a **chibi Ronin aesthetic** — flat-vector, single-subject, warm/parchment palette for object art (e.g. `scroll-stack.png`'s parchment/wood/red-tie scroll, `zen-garden-scene.png`'s mossy stone lantern). New commissioned pieces should match this style rather than introduce a new illustration language — see `apps/mobile/ART_HANDOFF_home_illustrations.md` for the most recent handoff spec as a style reference.

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

First generation: simple stroke silhouettes (Codex handoff). Second generation (current, shipped): commissioned filled-path redraws delivered as SVG + multi-size PNG packs — bolder redraws of Home/Calendar, and two icons reimagined entirely (Menu: "layers" → ensō/Zen circle; Profile: "personal seal" hexagon → ronin mon/portrait silhouette). At true 22px deployed size the torii and mon-portrait read cleanly; the sundial and ensō are softer/blobbier but still functional given fixed tab position + distinct color. The FAB brush icon has **not** been redrawn in the new filled-path style yet — still pending.
