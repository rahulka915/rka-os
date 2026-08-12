# Web ↔ Mobile Feature Parity

**Standing principle:** the desktop **web app** (`src/webApp/`) and the **iOS/native app** (`src/screens/`) should offer **essentially the same functionality**. Treat parity as the default expectation, not a stretch goal. Some *variation* is fine and expected (different navigation model — Sidebar + DetailPanel on web vs. `react-navigation` stack + bottom dock on native; different layout density; platform-only affordances like haptics/swipe). But a **feature** existing on one target and simply missing on the other is a **gap to be tracked here and closed**, unless the divergence was explicitly agreed.

**Keep this file updated.** Any change that adds, removes, or meaningfully alters a feature on *either* target MUST update this file in the same pass — mark the row parity ✅, partial 🟡, or missing ❌, and adjust the notes. This is part of the repo's multi-agent documentation rule (alongside `CLAUDE.md`/`AGENTS.md`/`HANDOVER_SUMMARY.md`). If you deliberately ship something on only one target, record *that decision* here so it doesn't read as an untracked gap.

Legend: ✅ at parity · 🟡 partial (exists but thinner) · ❌ missing on web · 📱 native-only by design

_Last audited: 2026-08-12._

**Web-only sidebar consolidation (2026-08-12):** four former top-level sidebar destinations were folded into the screen they conceptually belong to, since they aren't standalone concepts on native either — this is a web navigation cleanup, not a feature change (all underlying functionality is unchanged, just relocated):
- **Workout Trends** → now a third tab ("Trends") inside `WorkoutsScreen.web.tsx`, alongside Templates/Exercises, rendering the existing `WorkoutTrendsScreen.web.tsx` unchanged.
- **Focus** → now an inline expandable "Edit" row under Potential's "CURRENT FOCUS" section (`PotentialOverview.web.tsx`), backed by a new body-only `FocusEditor.web.tsx` (extracted from the old `FocusScreen.web.tsx`, which is deleted).
- **Me / Potential** → consolidated into one sidebar entry ("Potential", `ProfileScreen.web.tsx`, which already combined the account header + shared `PotentialOverview`). `PotentialScreen.web.tsx` is deleted; the `profile` sidebar view is gone, `potential` now points at the merged screen.
- **Plan Backwards** → now a third segment ("Plan Backwards") in Calendar's Timeline/Agenda toggle (`CalendarScreen.web.tsx`), swapping in the existing `PlanBackwardsScreen.web.tsx` full list+detail workflow in place of the day view when selected.

`Sidebar.web.tsx`'s `SidebarView` type and `PROGRESSION_ITEMS` were trimmed accordingly; `AppShell.web.tsx` routing updated to match.

**Further sidebar consolidation (same session, 2026-08-12):** the "Potential" sidebar entry is relabeled **"Me"** (still routes to `ProfileScreen.web.tsx`, key unchanged at `potential`). Achievements and Skills are no longer top-level sidebar destinations either — they're now two expandable sections on the Me/Potential page itself (`ProfileScreen.web.tsx`'s local `ExpandableSection` wrapper embeds the existing `AchievementsScreen.web.tsx`/`SkillsScreen.web.tsx` components unchanged, in a bounded-height scrollable box). `Sidebar.web.tsx`'s Domains/Missions tree sections were already collapsible (chevron toggle, `domainsOpen`/`missionsOpen` state) — no change needed there, just confirmed still correct.

**Cross-target navigation parity pass (2026-08-12):** the above web consolidations were mirrored onto native so both targets share the same top-level nav logic (platform navigation model still differs — sidebar vs. bottom tabs + a "More" grid — which is expected variation):
- **Native "More" grid** (`MenuScreen.tsx`) no longer lists Focus, Potential, Plan Backwards, Upcoming, Skills, or Achievements. Their screens stay registered in `MenuStack.tsx` (reachable via `navigate`), just not as grid destinations.
- **Focus** → reached from the "CURRENT FOCUS" row in `PotentialOverview.tsx` (rendered inside the Me/Profile tab), routed via `navigate('Menu', { screen: 'Focus' })`.
- **Potential / Me** → native already had these unified in the Profile ("Me") tab rendering `PotentialOverview`; the redundant "Potential" grid tile is simply removed.
- **Skills / Achievements** → now link rows on the Me/Profile tab (`ProfileScreen.tsx`), matching web's expandable sections.
- **Plan Backwards + Upcoming** → now two navigate-chips in `CalendarScreen.tsx`'s view-chip row (next to Calendar/Timeline), routed via `navigate('Menu', { screen: ... })`.
- **Web Upcoming** was still a top-level sidebar destination; it's now removed from `Sidebar.web.tsx`'s `NAV_ITEMS` and folded into Calendar as a fourth segment ("Upcoming") alongside Timeline/Agenda/Plan Backwards (`CalendarScreen.web.tsx`, rendering the unchanged `UpcomingScreen.web.tsx`). The dead `AppShell.web.tsx` `upcoming` route is harmless and left in place.

