# Desktop Warm Minimal Redesign — Design

## Context

The web companion (built across two prior sub-projects — [2026-07-30-web-companion-core-gtd-design.md](./2026-07-30-web-companion-core-gtd-design.md)) currently reuses mobile's screen components as-is via React Native Web: same bottom-tab layout, same Things 3 + Moonly-inspired visual language, same custom SVG icon system. That was correct for proving the data layer works, but it's not a real desktop experience — it's a phone screen stretched wide.

This sub-project redesigns the desktop/web layout from scratch: a genuinely desktop-shaped UI (persistent sidebar, slide-over detail panels, keyboard-first actions) in a new visual language (warm, minimal, Notion-adjacent) that drops the custom-icon maintenance burden mobile currently carries.

Mobile is explicitly out of scope and untouched — it keeps its current Things 3/Moonly look, Ronin hero, and custom icon set.

## Goals

- A desktop-shaped layout: persistent left sidebar, main content area, slide-over detail panel — not a stretched mobile screen.
- A new visual language: warm minimal (cream/warm-gray base, one amber accent, soft rounded corners), replacing the current dark Things-3-styled look on web only.
- Icons switch from the custom SVG icon system to Lucide (already a dependency), removing the need to hand-build a new icon for every new feature.
- First implementation slice covers the app shell plus Inbox and Tasks — enough to validate the whole direction end-to-end.

## Non-goals

- Mobile's visual language is unchanged. This redesign is web/desktop-only.
- Calendar and Areas/Projects are not restyled in this sub-project — Calendar has real layout complexity (a timeline, not a list) and Areas/Projects needs a board/list-detail pattern; both are deferred to a follow-up sub-project once the shell and list pattern are validated here.
- No literal game mechanics (streaks, points, badges) — confirmed explicitly: "gamified" here means visual warmth and color, not new features.
- No changes to the data layer (`database.web.ts`, `firestoreWebStore.ts`) — this sub-project is presentation-only, calling the exact same hooks (`useInbox`, `useTasks`, etc.) that already work.
- Mac/Tauri wrapper — still downstream of a stable web UI, not addressed here.

## Visual Language

**Colors** — sourced from a warm-minimal palette match (design-system search, "Notes & Writing App" category — closest real match to the target feel, not invented ad hoc):

| Token | Value | Use |
|---|---|---|
| `background` | `#FFFBEB` | Page background (cream) |
| `foreground` | `#0F172A` | Primary text (near-black) |
| `primary` | `#78716C` | Secondary text, muted UI |
| `accent` | `#D97706` | The one accent color — primary buttons, active nav item, focus rings, links |
| `card` | `#FFFFFF` | Sidebar, panels, list rows |
| `muted` | `#F6F6F6` | Hover states, subtle fills |
| `mutedForeground` | `#64748B` | Secondary/meta text (dates, counts) |
| `border` | `#EEEDED` | Dividers, row separators, panel edges |
| `destructive` | `#DC2626` | Delete/danger actions only |

One accent color used sparingly is the core discipline here — most of the interface stays near-monochrome (background/foreground/border), and amber is reserved for things that are genuinely actionable or active, not decoration.

**Typography** — Inter, already a dependency (multiple weights already loaded via `@expo-google-fonts/inter` for mobile). The top design-system match for this style (Plus Jakarta Sans) is explicitly described as "a modern alternative to Inter" — close enough that adding a second font family purely to chase that difference isn't worth the extra bundle weight. Weight scale: 700 for headings, 500 for labels/emphasis, 400 for body — matching the existing mobile weight usage so no new font files are needed.

**Icons** — Lucide (`lucide-react-native`, already a dependency), replacing the custom SVG icon components for anything new built in this sub-project. Existing custom icons stay wherever mobile still uses them; this only governs the new desktop screens. Stroke width 1.5–2px, sized as tokens (16/20/24px), matching the design-intelligence checklist's icon-consistency rules.

**Shape** — soft rounded corners (12–16px) on cards, panels, and buttons; this is what separates "warm minimal" from the sharper, more clinical Height/Linear look it's adjacent to.

## Layout Structure

**App shell**: a persistent left sidebar (~240px, fixed, does not collapse on desktop widths) containing:
1. Primary navigation — Inbox (with unread count), Today, Tasks, Calendar — flat list, active item highlighted with the accent color.
2. An expandable Areas/Projects tree below, mirroring Notion's page-tree pattern / Superlist's list panel (structure only reused this pass — this sub-project doesn't restyle the Areas/Projects *screen* itself, only gives the sidebar section a place to exist).

**Main content area** fills the remaining width. A page header (title + one primary action, e.g. "+ New Task") sits above the list. No bottom tab bar and no floating action button — both are mobile-specific patterns being explicitly dropped for desktop; primary actions live in the header and (in a later pass) via keyboard shortcuts.

**Item details**: clicking a task opens a slide-over panel from the right (~35–40% of viewport width) rather than mobile's full-screen sheet. The list stays visible and interactive underneath. This matches Height/Attio/Linear's pattern and keeps desktop feeling fast — no navigation away from context for a quick edit.

## Component Architecture

New components live under `apps/mobile/src/` using the same `.web.tsx` platform-extension convention already established for the data layer (`database.web.ts`, `firestoreWebStore.ts`) — Metro resolves them automatically for web builds, mobile is untouched by their existence.

Planned new files for this sub-project (exact paths/props finalized at planning time):
- An app shell component (sidebar + content frame + slide-over panel host)
- A sidebar component (primary nav + Areas/Projects tree stub)
- A slide-over detail panel component, replacing the full-screen sheet on web
- Web-specific versions of the Inbox and Tasks screens, restyled in the new language, calling the existing `useInbox`/`useTasks` hooks unchanged

Screens not covered by this pass (Calendar, Areas/Projects, Home) keep rendering through whatever they currently resolve to — meaning they'll look visually inconsistent with the new shell until the follow-up sub-project covers them. That's an accepted, explicit tradeoff of shipping incrementally rather than a full simultaneous reskin.

## Testing

Manual browser verification only, consistent with the rest of this project (no automated UI tests exist anywhere in this codebase). Verified via the same technique established in the Core GTD sub-projects: fetch-and-eval the web bundle, snapshot the DOM, check for console errors — plus visual review via screenshot, since this pass is explicitly about how things look, which the existing text-based DOM snapshot technique can't validate on its own.

## Self-review notes

- Placeholder scan: none found.
- Scope check: focused to shell + two screens, with Calendar/Areas-Projects/Home explicitly deferred rather than left ambiguous.
- Ambiguity check: the "gamified" scope decision (visual-only, no game mechanics) is stated explicitly as a non-goal so it can't be misread later as an implicit feature request.
- Consistency check: the accent-color discipline stated in Visual Language is referenced in Layout Structure's "active item highlighted with the accent color," not contradicted by e.g. reintroducing multiple bright colors in the nav.
