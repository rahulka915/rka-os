# RKA OS Mobile — Claude Code Configuration

**Platform:** React Native 0.86.2 + Expo SDK 57.0.9 (iOS-first, primary); also ships a desktop web target via Expo web (`.web.tsx` screens under `src/webApp/`) — see "Desktop Web App" section below before assuming iOS-only
**Database:** SQLite (expo-sqlite)  
**Design System:** Things 3-inspired interaction patterns (this file, below); visual look is a separate, actively-evolving Moonly/Ronin-inspired refresh — see `DESIGN_CHECKLIST.md` for current tokens, motifs, and per-component status before touching any styling. Settled/graduated decisions live in `../../docs/design-system/` (`reference/` for AI-facing spec + rationale, `handbook/` for a human-facing visual tour) — check there for anything not actively in flux on the checklist.  
**Status:** Ready for Expo development build; features requiring native code (HealthKit, true background fetch) need a dev client and Apple Developer signing  
**Multi-Agent Rule:** Any changes to database schema, components, theme, or backend services MUST be documented immediately in `CLAUDE.md`, `AGENTS.md`, and `HANDOVER_SUMMARY.md`. See `../../AGENTS.md` for full protocol.

**Cold-start performance guardrails:** Native uses synchronous SQLite, so startup must avoid full-table work on the JS thread. Home opens on Today only: do not hydrate Upcoming/Anytime/Someday/Logbook on first mount, and keep Potential/focus summary work behind first interactions. Segmented screens follow the same rule: Tasks does not load completed Logbook rows until the Logbook segment is selected. Realtime Firestore sync is deferred until after interactions, applies first snapshots in small chunks, and delays local-only reconciliation scans; `pushBackup` is manual/user-triggered only (Settings), not an automatic AppState background snapshot. `items` and `activityLogs` have startup-query indexes — preserve those when touching schema.

## Desktop Web App

