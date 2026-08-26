# Calendar Events — Design Spec

**Date:** 2026-08-26
**Status:** Approved, ready for implementation planning

## Problem

RKA OS's Calendar screen only shows `task` items (always completable, date-only scheduling with a coarse `timeOfDay` bucket, no real clock time) and a read-only overlay of the device calendar. There is no way to add a fixed-time, non-completable item — a concert, a birthday, a doctor's appointment at 3:30pm — as a first-class RKA item. The closest existing concept, `backward-plan` (Plan Backwards), is a deadline-anchored planning workspace with its own `planBlocks`, not a lightweight calendar entry, and isn't reachable from the Calendar day view's normal add flow.

## Goals

- A new `event` item type: fixed date, optional clock time (start required if timed, end optional), or all-day.
- Never completable — no checkbox, no `status: 'completed'` transition.
- Optional yearly recurrence (birthdays/anniversaries), the first real use of the existing-but-unused `rrule` column.
- Optional location, notes, and a local push reminder before the event (native only).
- Optional one-way write to the device calendar on create (native only) — does not disturb RKA's existing read-only device-calendar overlay contract for anything the user creates directly on their device.
- Full parity on desktop web except the two native-only pieces above (reminder, device-calendar write), tracked as intentional gaps in `WEB_PARITY.md`.
- Reachable from three entry points: Calendar screen, Capture/FAB, and Inbox classification.

## Non-goals

- Two-way sync with the device calendar (editing/deleting an RKA event never touches its linked device event after creation).
- General recurrence (daily/weekly/monthly) — yearly-only, via a single checkbox, not a full rule picker.
- A dedicated map preview or Apple Maps location search for the event's Location field (plain free-text, unlike Plan Backwards' `LocationSearchField` — that integration is out of scope here).

## Data model

Extends the existing `items` table (`SCHEMA.md`) with a new type, no schema migration beyond documenting the new `type` value and its `metadata` shape.

| Column | Value for an event |
|---|---|
| `type` | `'event'` |
| `title` | event title |
| `notes` | free text, optional |
| `scheduledDate` | `YYYY-MM-DD`, required |
| `status` | fixed `'scheduled'` — never becomes `'completed'`. This is the mechanism that makes an event non-completable: any code path checking `status === 'completed'` (Home badge counts, Logbook, streak logic) simply never sees events, and the UI never renders a checkbox for `type === 'event'` regardless of `status`. |
| `rrule` | `'FREQ=YEARLY'` when the "repeats yearly" checkbox is on, else absent |

New metadata shape, `EventMeta` (`src/utils/eventMeta.ts`, following the existing `BackwardPlanMeta`/`HabitMeta` pattern — a typed parse/serialize pair around the `metadata` JSON column):

```ts
interface EventMeta {
  startTime?: string;               // 'HH:MM' 24h, absent = all-day event
  endTime?: string;                 // 'HH:MM' 24h, optional, only meaningful when startTime is set
  location?: string;                // free text
  reminderMinutesBefore?: number;   // e.g. 15 / 30 / 60 / 1440 (1 day); absent = no reminder
  reminderNotificationId?: string;  // expo-notifications id returned by scheduleReminder, for cancel/reschedule on edit/delete; native only
  deviceCalendarEventId?: string;   // id of the device calendar event created alongside this RKA event; native only, never re-read or written back to after creation
}
```

Validation rules (enforced in the create/edit form, not the DB layer):
- `endTime`, if present, must be later than `startTime` on the same day (no overnight events in v1 — an event spanning midnight is out of scope).
- `reminderMinutesBefore` is a fixed picker (15m / 30m / 1h / 1 day), not free entry.
- All-day events ignore `endTime` entirely (form hides it when the all-day toggle is on).

## Entry points

All three converge on one DB function, `createEvent(title, scheduledDate, meta, options?)`, added to both `database.ts` (native) and `database.web.ts` (web) alongside the existing `createItem`-family wrappers. `options` carries `{ createDeviceEvent?: boolean }`, native-only, ignored on web.

1. **Calendar screen** — a new "Add Event" action alongside the existing add-task entry point on the Timeline/Agenda view, opening `AddEventSheet.tsx`.
2. **Capture/FAB** — the existing Type/Speak capture FAB gains an "Event" option next to "Task", opening the same sheet pre-filled with today's date.
3. **Inbox classification** — `processInboxItem()` gains `'event'` as a new classification destination (alongside the existing Project/Area/Habit/Medication destinations), prompting for date/time/all-day at classification time.