**Second consolidation round — Routines→Habits and Archive→Tasks (2026-08-12):** two more destinations folded on both targets, since neither is a standalone concept:
- **Routines → Habits.** Web: a "Routines" tab in `HabitsScreen.web.tsx` (segmented control, renders the unchanged `RoutinesScreen`), removed from `Sidebar.web.tsx`'s `PROGRESSION_ITEMS`. Native: a "Routines →" header link in `HabitsScreen.tsx` (matching the Workouts→Trends/Library link idiom), removed from `MenuScreen.tsx`'s grid; `RoutinesScreen` still registered in `MenuStack.tsx`.
- **Archive → Tasks.** Web: an "Archive" segment in `TasksScreen.web.tsx` (Tasks/Logbook/Archive), rendering the unchanged `ArchiveScreen`; removed from `Sidebar.web.tsx`'s `NAV_ITEMS`. Native: an "Archive" segment in `TasksScreen.tsx` rendering a new body-only `ArchiveList` extracted from `ArchiveScreen.tsx` (so its `useArchivedItems` query stays lazy — only runs when the segment is selected, honoring the cold-start guardrail); removed from `MenuScreen.tsx`'s grid.
- Dead `AppShell.web.tsx` `routines`/`archive` routes left in place, harmless.

---

## 1. Top-level destinations

