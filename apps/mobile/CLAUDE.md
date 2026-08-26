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
- **Theme:** `theme/webTheme.ts` (`webColors`/`webSpacing`/`webRadius`/`webFontSize`/`webDepth`/`webSunset`), not the native `theme/` tokens — but **deliberately aligned to the native River Stone palette** as of 2026-08-12 (dark sumi shell, vermilion brand accent not amber, warm River-Stone neutral surfaces). Values are CSS custom properties (`--rka-*`), so re-theming every screen is one edit to `WEB_THEME_CSS`. `webDepth.list`/`webDepth.card` are `boxShadow` recipes mirroring the native River Stone list/card shadow variants — apply to list rows/cards (`...webDepth.list`) and drop the old 1px border. `webSunset` is the Home-hero-only warm gradient halo (future Rive scene stage). See `../../docs/design-system/reference/tokens.md` "Desktop web app tokens".
- **Icons:** the sidebar (`Sidebar.web.tsx`) uses the **same destination artwork as iOS** via `src/webApp/navArtwork.web.tsx` (torii/inbox/note/sundial/bonsai/kettlebell/prayer-beads/furoshiki/treasure-chest/pill-bottle/portfolio/gear — colourful 3D, never tinted; active state = row highlight + bold label). `lucide-react-native` is still used for small utility glyphs (e.g. `Plus`, checkmarks) but no longer for top-level destinations.
- **Navigation model:** a `Sidebar.web.tsx` of top-level views, each rendering a single screen (list + capture row) with a right-side sliding `DetailPanel.web.tsx` for viewing/editing one item — not mobile's `react-navigation` screen stack. `ItemDetailForm.web.tsx` is the shared detail-panel body; per-domain forms (`DomainMissionDetailForm`, `HabitDetailPanel`, `MedicationEditForm`, `ExerciseDetailPanel`, `ObjectDetailForm`, `WorkoutTemplateDetailPanel`, `BlockEditForm`, `ExercisePickerModal`) plug into it.

**Parity principle (default expectation):** web and native should offer **essentially the same functionality**. Some *variation* is fine and expected (navigation model, layout density, platform-only affordances like haptics/swipe), but a **feature** on one target simply missing on the other is a **tracked gap to close**, not an accepted state — unless a divergence was explicitly agreed. **`WEB_PARITY.md` is the living source of truth for this** — read it before assuming a feature exists on web, and **update it in the same pass** whenever you add/remove/alter a feature on either target (mark ✅/🟡/❌ and adjust notes). This is part of the multi-agent documentation rule alongside `CLAUDE.md`/`AGENTS.md`/`HANDOVER_SUMMARY.md`.

**Sidebar navigation is intentionally leaner than the raw screen list** — Workout Trends, Focus, Plan Backwards, Upcoming, Routines, and Archive are not top-level sidebar destinations; they're folded into Workouts (a "Trends" tab), Potential (an inline expandable Focus editor), Calendar (a "Plan Backwards" segment alongside Timeline/Agenda, plus an "Upcoming" segment), Habits (a "Routines" tab), and Tasks (an "Archive" segment alongside Tasks/Logbook) respectively, since none of them are standalone concepts on native either. **As of the 2026-08-12 parity passes, native mirrors all of these** (the "More" grid dropped Focus/Potential/Plan Backwards/Upcoming/Skills/Achievements/Routines/Archive; the equivalents live on the Me tab, in Calendar's view-chip row, in the Habits header link, and in the Tasks segments) — see `WEB_PARITY.md`'s cross-target navigation notes. "Me" and "Potential" are consolidated into a single sidebar entry labeled **"Me"** (`ProfileScreen.web.tsx`, account header + shared `PotentialOverview`) since native treats them as the same content ("Me IS the Potential"). Achievements and Skills are folded into that same Me page as two expandable sections (`ExpandableSection` wrapper embedding the unchanged `AchievementsScreen.web.tsx`/`SkillsScreen.web.tsx`) rather than their own sidebar entries. See `WEB_PARITY.md`'s "Web-only sidebar consolidation" notes for the full mapping before assuming any of these still has its own sidebar entry or `AppShell.web.tsx` route.

**Screen parity (summary as of 2026-08-12 — full detail + within-screen gaps in [`WEB_PARITY.md`](WEB_PARITY.md)):** every native top-level destination now has a `.web.tsx` counterpart, including the progression/planning layer (Potential, Profile/"Me", Achievements, Focus, Skills, Routines, Plan Backwards, Workout Trends, Daily Check-In/Daily Log). Tasks/Inbox/Calendar/Settings/Home/Habits/Domain-detail have all had their remaining UI-level gaps closed too (Tasks: full grouping/sort/reorder/badges; Inbox: capture+triage menu; Calendar: 15-min snapping/agenda/plan-your-day; Settings: notifications/dev-tools; Home: widget row + progression strip; Habits: quantified count/duration plus Potential Stat assignment; Domain detail: Skills/Stats/Achievements/score sections plus create/unlink Potential Stats). Web Potential now uses the native maintenance-baseline concept (linked Potential Stats averaged from assigned habit streaks) for Domain/Overall scores, but still omits the separate `domainContributions` achievement/mission/skill decay lift. Remaining real gaps: Workouts still lacks live session logging (needs new session-state persistence, not just UI); Skills/Achievements' "contributes to score" toggles and Routines' session player are simplified/stubbed on web since the decay/contribution engine is not mirrored yet (see `WEB_PARITY.md` §4); Daily Check-In is `localStorage`-only, not cross-device synced; Medications lacks focus-timeline/override/streak/reminders; Settings lacks the Plan Backwards default-departure row (backend ready, UI not wired). When adding a new native screen/feature, it does not automatically appear on web — porting it is separate, deliberate work (and should be tracked toward parity, per above). **Important:** `database.web.ts` is a separate Firestore-backed reimplementation of `database.ts`, not a thin SQLite shim — a web screen that imports a `database.ts` function with no matching export in `database.web.ts` will crash the *entire* web app (no error boundary in `AppShell.web.tsx`) the first time that function is called. Always verify a new export exists in `database.web.ts` and smoke-test in a live browser before considering a port done.

`tsc --noEmit` reports `Cannot find module './DetailPanel'`-style errors on files under `src/webApp/`— this is a **false alarm**: `tsc`'s default resolution doesn't understand Expo/Metro's `.web.tsx` platform-extension convention the way the Metro bundler does at build/run time. Don't treat these as real breakage without also checking the file actually exists on disk.

