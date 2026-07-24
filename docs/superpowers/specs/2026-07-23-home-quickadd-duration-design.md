# Wire block-header Add + surface duration on Home rows

## Context

Follow-on from the Home swipe-action fixes. That work correctly relabeled the block
header's right-swipe from "Archive" to "Add" (it triggers `onTimeBlockAction(block,
'quickAdd')`), but didn't wire the action itself — `HomeScreen.tsx`'s `onTimeBlockAction`
handler still has `quickAdd`/`addItem`/`moveItems`/`sort` all as `console.log` stubs. This
spec closes the gap for the two that converge on the same real behavior (`quickAdd` from
the swipe, `addItem` from the header's long-press menu — both should open a capture sheet
prefilled for that block). `moveItems` and `sort` are bigger, more ambiguous asks
(bulk-move across blocks; unclear meaning next to the already-existing drag-reorder) and
stay out of scope, still stubs, for a future round.

Separately, the earlier Mobbin comparison (Tiimo, Things 3) noted that `durationMinutes`
already exists on every item but isn't shown on Home rows — Tiimo surfaces it on every
card. Small, additive, no new data.

A third, larger idea came up alongside these — rethinking Home more fundamentally (NextUp,
the Home/Calendar split) so it actually helps plan the day, informed by the Tiimo/Things
comparison. That's explicitly **out of scope here** — it needs its own full brainstorm as a
separate future sub-project, not a rushed addition to this small spec.

## Goal

Two small, independent, additive fixes:
1. Block header's "Add" (swipe) and "Add item" (long-press menu) actually open a capture
   sheet, prefilled with that block's time-of-day bucket.
2. Home rows show each item's duration.

## Non-goals

- `moveItems` / `sort` stubs — untouched, still stubs, deferred to a future round.
- Any Home/NextUp redesign — deferred to its own future brainstorm.
- Any change to how duration is *set* (the existing composer/editor duration pickers are
  untouched) — this is display-only on Home.

## Approach

### Block header Add → real capture flow

`ItemComposerContext` (`apps/mobile/src/components/item-composer/types.ts`) gets one new
optional field:

```ts
export type ItemComposerContext = {
  status?: 'inbox' | 'active';
  scheduledDate?: string;
  scheduledTime?: string;
  projectId?: string;
  projectTitle?: string;
  lockScheduleDate?: boolean;
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
  durationMinutes?: number;
  preferredTimeBucket?: TimeOfDay;
};
```

`createDraft` (`apps/mobile/src/components/item-composer/itemComposerPersistence.ts:62`)
currently hardcodes `preferredTimeBucket: 'anytime'` — changes to
`preferredTimeBucket: context.preferredTimeBucket ?? 'anytime'`, the same
"context overrides, default falls back" pattern already used for `durationMinutes` on the
line above it.

`HomeScreen.tsx` currently only destructures `openEditorForItem` from `useItemComposer()`;
add `openCapture` to that destructure. In the `onTimeBlockAction` handler, the `quickAdd`
and `addItem` branches (currently two separate `console.log` lines) both become:

```ts
openCapture({
  context: { status: 'active', preferredTimeBucket: block },
  onComplete: ({ action }) => {
    if (action === 'saved') refresh();
  },
});
```

`block`'s type (`TimeBlockType` in `TimelineSection.tsx`, `'anytime' | 'morning' |
'afternoon' | 'evening'`) is structurally identical to `TimeOfDay` — no cast needed. This
mirrors the existing `openEditorForItem` call directly above it in the same file, same
`onComplete`/`refresh` shape, no new patterns introduced.

### Duration on Home rows

`getTimelineDurationMinutes(item: Item, instance?: ItemInstance): number` already exists
in `apps/mobile/src/utils/timelineItem.ts` (parses `metadata.durationMinutes`, falls back
to 45) and is reused as-is — `TimelineTaskRow` calls it with just `item` (no instance is
threaded to this component today).

A small formatter, local to `TimelineSection.tsx` (not exported — single call site):

```ts
function formatDurationBadge(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}
```

**Placement, and why:** a memory note (`feedback_drag_reorder_uniform_height`) constrains
this app's draggable rows to *uniform height regardless of content*, or drag-reorder
visually glitches. `BlockedBadge`/`RepeatBadge` are safe today because they're the same
handful of pixels whether shown or not (row height is fixed independent of them per the
existing "every row is exactly uniform height" comment in this file). Duration must follow
the same rule: rendered unconditionally (every item has a duration, unlike blocker/repeat
which are conditional), on the *same line* as the title rather than a new line, so it can
never change a row's measured height. Implementation: wrap the existing title `Text` in a
new `View` (`flexDirection: 'row'`, `justifyContent: 'space-between'`) with the duration
badge as a sibling `Text` (small, `palette.textMuted`, fixed to one line, no wrap) — title
keeps `numberOfLines={2}` and `flex: 1` so long titles still wrap/truncate correctly with
the badge staying put.

## Data flow / component boundaries

No new state, no new DB functions. `openCapture`/`ItemComposerProvider` are unchanged
except for the one new optional context field threading through to `createDraft`, which
already has an identical field (`durationMinutes`) doing the same "context or default"
job — this follows an established pattern in the same function, not a new one.
`getTimelineDurationMinutes` is reused unmodified from `CalendarScreen`'s existing usage.

## Error handling

None new. Capture sheet's own existing validation (title required to save) is unchanged.
Duration formatting has no failure mode — `getTimelineDurationMinutes` already clamps to a
5–1440 range and defaults to 45 if metadata is missing/malformed.

## Testing / verification

No automated coverage for this UI (same constraint as the swipe-action work — RN
component/gesture behavior isn't unit-testable in this project's `node --test` setup).
`npx tsc --noEmit` must stay clean; manual device checklist:

1. Swipe right on a block header ("Add") → capture sheet opens; save a title-only item →
   confirm it lands in that block (check its `preferredTimeBucket` took effect — it should
   show up under that block's section on Home, not "Anytime" if you added it from Morning).
2. Long-press a block header → "Add item" → same capture sheet, same prefilled bucket.
3. Every Home row shows a duration badge (e.g. "15m", "1h", "1h 30m") that doesn't
   change row height, doesn't wrap, and doesn't crowd out a two-line title.
4. Existing rows without explicit duration show "45m" (the default), not blank or an
   error.
5. Drag-reorder still works smoothly with the new badge present (this is the uniform-
   height constraint's actual failure mode if violated — rows glitching mid-drag).
6. Both light and dark mode render the badge legibly.