`src/webApp/` + `App.web.tsx` (repo root of this package) is a **genuinely separate, actively-developed desktop/web target** — Expo web, `.web.tsx` platform-specific files sitting alongside the native screens (e.g. `WorkoutsScreen.web.tsx` next to `WorkoutsScreen.tsx`), run via `npm run web` (dev) / `npm run web:build` (prod, deploys to Firebase Hosting per the repo root `firebase.json`'s `hosting.public: apps/mobile/dist`). Built 2026-07-30 through 2026-08-01 across a run of "gap closure" phases.

**Do not confuse this with the *retired* Progressive Web App** (Vite + React + Dexie.js, lived at the repo root, last touched 2026-06-23) that `CLAUDE.md`/`AGENTS.md`/`HANDOVER_SUMMARY.md` describe as historical — that one is gone. This one is current and shares real data with the iOS app.

It shares the exact same SQLite-backed data layer as mobile — `db/database.ts`, `hooks/useDb.ts`, and the `utils/` aggregation modules are used unmodified (e.g. `WorkoutsScreen.web.tsx` calls the same `createItem`/`useWorkouts` as the native `WorkoutsScreen.tsx`) — but has its own:
- **Screens** under `src/webApp/*.web.tsx`, not `src/screens/`.
- **Theme:** `theme/webTheme.ts` (`webColors`/`webSpacing`/`webRadius`/`webFontSize`), not the native `theme/` tokens.
- **Icons:** `lucide-react-native`, not this app's native icon components.
- **Navigation model:** a `Sidebar.web.tsx` of top-level views, each rendering a single screen (list + capture row) with a right-side sliding `DetailPanel.web.tsx` for viewing/editing one item — not mobile's `react-navigation` screen stack. `ItemDetailForm.web.tsx` is the shared detail-panel body; per-domain forms (`DomainMissionDetailForm`, `HabitDetailPanel`, `MedicationEditForm`, `ExerciseDetailPanel`, `ObjectDetailForm`, `WorkoutTemplateDetailPanel`, `BlockEditForm`, `ExercisePickerModal`) plug into it.

**Screen parity (current, check before assuming a feature exists on web):** Home, Inbox, Tasks, Areas/Projects, Calendar, Upcoming, Archive, Objects (To Get), Medications, Workouts (+ Exercise Library, Workout Template detail), Habits, Settings all have a `.web.tsx` counterpart. **Not yet ported:** Potential, Achievements, Focus, Skills, Routines, Workout Trends, Plan Backwards, and Daily Check-In/Daily Log (native-only as of 2026-08-10 — see `HANDOVER_SUMMARY.md`). When adding a new native screen/feature, it does not automatically appear on web — porting it is separate, deliberate work.

`tsc --noEmit` reports `Cannot find module './DetailPanel'`-style errors on files under `src/webApp/`— this is a **false alarm**: `tsc`'s default resolution doesn't understand Expo/Metro's `.web.tsx` platform-extension convention the way the Metro bundler does at build/run time. Don't treat these as real breakage without also checking the file actually exists on disk.

**Quantified habits (shipped):** Binary habits keep their original tap-to-complete flow unchanged. Count/duration habits store a `HabitMeta` blob in `item.metadata` (see `src/utils/habitMeta.ts`) and log manual samples as `'habit-sample'` `activityLogs` rows (`src/db/database.ts`'s `logHabitSample`/`getHabitSamples`/`undoLastHabitSample`); period progress is always recomputed from those events, never a stored counter. UI: `HabitsScreen.tsx` branches the fast-completion control on measurement type (mark-done/add-one/`HabitQuantifiedSheet.tsx` value entry); `HabitDetailScreen.tsx` exposes measurement/target/period settings behind a collapsed "Measurement" disclosure.

**Routines (shipped):** A separate `routine`/`routine-step`/`routine-session` item domain (never Missions — no Harada/Potential semantics). `RoutinesScreen.tsx`/`RoutineTemplateDetailScreen.tsx` follow the Habits/Workouts list-and-detail pattern; step ordering reuses the existing manual-order table via `useHapticReorder`, same mechanism as `WorkoutTemplateDetailScreen`'s blocks. `RoutineSessionScreen.tsx` creates (or resumes) its session synchronously on mount so it's durable in SQLite independent of component lifecycle; remaining step time is always derived from persisted timestamps (`src/utils/routineMeta.ts`'s `computeStepRemainingSeconds`), never a local counter, so backgrounding/relaunch is correct automatically. `RoutineResumeBanner.tsx` (mounted in `App.tsx`) surfaces a tap-to-resume capsule for any active session on app start. Routine sessions never write to `domainContributions` or touch `potentialStat` — only a linked habit's own maintenance math may affect Potential. `RoutinesIntroOverlay.tsx` is a 3-step full-screen walkthrough (mirrors `OnboardingScreen.tsx`'s step/eyebrow/title/body/footer structure, informational only — no data collection) shown once on first visit to `RoutinesScreen`, gated by the `hasSeenRoutinesIntro`/`markRoutinesIntroSeen` `appSettings` flag; ends with a CTA into the existing New Routine sheet. Play is hidden on a routine with no steps, and both `RoutineSessionScreen`'s header X and `RoutineResumeBanner`'s dismiss action call `cancelRoutineSession` to abandon a session without completing it — fixes a bug where a zero-step routine's session could get permanently stuck 'active' with a blank player and no way to clear it. See `docs/superpowers/plans/2026-08-05-routines-quantified-habits.md` for the full plan.

**Plan Backwards (shipped, v1):** A standalone deadline/anchor-based planning workspace — deliberately NOT folded into Today yet (see `Menu` → "Plan Backwards" → `PlanBackwardsScreen.tsx` list → `PlanBackwardsDetailScreen.tsx` workspace). A plan is a `backward-plan` item (metadata = `BackwardPlanMeta`: `goalTime` required, `startTime`/`expectedTime`/`latestTime`/`endTime`/`location`/`deviceCalendarEventId` all optional — see `src/utils/backwardPlanMeta.ts`); its ordered Routine/Task/Travel components live in dedicated `planBlocks`/`planBlockSteps` tables (not `items` rows), since placement/buffer/completion are plan-instance-specific and must never leak into a reusable routine template. Adding an existing Routine to a plan **copies** its current steps into `planBlockSteps` (`addPlanBlockRoutine`) — a snapshot, not a live link, so completing a step today never mutates the template and editing the template later never retroactively changes an already-instantiated plan. The three live metrics (Time Remaining / Time Required / Unallocated) and backwards ordering (`keep-near-event` closest to Goal Time, then `auto`, then `anytime-before` furthest back) are pure functions in `src/utils/backwardPlanCalc.ts` (`calculateTimeRemaining`, `calculateRoutineRemainingDuration`, `calculatePlanRequiredDuration`, `calculateUnallocatedTime`, `calculateLeaveBy`, `buildBackwardsSchedule` — see its test file for the completed-step-exclusion behavior), consumed by `useBackwardPlan` (`useDb.ts`, minute-granularity tick). A completed block/step contributes nothing to Time Required but stays visible (struck through), never deleted. Buffers reserve timeline time but are never shown as a fake completable task. **Live Apple Maps routing (shipped):** Travel blocks can fetch a real ETA via Apple's Maps Server API (`https://developer.apple.com/documentation/applemapsserverapi`) — `AddPlanBlockSheet.tsx`'s Travel tab has a "Get live ETA from Apple Maps" button that geocodes the start/destination addresses and fetches drive/walk/transit time between them, filling the duration field and tagging the block `source: 'live'` (shown as "· Live · X km" in the plan). Editing any travel input afterward silently drops back to `'manual'` — a live estimate is never claimed once the inputs it was based on have changed. The private signing key for Apple's Maps Server API **never ships in the app** — `functions/src/index.ts`'s `getAppleMapsToken` Cloud Function signs the ES256 JWT server-side (from `APPLE_MAPS_TEAM_ID`/`APPLE_MAPS_KEY_ID`/`APPLE_MAPS_PRIVATE_KEY` Cloud Functions secrets) and exchanges it for a short-lived (~30 min) access token, which is all the client (`src/services/appleMaps.ts`) ever holds, cached in memory. Every call fails soft to the manual-duration fallback (no network/no token/unresolvable address never blocks the feature — spec section 28). Response parsing is pure/tested in `src/utils/appleMapsParsing.ts`. **Requires one-time setup the app can't do on its own** — see `HANDOVER_SUMMARY.md`'s 2026-08-08 entry for the exact Apple Developer + `firebase functions:secrets:set` + `firebase deploy --only functions` steps; until that's done, `getAppleMapsToken` fails and the button silently falls back to manual entry, exactly as if it were never wired up. The `TravelConfig` shape (`mode`/`durationMinutes`/`bufferMinutes`/`startLocation`/`destination`/`source`/`distanceMeters`/`estimatedAt`) keeps manual entry a first-class value, not just a fallback placeholder. **Location search-as-you-type** (`LocationSearchField.tsx`, backed by `searchLocations`/`/v1/searchAutocomplete`) replaces plain text entry for the anchor event's Location field and Travel's From/To fields — a debounced (300ms, 3+ chars) dropdown of real places, each carrying its own coordinate so picking one skips a follow-up geocode call; typing without picking a suggestion still works as free text, same fail-soft principle as the rest of this integration. Results are ranked by proximity to the device's current location (`src/services/deviceLocation.ts`'s `getApproximateLocation`, fetched lazily on first focus so there's no permission prompt until the field is actually used, cached 5 min module-wide) via Apple's `userLocation`/`searchLocation` params — matches how the native Maps app ranks "X mi away" results; search still works with no bias (just unranked by distance) if location permission is denied. **Gotcha discovered live, not from Apple's docs:** `/v1/searchAutocomplete`'s `location` field is actually `{latitude, longitude}` at runtime, not the `{lat, lng}` Apple's own documentation describes — `parseSearchAutocompleteResponse` reads both shapes defensively. **Per-result ETA badges:** `LocationSearchField`'s optional `etaOrigin`/`etaMode` props (wired for Travel's "To" field once "From" has a resolved coordinate — captured for free via `onSelectPlace` when the user picks a "From" suggestion, no extra geocode call) trigger one batched `/v1/etas` call (`getEtasBatch`, up to 10 destinations per Apple's cap) covering the whole visible dropdown, rather than one request per row — each row then shows its own duration badge, same UX as native Maps search. Cleared whenever "From" is edited by hand, so a badge is never left showing a stale origin's numbers. Calendar linking (separately) is read-only (`src/services/deviceCalendar.ts`'s existing today-only fetch) — RKA never writes back to the device calendar. Not yet ported to desktop web.

**Plan Backwards countdown widget (shipped, Home screen):** Third square card in Home's widget row (`PlanBackwardsCountdownWidget.tsx`, next to Medication/Weather — the row's own comment had already anticipated a third slot). Shows the soonest upcoming plan's live Time Remaining, and either its title or "`X` short" in red once Unallocated goes negative — same at-a-glance urgency signal as the detail screen's over-capacity warning, just condensed. Tap opens that plan. Renders nothing when no plan has a future Goal Time. `dateTimeFromParts` and `planBlockRowToCalc` (both now exported from `backwardPlanCalc.ts`, tested) were extracted out of `PlanBackwardsDetailScreen.tsx` so this widget and the detail screen share one definition of "what Goal Time means as a Date" and "how a DB block row becomes calc input" — `planBlockRowToCalc` takes a structurally-typed (duck-typed) row rather than importing `PlanBlockWithSteps` from `db/database.ts`, keeping `backwardPlanCalc.ts` fully decoupled from SQLite per its own file-header comment.

**Daily Check-In / Daily Log (native shipped, web not ported):** Home surfaces a non-task, time-windowed Morning Check-In / Evening Debrief card (`DailyCheckInCard.tsx`) backed by a dedicated `dailyCheckIns` SQLite table and pure helpers in `src/utils/dailyCheckIn.ts`. Morning captures sleep, starting state, intention and selected priorities from explainable suggestions/freeform rows; Evening captures day shape, priority outcomes, friction/helped chips and reflection notes. Saving a check-in writes only `dailyCheckIns` — it never mutates task status/order/schedule, Potential, Domain scoring, Focus weights, habits, routines or achievements. History lives in `DailyLogScreen.tsx`, reachable from Home and Profile; today/yesterday are editable and older entries are read-only. `database.web.ts` has inert in-memory exports only so shared hooks remain bundle-safe; desktop web UI parity is still a separate future pass.

**Weather widget (shipped, Home screen):** Current conditions via WeatherKit, shown as a square card in Home's widget row (`WeatherWidget.tsx`, next to `MedicationQuickLogWidget`) — emoji + rounded temperature + condition label, tap to refresh. Architecturally simpler than the Maps integration: `functions/src/index.ts`'s `getWeather` Cloud Function is a **full proxy** (mints its WeatherKit JWT AND calls `weatherkit.apple.com` itself, then relays the JSON) rather than handing the client a token — there's only one call site, so a second token-caching layer on the client would've been pure overhead. WeatherKit's JWT shape differs from Maps': header needs an `id` claim (`{teamId}.{bundleId}`), payload needs `sub` (the bundle id, since WeatherKit was enabled directly on the App ID rather than a separate Services ID) — Maps' JWT has neither. `src/services/weather.ts` caches by ~1km-rounded coordinate for 20 min; `src/utils/weatherParsing.ts` has the pure parse/label/emoji functions (tested). Uses the same `getApproximateLocation()` (`deviceLocation.ts`) as the location-search bias — no separate permission prompt. Fails soft to rendering nothing (no placeholder/error card) on any failure, same principle as the rest of the Apple integrations. **Known gotcha:** WeatherKit can return `401 {"reason":"NOT_ENABLED"}` for up to a few hours after first enabling the WeatherKit capability on an App ID + generating its key, even though the portal shows it as saved immediately — not a bug, just Apple's backend activation lag. Shows a city name (`reverseGeocode` in `services/appleMaps.ts`, `/v1/reverseGeocode`, `structuredAddress.locality`, cached 1hr since a location name barely changes) alongside temperature/condition — fetched in parallel with the weather call, and fails independently (a reverse-geocode miss still shows temp/condition, just no city line). A later pass can use `conditionCode` to tint the Home hero background — not built yet, deliberately deferred.

**Map preview — deliberately deferred, action needed on the next dev-client rebuild:** Apple's Maps Server API has no static-map-image endpoint (confirmed against live docs — only geocode/search/directions/etas), so a real in-app map preview needs a native map component (`expo-maps`), which needs a new EAS dev-client build to even run — not achievable in the pure-JS/REST style everything else in this Plan Backwards work used. **The next time a dev-client rebuild is planned for any reason, add `expo-maps` to it** so Plan Backwards can get a real in-app map view instead of the current stopgap. Stopgap (shipped now, no rebuild needed): `src/utils/appleMapsLink.ts`'s `buildAppleMapsDirectionsUrl` deep-links out to the native Maps app via its documented URL scheme (`maps.apple.com/?saddr=...&daddr=...&dirflg=d|w|r`) — "Open in Maps" button in `AddPlanBlockSheet.tsx`'s Travel tab, and a long-press action on any travel block in `PlanBackwardsDetailScreen.tsx`.

**Default departure location (shipped):** `SettingsScreen.tsx` gained a "PLAN BACKWARDS" section — a "Default departure location" row opening `DefaultDepartureSheet.tsx` (Apple Maps-backed search, same `LocationSearchField`), backed by the already-existing `getDefaultDeparturePoint`/`setDefaultDeparturePoint` (`appSettings` key). `AddPlanBlockSheet.tsx`'s Travel "From" field still prefills from and re-saves to the same value, so setting it here or just typing a new one in Travel both keep it in sync.

**Known bug fixed:** `AddPlanBlockSheet.tsx`'s tab ScrollViews were missing `keyboardShouldPersistTaps="handled"` — the classic RN gotcha where the first tap on a location-search suggestion only dismisses the keyboard instead of selecting, requiring a second tap.

**Travel redesigned as a toggle, not a repeatable "Add" (shipped):** Travel is a single feature per plan (you travel once to the anchor event), not a repeatable block type like Routine/Task — `TravelToggleCard.tsx` lives directly in the anchor area of `PlanBackwardsDetailScreen.tsx` (a `Switch` + inline `LocationSearchField`×2/mode chips/Get-live-ETA/Open-in-Maps, all with debounced auto-save, no separate sheet). `AddPlanBlockSheet.tsx` now only has Routine/Task tabs. DB-side, `addPlanBlockTravel` was replaced with `upsertPlanBlockTravel(planId, title, config)` — finds the plan's existing travel block (if any) and updates it instead of always inserting, so toggling/editing never creates duplicates. **This fixed a real bug in the process:** the old `addPlanBlockTravel` only wrote `durationMinutes`/`bufferMinutes` inside the `travelConfig` JSON blob, never into the `planBlocks` row's own same-named columns — since `calculateBlockRequiredDuration`/`buildBackwardsSchedule` (in `backwardPlanCalc.ts`) only read those row columns (type-agnostically, same code path for every block type), every travel block silently contributed `0m` to Time Required regardless of its actual duration, while Leave By still looked correct because the detail screen computed that separately, straight from `travelConfig`. `upsertPlanBlockTravel` now writes both.

**Skills (shipped):** A capability layer distinct from Domains — "Domains = areas of life you maintain, Skills = capabilities you develop." `SkillsScreen.tsx`/`SkillDetailScreen.tsx` (reachable from Menu and from `AreaDetailScreen`'s Skills section). One primary Domain (`skillArea` relation) + optional secondary Domains (`metadata.secondaryAreaIds`); proficiency is a manual 0-100 rating via a 5-level tap stepper, never derived. Linked habits/routines/missions (`habitSkill`/`routineSkill`/`missionSkill`) are organizational only. The only path from a Skill to Domain scoring is a skill-linked milestone (`achievementSkill`, mutually exclusive with `achievementArea`) — writes capped `sourceType: 'skill'` `domainContributions` rows via `setSkillMilestoneContributesToScore`, smaller than the Mission/Achievement tiers so a skill milestone can't outweigh a genuine Mission/Achievement on the same Domain. `computeSkillPracticeSummary` is a read-only 30-day aggregation of linked habit/routine completions — not itself a scoring input.

**Progression visual identity:** The eight canonical Domains use the custom vector family in `src/components/icons/DomainIcons.tsx` through `src/utils/domainIcons.ts` on onboarding, Domains, Domain Detail and Harada/Potential surfaces. Overall Potential alone keeps the bonsai. All Missions use the same target identity because they are user-created projects at scale; per-Mission artwork/emoji is intentionally not shown in the Mission list. Skills use `SkillIdentityIcon.tsx` for title-aware identity marks and show the five human-readable proficiency stages rather than raw percentages in the Skill grid.

A Mission's own `area` relation always wins when set, but a Mission with no direct Domain and a `missionSkill` link inherits its Skill's primary Domain for scoring (`getEffectiveAreaForMission`, used by `completeMission`/`setMissionAchievementEligible`) — e.g. one Mission per app, all linked to an "App Development" Skill, scoring against that Skill's Domain without each Mission needing its own redundant Domain assignment. `ProjectsScreen.tsx` shows a "via `<Skill>`" badge in place of the Domain badge when a Mission has no direct Domain but is Skill-linked.

A skill also has a manual `metadata.unlocked` gate ("still learning" vs. unlocked), independent of proficiency — a skill-tree-style toggle you flip yourself via `setSkillUnlocked`/`isSkillUnlocked`, never derived from proficiency or activity. New skills start locked; `convertAreaToSkill`'s migrated skills start unlocked (they already have real history). A locked skill can freely have milestones, proficiency, and linked habits/routines/missions, but its milestones never write active `domainContributions` rows regardless of their own `contributesToScore` flag — `setSkillMilestoneContributesToScore` checks `isSkillUnlocked` before activating a row, and `setSkillUnlocked` re-syncs every already-contributing milestone's rows (activate on unlock, exclude on lock) via the shared `applySkillMilestoneContribution` helper. UI: `SkillDetailScreen.tsx`'s lock banner toggles the gate (locking asks for confirmation); `SkillsScreen.tsx`'s card grid shows a small lock glyph on locked skills.

**Progress indicators:** `RiverStoneProgress` (`src/components/ui/RiverStoneProgress.tsx`) is the standard *linear* progress bar app-wide — a recessed River Stone track, a restrained vermilion fill, a warm-brass highlight riding the fill's leading edge, optional trailing percentage/label text, optional `milestones` tick markers, full non-color accessibility (`accessibilityRole="progressbar"` + `accessibilityValue`), and a Reanimated transition that respects Reduce Motion (same pattern as `KatanaProgress`, built with `react-native-svg` + `useAnimatedProps` so the bar stretches to its container width via a `0-100`-unit viewBox rather than a fixed pixel size). `EnsoMeter` (`src/components/ui/EnsoMeter.tsx`) is the *ring* counterpart for hero-moment single readings (Overall Potential) — an ink-brush enso stroke (a deliberate small gap, never a full closed circle) with the same vermilion fill / brass leading-edge-highlight language, `size`-parameterized so it also works as `HaradaWheel`'s center node. `SteppingStones` (`src/components/ui/SteppingStones.tsx`) is the discrete-stage counterpart (one tile per Domain/stage, filled past a threshold) for counts rather than continuous percentages. Use `RiverStoneProgress`/`EnsoMeter`/`SteppingStones` for Overall Potential, Domain/Pillar scores, habits, and other measurable values; `KatanaProgress` (the sword-shaped bar) still exists but is no longer a default — reserve it for rare Journey milestones, major achievements, or completion celebrations where its symbolism is deliberate.

**Potential is unified across Profile and Potential:** `PotentialOverview` (`src/components/potential/PotentialOverview.tsx`) is the single source of truth for the actual Potential content — hero `HaradaWheel`/`EnsoMeter` card, Current Focus row, per-Domain `RiverStoneProgress` list, Achievements link (`showAchievementsLink` prop hides it). `PotentialScreen.tsx` renders it as the whole screen; `ProfileScreen.tsx` ("Me") renders the exact same component below its account header — "Me IS the Potential," not a separate hand-built summary, so the two screens can't visually drift apart. `HaradaWheel` (`src/components/potential/HaradaWheel.tsx`) itself uses `EnsoMeter` for its center Overall Potential node and shows each Domain's own icon (`getDomainIcon`) on its surrounding pillar nodes, not just a bare percentage.

**Medication "too soon" override (shipped):** `computeMedicationEligibility`'s `canTake` gate (`src/utils/medicationState.ts`) is a caution, not a hard block — both `MedicationsScreen.tsx`'s `TodayRow.handleTake` and `MedicationQuickLogWidget.tsx`'s `promptTake` call the shared `promptTooSoonOverride(minsLeft, onOverride)` (`src/utils/medicationOverride.ts`) when `!canTake`, which shows the real wait time and an "Override…" action that forces a typed reason via `Alert.prompt` (e.g. "advised by doctor", "exam tomorrow") before continuing — there is no silent-allow path. The reason flows through `takeMedication(id, takenAt?, startTimer?, overrideReason?)` (`useDb.ts`) into `logMedicationTaken`'s new `overrideReason` param (`database.ts`), stored as `details.overrideReason` on the `medication-taken` activity log row (undefined when the dose wasn't early). `LogDoseSheet.tsx`'s `LogEntry` renders a small orange "Taken early — `<reason>`" caption under any log that has one, so the override stays visible in dose history, not just at confirmation time.

**Medication focus timeline (shipped):** Opt-in per medication (e.g. for stimulants) — `MedicationMeta` gained `focusCurveEnabled` plus six range fields, `onsetMinHours`/`onsetMaxHours`/`peakMinHours`/`peakMaxHours`/`fadeEndMinHours`/`fadeEndMaxHours` (`database.ts`), since real onset/peak/wear-off varies dose to dose rather than landing on one fixed hour. Edited via a "Track focus timeline" toggle + three min–max hour range rows in `MedicationsScreen.tsx`'s `MedFormSheet` (validated: each min <= max, and the three ranges' midpoints ordered onset <= peak <= fadeEnd). `src/utils/focusCurve.ts`'s pure `computeFocusState(item, meta, lastLog)` derives a `building`/`peak`/`fading` phase from wall-clock time elapsed since the last dose using the range midpoints for the phase transition, returning `null` once elapsed passes the *latest* fade-end estimate (`fadeEndMaxHours`) or the feature isn't enabled/fully configured. `MedicationsScreen.tsx` renders one `FocusTimelineCard` (`src/components/FocusTimelineCard.tsx`) per medication with an active state, above "Needs Attention" — an SVG onset/peak/fade hill with shaded uncertainty bands over the peak and fade-off windows, a live "now" dot, and a plain-language range summary ("Building — peak between 8:30pm and 9:30pm"), self-refreshing every 60s since the state depends only on the clock, not new writes.

**Future routines and quantified habits:** Product direction from the supplied research screenshots is recorded in `../../docs/design/routines-and-habits-product-brief.md`. It is not implemented yet; Apple Health is explicitly deferred from the first implementation.

**Header artwork (shipped):** `assets/icons/header-v2/` contains the transparent 512px Settings, light/dark theme and empty/active/full Inbox soft-object icons, wired into `AppHeader.tsx`. `SettingsMedallionIcon.tsx` renders `settings.png`; `header/ThemeToggleIcon.tsx` stacks `theme-light.png`/`theme-dark.png` and crossfades between them via Reanimated opacity on toggle (collapses to an immediate swap under Reduce Motion, `useReducedMotion`); the inbox button's `inboxIllustration()` picks `inbox-empty.png`/`inbox-active.png`/`inbox-full.png` by the same 0 / 1–10 / >10 thresholds as before. All buttons are 44×44pt touch targets with ~34pt artwork, `resizeMode="contain"`, no tinting. `InboxScrollCard.tsx` on Home's Today view still uses the older `assets/illustrations/inbox/` set — not part of this pack. Never load the green generation sheet under `header-v2/source/` at runtime.

**Logo refinement references:** `assets/branding/logo-reference-crops/` contains the approved A3/F2/F3/F4 negative-space directions. Follow the adjacent README: the dark `RKA` void must be generated by exactly eight light surrounding blocks, not rendered as foreground lettering.

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
| `ProfileScreen.tsx` | RN primitives (StyleSheet) | Account header + shared `PotentialOverview` (see below) |
| `PotentialScreen.tsx` | RN primitives (StyleSheet) | Shared `PotentialOverview` (see below) |
| `AchievementsScreen.tsx` | RN primitives (StyleSheet) | Permanent trophy case; manual/retrospective add flow (long-press a row to toggle contributes-to-score or delete) |
| `FocusScreen.tsx` | RN primitives (StyleSheet) | Current Focus label + per-Domain weight overrides |
| `OnboardingScreen.tsx` | RN primitives (StyleSheet) | First-launch guided setup: Domains -> per-Domain Mission/Potential Stat -> Focus; gated in `App.tsx` on `getItemsByType('area').length === 0` at boot. Per-Domain Mission/Stat/Focus steps stay skippable, but the 8-Domain baseline itself is not — every path (including "Skip setup" on the intro screen) creates all 8 `CANONICAL_DOMAIN_TITLES` (`database.ts`), tagged `metadata.canonical: true`. Canonical Domains can be renamed (`AreasScreen.tsx`'s Edit) but never deleted or converted to a Skill — both `AreasScreen`'s long-press menu and `deleteItem` itself refuse when `metadata.canonical === true`, so the guarantee holds even from other code paths (e.g. `convertAreaToSkill`). Only user-added Domains beyond the 8 are removable. A boot-time migration in `initSchema` retroactively tags any pre-existing Domain whose title exactly matches `CANONICAL_DOMAIN_TITLES` for devices that onboarded before this flag existed — a renamed pre-existing Domain won't be caught by that backfill. A device with duplicate-titled Domains (e.g. several onboarding runs during dev testing) could get more than one row tagged canonical for the same title; a corrective pass runs every boot to keep only the one with the most linked Missions (tie-broken by earliest `createdAt`) canonical and unmark the rest, so duplicates become ordinary, cleanable Domains again. A further boot-time pass creates any of the 8 canonical titles missing entirely (e.g. one deleted before the flag existed). See `mergeAreaIntoArea` below and `AreasScreen.tsx`'s "Merge into..." action, which re-homes a Domain's Missions/Stats/Achievements/Skill links onto another Domain and deletes it (the one deliberate exception to canonical Domains being undeletable, since the target absorbs the identity) — `initSchema` also runs this automatically, once, for two specific duplicate pairs confirmed directly with the user during dev cleanup ("Mind" → "Growth", "Craft" → "Creativity"; see `KNOWN_DUPLICATE_MERGES`), so the final canonical 8 are: Health & Wellbeing, Career, Finance, Relationships, Creativity, Growth, Discipline, Fitness & Performance. |
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

`@rive-app/react-native` and `react-native-nitro-modules` power the Ronin journey renderer. The currently *shipping* runtime export is `assets/rka_journey_rig.riv`, loaded by `RoninJourneyRiveWalker.tsx`; the surrounding Reanimated wrapper supplies whole-character motion, completion travel and a tap hop, retaining those cues on Reduce Motion devices. Rive contains native code, so regenerate/install the development build after native dependency or asset changes; Expo Go cannot run it.

**The active rig work is `RONIN RIG 1` in the Rive desktop app — see [`RONIN_RIVE.md`](RONIN_RIVE.md), which is the single source of truth.** It covers the scene graph, skeleton, IK, ViewModel contract, animations, state machine and interaction model. Everything that preceded it (the `2478489` cloud rig, the storybook manifest and its `Journey`/`Journey Controller` contract, the v1–v4 art specs, the painterly-PNG and parts-brief plans) has been **deleted, and must not be revived or reconstructed**. `RONIN RIG 1` has not yet been exported over `rka_journey_rig.riv`, so the shipping runtime above is unchanged for now.

Approved character reference art remains under `assets/ronin/reference/` and `assets/ronin/model/` for visual direction only — it no longer implies any rigging plan.

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
