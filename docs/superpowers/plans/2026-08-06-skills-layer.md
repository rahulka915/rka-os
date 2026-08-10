# Skills Layer Implementation Plan

**Goal:** Add `Skill` as a first-class entity between Domains and Habits/Missions/Achievements — a capability you develop, linked to one primary Domain and optional secondary Domains, with manual proficiency, organizational links to habits/routines/missions, and a capped/decaying scoring contribution that only fires on genuine new evidence (skill milestones), never by merely existing.

**Locked decisions:**
- Proficiency is a manual self-rating (0–100 slider, no derived formula).
- A Skill's only path to Domain scoring is a new `sourceType: 'skill'` `domainContributions` row created from a **Skill-linked achievement/milestone** — same decay mechanism as Mission/Achievement tiers, smaller defaults (`magnitude 0.3, halfLifeDays 45` — tune later if needed). Full weight on the primary Domain, half weight (`magnitude * 0.5`) on each secondary Domain.
- An achievement links to **either** an Area **or** a Skill, never both — this is what prevents double-counting (no channel where the same evidence feeds two contribution rows).
- Habits/routines/missions linked to a Skill are **purely organizational** — they keep contributing to Potential exactly as they do today (via their own Potential Stat / Mission-area relation), the Skill layer adds no second contribution for them.

## Data model additions (no changes to existing scoring functions)

- `ItemType` gains `'skill'`.
- `Item.metadata` for a skill: `{ proficiency: number }` (0–100), `{ secondaryAreaIds?: string[] }` — secondary Domains stored as a plain array in metadata (not `itemRelations`, since `itemRelations` only supports one target per `(sourceId, relationType)` and a skill can have several secondary Domains — same reasoning as `focus.weights` already being metadata-stored).
- New `itemRelations` relationTypes (all single-target, via existing `setRelation`): `skillArea` (skill → primary Domain), `achievementSkill` (achievement → skill, mutually exclusive with `achievementArea`), `habitSkill` (habit → skill, organizational), `missionSkill` (project → skill, organizational), `routineSkill` (routine → skill, organizational).
- New `domainContributions.sourceType` value: `'skill'`.

## Tasks

1. **Schema/types** — `ItemType` union, `SKILL_CONTRIBUTION_DEFAULTS` in `domainScoring.ts`, no `DomainContributionRow` shape change (sourceType already a union, just add the literal).
2. **`database.ts` — Skill CRUD + linkage** — `createSkill(title, primaryAreaId, secondaryAreaIds?)`, `getSkills()`, `getSkillsForArea(areaId)` (primary OR secondary), `updateSkillProficiency(skillId, proficiency)`, `setSkillSecondaryAreas(skillId, areaIds)`, `getPrimaryAreaForSkill`, `getSecondaryAreasForSkill`, `linkHabitToSkill`/`linkMissionToSkill`/`linkRoutineToSkill` + getters, `getHabitsForSkill`/`getMissionsForSkill`/`getRoutinesForSkill`.
3. **`database.ts` — Achievement/Skill contribution wiring** — extend `createAchievement`/`setAchievementContributesToScore` (or add Skill-specific siblings `createSkillAchievement`/`setSkillAchievementContributesToScore`) so a Skill-linked achievement's contribution writes to the skill's primary Domain (full weight) + each secondary Domain (half weight) instead of a single Area. Enforce the either/or constraint at the DB layer (a Skill-linked achievement never also takes an `achievementArea` relation).
4. **`SkillsScreen.tsx`** (new) — list, card grid matching the Domains grid pattern, reachable from Menu (register in `MenuStack.tsx`/`MenuScreen.tsx` tile grid) and from `AreaDetailScreen` (Skills section).
5. **`SkillDetailScreen.tsx`** (new) — proficiency (editable slider), practice time/consistency (aggregated read-only from linked habits' samples + routine session completions — best-effort display, no new tracking mechanism), linked habits/routines list, active missions list, milestones/achievements list (with the existing add-achievement flow adapted to target a Skill), related Domains (primary + secondary chips).
5. **Docs** — `SCHEMA.md`, `CLAUDE.md`, `HANDOVER_SUMMARY.md`.

Each task its own commit, isolated against HEAD per this session's established technique.
