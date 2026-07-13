# RKA OS Mobile — Flow Map

A Mobbin-style reference for what every tappable element actually does today, screen by screen. Purpose: before restyling or extending a component, know whether its current behavior is real, a stub, or mismatched with what it visually promises — and record what it *should* do once decided.

Any agent or human can edit this file directly. Authoritative source, same pattern as `DESIGN_CHECKLIST.md`. A human-viewable interactive mirror exists as an artifact (see project memory / ask Claude for the link) — that mirror is **not authoritative**; if they disagree, trust this file.

**Status legend**
- ✅ **Working** — real DB/state-backed behavior, does what it visually promises
- 🟡 **Stub** — wired up, but the handler is a no-op (`console.log`, TODO) or doesn't exist
- ⚠️ **Mismatched** — wired to something real, but the label/icon promises a different action than what actually fires
- ⬜ **Dead** — the tap target exists but no handler is connected at all

---

## Home Screen (`screens/HomeScreen.tsx`)

### AppHeader (`components/AppHeader.tsx`)

| Element | Status | Current behavior | Expected behavior |
|---|---|---|---|
| Avatar (left) | ⬜ Dead | `onProfilePress` prop exists on `AppHeader` but `HomeScreen` renders `<AppHeader />` with no props — tap does nothing | TBD — likely should navigate to Profile, same as the hero card tap below |
| "RKA OS" wordmark | ✅ Working (static) | Decorative, not tappable — no handler exists, none expected | — |
| Dark-mode toggle | ✅ Working | Calls `useThemeContext().toggle()`, flips theme app-wide, haptic feedback | — |
| "Synced" indicator | 🟡 Stub | Static `CheckCircle2` + hardcoded "Synced" text, not bound to any real sync/backup state | TBD — should reflect actual `pushBackup`/Supabase sync status |
| Timer-restore dot | ✅ Working | Only shown when a hidden timer is active; tap re-shows `PersistentTimerBanner` | — |

### RoninHero / RoninGreetingCard (`components/home/RoninGreetingCard.tsx`)

| Element | Status | Current behavior | Expected behavior |
|---|---|---|---|
| Greeting text | ✅ Working (simplified) | Time-of-day copy real; name is hardcoded `"Rahul"`, no profile data source | TBD — pull from a real profile record once one exists |
| Mood dot + copy | ✅ Working | `getRoninMood()` — real priority chain: `completedJustNow` → active timer → inbox/overdue thresholds → late-night → normal. All DB/state-backed except the 4s local `completedJustNow` flag | — |
| Level / XP bar | 🟡 Stub | `getRoninProgress()` hardcodes `{level:1, xp:0, xpToNext:100}` — no progression system exists. Katana bar always renders 0% | **Design decision needed** — see open questions below |
| Tap whole card | ✅ Working | Navigates to Profile tab (`onHeroPress` → `App.tsx`) | — |

### NextUpCard (`components/home/NextUpCard.tsx`, logic in `utils/nextUpItem.ts`)

| Element | Status | Current behavior | Expected behavior |
|---|---|---|---|
| Item selection | ✅ Working (simplified) | Real: filters pending items, buckets by time-of-day, returns first item in the bucket closest to now. **Not** overdue-first or urgency-sorted within a bucket — just insertion order | TBD — decide if overdue items should jump the queue |
| Tap action badge | 🟡 Stub | `console.log('Next Up action for:', ...)` — no navigation, no mutation, no timer start | TBD — should perform the labeled action (Start/Resume/Take/View) |
| Tap card body | ⬜ Dead | Only the small circular badge has a `TouchableOpacity`; title/subtitle/background have no handler | TBD — likely should open item detail |
| Empty state | ✅ Working (static) | "Nothing pressing right now / Enjoy the quiet," not tappable, correct by design | — |

### InboxScrollCard (`components/home/InboxScrollCard.tsx`)

