# RKA OS — React Native iOS Setup Guide

**Last Updated:** 2026-06-25  
**Status:** Active development — Expo development build is the default path on iOS

---

## Project Location

```
rka-os/
├── apps/mobile/          ← React Native iOS app + a separate desktop web app (src/webApp/, see apps/mobile/CLAUDE.md)
└── docs/migration/       ← This file + related guides
```

The *different, unrelated* Progressive Web App that used to live at `src/` (repo root, Vite + React + Dexie.js) has been fully retired. This repo is not web-free, though: `apps/mobile/src/webApp/` is a separate, current, actively-developed Expo-web desktop target sharing this same mobile app's SQLite data layer — see `apps/mobile/CLAUDE.md`'s "Desktop Web App" section. Don't conflate the two.

---

## Stack

| Item | Version | Notes |
|------|---------|-------|
| Expo SDK | 54.0.35 | Matches the current dev client runtime |
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

Originally ported 1:1 from the now-retired PWA's Dexie schema; this SQLite schema is the sole authoritative data model today — see `apps/mobile/SCHEMA.md` for its current state.

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
| Firebase sync | Wire `backgroundSync.ts` to API |
| Deep links | `rkaos://` URL scheme |
| Lucide icons in tab bar | Replace emoji with proper icons |

---

## Running the App

### Option A: Development Build (default)
```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile"
npm start -- --clear
```
Open the installed "RKA OS" dev client on iPhone and scan the QR code. Background fetch and geofencing stay active in the dev build.

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
| `expo-dev-client` version mismatch | May need package alignment if EAS build fails |
| Tab bar shows emoji | Replace with lucide-react-native icons when time permits |
| Background fetch silent in dev client | Expected — only active in dev build |

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
6. Wire `backgroundSync.ts` to Firebase API
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

---

## 2026-07-08/09 Update — expo-widgets Live Activity shipped, EAS cloud builds unreliable

**Current state:** `expo-widgets` is re-enabled in `app.json` (Medication Timer Live Activity — Dynamic Island + Lock Screen). Metro port is now **8082**, not 8081 (kill any stray instance on 8081 — running two Metro instances against the same phone causes silent stale-bundle confusion). Dev client connects via "Enter URL manually" → `http://<mac-LAN-ip>:8082`.

**EAS cloud builds are currently unreliable for this project** — repeated "lost connection to worker" failures even on `resourceClass: m-medium`, across many attempts on different days. When cloud build fails, go straight to local:
```bash
eas build --platform ios --profile development --local
xcrun devicectl list devices                                    # get device UDID
xcrun devicectl device install app --device <udid> <path>.ipa   # sideload directly, no Xcode GUI needed
```

