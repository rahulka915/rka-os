# Decision Log

Append-only. Never edit or delete a past entry — if a decision gets reversed later, add a new entry that says so and links back to the original, rather than rewriting history. Newest at the bottom.

---

### 2026-07-13 — Two-font greeting tried, then reverted to single Georgia italic
`RoninGreetingCard.tsx`'s time-of-day greeting briefly shipped with a two-font split (Shippori Mincho for the Japanese phrase, Cormorant Garamond italic for the name). After seeing both side by side, reverted to the original single Georgia italic across both — user preference on reflection, not a bug. The font packages were uninstalled since nothing else used them.

### 2026-07-13 — Hero card mood color rejected as whole-background hue swap
An earlier version of `RoninGreetingCard.tsx` swapped the entire card background hue based on mood. Rejected as "too jarring / not in line with the actual app theme colors." Replaced with the current two-axis system: a stable time-of-day base gradient, with mood expressed only as a small corner accent (glow, status dot, hanko tint, progress-bar fill) — see [`components.md`](components.md).

### 2026-07-13 — River Stone surface corners: point-symmetric, not four independent radii
Mid-session, an initial four-independent-corner asymmetric radius was corrected per explicit user feedback: "even if each corner does have a different value then the overall look should seem symmetric." Landed on the current rule — top-left pairs with bottom-right, top-right pairs with bottom-left — which reads as "carved" while staying recognizable as a card.

### 2026-07-13 — `InboxScrollCard`'s stacked-paper effect replaced with real depth
The original "paper stack" illusion (several offset duplicate card layers) was dropped in favor of an actual top-lit gradient surface + real drop shadow — the same River Stone technique already used for the dock FAB — after comparing against a real Moonly home screen and finding the card looked flat/under-illustrated by comparison.

### 2026-07-13 — Fabricated Level/XP bar replaced with real progress data
`RoninGreetingCard.tsx`'s progress bar was previously driven by `roninProgress.ts`, a hardcoded placeholder. Replaced with real `completedCount`/`totalCount` from `todayItems`, computed in `HomeScreen.tsx` with zero new DB queries needed. The old placeholder file was deleted rather than left as dead code.

### 2026-07-13 — Dock icons redrawn as a second, bolder generation
First-generation dock icons (simple stroke silhouettes from a Codex handoff) were replaced with a commissioned filled-path redraw (SVG + multi-size PNG packs). Two icons were reimagined rather than just re-rendered in the new style: Menu's "layers" glyph became an ensō/Zen circle, and Profile's "personal seal" hexagon became a ronin mon/portrait silhouette. The FAB brush icon was intentionally left in the old style pending a separate commission.

### 2026-07-13 — App-wide typography switched to Inter
One-time follow-up in the same session as the two-font revert above: switched all UI text (previously system font) to Inter, loaded via `useFonts()` and resolved through Tamagui's `interFont` face map so `fontWeight` props keep working without per-component changes. 131 raw `StyleSheet` `fontWeight` occurrences across 23 files needed an explicit matching `fontFamily` added alongside, since RN doesn't synthesize bold/weight variants for custom fonts. `InboxScreenV2.tsx`'s Georgia italic title and `RoninGreetingCard.tsx`'s greeting were deliberately left un-migrated.

### 2026-08-12 — Desktop web app re-skinned to the native River Stone language
The web app (`src/webApp/`) shipped with a standalone "warm-minimal" cream/amber palette (`#FFFBEB` bg, `#D97706` accent) that no longer matched the iOS app's River Stone look. Re-aligned `theme/webTheme.ts` to the native tokens: dark sumi shell, warm River-Stone neutral surfaces, and **restrained vermilion** (not amber) as the single brand/interactive accent — matching `colors.ts`'s `vermilion`. Because every web screen reads CSS custom properties, this was one edit to `WEB_THEME_CSS`, no per-screen changes. Also added `webDepth` (CSS `boxShadow` mirrors of the native River Stone `list`/`card` shadow variants) applied across list/card surfaces to replace flat 1px-bordered fills, and swapped the sidebar's generic Lucide icons for the **same destination artwork the iOS app ships** (`src/webApp/navArtwork.web.tsx`).

### 2026-08-12 — Web Home hero: "adaptive" warm sunset halo, not a full warm theme
The web Home page will host the Ronin Rive sunset scene. Rather than making the whole web app a warm/light theme to match the scene (which would diverge from iOS) or leaving the bright scene pasted onto a flat dark page, chose the adaptive middle: keep the dark River Stone shell everywhere, but give **only** the Home hero stage a warm sunset gradient halo (`webSunset`, sampled from the scene art) that melts into the dark shell — so the scene feels built into the page there while the rest stays cohesive with iOS. The Rive scene itself is not yet mounted (rig not ready); the hero currently shows a toned placeholder (sun + greeting) at the exact mount point.
