# Pillars page + Actions model — Design Spec

**Date:** 2026-08-13
**Status:** Approved, implementing in one pass (native iOS + desktop web)

## Context

"Potential Stats" were renamed to **Pillars** (product term; internal item type stays `potential-stat`, no migration — see the 2026-08-12 HANDOVER entry). Two gaps remain:

1. **Pillars have no standalone page** — reachable only by drilling into a single Domain (`AreaDetailScreen` / `DomainMissionDetailForm.web`). There's no "all my Pillars and how each is doing" view.
2. **Actions don't exist** — documented as future direction only. Notably, **skill practice is never logged** today: `computeSkillPracticeSummary` only *derives* activity read-only from linked habit/routine completions. There's no way to record "practiced piano 30 min, high intensity, because I have a recital."

Both get their **own top-level page now**, to be **nested later** (Pillars under Potential/Me; Actions near Tasks/Logbook), matching how Focus/Achievements/Skills were folded. Nesting is tracked in `WEB_PARITY.md`, not done in this pass.

## Existing architecture (grounding)

- `activityLogs(id, entityId, actionType, timestamp, details, createdAt)` is the **generic event log**, written via `logActivity(entityId, actionType, details?)`. Habit check-ins (`'completed-occurrence'`), habit samples (`'habit-sample'`), medication doses (`'medication-taken'`), routine steps (`'routine-step-completed'`) all live here.
- **Task completions** live on the `items` table: `status='completed'` + `completedAt` (no event row).
- Web `database.web.ts` is a **separate Firestore-backed reimplementation** — every function used by a web screen MUST have a matching export there or the whole web app crashes on first call.
- Pillar maintenance % per Pillar comes from `computePotentialStats(habits, stats, completedDatesByHabitId, today)` → `PotentialStatResult { stat, percent, contributions[] }`.

## Section A — Pillars page

New `src/screens/PillarsScreen.tsx` (native) + `src/webApp/PillarsScreen.web.tsx` (web). No schema change.

- **List** every `potential-stat` (via `getPotentialStats()`), each row: title, maintenance % (from `computePotentialStats` across all habits), linked Domain title (or "Unlinked"), feeding-habit count. Expand a row → contributing habits + their streak %.
- **Actions:** create Pillar (optional Domain link via `createPotentialStat(title, areaId?)`), rename (`updateItem`), delete (`deleteItem`), link/unlink Domain (`setPotentialStatArea`), plus `SUGGESTED_PILLARS` quick-adds (from `utils/potential.ts`).
- **Framing:** neutral/optional, mostly Health & Fitness. Empty state: "No Pillars yet — Pillars are optional maintenance areas (mostly Health & Fitness) like Sleep, Hydration, Strength."
- Reuses existing DB functions only; native uses River Stone `RiverStoneSurface`/`RiverStoneProgress` + theme tokens; web uses `webTheme` tokens + `webDepth`, mirroring existing list screens.

## Section B — Actions data model (no new item type, no migration)

An **Action = a lightweight event row in `activityLogs`**, `actionType: 'action'`.

`details` JSON:
```ts
interface ActionDetails {
  title: string;
  kind: 'practice' | 'general';        // practice = skill/effort session; general = anything else
  durationMinutes?: number;
  intensity?: 'low' | 'medium' | 'high';
  why?: string;
  domainId?: string;                   // 'area' item
  pillarId?: string;                   // 'potential-stat' item
  skillId?: string;
  missionId?: string;                  // 'project' item
}
```
- `entityId` = primary linked entity in priority skill→mission→pillar→domain, else `'manual'`.
- `timestamp` = when it happened (caller may override, like `logMedicationTaken`'s `takenAt`; defaults to now).

**New DB functions in BOTH `database.ts` and `database.web.ts`:**
```ts
interface LogActionInput extends ActionDetails { occurredAt?: number }
interface ActionRow extends ActionDetails { id: string; entityId: string; timestamp: number }
function logAction(input: LogActionInput): string
function getActions(limit?: number): ActionRow[]          // 'action' rows only, newest-first, parsed
function updateAction(id: string, patch: Partial<ActionDetails>): void
function deleteAction(id: string): void
```
Types (`ActionDetails`, `LogActionInput`, `ActionRow`, `FeedEntry`) live in `src/utils/actions.ts` (pure, shared by native + web + the feed builder). Parsing/normalization helpers there are unit-tested.

**Unified read-only feed** — `getActionFeed(limit?): FeedEntry[]` in both DB files:
```ts
type FeedSource = 'action' | 'habit' | 'task' | 'medication' | 'routine';
interface FeedEntry { id: string; source: FeedSource; title: string; timestamp: number; subtitle?: string; entityId?: string }
```
Merges, newest-first: `'action'` rows + `'completed-occurrence'` (habit check-ins) + completed `task` items (by `completedAt`) + `'medication-taken'` + `'routine-step-completed'`. A pure `buildActionFeed(sources)` in `utils/actions.ts` does the normalization/sort/limit and is unit-tested; the DB functions just gather rows and hand them to it.

**Scoring-safe:** logged actions NEVER write `domainContributions`, touch skill proficiency, or change any existing calc. Recorded + displayed only. Feeding proficiency/score is explicitly deferred.

## Section C — Actions page

New `src/screens/ActionsScreen.tsx` + `src/webApp/ActionsScreen.web.tsx`.

- **Log control** — button/FAB → capture sheet (native: BottomSheet/Modal per Things-3 pattern; web: inline capture row/panel): title, kind toggle, duration, intensity chips, why, and link pickers (Domain/Pillar/Skill/Mission, all optional). Calls `logAction`. This is the first place skill practice with why/duration/intensity is recordable.
- **Unified feed** — renders `getActionFeed(limit)` newest-first; each entry shows source glyph, title, subtitle (e.g. "45 min · high" or "Habit check-in"), relative time. Logged actions are editable/deletable (`updateAction`/`deleteAction`); derived entries (habit/task/med/routine) are read-only.

## Section D — Navigation + scope

- **Standalone entries now:** native → new tiles in `MenuScreen.tsx`'s grid ("Pillars", "Actions") + `MenuStack.tsx` `Stack.Screen` registration (`Pillars`, `Actions`). Web → `Sidebar.web.tsx` (`SidebarView` union + a `NAV_ITEMS`/`PROGRESSION_ITEMS` entry each) + `AppShell.web.tsx` render branch. Reuse an existing `NavArtwork` icon (Pillars→`potential`, Actions→`tasks`) — no new art this pass.
- **Later nesting (tracked, not done):** Pillars under Potential/Me; Actions near Tasks/Logbook.
- **Out of scope:** actions affecting scoring/proficiency; editing task/habit models; Apple Health; new artwork; a separate Pillar detail screen (inline expand instead).

## Verification

- New unit tests: `utils/actions.test.ts` (`buildActionFeed` ordering/normalization/limit; action detail parse). Existing `domainScoring`/`potential` tests stay green.
- `tsc --noEmit` clean on touched files (ignoring known `.web.tsx` platform-extension false alarms).
- Web: confirm every DB function a web screen calls is exported in `database.web.ts`.
- Docs updated: `AGENTS.md`, `apps/mobile/CLAUDE.md`, `WEB_PARITY.md`, `HANDOVER_SUMMARY.md` — Actions now shipped (logging + feed) but non-scoring; Pillars page shipped; both pending later nesting.
