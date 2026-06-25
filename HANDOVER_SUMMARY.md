# RKA OS — Handover Summary
**Last Updated:** 2026-06-25  
**Status:** Dual platform — PWA (maintenance) + React Native iOS (active)

---

## Platform Overview

| Platform | Location | Status | Run Command |
|----------|----------|--------|-------------|
| **React Native iOS** | `apps/mobile/` | Active development | `cd apps/mobile && npm start` |
| **Web PWA** | `src/` (root) | Maintenance mode | `npm run dev` |

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
- `backgroundSync.ts` — 15-min background task, updates badge, stub for Supabase
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

---

## Blocker: Apple Developer Account

**Cannot test until resolved:**
- Expo Development Build (custom Expo Go with all native modules)
- Skia, Rive, HealthKit, full background fetch

**Resolution:** Sign up at developer.apple.com — $99/yr, activates 24-48hrs.

**Once account active, run:**
```bash
cd apps/mobile
npm install -g eas-cli
eas login
eas init          # links project to Expo account
eas build --platform ios --profile development
# Install IPA from link, then npm start → scan QR in dev client
```

---

## Next Features (In Priority Order)

1. **HealthKit screen** — steps, workouts, sleep from Apple Health
2. **Skia charts** — progress rings on home stats
3. **Rive animations** — empty states, check animations, loading
4. **Calendar screen** — weekly view of scheduled items
5. **Profile + Settings** — notifications prefs, location reminders manager
6. **Supabase sync** — wire background task to real API
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
| `docs/migration/MAINTENANCE_MODE.md` | PWA maintenance mode policy |
| `docs/migration/SHARED_LOGIC.md` | How to share logic between web and mobile |
| `FIX_LOG.md` | All PWA fixes and optimisations with code |
| `AUDIT_LOG.md` | Issue tracking |