| Element | Status | Current behavior | Expected behavior |
|---|---|---|---|
| Tap card | ✅ Working | Opens Inbox as a modal (`InboxScreenV2`) over the tab navigator. Inert when count is 0 (`onPress={undefined}`), by design | — |

### TimelineSection (`components/TimelineSection.tsx`) — Anytime/Morning/Afternoon/Evening

| Element | Status | Current behavior | Expected behavior |
|---|---|---|---|
| Tap block header | ✅ Working (no persistence) | Expand/collapse, local `useState`, resets to all-collapsed on every mount | TBD — worth persisting last expand state? |
| Long-press → "Expand all" | ✅ Working | Client-side, expands all four blocks | — |
| Long-press → "Collapse all" | ✅ Working | Client-side, collapses all four blocks | — |
| Long-press → "Add item" | 🟡 Stub | `console.log('Add item to:', block)` | TBD — should open QuickAddScreen pre-filled with that time block |
| Long-press → "Move items here" | 🟡 Stub | `console.log('Move items to:', block)` | TBD — bulk move UI doesn't exist yet |
| Long-press → "Sort" | 🟡 Stub | `console.log('Sort items in:', block)` | TBD — no sort options defined yet |
| Swipe block header left ("Complete All") | ✅ Working | Confirm dialog, then `completeAllInTimeBlock(block)` — real DB mutation, sets every item in the block to `completed` | — |
| Swipe block header right (labeled "Archive") | ⚠️ Mismatched | Icon/label says Archive, actually fires `console.log('Quick add for:', block)` — a stub with the wrong label on top | Fix the label to match intent (Quick Add), then implement it — or rewire to a real archive-all action if that's actually wanted |
| Tap item row | 🟡 Stub | `console.log('Navigate to item:', item.id)` | TBD — item detail screen doesn't exist yet |
| Swipe item left (icon = checkmark) | ⚠️ Mismatched | Reads as "complete" visually, actually calls `updateItemStatus(id, 'active')` — does **not** mark the item done. There is currently no way to complete a single item from Home, only whole blocks via "Complete All" | Needs a real per-item complete action; current one should probably be relabeled or repurposed |
| Swipe item right ("Archive") | ✅ Working | `updateItemStatus(id, 'archived')`, real mutation | — |
| Item delete | ⬜ Dead (from Home) | `onItemDelete` prop wired to real `deleteItem()` in `HomeScreen`, but `TimelineSection` never calls it — no gesture reaches it from this screen | TBD — no delete path needed from Home, or add one? |

### FAB (+ button, `App.tsx`, always visible across tabs)

| Element | Status | Current behavior | Expected behavior |
|---|---|---|---|
| Tap | ✅ Working | Opens `QuickAddScreen`, context-prefilled based on current route (empty context on Home) | — |
| Long-press | ⬜ Dead on Home | Runs a per-screen "hold action" if registered; `HomeScreen` doesn't register one | TBD — could long-press FAB on Home do something specific (e.g. voice capture)? |

### Other

- **Pull-to-refresh** — not implemented, no `RefreshControl` on the Home `ScrollView`.
- **Haptics** fire on several stub actions (Add item, Move items, Sort, Quick add-mislabeled-Archive) — currently implies "this did something" even when it didn't. Worth fixing once those actions are real, or muting haptics on stubs in the meantime.

---

## Open design questions (not yet decided)

1. **XP/level system** — what should actually earn XP? Completing items? Streaks? Something else? Does leveling up do anything (unlock something, just a number)?
2. **Header avatar vs. hero-card tap** — both are "supposed" to go to Profile per the code's own intent; pick one, wire it, remove the dead one or repurpose it.
3. **Per-item complete** — Home currently has no working single-item complete gesture. Needs a real one (fix mismatched swipe-left, or add a new gesture/tap target).
4. **Next Up action button + card tap** — decide the real actions (start timer? open detail?) and implement.
5. **Time-block long-press stubs** (Add item, Move items, Sort) — decide priority/scope for each.

---

## Other screens

Not yet audited. Add sections here following the same table format as new screens get reviewed.