**`eas-cli@20.5.1` local-build bug:** its bundled `eas-cli-local-build-plugin` crashes with an uncaught `kill ESRCH` during cleanup right after the `expo doctor` phase (tries to kill an already-exited child process, doesn't catch the throw). **Fix:** downgrade global `eas-cli` to `20.4.0`:
```bash
npm install -g eas-cli@20.4.0 --prefix ~/.npm-global
```
Re-check if this is still needed before assuming it — a newer eas-cli may have fixed it by the time you read this.

**Local builds fill up disk fast.** Each attempt leaves behind gigabytes in `/private/var/folders/.../T/eas-build-local-nodejs/` that don't auto-clean on failure. Before a local build, check `df -h /`; if under ~5GB free, clear:
```bash
rm -rf /private/var/folders/*/T/eas-build-local-nodejs   # find the exact path via: getconf DARWIN_USER_TEMP_DIR
npm cache clean --force
rm -rf ~/Library/Caches/CocoaPods
```
(Don't wildcard-delete `~/Library/Developer/Xcode/Archives` without asking the user first — old archives may be intentionally kept.)

**macOS TCC gotcha:** if a shell session suddenly can't `ls`/`cd` into `~/Downloads` or its subfolders ("Operation not permitted" even though `cd` itself works), it's a stale Files-and-Folders/Full Disk Access grant for the app hosting the shell. Toggling the permission in System Settings does **not** apply to the already-running process — the app must be fully quit (Cmd+Q) and relaunched for a fresh shell to pick it up.

**`'widget'`-tagged component gotcha (expo-widgets/Live Activity):** functions marked with the `'widget'` directive (see `src/liveActivities/MedicationTimerActivity.tsx`) get extracted into an isolated JS context for the widget extension target. **Module-scope constants declared outside the function are NOT included in that extracted context** — referencing one throws `ReferenceError: Can't find variable: X` at runtime, visible on-device as a red error overlay (not caught by any JS try/catch in the RN app, since it's a separate native/JS context). Fix: declare every constant the widget function needs *inside* the function body itself.

**Verifying Live Activities work:** there's a `__DEV__`-only "Start/Stop Test Live Activity" button on `ProfileScreen.tsx` (fake "Test Medication" data, doesn't touch the DB or real timer state machine) — use this to test the Live Activity pipeline in isolation instead of starting a real medication timer.

---

## 2026-07-09 Update — Ronin 3D shipped via DOM components; local native builds broken on this Mac

**Ronin 3D companion is live with ZERO native builds.** It renders through an Expo DOM component (`'use dom'` → web three.js inside the SDK 57 dom-webview that every dev client already ships):
- `src/components/home/Ronin3DDom.tsx` — the 3D scene (web three.js; GLB passed in as a base64 prop; mood → clip crossfades, blink, one-shot `resolved_nod`). Bundles for the web platform: keep it free of react-native/app-domain imports.
- `src/domain/ronin/useRoninGlbBase64.ts` — RN-side GLB→base64 reader (expo-asset + expo-file-system, cached).
- `src/components/home/RoninCharacter.tsx` — the seam: `RONIN_3D_ENABLED` kill switch in `src/domain/ronin/roninModel.ts` (set `false` → exact static-PNG behavior); PNG fades out only after the scene reports ready; any error falls back to PNG.
- `src/screens/ProfileScreen.tsx` — `__DEV__`-only "Ronin 3D bench" on the Me tab: DOM-runtime canary chip + big panel + mood buttons. Use it to smoke-test any new dev client.
- **Required pure-JS deps for DOM components** (no native code, safe without rebuild): `@expo/metro-runtime`, `react-native-web`, `react-dom`. Missing ones fail as `DOM Bundling failed … Unable to resolve "<pkg>"` in Metro.
- `src/components/home/Ronin3D.tsx` (expo-gl + R3F native variant) is **parked, unused** — a future dev client built with expo-gl can switch the seam back for native GL.

**Local native iOS builds are currently NOT viable on this 8 GB MacBook Air** (repeated clang PCM corruption — "malformed or corrupted precompiled file" — across 10+ attempts: every cache tier wiped, quiet system, `-jobs 2`; one SWBBuildService segfault). Root cause: memory starvation — internal disk at ~100 % means swap can't grow. Don't burn cycles re-deriving this; free 10–20 GB internal and/or run Apple Diagnostics (D-key boot) to rule out RAM issues before trying again.
- **Xcode DerivedData is redirected** to an APFS sparse image on the T7: `defaults read com.apple.dt.Xcode IDECustomDerivedDataLocation` → `/Volumes/DevBuilds/DerivedData`; image file is `"/Volumes/rka T7/DevBuilds.sparseimage"` — remount after unplug/reboot with `hdiutil attach "/Volumes/rka T7/DevBuilds.sparseimage"` or builds silently fall back to the full internal disk.
- **EAS cloud still fails** with "lost connection to worker" (retried 2026-07-09, build d53dded3) — likely worker OOM at `m-medium`; `m-large` needs a paid plan.
- The `apps/mobile/ios/Podfile` has a `post_install` hook fixing `expo-widgets`/`expo-constants` script phases that break on the space in "Coding Projects". It survives `pod install` but NOT `npx expo prebuild --clean` — re-apply after prebuild.

**Parallel Claude sessions:** read `RKA-avatar-lab/COORDINATION.md` (session mailbox: ownership table + machine facts) before editing or building anything in this repo.
