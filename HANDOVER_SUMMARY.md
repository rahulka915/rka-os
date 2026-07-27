# RKA OS — Handover Summary
**Last Updated:** 2026-07-15  
**Status:** Mobile-only — React Native iOS (active). The companion Web PWA described in Session 1 below has since been fully retired; that section is kept as historical record only.

---

## Platform Overview

| Platform | Location | Status | Run Command |
|----------|----------|--------|-------------|
| **React Native iOS** | `apps/mobile/` | Active development | `cd apps/mobile && npm start` |

---

## Session 1 — PWA Fixes & Layout (2026-06-24)

### What Was Done
1. **Fixed Inbox sheet** — switched from Vaul (`NativeBottomSheet`) to custom `BottomSheet` primitive. All 7 items now visible.
2. **Redesigned bottom nav** — floating pill (Home | Calendar | Menu | Me) + separate FAB.
3. **Reorganised app header** — Profile icon (left) | RKA OS (centre) | Sync status (right).
4. **Removed Me from bottom nav** — moved to top-left of header.
5. **Compacted home page layout** — entire page fits on screen without scroll when collapsed.
6. **Added scroll behaviour** — `overscroll-behavior: contain`, scroll-padding, smooth scroll.

### Key Spacing Values (Web)
```css
.rka-page { gap: 12px; padding: 0; }
.rka-section { gap: 8px; }
.time-block-stack { gap: 4px; }
.rka-page-title { font-size: 24px; }
.rka-page-subtitle, .rka-page-kicker { display: none; }
```

---

## Session 2 — React Native Migration (2026-06-25)

### Decision
Migrated to React Native + Expo because the PWA cannot support:
- 3D Touch / context menus
- HealthKit
- Background sync
- Location-based reminders
- Home screen widgets

Strategy: **Expo managed workflow + EAS remote builds. No ejecting. No local Xcode.**

### What Was Built

#### Foundation
- Expo SDK 54 project at `apps/mobile/`
- `babel.config.js` with Reanimated plugin
- `eas.json` with dev/preview/production profiles
- `app.json` with all iOS permissions (location, health, background, notifications)

#### Design System (`src/theme/`)
Full RKA design token parity with web CSS custom properties:
- `colors.ts` — all `--rka-*` colour vars as TS constants
- `spacing.ts` — spacing, radius, font sizes, shadow objects

#### Database (`src/db/`)
- `types.ts` — Item, ItemInstance, ActivityLog interfaces (mirrors web Dexie schema)
- `database.ts` — SQLite init, schema creation, all CRUD + query functions

#### Hooks (`src/hooks/`)
- `useDb.ts` — `useInbox()`, `useHomeData()`, `useItems()`
- `useNotifications.ts` — permission, schedule, badge, daily reminders

#### Services (`src/services/`)
- `backgroundSync.ts` — 15-min background task, updates badge, stub for Firebase
- `locationReminders.ts` — geofencing, arrive/leave notifications, `addGeofence()` / `removeGeofence()`

#### Components (`src/components/`)
- `AppHeader.tsx` — Profile | RKA OS | Synced (mirrors web header)
- `SwipeableItem.tsx` — Reanimated swipe, drag-tracked opacity/scale on action buttons
- `ContextMenu.tsx` — long-press modal menu (3D Touch feel)

#### Screens (`src/screens/`)
| Screen | Status | Notes |
|--------|--------|-------|
| HomeScreen | ✅ Functional | Real DB data, inbox count, stats, time blocks |
| InboxScreen | ✅ Functional (Things 3 redesign) | Flat circle-checkbox rows + bottom capture row; swipe + long-press |
| QuickAddScreen | ✅ Functional (Things 3 redesign) | Modal sheet with title/notes inputs, toolbar (Cancel \| Save) |
| MenuScreen | ✅ UI only | Projects, Workouts, Medications (navigation pending) |
| CalendarScreen | 🔲 Placeholder | |
| ProfileScreen | 🔲 Placeholder | |

