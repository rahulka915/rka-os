# RKA OS Mobile — Claude Code Configuration

**Platform:** React Native 0.86.2 + Expo SDK 57.0.9 (iOS-first)
**Database:** SQLite (expo-sqlite)  
**Design System:** Things 3-inspired interaction patterns (this file, below); visual look is a separate, actively-evolving Moonly/Ronin-inspired refresh — see `DESIGN_CHECKLIST.md` for current tokens, motifs, and per-component status before touching any styling. Settled/graduated decisions live in `../../docs/design-system/` (`reference/` for AI-facing spec + rationale, `handbook/` for a human-facing visual tour) — check there for anything not actively in flux on the checklist.  
**Status:** Ready for Expo development build; features requiring native code (HealthKit, true background fetch) need a dev client and Apple Developer signing  
**Multi-Agent Rule:** Any changes to database schema, components, theme, or backend services MUST be documented immediately in `CLAUDE.md`, `AGENTS.md`, and `HANDOVER_SUMMARY.md`. See `../../AGENTS.md` for full protocol.

**Quantified habits (shipped):** Binary habits keep their original tap-to-complete flow unchanged. Count/duration habits store a `HabitMeta` blob in `item.metadata` (see `src/utils/habitMeta.ts`) and log manual samples as `'habit-sample'` `activityLogs` rows (`src/db/database.ts`'s `logHabitSample`/`getHabitSamples`/`undoLastHabitSample`); period progress is always recomputed from those events, never a stored counter. UI: `HabitsScreen.tsx` branches the fast-completion control on measurement type (mark-done/add-one/`HabitQuantifiedSheet.tsx` value entry); `HabitDetailScreen.tsx` exposes measurement/target/period settings behind a collapsed "Measurement" disclosure.

**Routines (shipped):** A separate `routine`/`routine-step`/`routine-session` item domain (never Missions — no Harada/Potential semantics). `RoutinesScreen.tsx`/`RoutineTemplateDetailScreen.tsx` follow the Habits/Workouts list-and-detail pattern; step ordering reuses the existing manual-order table via `useHapticReorder`, same mechanism as `WorkoutTemplateDetailScreen`'s blocks. `RoutineSessionScreen.tsx` creates (or resumes) its session synchronously on mount so it's durable in SQLite independent of component lifecycle; remaining step time is always derived from persisted timestamps (`src/utils/routineMeta.ts`'s `computeStepRemainingSeconds`), never a local counter, so backgrounding/relaunch is correct automatically. `RoutineResumeBanner.tsx` (mounted in `App.tsx`) surfaces a tap-to-resume capsule for any active session on app start. Routine sessions never write to `domainContributions` or touch `potentialStat` — only a linked habit's own maintenance math may affect Potential. `RoutinesIntroOverlay.tsx` is a 3-step full-screen walkthrough (mirrors `OnboardingScreen.tsx`'s step/eyebrow/title/body/footer structure, informational only — no data collection) shown once on first visit to `RoutinesScreen`, gated by the `hasSeenRoutinesIntro`/`markRoutinesIntroSeen` `appSettings` flag; ends with a CTA into the existing New Routine sheet. Play is hidden on a routine with no steps, and both `RoutineSessionScreen`'s header X and `RoutineResumeBanner`'s dismiss action call `cancelRoutineSession` to abandon a session without completing it — fixes a bug where a zero-step routine's session could get permanently stuck 'active' with a blank player and no way to clear it. See `docs/superpowers/plans/2026-08-05-routines-quantified-habits.md` for the full plan.

**Future routines and quantified habits:** Product direction from the supplied research screenshots is recorded in `../../docs/design/routines-and-habits-product-brief.md`. It is not implemented yet; Apple Health is explicitly deferred from the first implementation.

Run `npx expo install --check` after changing Expo or any native Expo package. SDK 57 patch releases share the major version but not necessarily the same Swift ABI: an earlier `expo-location` linked against a newer `expo-modules-core` caused an immediate iOS `dyld` launch abort. Use `npx expo install --fix` to realign the whole supported package matrix rather than updating individual native modules piecemeal. Restart Metro with `--clear` after the alignment; an already-running Metro retained Worklets Babel plugin `0.10.0` while serving Worklets JavaScript `0.10.1`.

---

## Design Patterns

### Things 3-Style UI

All sheets, forms, and input flows follow Things 3's minimalist patterns:

#### Capture Sheets (QuickAddScreen, InboxScreen bottom row)
- **Transparent modal backdrop** with `~45%` dark overlay (tappable to dismiss)
- **Bottom-anchored sheet** rising with keyboard, rounded top corners (20pt radius)
- **Title input** — large unstyled TextInput (20-22px, bold), autofocused
- **Notes input** — secondary smaller input with hairline separator above
- **Metadata pills** — optional tags/when/priority (visual, wiring TBD)
- **Toolbar pattern** — single row at bottom: **Cancel** (left, gray) | future center area | **Save** (right, blue, disabled until text)

### Things 3 Flow Handoff

Use the following Mobbin references as the current source of truth for Things 3-style mobile flow work:

- [Creating a new to do (shortcut)](https://mobbin.com/flows/b88466ae-38b3-4c00-bfd1-a30197abf09c)
- [Creating a new to-do](https://mobbin.com/flows/b1fa3cd6-e51a-4c76-9b52-747df82afefe)
- [Creating a new project](https://mobbin.com/flows/1999adcb-b259-4ae5-a6f2-2ea992810fbb)
- [Task detail screen 1](https://mobbin.com/screens/18b05379-2af1-41ab-afef-0ca4870933c1)
- [Task detail screen 2](https://mobbin.com/screens/838b35e9-1462-4b3b-bbae-215fb9cc12a0)
- [Task detail screen 3](https://mobbin.com/screens/8de8b342-f6ab-40c7-ac9b-0599039b105f)
- [Task detail screen 4](https://mobbin.com/screens/34ad19d8-7254-455e-a9f8-360e215228eb)

Handoff summary for Claude:

- Treat Things 3 as the flow reference, not the exact visual target.
- Optimize for fast capture first, then progressive disclosure.
- Keep creation flows short, modal, and keyboard-friendly.
- Prefer bottom sheets / capture sheets over full-screen form stacks for quick actions.
- Keep list views flat and lightweight: text first, minimal chrome, clear separators, obvious swipe affordances.
- Project creation should feel guided and structured, not like a blank settings form.
- Task detail should expose notes, schedule, and metadata without overwhelming the primary action.
- If a UX change adds friction to capture, it needs a strong reason.

### Reference Board

Use these Mobbin references for the current RKA mobile visual direction:

**Ronin hero / avatar direction**
- [Shadow Ronin hero page](https://mobbin.com/screens/74201708-1b1b-4b6d-b804-92f9eb2d65c9)
- [Shadow Ronin companion / avatar variants](https://mobbin.com/screens/00604675-8c71-49e9-b454-4924ace45e4d)
- [Shadow Ronin avatar customization](https://mobbin.com/screens/68a30b4e-5c83-4deb-adcc-6c894e36692d)

**Motion-heavy / never-static references**
- [Not Boring Calculator onboarding](https://mobbin.com/flows/ee3a1e29-332d-4141-b2f1-781022885bf7)
- [Not Boring Weather onboarding](https://mobbin.com/flows/9b497adc-67c2-4da9-b1bc-9fc583083113)
- [Finch onboarding](https://mobbin.com/flows/80ef83ef-f872-4825-b18d-6b193d60a9aa)
- [Gentler Streak onboarding](https://mobbin.com/flows/8d4fa57c-117e-4557-8d5c-4d241bfdf9d4)
- [Opal celebration 1](https://mobbin.com/screens/5e08d4e5-1964-43b1-9261-9d7f470a6ba5)
- [Opal celebration 2](https://mobbin.com/screens/1d74f26a-b6c3-4a99-9c7e-0574d6147482)

**Quick add / bottom sheet flow**
- [Things 3 new to-do](https://mobbin.com/flows/b1fa3cd6-e51a-4c76-9b52-747df82afefe)
- [Things 3 shortcut quick add](https://mobbin.com/flows/b88466ae-38b3-4c00-bfd1-a30197abf09c)
- [Tiimo add task](https://mobbin.com/flows/704b09e2-a516-4150-ba3e-14b0d411e4a5)
- [Evernote new task](https://mobbin.com/flows/2954b6d8-6c44-40c7-ae25-648861602dbc)
- [Asana new task](https://mobbin.com/flows/38f5c2dc-1887-4888-98ce-ee986910816d)

Claude should treat these as direct design references and not invent a competing visual language unless the task explicitly calls for it.

#### Inbox-Style Lists (InboxScreen)
- **Flat rows** — no cards, no backgrounds, no shadows
- **Circle checkbox** on left (22×22pt, 1.5pt border, hollow until active)
- **Title + notes** right of circle (text not card)
- **Hairline separators** between rows (indented to text baseline, not full-width)
- **Swipe actions** on left/right (preserved from SwipeableItem)
- **Long-press context menu** (preserved from ContextMenu)
- **Capture row** at bottom (dashed circle + placeholder input, persistent)

#### Toolbars (LogDoseSheet, etc.)
- **Single-row pattern** at top: **Cancel** (left) | **Title/Subtitle** (center) | **Save** (right, blue)
- **Alignment:** both sides are fixed 64pt wide, center area flexible
- **Styling:** no separators, just hairline borders where needed

#### Color Palette (Theme-Aware)
```
Light Mode:
  bg: #f2f2f7
  text: #000000
  textSecondary: rgba(0,0,0,0.38)
  textTertiary: rgba(0,0,0,0.30)
  surface: #ffffff
  separator: rgba(0,0,0,0.08)
  primary: #007aff (blue)
  success: #34a853 (green)
  error: #ff3b30 (red)

Dark Mode:
  bg: #0c0c0c
  text: #f2f2f2
  textSecondary: rgba(255,255,255,0.40)
  textTertiary: rgba(255,255,255,0.28)
  surface: #1c1c1e
  separator: rgba(255,255,255,0.10)
  (primary/success/error unchanged)
```

---

## Component Structure

### Screens (`src/screens/`)

| File | Pattern | Notes |
|------|---------|-------|
| `HomeScreen.tsx` | Tamagui XStack/YStack | Real DB data, stats, time blocks |
| `InboxScreen.tsx` | RN primitives (FlatList, StyleSheet) | Things 3 flat rows + capture |
| `QuickAddScreen.tsx` | RN primitives (Modal, TextInput, StyleSheet) | Things 3 sheet with toolbar |
| `MedicationsScreen.tsx` | Tamagui | Timer, take button, LogDoseSheet |
| `CalendarScreen.tsx` | Tamagui + custom timeline | Week strip, protocol-style instances |
| `MenuScreen.tsx` | Tamagui | Navigation stubs |
| `ProfileScreen.tsx` | Tamagui | Overall Potential + per-Domain score card |
| `PotentialScreen.tsx` | RN primitives (StyleSheet) | Overall Potential, Current Focus, per-Domain scores |
| `AchievementsScreen.tsx` | RN primitives (StyleSheet) | Permanent trophy case; manual/retrospective add flow (long-press a row to toggle contributes-to-score or delete) |
| `FocusScreen.tsx` | RN primitives (StyleSheet) | Current Focus label + per-Domain weight overrides |
| `OnboardingScreen.tsx` | RN primitives (StyleSheet) | First-launch guided setup: Domains -> per-Domain Mission/Potential Stat -> Focus; gated in `App.tsx` on `getItemsByType('area').length === 0` at boot, skippable throughout |
| `ExerciseLibraryScreen.tsx` | RN primitives (StyleSheet) | Exercise catalog: muscle-group overview, then 32 canonical movement-family sections containing the exact variations |
| `WorkoutTemplateDetailScreen.tsx` | RN primitives + ReorderableList | Drag-reorder exercises within a template |
| `WorkoutSessionScreen.tsx` | RN primitives (StyleSheet) | Live set logging: reps/weight capture per exercise, shows last-session reference |

### Components (`src/components/`)

| File | Uses | Purpose |
|------|------|---------|
| `AppHeader.tsx` | Tamagui | Profile | RKA OS | Synced (top-level) |
| `SwipeableItem.tsx` | RN Gesture Handler + Reanimated | Swipe left/right with haptics |
| `ContextMenu.tsx` | RN long-press | 3D Touch-style menu |
| `LogDoseSheet.tsx` | Tamagui + RN Modal | LogDose form with Things 3 toolbar |
| `ExerciseEditSheet.tsx` | RN primitives + BottomSheet | Create/edit exercise (muscle group + equipment chips) |
| `BlockEditSheet.tsx` | RN primitives + BottomSheet | Sets/reps/weight/rest for a template's exercise block |
| `ExercisePickerSheet.tsx` | RN primitives + BottomSheet | Search/pick/create an exercise to add to a template |
| `SetLogRow.tsx` | RN primitives | One reps/weight input row + log button, used by WorkoutSessionScreen |
| `ExerciseThumbnail.tsx` | RN primitives (Image) | Exercise image or placeholder, used in library/picker/template rows |
| `AvatarCompanion.tsx` | Tamagui | Placeholder avatar/initials |
| `fab/FabControl.tsx` | SVG + Reanimated | Shared layered-vector calligraphy FAB; independent lacquer, washi, ink and brush motion; used by the dock and capture surfaces |
| `icons/CollectionIcons.tsx` | RN Image wrappers | High-detail transparent 3D collection artwork: Workout kettlebell, Habit prayer beads, To Get furoshiki parcel and Archive scroll chest |
| `home/RoninJourneyPrototype.tsx` | River Stone + SVG + Reanimated + Rive | Compact Home progress path; advances the animated Ronin-and-cat group from the real Today completion ratio and handles tap reactions |
| `home/RoninJourneyRiveWalker.tsx` | Rive Nitro runtime | Loads `assets/rka_journey_rig.riv`, autoplays `State Machine 1`, and falls back to the transparent PNG while loading or after a runtime error |

`@rive-app/react-native` and `react-native-nitro-modules` power the active Ronin journey renderer. The prepared transparent vector source is `assets/ronin/for-rive/ronin-cat-walk-rive-source.svg`; its adjacent manifest records semantic structure and suggested pivots, and its rig-notes file records the cloud rig. Rive file `2478489` (`RKA Journey Rig`) has weighted Ronin/cat bone chains plus `Idle` and `Walk` timelines. The checked-in runtime export is `assets/rka_journey_rig.riv`; its artboard fill is transparent and `State Machine 1` enters the restrained `Idle` state. The surrounding Reanimated wrapper provides continuous whole-character motion, completion travel and a tap hop, explicitly retaining these functional cues on Reduce Motion devices. Rive contains native code, so regenerate/install the development build after native dependency or asset changes; Expo Go cannot run it.

The canonical source image for the planned multi-pose replacement is `assets/ronin/model/ronin-cat-side-style-reference-v3.png`. It is byte-identical to the transparent side-on Ronin-and-walking-cat layer from the approved Fuji scene and therefore locks the actual target: compact storybook proportions, softer facial construction, subtly irregular illustrated outlines, warm textured shading and a nostalgic hand-painted adventure-game feel. It is not a separate runtime asset. The generated `ronin-cat-front-reference-v1.png` and `ronin-cat-master-identity-sheet-v2.png` are rejected explorations and must not be used as visual targets. Keep new outputs separate until they convincingly reproduce the v3 identity, then vectorise and rig them without flattening, clean-anime restyling or anatomical correction.

The first accepted expansion batch is preserved under `assets/ronin/reference/approved-storybook-v1/`: side-neutral and three-quarter identity views, a rear concept, a cat turnaround, and front/side facial-expression sheets. Treat the side-neutral, three-quarter and expression sheets as approved visual references. The rear view remains concept-only because its headband knot and backpack construction drift, while the cat sheet still needs a standing front view before it can define rig geometry.

The first structural activity batch is under `assets/ronin/reference/approved-structural-v1/`. The front rigging pose, cross-legged meditation, side sleeping, working/journaling and celebration images are approved production references. `rear-rig-needs-sword-correction.png` matches the desired rear identity and backpack better than the earlier concept, but contains an erroneous duplicate sword/scabbard arrangement; retain it for correction guidance only and never infer the final rear prop layers from it.

The corrected rear view is `assets/ronin/reference/approved-structural-v1/rear-rig-corrected-approved.png`; it has empty hands and one attached sheathed sword and supersedes the needs-correction version for rigging. `assets/ronin/reference/approved-activities-v1/` adds approved tea-break, petting, reading and tired/comfort scenes. Its stretching image intentionally remains labelled as a travel-gear concept, while its training image is not yet Workout-rig authority because the generator left the backpack and sword attached despite the requested gear-free state.

The replacement production rig must follow `assets/ronin/for-rive/storybook-journey-rig.manifest.json` and the matching TypeScript contract in `src/domain/ronin/journeyAnimation.ts`. Author the `Journey` composition artboard, `Journey Controller` state machine and `Journey` View Model exactly as named; the app contract supports Journey/idle plus meditation, sleeping, working, reading, training, stretching, tea, tired, celebration and companion activities, with independent mood, outfit, cat state, progress, reduced-motion and tap/completion properties. The manifest assigns approved source art to Side, Front, Rear, Seated, Sleeping, Training and Cat rig families and defines modular face/outfit/travel-gear/prop slots. The intended export is `assets/rka_journey_storybook.riv`; until that file exists and passes the manifest's on-device gates, keep `assets/rka_journey_rig.riv` active. See `../../docs/plans/2026-08-03-ronin-storybook-animation-system.md`.

### Exercise Images

`assets/exercises/*.png` (183 images) + `src/utils/exerciseImages.ts` (generated static `require()` registry) + `src/utils/starterExercises.ts` (generated full starter catalog). `src/utils/exerciseLibrary.ts` classifies all 183 exact variations into 32 canonical movement families; the generated starter metadata persists `movementFamily`, while existing/custom exercises without it fall back to title inference. The muscle-group screen and exercise picker show family sections, and search matches both exact titles and parent-family labels. Regenerate both generated files via `node scripts/generateExerciseAssets.cjs` from `apps/mobile/` after adding new PNGs to `assets/exercises/` — do not hand-edit them, and update both classifier rule copies when adding a genuinely new movement family.

### Database (`src/db/`)

- **database.ts** — SQLite init, schema, all CRUD functions
- **types.ts** — TypeScript interfaces for Item, ItemInstance, ActivityLog
- **Key functions:**
  - `createItem(type, title, status, scheduledDate?, notes?)` — now accepts optional `notes`
  - `getInboxItems()`, `getTodayItems()`, `getItemsByStatus()`
  - `logMedicationTaken(itemId, takenAt?)`, `getMedicationLogs()`, `editMedicationLog()`, `deleteMedicationLog()`
  - Potential/Domains/Achievements/Focus: `computeDomainScore(areaId)`, `computeOverallPotential()`, `completeMission(missionId)`, `setMissionAchievementEligible(missionId, eligible)`, `createAchievement()`, `setAchievementContributesToScore(achievementId, contributes)` (also creates/reactivates/excludes the achievement's `domainContributions` row — `createAchievement` alone never does), `deleteAchievement(achievementId)`, `getFocus()`/`setFocus()`/`clearFocus()` — see `../../SCHEMA.md` for the full data model and `src/utils/domainScoring.ts` for the scoring formula
  - Potential/Domains/Achievements/Focus: `computeDomainScore(areaId)`, `computeOverallPotential()`, `completeMission(missionId)`, `setMissionAchievementEligible(missionId, eligible)`, `createAchievement()`, `getFocus()`/`setFocus()`/`clearFocus()` — see `../../SCHEMA.md` for the full data model and `src/utils/domainScoring.ts` for the scoring formula

### Hooks (`src/hooks/`)

- **useDb.ts** — `useInbox()`, `useHomeData()`, `useItems()`, reactive DB queries
- **useNotifications.ts** — badge, scheduling, daily reminders
- **useThemeContext.ts** — dark mode toggle + system preference

### Services (`src/services/`)

- **backgroundSync.ts** — 15-min background task (expo-background-task, guarded import for runtimes without native support)
- **locationReminders.ts** — geofencing with arrive/leave notifications

### Theme (`src/theme/`)

- **colors.ts** — all palette tokens as TS constants
- **spacing.ts** — spacing scale, radius, shadows, font sizes
- **index.ts** — exported constants used in StyleSheet definitions

### Ronin 3D Companion

A real, working 3D character (Fable 5's GLB export, `assets/ronin/model/ronin_companion_v0.glb`)
is available app-wide via `src/components/home/RoninCharacter.tsx`. It's mood-driven
(`RoninMood` → animation clip, see `src/domain/ronin/roninModel.ts`), renders through an Expo
DOM component (`Ronin3DDom.tsx` — web three.js in a webview, no native modules needed), and
falls back to a static PNG automatically if the GL scene fails. The renderer is transparent
(`alpha: true`, no scene background) — droppable into any container, no box/border required,
though the character is near-black and reads best against a mid-to-dark backdrop given the
current static lighting rig.

**Current mount:** only `ProfileScreen.tsx`'s `Ronin3DBench` (`__DEV__`-only, all 6 moods
switchable) — kept as the single live visualization surface while Fable 5 continues
improving the character (richer idle motion now; a skinned rig for real gestures/tap
reactions later — see model manifest `notes.limitations`). **Not currently mounted on Home**
— `RoninHero.tsx` renders only the status/XP card (`RoninGreetingCard.tsx`); the 3D stage
component (`RoninStage.tsx`, full-width 300px stage with time-of-day gradient) still exists
and is ready to drop back in once the character is ready to be the default Home experience.
No other screen currently uses `RoninCharacter` — do so freely; each mount does its own GLB
load and spins up its own WebGL context, so avoid mounting many instances at once (e.g. in a
list).

---

## Styling Strategy

### Tamagui vs. StyleSheet

- **Tamagui** — HomeScreen, MenuScreen, calcs that need theme switching (light/dark)
- **StyleSheet** — InboxScreen, QuickAddScreen, LogDoseSheet (static Things 3 patterns with hardcoded light/dark colors in component)

### Dark Mode

- **System preference** — read via `useColorScheme()` in App.tsx
- **Manual toggle** — ThemeContext.toggle() updates both local state and TamaguiProvider `defaultTheme`
- **Component pattern** — `const { isDark } = useThemeContext()` then pass theme-aware colors to RN StyleSheet

### Spacing Scale
```
$1 = 4pt, $2 = 8pt, $3 = 12pt, $4 = 16pt, $5 = 20pt, $6 = 24pt
```
Used in Tamagui (XStack/YStack gap, padding). StyleSheet uses literal pt values.

---

## Known Constraints

### Dev Build Requirements
- **BlurView** — not available; using semi-transparent backgroundColor instead
- **HealthKit** — requires dev build (react-native-health)
- **Skia** — requires dev build (@shopify/react-native-skia)
- **Rive** — requires dev build (rive-react-native)
- **True background fetch** — requires dev build (expo-background-task can run, but no reliable periodic wake)
- **Geofencing** — requires dev build (expo-location basic permission works)

### SDK 54 Gotchas
- `npm install --legacy-peer-deps` required for all packages
- `babel.config.js` must have reanimated plugin, NOT app.json
- tsconfig must NOT extend expo/tsconfig.base
- `lucide-react-native` v1.21.0+
- `react-native-get-random-values` v1.11.0

---

## Next Steps (Prioritized)

1. **Apple Developer Account** — required to build dev client
2. **HealthKit screen** — once dev build available
3. **Wiring metadata pills** — When/Tags/Priority in capture sheets
4. **Calendar screen** — full functionality
5. **Deep links** — `rkaos://inbox`, `rkaos://item/:id`
7. **Skia charts** — progress rings on home stats
8. **Rive animations** — loading, empty states, check animations

---

## Quick Reference

### Run the Dev Client
```bash
cd apps/mobile
npm start -- --clear
# Open the installed RKA OS dev client and scan the QR code
```

### TypeScript Check
```bash
npx tsc --noEmit
```

### File Locations
| Thing | File |
|-------|------|
| DB schema/queries | `src/db/database.ts` |
| Types | `src/db/types.ts` |
| Home/Inbox logic | `src/hooks/useDb.ts` |
| Notifications | `src/hooks/useNotifications.ts` |
| Background sync | `src/services/backgroundSync.ts` |
| Location reminders | `src/services/locationReminders.ts` |
| Colors/spacing | `src/theme/` |
| Inbox + Capture UI | `src/screens/InboxScreen.tsx` |
| Quick add sheet | `src/screens/QuickAddScreen.tsx` |
| Medications + LogDose | `src/screens/MedicationsScreen.tsx` + `src/components/LogDoseSheet.tsx` |

---

## Style Sheet Template

Reusable pattern for flat UI components with theme awareness:

```typescript
import { StyleSheet } from 'react-native';
import { useThemeContext } from '../hooks/useThemeContext';

function MyComponent() {
  const { isDark } = useThemeContext();
  
  const textColor = isDark ? '#f2f2f2' : '#000000';
  const bgColor = isDark ? '#1c1c1e' : '#ffffff';
  
  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>Hello</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 12 },
  text: { fontSize: 16, fontWeight: '500' },
});
```

This ensures light/dark mode support without needing Tamagui's overhead on every component.
