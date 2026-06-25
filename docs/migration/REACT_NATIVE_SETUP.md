# RKA OS — React Native iOS Setup Guide

**Last Updated:** 2026-06-25  
**Status:** Active development — Expo Go (SDK 54) working on device, transitioning to EAS dev build

---

## Project Location

```
rka-os/
├── apps/mobile/          ← React Native iOS app (PRIMARY)
├── src/                  ← PWA web app (maintenance mode only)
└── docs/migration/       ← This file + related guides
```

---

## Stack

| Item | Version | Notes |
|------|---------|-------|
| Expo SDK | 54.0.35 | Matches Expo Go on device |
| React Native | 0.81.5 | |
| React | 19.1.0 | |
| TypeScript | 5.9.x | |
| Navigation | @react-navigation v6 | bottom-tabs |
| Database | expo-sqlite 16.x | Local SQLite, no server needed |
| Gestures | react-native-gesture-handler + reanimated | Swipe actions on inbox |
| Haptics | expo-haptics | All interactions wired |
| Notifications | expo-notifications 0.32.x | Badge = inbox count |
| Location | expo-location 19.x | Geofencing wired, needs dev build |
| Background sync | expo-background-fetch + expo-task-manager | Wired, needs dev build |

---

## File Structure

```
apps/mobile/
├── App.tsx                         # Root: navigation, modals, init
├── index.ts                        # Entry point (imports expo-dev-client)
├── app.json                        # Expo config, permissions, EAS project ID
├── eas.json                        # EAS build profiles
├── babel.config.js                 # babel-preset-expo + reanimated plugin
├── src/
│   ├── theme/
│   │   ├── colors.ts               # RKA design tokens (mirrors web CSS vars)
│   │   ├── spacing.ts              # Spacing, radius, font sizes, shadows
│   │   └── index.ts
│   ├── db/
│   │   ├── types.ts                # Item, ItemInstance, ActivityLog types
│   │   └── database.ts             # SQLite init + all CRUD/queries
│   ├── hooks/
│   │   ├── useDb.ts                # useInbox, useHomeData, useItems
│   │   └── useNotifications.ts     # Permission, schedule, badge count
│   ├── services/
│   │   ├── backgroundSync.ts       # 15-min background task (expo-background-fetch)
│   │   └── locationReminders.ts    # Geofencing (expo-location)
│   ├── components/
│   │   ├── AppHeader.tsx           # Profile icon | RKA OS | Synced
│   │   ├── SwipeableItem.tsx       # Reanimated swipeable (activate / archive)
│   │   └── ContextMenu.tsx         # Long-press menu with heavy haptic + scale
│   └── screens/
│       ├── HomeScreen.tsx          # Live data: greeting, inbox count, stats, timeline
│       ├── InboxScreen.tsx         # Add, swipe-activate, swipe-archive, long-press, delete
│       ├── QuickAddScreen.tsx      # FAB → quick capture to inbox
│       ├── CalendarScreen.tsx      # 🔲 Placeholder
│       ├── MenuScreen.tsx          # Projects / Workouts / Medications list
│       └── ProfileScreen.tsx       # 🔲 Placeholder
```

---

## Data Model

Mirrors the web app's Dexie schema exactly, implemented in SQLite:

```typescript
type ItemType = 'task' | 'habit' | 'medication' | 'workout-template' | 'exercise' | 'area' | 'project' | 'meal'
type ItemStatus = 'inbox' | 'active' | 'scheduled' | 'due-today' | 'overdue' | 'completed' | 'skipped' | 'archived' | 'cancelled'

interface Item {
  id: string;           // uuid v4
  type: ItemType;
  title: string;
  status: ItemStatus;
  notes?: string;
  scheduledDate?: string; // YYYY-MM-DD
  dueDate?: string;
  rrule?: string;
  metadata?: string;    // JSON string (timeOfDay etc.)
  createdAt: number;    // ms timestamp
  updatedAt: number;
}
```

DB file: `rka-os.db` (SQLite, on-device)

---

## Navigation Structure