| Destination | Web | Native | Status | Notes |
|---|---|---|---|---|
| Home | ✅ | ✅ | 🟡 | Web now has a widget row (Weather, Medication quick-log, Habits quick-log, Plan Backwards countdown) and a condensed progression strip (ring + current focus). Countdown widget tap is a no-op (no cross-screen route yet). |
| Inbox | ✅ | ✅ | 🟡 | Web now has a capture row and a per-row "..." triage menu (Today/Morning/Evening/Someday, convert-to-X, delete) in place of native's swipe/long-press. |
| Tasks | ✅ | ✅ | ✅ | Full view config (group by status/priority/mission/due-date, sort by manual/due/priority/alphabetical/created, filter), up/down reorder + "Move to..." (buttons instead of drag), badges (blocked/deadline/repeat/checklist). Close to native. |
| Upcoming | ✅ | ✅ | ✅ | No longer a top-level destination on either target — folded into Calendar (web: an "Upcoming" segment; native: a Calendar view-chip). Same `UpcomingScreen`/grouping on both. |
| Calendar | ✅ | ✅ | 🟡 | Timeline/Agenda toggle, 15-min snapping (quarter-hour drop targets), "Plan your day" drawer for unscheduled items. Native-only: read-only device-calendar overlay (`deviceCalendar.ts`, iOS EventKit — reads whatever's synced to the device, including Google if added in iOS Settings) renders synced events as non-editable "busy" blocks on the day timeline, with a Settings → Calendar connect row. No browser equivalent — no Google/CalDAV API wired up on web (tracked gap, not attempted). |
| Archive | ✅ | ✅ | ✅ | No longer a top-level destination on either target — folded into Tasks as a third segment (Tasks/Logbook/**Archive**). Same restore/delete list on both. |
| To Get | ✅ | ✅ | ✅ | Close. |
| Medications | ✅ | ✅ | 🟡 | Web missing focus timeline, too-soon override, eligibility/streak, reminders. |
| Workouts | ✅ | ✅ | 🟡 | Web has template edit + picker; no live session logging/history (Workout Trends screen itself is now ported, see below). |
| Habits | ✅ | ✅ | ✅ | Web supports quantified (count/duration) habits — +1/duration-entry quick-log, period progress recomputed from samples, undo-last, measurement editor — and now exposes Potential Stat/Pillar assignment plus target-days editing in the habit edit panel. |
| Areas / Missions | ✅ | ✅ | ✅ | Domain detail now has Domain Score, Skills, **Pillars** (user-facing name for `potential-stat`), and Achievements sections. Pillars can be created and unlinked from the Domain detail panel. A Domain with no Pillars shows a neutral "No Pillars tracked" state (Pillars are optional, mostly Health/Fitness) and scores off a 10% maintenance floor via the shared `domainMaintenance` helper — same as native, not a 0% failure. |
| Settings | ✅ | ✅ | 🟡 | Now has Notifications (informational + browser-permission button, since native's local-scheduling model doesn't exist on web) and Dev Tools (clear cache, copy debug info). Still missing Plan Backwards default-departure row (backend ready, UI not wired). |
| **Potential** (Harada wheel) | ✅ | ✅ | 🟡 | Ported as a simplified ring (no SVG Harada wheel/EnsoMeter); Domain/Overall scores now use the native maintenance-baseline model from linked **Pillars** (`potential-stat`) and assigned habit streaks, including the shared `NO_PILLAR_MAINTENANCE_BASELINE` (10%) neutral floor for Pillar-less Domains. Web still omits the separate `domainContributions` achievement/mission/skill decay lift. |
| **Profile / "Me"** | ✅ | ✅ | 🟡 | Account header + shared Potential content, mirrors native's "Me IS the Potential." Same maintenance-baseline-without-decay caveat as Potential. |
| **Achievements** | ✅ | ✅ | 🟡 | Capture row, per-row contributes-to-score toggle, delete. "Contributes to score" is flag-only on web — no `domainContributions` scoring engine there yet. |
| **Focus** | ✅ | ✅ | 🟡 | Label + per-Domain weight stepper, Save/Clear. Simplified singleton persistence vs native. |
| **Skills** (+ detail) | ✅ | ✅ | 🟡 | Grid + full detail panel (proficiency stepper, lock/unlock, primary/secondary Domains, linked Habits/Routines/Missions, milestones). Milestone "contributes to score" and unlock are flag-only (no domainContributions engine on web). |
| **Routines** (+ session) | ✅ | ✅ | 🟡 | No longer a top-level destination on either target — folded into Habits (web: a "Routines" tab next to Habits; native: a "Routines →" link in the Habits header). List + step CRUD with up/down reorder (no drag). Live session play (timer) not built on web — "Start" is a visible stub. |
| **Plan Backwards** (+ detail) | ✅ | ✅ | 🟡 | Full workspace: anchor fields, live Remaining/Required/Unallocated metrics, Routine/Task blocks, Travel toggle. No Apple Maps live-ETA/location-search (plain manual fields instead) — native-only integration, deliberately out of scope. |
| **Workout Trends** | ✅ | ✅ | 🟡 | Frequency heatmap, exercise progression, weekly volume, muscle balance — all as CSS bar/grid charts (no Skia). Monthly volume view dropped for v1 (weekly only). |
| **Daily Check-In / Daily Log** | ✅ | ✅ | 🟡 | Morning/Evening capture form + history list (today/yesterday editable, older read-only). Persisted via `localStorage` on web (not SQLite/Firestore-synced) — per-browser only, not cross-device yet. |
| **Pillars** (new, 2026-08-13) | ✅ | ✅ | ✅ | Standalone list of every `potential-stat`: maintenance %, linked Domain, feeding-habit count, expandable contributions, create/rename/delete/link/unlink, `SUGGESTED_PILLARS` quick-adds. Currently a standalone top-level destination on both (web `Sidebar.web.tsx` PROGRESSION_ITEMS; native `MenuScreen.tsx` grid + `MenuStack.tsx`) — later nesting under Potential/Me is planned, not done. |
| **Actions** (new, 2026-08-13) | ✅ | ✅ | ✅ | Log control (title/kind/duration/intensity/why/optional Domain-Pillar-Skill-Mission links) writing `activityLogs` rows (`actionType: 'action'`, non-scoring — never touches `domainContributions`/proficiency). Unified read-only feed (`getActionFeed`) merges logged Actions with habit check-ins/task completions/medication doses/routine steps, newest-first; logged Actions are editable/deletable, derived entries are not. Standalone top-level destination on both for now — later nesting near Tasks/Logbook is planned, not done. |

## 2. Detail-level gaps within shared screens

- **Tasks** — full parity on grouping/sort/filter/reorder/badges (buttons substitute for native's drag gesture and swipe actions). Still lacks: dependency connector lines (blocked badge text is shown instead), the native drag-and-drop feel itself.
- **Home** — widget row + progression strip now shipped (see §1). Weather widget renders nothing without location/API access in some environments — fails soft by design, not a bug.
- **Medications** — web lacks: **focus timeline**, **"too soon" override**, eligibility/streak, reminders. Has: take, timer, restock, dose-log panel.
- **Habits** — quantified (count/duration) habits now shipped: quick-log control, period progress from samples (never a stored counter), undo-last, measurement editor. Habit edit also exposes Potential Stat/Pillar assignment and target-days editing, matching the native habit-to-Potential wiring.
- **Workouts** — web lacks **live session logging** (reps/weight per set) and session history on the Workouts screen itself. Workout Trends (aggregation/charts) is now a separate, fully ported screen (see §1) — it reads existing session/set-log data, it doesn't create the live-logging UI.
- **Calendar** — 15-min snapping, Agenda view, and a "Plan your day" drawer now shipped (see §1).
- **Inbox** — capture row and a triage menu (replacing native's swipe+long-press with a "..." dropdown) now shipped (see §1).
- **Domain/Mission detail** — Domain Score, Skills, Potential Stats, and Achievements sections now shipped for Domains (see §1); Domain detail can create/unlink Potential Stats/Pillars. Missions still only show the basic edit form (native has no equivalent extra sections for Missions either, so this is expected, not a gap).
- **Settings** — Notifications and Dev Tools now shipped (see §1); Plan Backwards default-departure row still missing (backend functions `getDefaultDeparturePoint`/`setDefaultDeparturePoint` already exist in `database.web.ts`, just needs a Settings row + a small sheet/field, same pattern as `DefaultDepartureSheet.tsx` on native).

## 3. Genuinely at parity

- **Item detail panel** (`ItemDetailForm.web.tsx`) — title, notes, scheduled date/time, deadline, priority (low/med/high), repeat (Daily/Weekdays/Weekends/Weekly), someday/complete toggles.
- **Design language** (as of 2026-08-12) — web re-skinned to the native River Stone palette, depth, and destination artwork. See `docs/design-system/reference/tokens.md` "Desktop web app tokens".

## 4. Web data-layer note (important for future porting work)

`database.web.ts` is **not** a thin stub over the same SQLite database as native — it's a **separate, independently-maintained Firestore-backed reimplementation** of the same function surface (Metro's platform-extension resolution makes `import ... from '../db/database'` resolve to it on web builds instead of `database.ts`). Porting a native screen to web is therefore two jobs, not one: the UI, **and** confirming every `database.ts` function the UI calls actually has a matching export in `database.web.ts` — if one is missing, the import silently resolves to `undefined` and calling it throws at runtime. Since `AppShell.web.tsx` has **no error boundary**, one missing function crashes the entire web app to a blank white screen, not just the screen that used it. Always grep `database.web.ts` for every native db function a new web screen imports before considering a port done, and smoke-test in a live browser preview (`npx tsc --noEmit` alone will NOT catch this — both files satisfy the same type-only import correctly even when one has no matching runtime export... actually it will catch a missing export as a type error too, but only if strict — verify by actually clicking through the screen, not just by a clean `tsc` run).

As of this pass, `database.web.ts` has real (if simplified) implementations for Achievements, Focus, Skills, Routines, Plan Backwards (new `blocks` array stored in the plan item's metadata — no separate Firestore collection), Workout Trends aggregation, quantified-habit samples (`logHabitSample`/`getHabitSamples`/`undoLastHabitSample`, reusing the existing activity-log mirror), Potential Stats (`getPotentialStats`/`createPotentialStat`/Domain linking), Domain-detail lookups (`getAchievementsForArea`/`getSkillsForArea`/`getPotentialStatsForArea`), and the Plan Backwards default-departure setting (`localStorage`-backed singleton). Scoring side-effects that depend on native's SQLite-only `domainContributions`/decay engine (achievement/milestone "contributes to score", skill unlock re-sync, mission completion lift) are simplified to flag-only/no-lift behavior on web for now. `PotentialOverview.web.tsx` now exports `computeDomainScoreApprox`/`computeDomains`/`readFocus`/`PotentialRing` so every screen showing a domain score or the potential ring (Potential, Me, Home's progression strip, Domain detail) uses the same habit/Pillar maintenance baseline — no drift between screens.

## 5. Suggested gap-closing order (highest value first)

1. ~~**Tasks** — sections + Logbook + Status filter~~ — done, now full grouping/sort/reorder/badges too.
2. ~~**Progression layer** — Potential / Focus / Achievements / Skills~~ — done (simplified scoring).
3. ~~**Planning layer** — Routines, Plan Backwards, Daily Check-In~~ — done (Routines has no session player; Daily Check-In is localStorage-only).
4. ~~**Home** — widget row + progression strip~~ — done.
5. ~~**Habits** — quantified habits~~ — done.
6. ~~**Tasks/Inbox/Calendar/Settings UI-heavy gaps**~~ — done (drag-reorder→buttons, swipe→menus, snapping, agenda, plan-your-day, notifications, dev tools).
7. **Workouts** — live session logging (reps/weight per set) — the one remaining screen-level gap, needs new session-state persistence in `database.web.ts` (not just UI).
8. **Web scoring engine** — a real `domainContributions`-equivalent on web, so Achievements/Skills/Mission completion "contributes to score" effects add the same decaying lift native has. Habit/Pillar maintenance is now wired; the remaining gap is contribution lift.
9. **Routine session play** on web (timer-driven step player, mirroring native's `RoutineSessionScreen`).
10. **Daily Check-In cross-device sync** — move off `localStorage` onto the same Firestore-backed persistence the rest of `database.web.ts` uses.
11. **Settings: Plan Backwards default-departure row** — backend ready, just needs a small UI row/sheet.
12. **Medications**: focus timeline, too-soon override, eligibility/streak, reminders.