`AddEventSheet.tsx` (native) / equivalent web form (`DetailPanel`-hosted, matching the existing web create-form pattern) fields: title, date, all-day toggle, start time + end time (hidden when all-day), location, notes, reminder picker (native only), "Repeats yearly" checkbox.

## Reminder (native only)

Reuses the existing `scheduleReminder(title, body, seconds)` from `useNotifications.ts` — no new notification infrastructure. On save, if `reminderMinutesBefore` is set:
- Compute the target fire time: for a timed event, `(scheduledDate + startTime) - reminderMinutesBefore`; for an all-day event, a fixed default local time (9:00am) on `scheduledDate` minus `reminderMinutesBefore` (so "remind me 1 day before" on an all-day event fires 9am the prior day).
- Call `scheduleReminder`, store the returned id in `metadata.reminderNotificationId`.
- On edit (date/time/reminder-offset change) or delete, cancel the existing notification (`cancelNotification`) before rescheduling or discarding.
- A reminder whose computed fire time is already in the past (e.g. editing an event to be sooner than the reminder offset) is simply not scheduled — no error, no past-dated notification.

Web has no local push equivalent — the web form omits the reminder picker entirely; `reminderMinutesBefore`/`reminderNotificationId` stay unset for web-created events.

## Device calendar write (native only)

`deviceCalendar.ts` currently only reads (`getTodayDeviceEvents`, `getDeviceEventsForDate`) and explicitly never writes. This is extended, additively, with a new opt-in write path — the existing read-only guarantee for everything else in the app (Plan Backwards' `deviceCalendarEventId` reference, the Calendar screen's busy-block overlay) is unchanged; only this new Events feature gains a write capability, and only when the user opts in.

- New permission prompt (separate ask from the existing read-only calendar-access flow) for calendar **write** access, requested the first time the user saves an event with device-sync enabled.
- On create, if granted, call `expo-calendar`'s `createEventAsync` with title/date/time/location/notes, store the returned id in `metadata.deviceCalendarEventId`.
- **One-way, create-only.** Later edits or deletes of the RKA event never touch the linked device event. There is no ongoing sync relationship to maintain, no conflict resolution needed.
- Fails soft: permission denial or a write error still leaves the RKA event created successfully, just without `deviceCalendarEventId` set — never blocks or rolls back the RKA-side save.
- A per-event toggle in `AddEventSheet.tsx` ("Also add to iPhone Calendar"), defaulted based on whether write permission was previously granted (off if never asked/denied, on if already granted).

## Rendering

**Calendar screen** (`CalendarScreen.tsx` Timeline/Agenda + web equivalent): events render as visually distinct blocks — no checkbox, a dedicated icon and accent color distinguishing them from both tasks and the existing read-only device-calendar "busy" blocks. Timed events sit at their time slot on the hour grid (rendering as a bounded block when `endTime` is set, a thin marker when it isn't); all-day events render in a header strip above the hour grid, matching common calendar-UI convention.

**Home Today** (`HomeScreen.tsx` + web): events slot into the existing Morning/Afternoon/Evening/Anytime time buckets. The bucket-resolution logic (`resolveTimeBucket`, currently keyed off tasks' coarse `timeOfDay`/`scheduledDate`+`metadata.plannedDate` union) is extended to also accept an event's `startTime` for bucket placement — a 3:30pm appointment resolves to Afternoon the same way a task with `timeOfDay: 'afternoon'` would, just from a real clock time instead of a bucket label. All-day events land in Anytime. Rendered with the same no-checkbox, distinct-styling treatment as the Calendar screen. Tapping an event opens its edit sheet — there is no tap-to-complete gesture for `type === 'event'` anywhere in the app.

## Web parity

Full create/edit/list/render parity on desktop web (`Sidebar`+`DetailPanel` pattern, `database.web.ts` mirrors of `createEvent`/update/delete), **except**:
- No reminder picker (no local push on web).
- No device-calendar write toggle (no browser equivalent to `expo-calendar`).

Both gaps are recorded in `WEB_PARITY.md` as intentional native-only rows in the same pass this feature ships, consistent with how Plan Backwards' device-calendar integration is already documented there.

## Testing

- Pure-function unit tests: `eventMeta.ts` parse/serialize round-trip; reminder fire-time computation (timed + all-day + past-time-skip cases); `resolveTimeBucket`'s extended startTime-based bucketing.
- DB-layer tests (native + web): `createEvent` writes correct columns/metadata; edit/delete correctly cancels and reschedules the linked notification; delete never attempts to touch `deviceCalendarEventId`.
- Manual/live verification: Calendar screen and Home rendering (no checkbox, correct bucket placement, all-day header strip) on a live simulator; device-calendar write against a real permission prompt; reminder notification firing.
