# Inbox Triage Mode — Design

**Date:** 2026-07-25
**Status:** Approved, pending implementation plan

## Problem

Tapping an unprocessed Inbox item currently just opens the generic task editor —
a long form covering every field at once. This creates friction: users leave
items sitting in the Inbox indefinitely rather than filling out a full form for
each one. The Inbox rarely gets to zero.

## Goal

Replace that tap behavior with a guided, single-question-at-a-time "Triage
Mode" — one card, one decision, fast tap-to-advance, gamified card-stack
framing ("N remaining" instead of "I need to organise 42 things"). Capture
stays instant and frictionless (unchanged); *processing* becomes its own fast,
satisfying session, separate from capture.

This does not replace the existing selection-mode bulk toolbar (swipe
Today/Morning/Evening/Archive, long-press → "Classify as..." action sheet) —
that stays as the fast power-user path for acting on multiple items at once.
Triage Mode is specifically what happens when you tap a single item.

## Entry point & session architecture

- Every item visible in `InboxScreenV2` has `status: 'inbox'` by definition —
  there's no need to check eligibility per item.
- Tapping any row launches a full-screen **Triage Mode overlay**, replacing
  today's `openItem(...)` call for that one interaction. Rendered via the
  existing `useOverlayHost` mechanism, the same pattern `VoiceCaptureOverlay`
  already uses (full-screen, escapes tab bar/modal stacking, no new plumbing).
- **Session queue**: the current Inbox list order, with the tapped item moved
  to the front. Each item confirmed at its Review step is written to the DB
  immediately and removed from the queue; the next card animates in
  automatically.
- **Exiting mid-session** (tap X) just closes the overlay. Anything not yet
  confirmed at Review is untouched in the DB — it stays in the Inbox and
  reappears next time Triage Mode is opened. There is no partial-answer
  autosave for an in-progress card: "progress is saved" means *already-
  processed items stay processed*, not that a half-answered card is
  remembered across sessions.
- **Session ends** (small celebration screen) when the queue empties, or
  immediately on manual exit.

## Step sequence & data model

### Step 1 — "What is this?"

Binary choice: **Task** / **Object** (tap to choose).

- **Object** → writes immediately and advances straight to the next card, no
  further questions:
  - `type: 'object'`, `status: 'active'`, `metadata.objectStatus: 'want'`
  - Identical to the existing `processInboxItem(id, 'object')` behavior.
  - Deliberately minimal — Object's own dedicated triage sub-flow is future
    work, once Object gets built out further.
- **Task** → continues to Steps 2–5 below.

Other existing destinations (Habit, Medication, Project/Mission,
Area/Domain, Reference) are **not** part of this flow — they remain reachable
only via the existing "Classify as..." bulk action sheet.

### Step 2 — "How important?" (Task only)

Low / Normal / High — maps directly onto the existing `ItemPriority` field
(`metadata.priority`), the same 3-value scale used everywhere else in the app
(editor, badges, sorting, Needs Doing filtering). No 4th "Critical" level —
that would require widening `ItemPriority` app-wide, out of scope here.

### Step 3 — "When should this surface?" (Task only)

Today / Tomorrow / This week / Someday:

| Choice | `status` | `scheduledDate` | `metadata` |
|---|---|---|---|
| Today | `active` | today | — |
| Tomorrow | `active` | tomorrow | — |
| This week | `active` | *(unset)* | `gtdContext: 'week'` |
| Someday | `someday` | *(unset)* | — |

"This week" stays an unscheduled active item tagged `gtdContext: 'week'` —
it shows in the normal active Tasks list, not on a specific calendar day. No
auto-scheduling to a specific weekday. The `gtdContext` tag exists so a
dedicated "This Week" bucket view can be built later without a data
migration.

### Step 4 — "Where does this belong?" (Task only)

Optional project link. Reuses the exact same project list + "No project" row
already built for `ItemEditorSheet`'s Mission picker (`getItemsByType
('project')`). Selecting one calls `setRelation(itemId, 'project',
projectId)` — same call the existing editor makes.

### Step 5 — Review (Task only)

Shows the three decisions made so far (Importance, When, Project) as plain
rows. "Process item" commits everything to the DB in a single write. "Back"
(available from every step except the first) returns to the previous
question with answers preserved in local card state.

## Components

New files, following existing overlay/screen conventions:

- **`src/hooks/useTriageSession.ts`** — the state machine. Owns: the queue
  (array of `Item`), current index, current card's in-progress answers
  (`type`/`priority`/`when`/`projectId`), and current step. Exposes
  `answer(field, value)` (advances to the next step for the active branch),
  `back()`, `confirm()` (writes to the DB via the same primitives
  `processInboxItem` / `updateItemStatus` / `setRelation` already use, then
  advances to the next card), and `exit()`.
- **`src/components/triage/TriageOverlay.tsx`** — top-level. Renders header
  (X to close, "N remaining" counter), a per-card progress bar (segments =
  steps in the active branch), the active step component, and the
  completion screen once the queue empties. Uses `useTriageSession`.
- **`src/components/triage/steps/`** — one small component per step
  (`TypeStep`, `ImportanceStep`, `WhenStep`, `ProjectStep`, `ReviewStep`),
  each a title + a short list of tap targets, mirroring the mockup's
  single-question-per-screen layout.

### Wiring

`InboxScreenV2`'s row `onPress` (currently `openItem({...})`) is replaced
with a call that opens `TriageOverlay` via `useOverlayHost`, seeded with the
tapped item and the current inbox list.

## Animation & feedback

Reanimated only — no new dependencies (no confetti/particle library; the
project avoids native modules outside Expo-managed packages per existing
convention).

- **Card transitions**: outgoing card slides out + fades, incoming card
  slides in + fades — a lightweight version of the Tinder-card feel.
- **On "Process item"**: a brief checkmark scale/fade pulse (same pattern
  `VoiceCaptureOverlay` uses for its "saved" state) + `Haptics
  .notificationAsync(Success)`, then auto-advance to the next card.
- **Per-choice taps**: `Haptics.impactAsync(Light)`, consistent with tap
  feedback elsewhere in the app.
- **End of session**: a simple "Inbox zero" screen (checkmark + short
  celebratory text), tap to dismiss back to the Inbox list.

## Explicitly out of scope (v1)

Per the mockup's own "Future Ideas" list — deferring these matches the
source spec, not a scope cut invented here:

- Swipe gestures as an input method (tap-only for v1)
- Streaks / daily triage goals
- Cross-item undo ("undo last processed item")
- Object sub-questions beyond "mark as wishlist" (Category/Intent steps from
  the mockup's object branch — explicitly deferred per your note that
  Object gets built out further later)
- A 4th ("Critical") priority level
- Auto-scheduling "This week" to a specific date
- A Tags step (mockup diagram itself omits it; only the prose list
  mentioned it)