#### Recent Changes (Session 3)
- **Things 3 UI redesign** — QuickAddScreen and InboxScreen now match Things 3 aesthetic (flat rows, circle checkboxes, capture input at bottom, toolbar pattern)
- **LogDoseSheet toolbar** — replaced separate buttons with Things 3-style top toolbar (Cancel | Title | Save)
- **DB notes field** — `createItem()` now accepts optional `notes` parameter for inline storage
- **backgroundSync.ts fixed** — removed deprecated `expo-background-fetch`, now uses `expo-background-task` (dynamic import with Expo Go fallback)
- **BlurView removed** — replaced with semi-transparent `backgroundColor` in App.tsx (BlurView not available in Expo Go)

### Packages Installed
```json
"expo": "~54.0.0",
"expo-background-task": "^56.0.19",       // (was expo-background-fetch)
"expo-haptics": "~15.0.8",
"expo-location": "~19.0.8",
"expo-notifications": "^0.32.17",
"expo-sqlite": "~16.0.10",
"expo-task-manager": "~14.0.9",
"react-native-reanimated": "~4.1.1",
"react-native-gesture-handler": "~2.20.0",
"@shopify/react-native-skia": "^2.2.12",  // needs dev build
"rive-react-native": "^9.8.3"             // needs dev build
```

### Known SDK 54 Gotchas
- All `npm install` needs `--legacy-peer-deps`
- `lucide-react-native` must be `^1.21.0`+ (0.263 conflicts with React 19)
- `react-native-get-random-values` must be `~1.11.0` (not 2.x)
- tsconfig must NOT extend `expo/tsconfig.base` (base uses `"module": "preserve"` requiring TS 5.4+)
- Reanimated plugin must be in `babel.config.js` ONLY (not in `app.json` plugins — causes crash)
- `expo-background-fetch` is deprecated → use `expo-background-task` with dynamic import for Expo Go compatibility

## Session 3 — Quick Add polish + BottomSheet keyboard fixes (2026-07-07)

**Status of this session's work: all uncommitted in the working tree.** Nothing from
Sessions 1–3 has been committed yet — `git status` on `apps/mobile` is dirty. See
"Uncommitted state" below before doing anything destructive (`git checkout`, `stash`, etc.).

### Context
A prior session (Fable-audited, Sonnet-built, plan at
`~/.claude/plans/only-audit-plan-using-ticklish-hoare.md`) rebuilt `BottomSheet.tsx` with
`useAnimatedKeyboard` and started a 4-phase Quick Add polish round (When chip, dismiss-saves,
keep-adding, draft persistence). Phases 2–4 never actually landed (the agent that reported
"finished in 11s" hit a rate-limit error and wrote nothing). This session picked up from there.

### What was done
1. **Fixed the swipe-to-dismiss gesture conflict** — `GestureDetector`'s pan gesture no longer
   wraps the Cancel/Save `TouchableOpacity`s, only the drag-handle bar itself
   (`src/components/ui/BottomSheet.tsx`).
2. **Implemented Quick Add Phases 2–4** (`src/screens/QuickAddScreen.tsx`):
   - Phase 2: When chip (Today / This Evening / Tomorrow / Anytime / Clear), inline row, exact
     `scheduledDate`/`status`/`timeOfDay` mapping per the plan doc.
   - Phase 3: dismiss-saves (swipe/backdrop with text = silent save, success haptic, never a
     dialog); keep-adding (return key saves, clears title, keeps `when`, refocuses, single-line
     title).
   - Phase 4: draft persistence — new `src/utils/quickAddDraft.ts` (AsyncStorage), backgrounding
     with unsaved text saves a draft, reopening prefills once then clears.
3. **Fixed Inbox staleness bug** — `InboxScreenV2.tsx`'s `useInbox()` only fetched once on mount;
   items created via the global Quick Add FAB never appeared until app reload. Now refetches on
   `visible` becoming true.