```
App.tsx
├── GestureHandlerRootView
│   └── SafeAreaProvider
│       ├── Tab.Navigator (floating pill TabBar)
│       │   ├── Home → HomeScreen (onInboxPress prop opens modal)
│       │   ├── Calendar → CalendarScreen
│       │   ├── Menu → MenuScreen
│       │   └── Profile → ProfileScreen
│       ├── InboxScreen (Modal, pageSheet presentation)
│       └── QuickAddScreen (Modal, formSheet — triggered by FAB)
```

Tab bar: floating pill (Home | Calendar | Menu | Me) + separate FAB (+)  
Tab icons: currently emoji — replace with lucide-react-native icons

---

## What's Working ✅

| Feature | Notes |
|---------|-------|
| Home screen with live SQLite data | Inbox count, today items, upcoming, time blocks |
| Inbox — add / activate / archive / delete | Full CRUD |
| Swipe right to activate | Reanimated spring physics |
| Swipe left to archive | |
| Long-press context menu | Heavy haptic + scale animation |
| Quick capture via FAB | Drops to inbox |
| Haptics on all interactions | Light nav, medium FAB, success activate |
| Push notification permission | Requested on first launch |
| Inbox badge count | Updates on close |
| Background sync task | Registered, activates in dev build only |
| Location permission request | On launch, silent fail if denied |

## Not Yet Built 🔲

| Feature | Needs |
|---------|-------|
| Calendar screen | Build out |
| Profile screen | Build out |
| HealthKit | Dev build + `react-native-health` package |
| True background sync | Dev build |
| Supabase sync | Wire `backgroundSync.ts` to API |
| Deep links | `rkaos://` URL scheme |
| Lucide icons in tab bar | Replace emoji with proper icons |

---

## Running the App

### Option A: Expo Go (current — works now)
```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile"
npm start -- --clear
```
Scan QR with iPhone → opens in Expo Go. Background fetch and geofencing silently inactive.

### Option B: EAS Development Build (next step — unlocks all native features)
```bash
# Step 1: Register device (one-time)
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile"
eas device:create

# Step 2: Build on EAS cloud (~10-15 min)
eas build --platform ios --profile development

# Step 3: Install IPA on device via the link EAS sends

# Step 4: Start dev server
npm start

# Open the installed "RKA OS" dev client (not Expo Go) → scan QR
```

**Requirements for dev build:**
- Apple Developer account (free — 7-day sideloading, rebuild after expiry)
- EAS account: `@rka1107` (already linked)
- Xcode installed ✅
- EAS project ID: `f19be19e-206b-4530-9dbb-5b05dfce7d0f`
- Bundle ID: `com.rahul.rkaos`

---

## Known Gotchas

| Issue | Fix |
|-------|-----|
| `react-native-worklets` must be `0.5.1` | Pinned in package.json |
| `reanimated/plugin` goes in `babel.config.js` only | NOT in `app.json plugins` — crashes config |
| `expo-dev-client` version mismatch | May need `~4.0.0` if EAS build fails |
| Tab bar shows emoji | Replace with lucide-react-native icons when time permits |
| Background fetch silent in Expo Go | Expected — only active in dev build |

---

## EAS Config

**eas.json profiles:**
- `development` — dev build, `developmentClient: true`, internal distribution
- `preview` — internal distribution, no dev client
- `production` — App Store, auto-increment build number

**app.json permissions declared:**
- Location (foreground + background)
- Notifications
- Background modes: fetch, remote-notification, location
- HealthKit (NSHealthShareUsageDescription, NSHealthUpdateUsageDescription)
- Motion

---

## Next Steps (Priority Order)

1. `eas build --platform ios --profile development` → install dev build
2. Verify background sync + geofencing activate in dev build
3. Add `react-native-health` → wire up HealthKit (steps, sleep, workouts, HR)
4. Build Calendar screen (today's schedule from SQLite)
5. Build Profile screen (user settings)
6. Wire `backgroundSync.ts` to Supabase API
7. Add deep link handler (`rkaos://`)
8. Replace emoji tab icons with lucide-react-native

---

## Key Commands Reference

```bash
# Dev server
npm start -- --clear

# Type check
npx tsc --noEmit

# Bundle check (no device)
npx expo export --platform ios --output-dir /tmp/rka-export

# EAS device register
eas device:create

# EAS dev build
eas build --platform ios --profile development

# Check installed expo package versions
npx expo-doctor
```