**Quantified habits (shipped):** Binary habits keep their original tap-to-complete flow unchanged. Count/duration habits store a `HabitMeta` blob in `item.metadata` (see `src/utils/habitMeta.ts`) and log manual samples as `'habit-sample'` `activityLogs` rows (`src/db/database.ts`'s `logHabitSample`/`getHabitSamples`/`undoLastHabitSample`); period progress is always recomputed from those events, never a stored counter. UI: `HabitsScreen.tsx` branches the fast-completion control on measurement type (mark-done/add-one/`HabitQuantifiedSheet.tsx` value entry); `HabitDetailScreen.tsx` exposes measurement/target/period settings behind a collapsed "Measurement" disclosure.

**Routines (shipped):** A separate `routine`/`routine-step`/`routine-session` item domain (never Missions — no Harada/Potential semantics). `RoutinesScreen.tsx`/`RoutineTemplateDetailScreen.tsx` follow the Habits/Workouts list-and-detail pattern; step ordering reuses the existing manual-order table via `useHapticReorder`, same mechanism as `WorkoutTemplateDetailScreen`'s blocks. `RoutineSessionScreen.tsx` creates (or resumes) its session synchronously on mount so it's durable in SQLite independent of component lifecycle; remaining step time is always derived from persisted timestamps (`src/utils/routineMeta.ts`'s `computeStepRemainingSeconds`), never a local counter, so backgrounding/relaunch is correct automatically. `RoutineResumeBanner.tsx` (mounted in `App.tsx`) surfaces a tap-to-resume capsule for any active session on app start. Routine sessions never write to `domainContributions` or touch `potentialStat` — only a linked habit's own maintenance math may affect Potential. `RoutinesIntroOverlay.tsx` is a 3-step full-screen walkthrough (mirrors `OnboardingScreen.tsx`'s step/eyebrow/title/body/footer structure, informational only — no data collection) shown once on first visit to `RoutinesScreen`, gated by the `hasSeenRoutinesIntro`/`markRoutinesIntroSeen` `appSettings` flag; ends with a CTA into the existing New Routine sheet. Play is hidden on a routine with no steps, and both `RoutineSessionScreen`'s header X and `RoutineResumeBanner`'s dismiss action call `cancelRoutineSession` to abandon a session without completing it — fixes a bug where a zero-step routine's session could get permanently stuck 'active' with a blank player and no way to clear it. See `docs/superpowers/plans/2026-08-05-routines-quantified-habits.md` for the full plan.

**Plan Backwards (shipped, v1):** A standalone deadline/anchor-based planning workspace — deliberately NOT folded into Today yet (see `Menu` → "Plan Backwards" → `PlanBackwardsScreen.tsx` list → `PlanBackwardsDetailScreen.tsx` workspace). A plan is a `backward-plan` item (metadata = `BackwardPlanMeta`: `goalTime` required, `startTime`/`expectedTime`/`latestTime`/`endTime`/`location`/`deviceCalendarEventId` all optional — see `src/utils/backwardPlanMeta.ts`); its ordered Routine/Task/Travel components live in dedicated `planBlocks`/`planBlockSteps` tables (not `items` rows), since placement/buffer/completion are plan-instance-specific and must never leak into a reusable routine template. Adding an existing Routine to a plan **copies** its current steps into `planBlockSteps` (`addPlanBlockRoutine`) — a snapshot, not a live link, so completing a step today never mutates the template and editing the template later never retroactively changes an already-instantiated plan. The three live metrics (Time Remaining / Time Required / Unallocated) and backwards ordering (`keep-near-event` closest to Goal Time, then `auto`, then `anytime-before` furthest back) are pure functions in `src/utils/backwardPlanCalc.ts` (`calculateTimeRemaining`, `calculateRoutineRemainingDuration`, `calculatePlanRequiredDuration`, `calculateUnallocatedTime`, `calculateLeaveBy`, `buildBackwardsSchedule` — see its test file for the completed-step-exclusion behavior), consumed by `useBackwardPlan` (`useDb.ts`, minute-granularity tick). A completed block/step contributes nothing to Time Required but stays visible (struck through), never deleted. Buffers reserve timeline time but are never shown as a fake completable task. **Live Apple Maps routing (shipped):** Travel blocks can fetch a real ETA via Apple's Maps Server API (`https://developer.apple.com/documentation/applemapsserverapi`) — `AddPlanBlockSheet.tsx`'s Travel tab has a "Get live ETA from Apple Maps" button that geocodes the start/destination addresses and fetches drive/walk/transit time between them, filling the duration field and tagging the block `source: 'live'` (shown as "· Live · X km" in the plan). Editing any travel input afterward silently drops back to `'manual'` — a live estimate is never claimed once the inputs it was based on have changed. The private signing key for Apple's Maps Server API **never ships in the app** — `functions/src/index.ts`'s `getAppleMapsToken` Cloud Function signs the ES256 JWT server-side (from `APPLE_MAPS_TEAM_ID`/`APPLE_MAPS_KEY_ID`/`APPLE_MAPS_PRIVATE_KEY` Cloud Functions secrets) and exchanges it for a short-lived (~30 min) access token, which is all the client (`src/services/appleMaps.ts`) ever holds, cached in memory. Every call fails soft to the manual-duration fallback (no network/no token/unresolvable address never blocks the feature — spec section 28). Response parsing is pure/tested in `src/utils/appleMapsParsing.ts`. **Requires one-time setup the app can't do on its own** — see `HANDOVER_SUMMARY.md`'s 2026-08-08 entry for the exact Apple Developer + `firebase functions:secrets:set` + `firebase deploy --only functions` steps; until that's done, `getAppleMapsToken` fails and the button silently falls back to manual entry, exactly as if it were never wired up. The `TravelConfig` shape (`mode`/`durationMinutes`/`bufferMinutes`/`startLocation`/`destination`/`source`/`distanceMeters`/`estimatedAt`) keeps manual entry a first-class value, not just a fallback placeholder. **Location search-as-you-type** (`LocationSearchField.tsx`, backed by `searchLocations`/`/v1/searchAutocomplete`) replaces plain text entry for the anchor event's Location field and Travel's From/To fields — a debounced (300ms, 3+ chars) dropdown of real places, each carrying its own coordinate so picking one skips a follow-up geocode call; typing without picking a suggestion still works as free text, same fail-soft principle as the rest of this integration. Results are ranked by proximity to the device's current location (`src/services/deviceLocation.ts`'s `getApproximateLocation`, fetched lazily on first focus so there's no permission prompt until the field is actually used, cached 5 min module-wide) via Apple's `userLocation`/`searchLocation` params — matches how the native Maps app ranks "X mi away" results; search still works with no bias (just unranked by distance) if location permission is denied. **Gotcha discovered live, not from Apple's docs:** `/v1/searchAutocomplete`'s `location` field is actually `{latitude, longitude}` at runtime, not the `{lat, lng}` Apple's own documentation describes — `parseSearchAutocompleteResponse` reads both shapes defensively. **Per-result ETA badges:** `LocationSearchField`'s optional `etaOrigin`/`etaMode` props (wired for Travel's "To" field once "From" has a resolved coordinate — captured for free via `onSelectPlace` when the user picks a "From" suggestion, no extra geocode call) trigger one batched `/v1/etas` call (`getEtasBatch`, up to 10 destinations per Apple's cap) covering the whole visible dropdown, rather than one request per row — each row then shows its own duration badge, same UX as native Maps search. Cleared whenever "From" is edited by hand, so a badge is never left showing a stale origin's numbers. Calendar linking (separately) is read-only (`src/services/deviceCalendar.ts`'s existing today-only fetch) — RKA never writes back to the device calendar. Not yet ported to desktop web.

**Plan Backwards countdown widget (shipped, Home screen):** Third square card in Home's widget row (`PlanBackwardsCountdownWidget.tsx`, next to Medication/Weather — the row's own comment had already anticipated a third slot). Shows the soonest upcoming plan's live Time Remaining, and either its title or "`X` short" in red once Unallocated goes negative — same at-a-glance urgency signal as the detail screen's over-capacity warning, just condensed. Tap opens that plan. Renders nothing when no plan has a future Goal Time. `dateTimeFromParts` and `planBlockRowToCalc` (both now exported from `backwardPlanCalc.ts`, tested) were extracted out of `PlanBackwardsDetailScreen.tsx` so this widget and the detail screen share one definition of "what Goal Time means as a Date" and "how a DB block row becomes calc input" — `planBlockRowToCalc` takes a structurally-typed (duck-typed) row rather than importing `PlanBlockWithSteps` from `db/database.ts`, keeping `backwardPlanCalc.ts` fully decoupled from SQLite per its own file-header comment.

**Daily Check-In / Daily Log (shipped on native and web):** Home surfaces a non-task, time-windowed Morning Check-In / Evening Debrief card (`DailyCheckInCard.tsx`) backed by a dedicated `dailyCheckIns` SQLite table and pure helpers in `src/utils/dailyCheckIn.ts`. Morning captures sleep, starting state, intention and selected priorities from explainable suggestions/freeform rows; Evening captures day shape, priority outcomes, friction/helped chips and reflection notes. Saving a check-in writes only `dailyCheckIns` — it never mutates task status/order/schedule, Potential, Domain scoring, Focus weights, habits, routines or achievements. History lives in `DailyLogScreen.tsx`, reachable from Home and Profile; today/yesterday are editable and older entries are read-only. Web port: `DailyLogScreen.web.tsx` + `DailyCheckInForm.web.tsx` mirror the native fields; `database.web.ts`'s `dailyCheckIn` functions persist to `localStorage` (per-browser, not yet Firestore-synced across devices — see `WEB_PARITY.md` §4/§5).

**Weather widget (shipped, Home screen):** Current conditions via WeatherKit, shown as a square card in Home's widget row (`WeatherWidget.tsx`, next to `MedicationQuickLogWidget`) — emoji + rounded temperature + condition label, tap to refresh. Architecturally simpler than the Maps integration: `functions/src/index.ts`'s `getWeather` Cloud Function is a **full proxy** (mints its WeatherKit JWT AND calls `weatherkit.apple.com` itself, then relays the JSON) rather than handing the client a token — there's only one call site, so a second token-caching layer on the client would've been pure overhead. WeatherKit's JWT shape differs from Maps': header needs an `id` claim (`{teamId}.{bundleId}`), payload needs `sub` (the bundle id, since WeatherKit was enabled directly on the App ID rather than a separate Services ID) — Maps' JWT has neither. `src/services/weather.ts` caches by ~1km-rounded coordinate for 20 min; `src/utils/weatherParsing.ts` has the pure parse/label/emoji functions (tested). Uses the same `getApproximateLocation()` (`deviceLocation.ts`) as the location-search bias — no separate permission prompt. Fails soft to rendering nothing (no placeholder/error card) on any failure, same principle as the rest of the Apple integrations. **Known gotcha:** WeatherKit can return `401 {"reason":"NOT_ENABLED"}` for up to a few hours after first enabling the WeatherKit capability on an App ID + generating its key, even though the portal shows it as saved immediately — not a bug, just Apple's backend activation lag. Shows a city name (`reverseGeocode` in `services/appleMaps.ts`, `/v1/reverseGeocode`, `structuredAddress.locality`, cached 1hr since a location name barely changes) alongside temperature/condition — fetched in parallel with the weather call, and fails independently (a reverse-geocode miss still shows temp/condition, just no city line). A later pass can use `conditionCode` to tint the Home hero background — not built yet, deliberately deferred.

**Map preview — deliberately deferred, action needed on the next dev-client rebuild:** Apple's Maps Server API has no static-map-image endpoint (confirmed against live docs — only geocode/search/directions/etas), so a real in-app map preview needs a native map component (`expo-maps`), which needs a new EAS dev-client build to even run — not achievable in the pure-JS/REST style everything else in this Plan Backwards work used. **The next time a dev-client rebuild is planned for any reason, add `expo-maps` to it** so Plan Backwards can get a real in-app map view instead of the current stopgap. Stopgap (shipped now, no rebuild needed): `src/utils/appleMapsLink.ts`'s `buildAppleMapsDirectionsUrl` deep-links out to the native Maps app via its documented URL scheme (`maps.apple.com/?saddr=...&daddr=...&dirflg=d|w|r`) — "Open in Maps" button in `AddPlanBlockSheet.tsx`'s Travel tab, and a long-press action on any travel block in `PlanBackwardsDetailScreen.tsx`.

**Default departure location (shipped):** `SettingsScreen.tsx` gained a "PLAN BACKWARDS" section — a "Default departure location" row opening `DefaultDepartureSheet.tsx` (Apple Maps-backed search, same `LocationSearchField`), backed by the already-existing `getDefaultDeparturePoint`/`setDefaultDeparturePoint` (`appSettings` key). `AddPlanBlockSheet.tsx`'s Travel "From" field still prefills from and re-saves to the same value, so setting it here or just typing a new one in Travel both keep it in sync.

**Known bug fixed:** `AddPlanBlockSheet.tsx`'s tab ScrollViews were missing `keyboardShouldPersistTaps="handled"` — the classic RN gotcha where the first tap on a location-search suggestion only dismisses the keyboard instead of selecting, requiring a second tap.

**Travel redesigned as a toggle, not a repeatable "Add" (shipped):** Travel is a single feature per plan (you travel once to the anchor event), not a repeatable block type like Routine/Task — `TravelToggleCard.tsx` lives directly in the anchor area of `PlanBackwardsDetailScreen.tsx` (a `Switch` + inline `LocationSearchField`×2/mode chips/Get-live-ETA/Open-in-Maps, all with debounced auto-save, no separate sheet). `AddPlanBlockSheet.tsx` now only has Routine/Task tabs. DB-side, `addPlanBlockTravel` was replaced with `upsertPlanBlockTravel(planId, title, config)` — finds the plan's existing travel block (if any) and updates it instead of always inserting, so toggling/editing never creates duplicates. **This fixed a real bug in the process:** the old `addPlanBlockTravel` only wrote `durationMinutes`/`bufferMinutes` inside the `travelConfig` JSON blob, never into the `planBlocks` row's own same-named columns — since `calculateBlockRequiredDuration`/`buildBackwardsSchedule` (in `backwardPlanCalc.ts`) only read those row columns (type-agnostically, same code path for every block type), every travel block silently contributed `0m` to Time Required regardless of its actual duration, while Leave By still looked correct because the detail screen computed that separately, straight from `travelConfig`. `upsertPlanBlockTravel` now writes both.

**Skills (shipped, but the 0-100 proficiency model is now legacy — 2026-08-14):** A capability layer distinct from Domains — "Domains = areas of life you maintain, Skills = capabilities you develop." `SkillsScreen.tsx`/`SkillDetailScreen.tsx` (reachable from Menu and from `AreaDetailScreen`'s Skills section). One primary Domain (`skillArea` relation) + optional secondary Domains (`metadata.secondaryAreaIds`); proficiency is a manual 0-100 rating via a 5-level tap stepper, never derived. Linked habits/routines/missions (`habitSkill`/`routineSkill`/`missionSkill`) are organizational only. The only path from a Skill to Domain scoring is a skill-linked milestone (`achievementSkill`, mutually exclusive with `achievementArea`) — writes capped `sourceType: 'skill'` `domainContributions` rows via `setSkillMilestoneContributesToScore`, smaller than the Mission/Achievement tiers so a skill milestone can't outweigh a genuine Mission/Achievement on the same Domain. `computeSkillPracticeSummary` is a read-only 30-day aggregation of linked habit/routine completions — not itself a scoring input. **Direction confirmed 2026-08-14: the future model is a skill-tree (branch/node, locked/available/mastered), not a universal percentage** — not built this pass, do not design new work around `metadata.proficiency` being permanent. A locked Skill still gates its own milestone's Domain credit exactly as today, but critically does **not** gate a Practice Action's separate Potential Attribute evidence (see below) — the physical activity counts toward Strength/Stamina regardless of the Skill's lock state.

**Progression visual identity:** The six canonical Domains (was eight through 2026-08-13 — see "Domains are now six" below) use the custom transparent PNG family in `src/components/icons/DomainIcons.tsx` through `src/utils/domainIcons.ts` on onboarding, Domains, Domain Detail and Harada/Potential surfaces. Runtime art lives in `assets/icons/domains/`; Overall Potential alone keeps the bonsai/custom fallback. The Discipline/Growth icon assets (`DisciplineDomainIcon`, `GrowthDomainIcon`) are now unused dead code — left in place, not deleted, in case Discipline resurfaces later as a Potential Attribute. All Missions use the same generated mountain destination identity through `ProjectPortfolioIcon`/`ProjectPlaceholderIcon` because they are user-created projects at scale; per-Mission artwork/emoji is intentionally not shown in the Mission list. Skills use `SkillIdentityIcon.tsx` for title-aware identity marks and show the five human-readable proficiency stages rather than raw percentages in the Skill grid — though see "Skills are legacy" below, this percentage model itself is now legacy too.

A Mission's own `area` relation always wins when set, but a Mission with no direct Domain and a `missionSkill` link inherits its Skill's primary Domain for scoring (`getEffectiveAreaForMission`, used by `completeMission`/`setMissionAchievementEligible`) — e.g. one Mission per app, all linked to an "App Development" Skill, scoring against that Skill's Domain without each Mission needing its own redundant Domain assignment. `ProjectsScreen.tsx` shows a "via `<Skill>`" badge in place of the Domain badge when a Mission has no direct Domain but is Skill-linked.

A skill also has a manual `metadata.unlocked` gate ("still learning" vs. unlocked), independent of proficiency — a skill-tree-style toggle you flip yourself via `setSkillUnlocked`/`isSkillUnlocked`, never derived from proficiency or activity. New skills start locked; `convertAreaToSkill`'s migrated skills start unlocked (they already have real history). A locked skill can freely have milestones, proficiency, and linked habits/routines/missions, but its milestones never write active `domainContributions` rows regardless of their own `contributesToScore` flag — `setSkillMilestoneContributesToScore` checks `isSkillUnlocked` before activating a row, and `setSkillUnlocked` re-syncs every already-contributing milestone's rows (activate on unlock, exclude on lock) via the shared `applySkillMilestoneContribution` helper. UI: `SkillDetailScreen.tsx`'s lock banner toggles the gate (locking asks for confirmation); `SkillsScreen.tsx`'s card grid shows a small lock glyph on locked skills.

**Progress indicators:** `RiverStoneProgress` (`src/components/ui/RiverStoneProgress.tsx`) is the standard *linear* progress bar app-wide — a recessed River Stone track, a restrained vermilion fill, a warm-brass highlight riding the fill's leading edge, optional trailing percentage/label text, optional `milestones` tick markers, full non-color accessibility (`accessibilityRole="progressbar"` + `accessibilityValue`), and a Reanimated transition that respects Reduce Motion (same pattern as `KatanaProgress`, built with `react-native-svg` + `useAnimatedProps` so the bar stretches to its container width via a `0-100`-unit viewBox rather than a fixed pixel size). `EnsoMeter` (`src/components/ui/EnsoMeter.tsx`) is the *ring* counterpart for hero-moment single readings (Overall Potential) — an ink-brush enso stroke (a deliberate small gap, never a full closed circle) with the same vermilion fill / brass leading-edge-highlight language, `size`-parameterized so it also works as `HaradaWheel`'s center node. `SteppingStones` (`src/components/ui/SteppingStones.tsx`) is the discrete-stage counterpart (one tile per Domain/stage, filled past a threshold) for counts rather than continuous percentages. Use `RiverStoneProgress`/`EnsoMeter`/`SteppingStones` for Overall Potential, Domain/Pillar scores, habits, and other measurable values; `KatanaProgress` (the sword-shaped bar) still exists but is no longer a default — reserve it for rare Journey milestones, major achievements, or completion celebrations where its symbolism is deliberate.

**Potential is unified across Profile and Potential:** `PotentialOverview` (`src/components/potential/PotentialOverview.tsx`) is the single source of truth for the actual Potential content — hero `HaradaWheel`/`EnsoMeter` card, Current Focus row, per-Domain `RiverStoneProgress` list, Achievements link (`showAchievementsLink` prop hides it). `PotentialScreen.tsx` renders it as the whole screen; `ProfileScreen.tsx` ("Me") renders the exact same component below its account header — "Me IS the Potential," not a separate hand-built summary, so the two screens can't visually drift apart. `HaradaWheel` (`src/components/potential/HaradaWheel.tsx`) itself uses `EnsoMeter` for its center Overall Potential node and shows each Domain's own icon (`getDomainIcon`) on its surrounding pillar nodes, not just a bare percentage.

**Pillars (`potential-stat`) — now LEGACY, superseded by Potential Attributes (2026-08-14):** User-facing copy says **Pillar/Pillars**; the internal item `type` is `'potential-stat'`. Pillars are the *old* habit-streak-average developmental-stat model — see "Potential Attributes" below for the model actively being built now. **Do not build new features on Pillars.** They still work exactly as before (nothing was removed) and Domain maintenance (`domainMaintenance` in `src/utils/domainScoring.ts`, `NO_PILLAR_MAINTENANCE_BASELINE` neutral floor when a Domain has none) still reads from them — kept running for compatibility, not as the future design. An inspection of the live account on 2026-08-14 found all 4 seeded Pillars (Physique/Skin/Oral Hygiene/Vitality, from the legacy `migratePotentialStats` seed) unlinked to any Domain with zero Habits assigned — nothing real to migrate onto Attributes, so no migration ran; a fresh/different account may differ. `PillarsScreen.tsx`/`PillarsScreen.web.tsx` (native "More" grid / web sidebar) is expected to be retired once the Attribute scoring formula lands, not extended further.

**Persistence model — three primitives, not one (read before writing any generic status/count query):** Everything in the app is one of three shapes, and conflating them is a real bug class (see `src/utils/itemLifecycle.ts` and the 2026-08-13 fix where Home's "Upcoming" count used a type-agnostic query and silently summed all 19 item types instead of just Tasks).
1. **Structural items** — durable reference nouns, created rarely, edited/referenced over a long lifetime, rarely deleted: Domains, Missions, Skills, Pillars, Achievements, Focus, Plan Backwards workspaces, and every *definition* (Habit/Medication/Routine/Workout templates, a routine's steps, a workout's blocks, the exercise catalog). `ITEM_LIFECYCLE`/`isStructuralType` in `itemLifecycle.ts` classify these.
2. **Transactional items** — created and discarded frequently, carry a short status lifecycle: Tasks, To Get objects, and one-off session rows (`workout-session`, `routine-session`). `isTransactionalType` in the same file. A Task is one of these — its own `items` row, its own `status`, shown in the Actions feed only once completed (derived, not itself logged).
3. **Logged events** (`activityLogs`) — never their own item row: habit check-ins, medication doses, routine-step completions, and generic **Actions** (`actionType: 'action'`, see below) including skill-practice sessions. These are pure history — recorded once, rarely edited, never re-queried by status the way items are.
Any helper that queries/counts by `status` alone (no `type` filter) is a landmine — it silently spans structural and transactional items together. Before adding one, check whether `ITEM_LIFECYCLE`/`STRUCTURAL_ITEM_TYPES`/`TRANSACTIONAL_ITEM_TYPES` should scope it instead (exception: `ArchiveScreen`'s `useArchivedItems` is deliberately cross-type — Domains/Missions/etc. can be archived too, not just Tasks — so it's correct as type-agnostic; that's a real design choice, not an oversight).

**Actions model (shipped):** An Action is a lightweight `activityLogs` row (`actionType: 'action'`), not a new item type — `logAction`/`getActions`/`updateAction`/`deleteAction` in both `database.ts` and `database.web.ts`, typed via `src/utils/actions.ts` (`ActionDetails`: title/kind `'practice'|'general'`/durationMinutes/intensity/why/optional Domain-Pillar-Skill-Mission links). This is the first place skill practice with duration/intensity/"why" is recordable — `computeSkillPracticeSummary` still only *derives* activity read-only from linked habit/routine completions, unrelated to this. `getActionFeed` (both DB files, built on the pure `buildActionFeed` in `utils/actions.ts`) is a unified read-only feed merging logged Actions with habit check-ins/task completions/medication doses/routine steps, newest-first. Domain/Pillar/Skill/Mission tags remain purely contextual, never scoring inputs. **As of 2026-08-14, this is no longer true of Attribute tags specifically** — see "Potential Attributes" below: an Action can optionally tag one or more Potential Attributes (`attributeContributions`), each generating a real evidence row. UI: `ActionsScreen.tsx`/`ActionsScreen.web.tsx` (log control + feed), standalone destination on both targets (native "More" grid + `MenuStack.tsx`; web sidebar `PROGRESSION_ITEMS` + `AppShell.web.tsx`). See `docs/superpowers/specs/2026-08-13-pillars-and-actions-design.md` for the original spec.

**Potential Attributes (shipped 2026-08-14 — evidence architecture + v1 "H1" scoring model + minimal UI):** A separate developmental-stat system from the legacy Pillar model above. New item type `'potential-attribute'`, seeded with **Strength** and **Stamina** (`seedInitialAttributes` on native's `getDb()` cold-init; web has no equivalent boot hook, so `getAttributes()` in `database.web.ts` lazily seeds on first read instead — same idempotent `metadata.seedKey` guard both places). Two more tables: `attributeDomains` (many-to-many Attribute↔Domain association, **context only, never itself a scoring input** — Strength can relate to both Fitness & Performance and Health & Wellbeing) and `attributeContributions` (the evidence/event log — one row per piece of real-world evidence, `{attributeId, sourceType: 'habit'|'action', sourceId, weight: 'minor'|'moderate'|'major', occurredAt, excludedAt}`, no magnitude/decay baked in — that's config, applied at read time, see below). A Habit's `metadata.attributeContributions` and an Action's `ActionDetails.attributeContributions` (both parsed via `utils/attributes.ts`'s `parseAttributeContributions`) configure which Attribute(s) a source taps and how strongly — many-to-many, independent of the legacy single-target `metadata.potentialStat`. Evidence is generated automatically: every real Habit completion (`updateItemStatus`'s repeating-completion branch, `toggleHabitOccurrence`'s add branch — both via `recordHabitCompletionEvidence`) and every logged Action (`logAction`/`updateAction`/`deleteAction`, which insert/exclude/hard-delete rows to match) writes real `attributeContributions` rows — a Practice Action's evidence is written unconditionally, regardless of the tagged Skill's unlock state (the two are unrelated systems). **Measurable (count/duration) Habits (2026-08-15) generate proportional evidence** via a separate `fraction` column (0..1, NULL = full credit) — `logHabitSample`/`undoLastHabitSample` both call `recordHabitProgressEvidence`, which recomputes the current period's completion fraction from scratch and *replaces* (never accumulates) that period's evidence, so repeated same-day progress updates never stack duplicate rows. `fraction` is applied once, linearly, at the raw-unit level — deliberately never fed through the weekly-credit curve's `^curveExponent` a second time, which would double-count partial effort. See `SCHEMA.md`'s `attributeContributions` section for the full mechanism and the web-specific async-staleness gotcha it works around.

**Scoring (`src/utils/attributeScoring.ts`, the "H1" model from the 2026-08-14 candidate comparison):** deliberately separate from the evidence above — `computeAttributeValue(evidence, config, now)` is a pure function, always recomputed fresh from `getContributionsForAttribute`, nothing cached/stored, so changing config or swapping the model later never requires touching past evidence. Per-Attribute `AttributeScoringConfig` (`weeklyTargetUnits`, `weightMagnitude` for minor/moderate/major, `curveExponent`, `alphaUp`, `alphaDown`) lives on the Attribute item's own `metadata.scoringConfig` (`getAttributeScoringConfig`/`setAttributeScoringConfig`, both DB files) — Strength and Stamina share `DEFAULT_ATTRIBUTE_SCORING_CONFIG` today (target 6 stimulus units/week, minor/moderate/major = 1/2/4, curve exponent 0.6, α-up 0.04, α-down 0.015) but are **not** assumed to share it forever; nothing in the engine hardcodes "6 units" as universal. Mechanism: evidence is bucketed into Monday-start calendar weeks (`weekStartMs`), each week's raw units converted to a 0–100 "weekly credit" via `100 × min(raw/target, 1)^curveExponent` (partial credit below target, hard-capped at target — no amount of extra volume buys more than a perfect week), then the Attribute value chases that weekly signal via an asymmetric exponential filter (fast α up, slow α down) walking every week from the first evidence to now. `computeAttributeScore(attributeId)` (both DB files) is the only place that ties config + evidence + formula together into the number shown in UI. History-aware recovery (H2 — letting recently-lost, well-established progress rebuild faster than the same number reached fresh) was explicitly evaluated and NOT built this pass; see the candidate-comparison artifact for why and how to add it later without any evidence-model changes.

**UI (minimal, native + web):** `AttributesScreen.tsx`/`.web.tsx` (native "More" grid + `MenuStack.tsx`; web sidebar + `AppShell.web.tsx`) shows Strength/Stamina with their live score, a progress bar, and (tap to expand) the 5 most recent evidence rows — deliberately no history graph. A separate "CURRENT STATE" section on the same screen shows Alertness, visually and structurally distinct from the developmental cards. Habit tagging: `HabitDetailScreen.tsx`'s "ATTRIBUTE EVIDENCE" section (native) / `HabitAttributeEditor` in `HabitQuantifiedControls.web.tsx` (web, rendered in `HabitsScreen.web.tsx`'s edit mode) — per-Attribute None/Minor/Moderate/Major chips, independent of the legacy Pillar picker on the same screen. Action tagging: `LogActionSheet` in `ActionsScreen.tsx` (native) / `CaptureForm` in `ActionsScreen.web.tsx` (web) gained an "ATTRIBUTE EVIDENCE" chip section alongside the existing Domain/Pillar/Skill/Mission link pickers — multi-select, unlike those single-select pickers. Editing an already-logged Action's tags isn't supported (native/web edit flows are both title-only today, pre-existing scope, not a gap introduced here).

Web mirror note: `attributeDomains`/`attributeContributions` are localStorage-backed for now (same "no firestoreWebStore mirror yet" pattern as `dailyCheckIns`), not yet cross-device synced.

**Alertness (shipped 2026-08-14):** A "Current State" reading, architecturally separate from Potential Attributes — fast-changing, recomputed fresh from today's Daily Check-In every read, nothing stored or decayed (unlike Attributes' accumulated-evidence model). `computeAlertness()` (both DB files) reads the day's morning `dailyCheckIns` row and calls the pure `src/utils/alertness.ts`'s `computeAlertness`, which derives a basic 0-100 value from the existing `sleepAmount`/`sleepQuality` chip answers (`DailyCheckInFlowScreen.tsx`'s `SLEEP_AMOUNT`/`SLEEP_QUALITY` vocabularies) — returns `null` (never a guessed default) if no check-in was logged today. `AlertnessInputs` deliberately has room for more signals (energy chip, time awake, ...) not wired in yet. No HP, no manual daily entry.

**Agentic assistant (shipped, BOTH targets 2026-08-15):** The assistant is agentic on web and native. The agentic loop is a single shared `services/ai/assistant.ts` (VertexAIBackend, `gemini-2.5-flash`, tool-calling + confirm-then-execute); the only platform split is the data layer — `assistantContext` (native `assistantContext.ts` via `getDb` / web `assistantContext.web.ts` via `firestoreWebStore` snapshot) and `assistantToolExecutor` (native `.ts` → `database.ts` / web `.web.ts` → `database.web.ts`), both Metro-resolved. Entry points: web = floating Sparkles button in `AppShell.web.tsx`; native = **FAB long-press** (`App.tsx` `handleFabHold`). It can create/update/complete/delete items and log habit samples, medication doses, and Actions via Gemini function calling (`assistantTools.ts`'s curated `FunctionDeclaration` set + preview generators, both pure/unit-tested; `assistantToolExecutor.ts` holds the real `database.web.ts`-backed executor in a separate module since the DB module's extensionless internal imports aren't resolvable by Node's raw ESM loader, which would otherwise make the tool schemas untestable). Every tool call the model proposes is shown as a pending-action confirmation card in `AssistantOverlay.tsx` (preview text + Confirm/Cancel) — nothing writes to the database until the user explicitly confirms; declining sends a `{cancelled: true}` functionResponse back so the model acknowledges rather than retries. No `find_item`/search tool — reference resolution relies on the same full-item JSON snapshot already in the read-only system prompt context (`assistantContext.ts`/`assistantContext.web.ts`, the latter reading `firestoreWebStore`'s `getItemsSnapshot()` since web has no SQLite `getDb()`), which is fine at the current small data scale; revisit if title collisions become a real problem. Native is untouched. Backend is Vertex AI (`VertexAIBackend`, model `gemini-2.5-flash`) — NOT the Gemini Developer API `GoogleAIBackend`, whose prepay credits were depleted; Vertex bills against the Cloud project credit. The `gemini-flash-latest` alias 404s on Vertex, so a concrete model ID is required. Entry point: a floating Sparkles button in `AppShell.web.tsx`. Enter sends / Shift+Enter newlines / Enter-confirm + Esc-cancel on the confirmation card (real DOM keydown listeners on web, since RN-web's `onKeyPress` is unreliable for Enter). **Conversational onboarding (2026-08-15):** additional tools — `create_mission`, `create_skill`, `create_habit` (measurement/target/period + Potential Attribute evidence), `link_items`, `set_focus` — plus a "Set up my system" empty-state chip and a system-prompt interview flow let the assistant build out the full progression model (Domains/Missions/Skills/measurable Habits/Focus) by conversation. The confirmation card confirms each proposed action individually (per-row Accept/Skip toggles, defaults to all accepted). See `docs/superpowers/specs/2026-08-15-agentic-web-assistant-design.md` and `2026-08-15-conversational-onboarding-design.md`.

**Domains are now six (2026-08-14, was eight through 2026-08-13):** Discipline and Growth were removed from `CANONICAL_DOMAIN_TITLES` — both were judged too cross-cutting to be their own Domain (Growth happens across every Domain; Discipline may resurface later as a Potential Attribute, not a Domain). `retireDroppedDomains()` (`RETIRED_DOMAIN_TITLES`, runs once at boot after `initSchema`'s canonical-backfill pass) re-homes anything linked to either into a fallback Domain (Discipline → Health & Wellbeing, Growth → Creativity) via the existing `mergeAreaIntoArea`, then removes them — confirmed empty on the live account before this was written, so in practice this is a clean removal, not a real data migration. **Domain scoring itself (`domainScore`/`domainMaintenance`/`computeDomainScore`/all of `domainScoring.ts`) is unchanged and explicitly legacy/compatibility-only going forward** — the 2026-08-14 direction is that Domains should NOT have a universal numeric formula at all (each Domain may eventually need its own "am I tending to this?" logic — Finance cares about actual financial trajectory, not Task-completion count) but that redesign is explicitly out of scope for this pass; the existing 0-100 display keeps working, just over 6 Domains instead of 8, so nothing in the current UI breaks.

**Medication "too soon" override (shipped):** `computeMedicationEligibility`'s `canTake` gate (`src/utils/medicationState.ts`) is a caution, not a hard block — both `MedicationsScreen.tsx`'s `TodayRow.handleTake` and `MedicationQuickLogWidget.tsx`'s `promptTake` call the shared `promptTooSoonOverride(minsLeft, onOverride)` (`src/utils/medicationOverride.ts`) when `!canTake`, which shows the real wait time and an "Override…" action that forces a typed reason via `Alert.prompt` (e.g. "advised by doctor", "exam tomorrow") before continuing — there is no silent-allow path. The reason flows through `takeMedication(id, takenAt?, startTimer?, overrideReason?)` (`useDb.ts`) into `logMedicationTaken`'s new `overrideReason` param (`database.ts`), stored as `details.overrideReason` on the `medication-taken` activity log row (undefined when the dose wasn't early). `LogDoseSheet.tsx`'s `LogEntry` renders a small orange "Taken early — `<reason>`" caption under any log that has one, so the override stays visible in dose history, not just at confirmation time.

**Medication focus timeline (shipped):** Opt-in per medication (e.g. for stimulants) — `MedicationMeta` gained `focusCurveEnabled` plus six range fields, `onsetMinHours`/`onsetMaxHours`/`peakMinHours`/`peakMaxHours`/`fadeEndMinHours`/`fadeEndMaxHours` (`database.ts`), since real onset/peak/wear-off varies dose to dose rather than landing on one fixed hour. Edited via a "Track focus timeline" toggle + three min–max hour range rows in `MedicationsScreen.tsx`'s `MedFormSheet` (validated: each min <= max, and the three ranges' midpoints ordered onset <= peak <= fadeEnd). `src/utils/focusCurve.ts`'s pure `computeFocusState(item, meta, lastLog)` derives a `building`/`peak`/`fading` phase from wall-clock time elapsed since the last dose using the range midpoints for the phase transition, returning `null` once elapsed passes the *latest* fade-end estimate (`fadeEndMaxHours`) or the feature isn't enabled/fully configured. `MedicationsScreen.tsx` renders one `FocusTimelineCard` (`src/components/FocusTimelineCard.tsx`) per medication with an active state, above "Needs Attention" — an SVG onset/peak/fade hill with shaded uncertainty bands over the peak and fade-off windows, a live "now" dot, and a plain-language range summary ("Building — peak between 8:30pm and 9:30pm"), self-refreshing every 60s since the state depends only on the clock, not new writes.

**Future routines and quantified habits:** Product direction from the supplied research screenshots is recorded in `../../docs/design/routines-and-habits-product-brief.md`. It is not implemented yet; Apple Health is explicitly deferred from the first implementation.

**Header artwork (shipped):** `assets/icons/header-v2/` contains the transparent 512px Settings, light/dark theme and empty/active/full Inbox soft-object icons, wired into `AppHeader.tsx`. `SettingsMedallionIcon.tsx` renders `settings.png`; `header/ThemeToggleIcon.tsx` stacks `theme-light.png`/`theme-dark.png` and crossfades between them via Reanimated opacity on toggle (collapses to an immediate swap under Reduce Motion, `useReducedMotion`); the inbox button's `inboxIllustration()` picks `inbox-empty.png`/`inbox-active.png`/`inbox-full.png` by the same 0 / 1–10 / >10 thresholds as before. All buttons are 44×44pt touch targets with ~34pt artwork, `resizeMode="contain"`, no tinting. `InboxScrollCard.tsx` on Home's Today view still uses the older `assets/illustrations/inbox/` set — not part of this pack. Never load the green generation sheet under `header-v2/source/` at runtime.

**Collection destination artwork:** `src/components/icons/CollectionIcons.tsx` wraps the transparent PNG destination artwork used by the Collections grid. Current generated app-area PNGs under `assets/icons/domains/collection-*.png` cover Habits, Routines, Skills, To Get and Workouts; Archive, Potential and Achievements still use the approved PNGs under `assets/icons/collections/`. `TaskNoteIcon.tsx` uses the generated task clipboard PNG for Tasks/Upcoming entry points. Use these artwork components instead of generic Heroicons for destination identity; reserve system icons for universal actions and small controls.

**Material-language baseline:** the production native surface baseline is the warm-depth River Stone pass in `src/components/riverstone/riverStoneTokens.ts` + `src/components/riverstone/materials.ts`, with synced tray/header constants in `src/theme/riverStone.ts`: cool sumi background, graphite River Stone everyday cards/rows, blackened-iron-leaning chrome, sparse brass/vermilion accents and semantic-colour icons. `RiverStoneSurface` treats dense `list`/`card` surfaces as everyday stone with no internal vertical face gradients and no edge-catch strokes; they rely on base colour, silhouette, stronger backing/contact shadows and subtle full-perimeter boundary so grids and task lists cannot reveal two-layer horizontal bands. Larger hero/tray surfaces may still use broader continuous lighting whose opacity scales from each palette colour's own rgba alpha. Do not reintroduce finite upper-light, lower-shadow, edge-catch or corner slabs that terminate inside the clipped face. `src/components/dev/MaterialSheetWorkbench.tsx` remains exposed only in `SettingsScreen.tsx`'s `__DEV__` Dev Tools section for tuning Washi/Sumi, River Stone, Blackened Iron, Urushi Lacquer and Gold/Brass roles before future production promotion.

**Domains progress treatment:** `AreasScreen.tsx` treats the Domain grid as a calm maintenance dashboard, not an alert panel. `RiverStoneProgress` supports `showZeroFill={false}` so 0% Domains render as empty recessed tracks instead of vermilion nubs. Actual progress uses brass, while vermilion stays reserved for Focus/active emphasis and selected states.

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
| `CalendarScreen.tsx` | RN primitives + custom timeline | Compact month + selected-day agenda; one-day, single-column Timeline with readable labelled blocks and planning drawer preserves long-press drag-to-time and 15-minute snapping |
| `MenuScreen.tsx` | Tamagui | Navigation stubs |
| `ProfileScreen.tsx` | RN primitives (StyleSheet) | Account header + shared `PotentialOverview` (see below) |
| `PotentialScreen.tsx` | RN primitives (StyleSheet) | Shared `PotentialOverview` (see below) |
| `AchievementsScreen.tsx` | RN primitives (StyleSheet) | Permanent trophy case; manual/retrospective add flow (long-press a row to toggle contributes-to-score or delete) |
| `FocusScreen.tsx` | RN primitives (StyleSheet) | Current Focus label + per-Domain weight overrides |
| `OnboardingScreen.tsx` | RN primitives (StyleSheet) | First-launch guided setup: Domains -> per-Domain Mission/Potential Stat -> Focus; gated in `App.tsx` on `getItemsByType('area').length === 0` at boot. Per-Domain Mission/Stat/Focus steps stay skippable, but the 6-Domain baseline itself is not (was 8 through 2026-08-13; Discipline and Growth retired 2026-08-14 as too cross-cutting to be their own Domain — see "Domains are now six" below) — every path (including "Skip setup" on the intro screen) creates all 6 `CANONICAL_DOMAIN_TITLES` (`database.ts`), tagged `metadata.canonical: true`. Canonical Domains can be renamed (`AreasScreen.tsx`'s Edit) but never deleted or converted to a Skill — both `AreasScreen`'s long-press menu and `deleteItem` itself refuse when `metadata.canonical === true`, so the guarantee holds even from other code paths (e.g. `convertAreaToSkill`). Only user-added Domains beyond the 6 are removable. A boot-time migration in `initSchema` retroactively tags any pre-existing Domain whose title exactly matches `CANONICAL_DOMAIN_TITLES` for devices that onboarded before this flag existed — a renamed pre-existing Domain won't be caught by that backfill. A device with duplicate-titled Domains (e.g. several onboarding runs during dev testing) could get more than one row tagged canonical for the same title; a corrective pass runs every boot to keep only the one with the most linked Missions (tie-broken by earliest `createdAt`) canonical and unmark the rest, so duplicates become ordinary, cleanable Domains again. A further boot-time pass creates any of the 6 canonical titles missing entirely (e.g. one deleted before the flag existed). See `mergeAreaIntoArea` below and `AreasScreen.tsx`'s "Merge into..." action, which re-homes a Domain's Missions/Stats/Achievements/Skill links onto another Domain and deletes it (the one deliberate exception to canonical Domains being undeletable, since the target absorbs the identity) — `initSchema` also runs this automatically for two dev-cleanup duplicate pairs ("Mind" → "Growth", "Craft" → "Creativity"; see `KNOWN_DUPLICATE_MERGES`) and, since 2026-08-14, for `retireDroppedDomains()` (`RETIRED_DOMAIN_TITLES`), which re-homes Discipline into Health & Wellbeing and Growth into Creativity before removing them — confirmed empty (no Missions/Habits/Skills/Pillars/Achievements) on the live account before this was written, so the re-home is a safety net, not an expected data-mover. Final canonical 6: Health & Wellbeing, Fitness & Performance, Career, Finance, Creativity, Relationships. |
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
| `icons/CollectionIcons.tsx` | RN Image wrappers | Transparent PNG collection artwork: Workout kettlebell, Habit prayer beads, To Get furoshiki parcel, Archive scroll chest, Routines steps, Skills nodes, Potential core and Achievements medal |
| `home/RoninJourneyPrototype.tsx` | River Stone + SVG + Reanimated + PNG frames | Compact Home progress path; runs the 52-frame `assets/ronin/idle-v2/` library with weighted 8–18 second personality idles, walking/action interruption, and blink-only Reduce Motion behaviour |
| `home/RoninJourneyRiveWalker.tsx` | Rive Nitro runtime | Loads `assets/rka_journey_rig.riv`, autoplays `State Machine 1`, and falls back to the transparent PNG while loading or after a runtime error |

`@rive-app/react-native`, `react-native-nitro-modules`, `assets/rka_journey_rig.riv`, and `RoninJourneyRiveWalker.tsx` remain available for the separate rig experiment, but Home currently mounts `RoninWalkCycleSprite.tsx` and the PNG-frame library described above. Rive contains native code, so regenerate/install the development build before testing the retained Rive renderer; Expo Go cannot run it.

**The active rig work is `RONIN RIG 1` in the Rive desktop app — see [`RONIN_RIVE.md`](RONIN_RIVE.md), which is the single source of truth.** It covers the scene graph, skeleton, IK, ViewModel contract, animations, state machine and interaction model. Everything that preceded it (the `2478489` cloud rig, the storybook manifest and its `Journey`/`Journey Controller` contract, the v1–v4 art specs, the painterly-PNG and parts-brief plans) has been **deleted, and must not be revived or reconstructed**. `RONIN RIG 1` has not yet been exported over `rka_journey_rig.riv`, so the shipping runtime above is unchanged for now.

Approved character reference art remains under `assets/ronin/reference/` and `assets/ronin/model/` for visual direction only — it no longer implies any rigging plan.

### Exercise Images

`assets/exercises/*.png` (183 images) + `src/utils/exerciseImages.ts` (generated static `require()` registry) + `src/utils/starterExercises.ts` (generated full starter catalog). `src/utils/exerciseLibrary.ts` classifies all 183 exact variations into 32 canonical movement families; the generated starter metadata persists `movementFamily`, while existing/custom exercises without it fall back to title inference. The muscle-group screen and exercise picker show family sections, and search matches both exact titles and parent-family labels. Regenerate both generated files via `node scripts/generateExerciseAssets.cjs` from `apps/mobile/` after adding new PNGs to `assets/exercises/` — do not hand-edit them, and update both classifier rule copies when adding a genuinely new movement family.

Custom muscle-group artwork lives in `assets/icons/muscle-groups/`, separate from the generated exercise thumbnail library, and is wired through **`src/utils/muscleGroupIcons.ts`** (`getMuscleGroupIcon(group)`) into the Exercise Library's group cards (`MuscleGroupCard.tsx` + `MuscleGroupCard.web.tsx`) — this is the muscle-group identity surface; the group-detail screens still show individual exercise photos. As of 2026-08-12 the set ships two variants — `3d/` (anatomical figure with the worked region highlighted, the one currently wired) and `gold/` (flat gold glyph) — each covering ten groups: `arms/back/calves/chest/core/full-body/glutes/hamstrings/legs/shoulders.png`. The registry only maps the eight `MUSCLE_GROUPS` keys; `cardio` has no dedicated figure so it reuses `full-body`, and `calves/glutes/hamstrings` art is present but unused until the taxonomy grows. Do not point the cards back at exercise-photo thumbnails (`pickGroupThumbnailImageKey`).

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
