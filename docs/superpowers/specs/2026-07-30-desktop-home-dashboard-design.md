# Desktop Home Dashboard — Design Spec

## Goal

Add a "Home" view to the desktop web app's sidebar that acts as a dashboard: quick stats, a
quick-capture bar, today's tasks grouped by time block, and a recently-completed feed. Home
becomes the default landing view after sign-in (replacing Inbox).

## Context

The desktop web companion (`apps/mobile/src/webApp/`) currently has Inbox and Tasks screens,
a `Sidebar`, and a slide-over `DetailPanel`/`ItemDetailForm` for editing an item. Mobile
already has an equivalent data hook, `useHomeData()` (`src/hooks/useDb.ts`), which is
platform-generic — it imports from `../db/database` (extensionless), so Metro resolves
`database.web.ts` automatically on web builds. No new backend/data-layer work is needed;
`getCompletedItems()` (sorted by `completedAt` desc) and `createItem()` are also already
implemented on web.

## Scope

Desktop/web only, matching the rest of this redesign. Mobile is untouched. No new database
functions — this is purely a new screen composing existing hooks/functions.

## Components

### `Sidebar.web.tsx` (modify)

Add `'home'` to `SidebarView`, as the first nav item (above Inbox), using Lucide's `Home`
icon. Existing `'inbox' | 'tasks'` items shift down; Calendar/Areas & Projects stay disabled
placeholders, unchanged.

### `HomeScreen.web.tsx` (new)

Uses `useHomeData()` for `{ anytime, morningItems, afternoonItems, eveningItems, inboxCount,
upcomingCount, refresh }`, plus a local `useState` + `getCompletedItems()` read (refreshed via
the same `useDbRefresh`-driven pattern already used elsewhere — call `getCompletedItems()`
inside the same refresh callback pattern as other screens, no new hook needed since
`useDbRefresh` is only exported for hook authors, not consumed directly by screens elsewhere;
simplest is a small local `useState<Item[]>` populated in a `useEffect` on mount plus
`useDbRefresh(...)`-equivalent — see Plan for exact wiring).

Sections, top to bottom:

1. **Header** — "Home" title (`webFontSize.xl`, bold) + today's date formatted as e.g. "Thursday, July 30" (small, muted, right-aligned on the same row, matching Inbox/Tasks header layout of title+count).
2. **Stat cards row** — 4 cards in a horizontal flex row, equal width, each: big number (`webFontSize.xl`, bold) + small label (`webFontSize.xs`, muted) underneath. Cards: **Inbox** (`inboxCount`), **Today** (count of all today items across buckets), **Upcoming** (`upcomingCount`), **Completed today** (count of completed items whose `completedAt` falls on today's date). Card style: `webColors.card` background, `webRadius.md`, `webColors.border` border, `webSpacing[4]` padding — same visual language as existing rows.
3. **Quick capture bar** — single `TextInput` + Lucide `Plus` icon, full width, placeholder "Add to inbox...". On submit (Enter key / `onSubmitEditing`): calls `createItem('task', text.trim())`, clears the input, calls `refresh()`. No-op on empty/whitespace-only input. Same input styling as `SignInScreen.web.tsx`'s `TextInput` (muted background, `webRadius.sm`).
4. **Today, by time block** — for each non-empty bucket in order Morning → Afternoon → Evening → Anytime: a small section label (`webFontSize.sm`, bold, muted, e.g. "MORNING") then task rows identical in style/behavior to `TasksScreen.web.tsx`'s rows (checkbox toggle via `updateItemStatus`, row click opens `DetailPanel` with `ItemDetailForm`, same `selectedId` state pattern). If all buckets are empty, show a single empty-state line: "Nothing scheduled for today."
5. **Recently completed** — section label "RECENTLY COMPLETED" (same style as time-block labels) + up to 5 most-recent entries from `getCompletedItems()`. Each row: Lucide `Check` icon (small, muted-green or `webColors.accent`), item title (`webColors.mutedForeground`, strikethrough optional — keep plain, not strikethrough, since this list is inherently "done"), relative time on the right (e.g. "2h ago", "3d ago" — simple hand-rolled formatter, no new dependency). Read-only: no click-to-open, no checkbox (avoid implying it can be un-completed from here — that's what Tasks screen is for).

Shares `DetailPanel` + `ItemDetailForm` exactly as Inbox/Tasks do, for the time-block task rows only (recently-completed rows are not clickable).

### `AppShell.web.tsx` (modify)

- `activeView` initial state changes from `'inbox'` to `'home'`.
- Render `<HomeScreen />` when `activeView === 'home'`.

## Data / Refresh Wiring

`useHomeData()` already subscribes to live updates via `useDbRefresh` internally (per its
existing implementation), so today-bucket data and stat counts stay live. For recently-completed
data, `HomeScreen` calls `getCompletedItems()` directly inside a `useCallback` refresh function
wired through the same `useDbRefresh` hook used by every other screen (`Sidebar`/`Inbox`/`Tasks`
pattern), so it reacts to the same Firestore snapshot changes without polling.

## Out of Scope

- No drag-reorder, no project/area grouping, no charts/graphs.
- No "greeting" copy or motivational text — the mobile app's Ronin/greeting-card concept is
  explicitly not part of this desktop redesign (per the earlier "visual feel only, no game
  mechanics" decision).
- No new relative-time library — a minimal inline formatter is enough for "Xm/Xh/Xd ago".

## Self-Review

- **Placeholder scan:** none found.
- **Consistency:** stat card counts, row styles, and detail-panel wiring all reuse
  already-shipped patterns from Inbox/Tasks; no new visual language introduced.
- **Scope:** single cohesive screen + two small edits (Sidebar, AppShell) — right-sized for one
  implementation plan.
- **Ambiguity resolved:** "Today" stat card explicitly defined as the union count across all
  four buckets (matches what's rendered below it, avoiding a stat that doesn't match the list).