4. **Rewrote BottomSheet's keyboard handling** — the `useAnimatedKeyboard`-based manual lift
   math raced against the entrance spring on autofocus (sheet never lifted on cold open). Reverted
   to native `KeyboardAvoidingView` (`behavior="padding"`), matching the already-proven pattern in
   `MedicationsScreen.tsx`'s Add Medication modal. Kept the swipe gesture/backdrop/entrance spring.
5. **Fixed a native crash on drag-handle swipe** — two compounding causes, both fixed:
   - `Keyboard.dismiss()` was firing in the gesture's `.onStart` on every touch-down, racing a
     native `KeyboardAvoidingView` layout pass against an in-flight Reanimated worklet. Moved it
     to only fire in `.onEnd` when the dismiss threshold is actually crossed.
   - The `onClose` callback (SQLite write + haptics + several `setState`s cascading into an
     unmount) ran synchronously inside the `runOnJS` bridge right as the native pan recognizer was
     tearing down. Deferred it with `setTimeout(onClose, 0)` so the recognizer finishes first.
   - Also regenerated the native iOS project (`npx expo prebuild --clean`) and shipped a fresh EAS
     dev-client build, since the installed binary predated a same-day `expo-dev-client` version fix
     (`^56.0.20` → `~6.0.21`, a bad/typo'd entry) — this turned out NOT to be the actual crash
     cause, but is still the correct, up-to-date state and worth keeping.
6. **Fixed a stale-KeyboardAvoidingView bug on fast dismiss→reopen** — `BottomSheet`'s outer
   mount-gate could reuse the same `SheetContainer`/`KeyboardAvoidingView` instance across a fast
   swipe-dismiss-then-reopen, leaving its native keyboard-frame tracking stale. Now keyed on an
   incrementing `openId` so every open mounts fresh.
7. **Fixed double keyboard-inset compensation** — the scrollable body's `ScrollView` had
   `automaticallyAdjustKeyboardInsets` stacked on top of the outer `KeyboardAvoidingView`'s own
   padding, which double-shifted content and scrolled the title out of view. Removed the
   `ScrollView` prop; `KeyboardAvoidingView` alone owns it now.
8. **Added a `topAnchored` mode to `BottomSheet`** — after iterating on "half page" vs "full page"
   with the user, landed on: content-sized (not stretched), anchored just below the safe-area top
   (`justifyContent: 'flex-start'`, `paddingTop: insets.top + spacing[6]`) instead of
   bottom-anchored. Applied to `QuickAddScreen` via the new `topAnchored` prop. (`fullHeight` is a
   separate flex-fill variant still used by other consumers like `LogDoseSheet`/`CalendarScreen`;
   not touched this session. `topAnchored` and `fullHeight` are orthogonal and were briefly
   combined mid-session before settling on `topAnchored` alone — see below.)
9. **Fixed a real layout bug this surfaced** — the scrollable body's `ScrollView` had
   `style={{ flex: 1 }}` unconditionally. That only resolves when the parent chain is flex-bound
   (true for `fullHeight`); in content-sized `topAnchored` mode the parent has no bound, so the
   `ScrollView` collapsed to zero height and the whole card appeared empty (title/notes/pills
   invisible). Fixed: `style={fullHeight ? { flex: 1 } : undefined}` — only flex when the parent
   actually gives it something to flex against.
10. **Restyled Quick Add as a Things-3-style floating card**, per Mobbin reference research
    ([Things 3 "Creating a new to-do"](https://mobbin.com/flows/b1fa3cd6-e51a-4c76-9b52-747df82afefe)):
    - Converted the inline When-picker row (Today/This Evening/Tomorrow/Anytime/Clear) into an
      absolutely-positioned popover overlay anchored below the "When" pill, so opening it doesn't
      grow the sheet's height (`whenPopover` in `QuickAddScreen.tsx`).
    - `topAnchored` sheets now render with `sheetCardRadius` (all four corners rounded — Things 3
      itself only rounds the bottom because its card is flush against the screen edge with zero
      gap above; ours has a visible top gap for status-bar breathing room, so square-top would
      look broken, not intentional) instead of the standard sheet's top-only radius.
    - Backdrop tap-to-dismiss is **disabled** for `topAnchored` cards (`onPress={topAnchored ?
      undefined : onClose}`) — the dimmed gap between a compact card and the keyboard is easy to
      tap by accident while typing mid-note; dismissal still works via the drag-handle swipe and
      Cancel/Save. The backdrop still blocks touches from reaching the app behind it, just no
      longer closes on tap.
    - Toolbar (Cancel/Save) deliberately stayed at the top, not moved to the bottom like Things
      3's actual layout — kept consistent with every other `BottomSheet` consumer in the app
      (LogDose, Medications). Flagged to the user as a scope call, not an oversight; revisit if
      full Things 3 parity is wanted later.
11. **Hardened position-reset on open** — `dragY` (the swipe-drag shared value) was never
    explicitly zeroed when a swipe crossed the dismiss threshold; it relied entirely on the
    `key={openId}` remount (item 6) giving every open a fresh shared value. Added an explicit
    `dragY.value = 0` at the top of the entrance branch in `SheetContainer`'s `visible` effect, so
    the reset is guaranteed regardless of remount timing, not just implied by it. (Deliberately did
    *not* reset `dragY` in the gesture's `.onEnd` dismiss branch — doing so mid-exit-animation would
    cause a visible snap/jump instead of a smooth continued slide-off.)

### Verified on-device (physical iPhone, EAS dev-client build)
- Quick Add keyboard lift on cold open — works.
- Swipe-to-dismiss on drag handle (with text, triggers save) — no longer crashes.
- Fast dismiss→reopen keyboard lift — works.
- Inbox shows items added via the global Quick Add FAB without reload — works.
- Card content (title/notes/pills) visible after the ScrollView flex fix — confirmed via
  screenshot.
- Card corners rounded on all sides, positioned with top breathing room — confirmed via
  screenshot.

### NOT yet verified on-device (pick up here)
- When chip: Today/This Evening/Tomorrow/Anytime mapping actually landing items correctly on
  Home's Today/Evening blocks. The new popover-overlay interaction itself also hasn't been
  screenshotted/confirmed yet.
- Keep-adding: return key 3× → 3 items, sheet stays open, `when` persists.
- Draft persistence: background app with unsaved text → reopen Quick Add → draft prefills once.
- Backdrop-tap-no-longer-dismisses for `topAnchored` — implemented, not yet confirmed on device.
- Position-reset hardening (item 11) — implemented in response to a user request for extra
  robustness, not a confirmed reproducible bug; user asked to stress-test rapid
  swipe-dismiss→reopen cycles, not yet confirmed done.

### Uncommitted state
Everything above is **uncommitted**. Also present in the working tree but **untouched by this
session** and unrelated to it: a large uncommitted diff removing the entire lyrics-player feature
and audio files, and a ~1700-line `CalendarScreen.tsx` rewrite. These predate this session and
were explicitly scoped out (see chat: user confirmed "1 yes definitely" to scoping this session to
the keyboard/Quick Add work only, leaving that other churn alone). Do not commit everything
together — separate these concerns before committing anything.

### Known gap, explicitly deferred (not this session's scope)
**There is no real sync/multi-device story.** `src/services/backgroundSync.ts` is a badge-count
updater with a `// TODO: sync with Firebase when online` that was never implemented.
`firebase` is a dependency (`firebase.ts`), but no realtime listeners exist yet. Everything is
100% local SQLite today — reinstall the app and all data is gone.

---

## Session 4 — Home Polish, Inbox Triage Modal, Backend Purge & Multi-Agent Protocol (2026-07-27)

### What Was Done
1. **Home Screen Timeline Polish** (`apps/mobile/src/components/TimelineSection.tsx`):
   - Surfaced parent project subtitles, checklist progress fractions (e.g. `1/2`), and dynamic `DeadlineBadge` indicators on daily timeline task rows.
   - Defaulted all daily time blocks (Morning, Afternoon, Evening, Anytime) to expanded mode on load.
   - Fixed React Rules of Hooks ordering bug in `TimeBlockItems` by moving conditional early returns after all hook declarations.
2. **Inbox Triage Modal Layering Fix** (`apps/mobile/src/components/triage/TriageOverlay.tsx`):
   - Wrapped `TriageOverlay` in a React Native `<Modal>` component so tapping an Inbox item immediately presents the full-screen guided triage session over the Inbox modal rather than underneath it.
3. **Purged Legacy Supabase References & Clarified Firebase**:
   - Audited the entire repository and verified that `firebase` (`src/lib/firebase.ts`) is the sole backend package.
   - Completely purged stale Supabase references in `AGENTS.md`, `HANDOVER_SUMMARY.md`, and `REACT_NATIVE_SETUP.md`.
   - Deleted obsolete Supabase plan/spec files (`2026-07-10-mobile-supabase-backup.md`, etc.).
4. **Multi-Agent & Developer Synchronization Protocol**:
   - Added a mandatory protocol section to `AGENTS.md` and `apps/mobile/CLAUDE.md` governing documentation synchronization, zero context drift, mandatory handover logging, and repository verification for all present and future AI agents (Claude, Codex, Antigravity) and developers.

---

## Blocker: Apple Developer Account — RESOLVED

~~Cannot test until resolved~~ — Apple Developer Program is active, EAS dev-client builds work.
See "iOS Dev Build" — current flow:

```bash
cd apps/mobile
npx expo start --dev-client         # Metro; add --port <N> if 8081 is taken
# On the iPhone dev-client: Enter URL manually → http://<mac-ip>:<port>
```

To ship a fresh native build after changing native deps or running `expo prebuild`:
```bash
cd apps/mobile
npx expo prebuild --clean --platform ios   # regenerates ios/ (gitignored, safe to nuke)
npx eas-cli build --platform ios --profile development --non-interactive
# Install link printed at the end; same bundle ID so it overwrites in place (data preserved)
```

---

## Next Features (In Priority Order)

1. **HealthKit screen** — steps, workouts, sleep from Apple Health
2. **Skia charts** — progress rings on home stats
3. **Rive animations** — empty states, check animations, loading
4. **Calendar screen** — weekly view of scheduled items
5. **Profile + Settings** — notifications prefs, location reminders manager
6. **Firebase sync** — wire background task to real API
7. **Deep links** — `rkaos://inbox`, `rkaos://item/:id`
8. **Projects screen** — task management with Kanban view

---

## Quick Reference

### Run the App (Expo Go)
```bash
cd apps/mobile
npm start -- --clear    # always --clear after package changes
# Scan QR with iPhone
```

### Run Web PWA
```bash
npm run dev    # from project root
```

### File Locations
| Thing | File |
|-------|------|
| DB queries | `apps/mobile/src/db/database.ts` |
| State hooks | `apps/mobile/src/hooks/useDb.ts` |
| Notifications | `apps/mobile/src/hooks/useNotifications.ts` |
| Background sync | `apps/mobile/src/services/backgroundSync.ts` |
| Location | `apps/mobile/src/services/locationReminders.ts` |
| Design tokens | `apps/mobile/src/theme/` |
| Full setup guide | `docs/migration/REACT_NATIVE_SETUP.md` |

---

## Documentation Index

| File | Contents |
|------|---------|
| `CLAUDE.md` | Project config, skills, constraints, current status |
| `HANDOVER_SUMMARY.md` | This file — session history and quick reference |
| `docs/migration/REACT_NATIVE_SETUP.md` | Full RN setup guide, architecture, what works where |
| `docs/design-system/` | RKA.OS Design System — AI reference + human handbook |

PWA-specific docs (`FIX_LOG.md`, `AUDIT_LOG.md`, `SCROLL_*.md`, `IOS_BOTTOM_NAV.md`, `MOBILE_IMPLEMENTATION_GUIDE.md`) were removed when the web app was retired — see git history if you need them.
