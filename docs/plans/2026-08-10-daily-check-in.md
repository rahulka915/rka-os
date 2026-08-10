# Daily Check-In Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Build the native Home-first Morning Check-In and Evening Debrief ritual, including structured logs, priority suggestions, and a tucked-away history view.

**Architecture:** Add a small pure utility layer for time windows, metadata parsing, and priority suggestions; persist logs in a dedicated `dailyCheckIns` SQLite table so they remain clearly separate from tasks and scoring. Native UI consists of a Home prompt card, two step-by-step full-screen flows, and a Daily Log history screen reachable from Home and Profile.

**Tech Stack:** React Native + Expo SDK 57, SQLite via `expo-sqlite`, existing `useDb` hook style, Node `node:test` for pure utilities, existing theme/RiverStone surfaces.

---

### Task 1: Pure Daily Check-In Utilities

**Files:**
- Create: `apps/mobile/src/utils/dailyCheckIn.ts`
- Test: `apps/mobile/src/utils/dailyCheckIn.test.ts`

**Steps:**
1. Write tests for local date assignment, Home prompt selection, safe metadata parsing, priority snapshots, and suggestion reason ranking.
2. Run `cd apps/mobile && npm test -- src/utils/dailyCheckIn.test.ts`; expect failures because the module does not exist.
3. Implement types and helpers:
   - `DailyCheckInPhase`
   - `DailyCheckInAnswers`
   - `DailyPrioritySnapshot`
   - `getDailyCheckInDateKey(now)`
   - `getDailyCheckInPromptState(now, morning?, evening?)`
   - `parseDailyCheckInAnswers(raw)`
   - `buildDailyPrioritySuggestions(tasks, context)`
4. Re-run `npm test -- src/utils/dailyCheckIn.test.ts`; expect pass.

### Task 2: SQLite Repository And Hook

**Files:**
- Modify: `apps/mobile/src/db/database.ts`
- Modify: `apps/mobile/src/db/types.ts`
- Modify: `apps/mobile/src/hooks/useDb.ts`
- Modify: `apps/mobile/SCHEMA.md`

**Steps:**
1. Add `dailyCheckIns` table with unique `(dateKey, phase)`.
2. Add `DailyCheckInRow` type.
3. Add DB functions:
   - `upsertDailyCheckIn(dateKey, phase, answers)`
   - `getDailyCheckIn(dateKey, phase)`
   - `getDailyCheckIns(limit?)`
   - `getDailyCheckInsForDate(dateKey)`
4. Add `useDailyCheckIns(dateKey)` hook returning today rows, recent rows, `save`, and `refresh`.
5. Document the table and non-mutating behavior in `apps/mobile/SCHEMA.md`.

### Task 3: Native Capture Flow

**Files:**
- Create: `apps/mobile/src/screens/DailyCheckInFlowScreen.tsx`
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`

**Steps:**
1. Build one full-screen stepper for both `morning` and `evening`, selected by route params.
2. Use label/chip controls for the fixed questionnaire.
3. Load existing entry for edit.
4. Build task suggestions from Today tasks passed by DB reads, but only save snapshots.
5. Save through `upsertDailyCheckIn` and navigate back.

### Task 4: Home Prompt Card

**Files:**
- Create: `apps/mobile/src/components/home/DailyCheckInCard.tsx`
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`

**Steps:**
1. Render a non-task RiverStone card under the Journey summary and before widgets.
2. Use time-window prompt state to show Morning, catch-up, Evening, or Today logged.
3. Navigate to `DailyCheckInFlow` with phase/dateKey.
4. Include a History action that navigates to `DailyLog`.

### Task 5: Daily Log History

**Files:**
- Create: `apps/mobile/src/screens/DailyLogScreen.tsx`
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx`
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`

**Steps:**
1. Show reverse-chronological grouped daily logs.
2. Show compact morning/evening summaries.
3. Allow editing today and yesterday, read-only older days.
4. Add a Profile row linking to Daily Log.

### Task 6: Documentation, Verification, Commit

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/mobile/CLAUDE.md`
- Modify: `HANDOVER_SUMMARY.md`

**Steps:**
1. Document the shipped native-only Daily Check-In feature and desktop web gap.
2. Run `cd apps/mobile && npm test`.
3. Run `cd apps/mobile && npm run typecheck`.
4. Run `git diff --check`.
5. Commit implementation with a focused `feat:` message.
