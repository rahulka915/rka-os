# Conversational Onboarding & Full Life-Setup for the Web Assistant

**Date:** 2026-08-15
**Scope:** Desktop web app only (`apps/mobile/src/webApp/`, `services/ai/assistant.web.ts`, `assistantTools.ts`). Native unchanged.
**Builds on:** `2026-08-15-agentic-web-assistant-design.md` (the agentic CRUD + confirm-before-write foundation this extends).

## Problem

The agentic web assistant can create bare items (task, project, habit, medication, supplement, object, area) but can't set them up *properly*: habits come out as plain binary with no measurement/target/period or attribute evidence; Skills aren't creatable at all; nothing links entities (mission→domain, habit→skill) or sets Focus. So a real "set up my whole system by talking to it" onboarding isn't possible yet.

The user wants a **guided conversational onboarding**: a dedicated mode that interviews them and builds out Domains, Missions, Skills (domain-linked), measurable Habits (with attribute evidence), and Focus — with every write still confirmed.

## Goals

- The assistant can create and correctly link the full progression model through conversation: Domains, Missions (→Domain), Skills (→primary/secondary Domains, unlock state), measurable Habits (measurement/target/period + optional Strength/Stamina evidence), and Focus.
- A dedicated **"Set up my system"** guided-onboarding entry point that runs a structured interview, distinct from normal chat but implemented as a kickoff message + system-prompt behavior (not a separate screen).
- **Individual confirmation:** each proposed action is accepted or skipped on its own, even when the model proposes several in one turn.
- All existing safety holds — nothing writes without explicit per-item confirmation.

## Non-goals

- No native changes; no data-layer changes (every needed DB function already exists on web).
- No new persistence — reuses `createSkill`, `setFocus`, `setRelation`, `updateItemMetadata`, `HabitMeta`, `getAttributes`, etc.
- Not replacing the existing `OnboardingScreen`/canonical-domain seeding — the 6 canonical Domains stay pre-seeded; onboarding mostly *references* and optionally renames/extends them.
- No routines/achievements tools this pass (deferred; the tool pattern makes them easy to add later).

## Design

### 1. New tools — `assistantTools.ts` (schemas + previews) + `assistantToolExecutor.ts` (executors)

All are thin wrappers over existing `database.web.ts` functions. The model already receives the full item snapshot in context (including existing Domain and Potential-Attribute IDs), so it links to real IDs without extra lookup tools.

| Tool | Wraps | Notes |
|---|---|---|
| `create_mission` (title, domainId?, notes?) | `createItem('project')` + `setRelation(id,'area',domainId)` | Mission linked to its Domain |
| `create_skill` (title, primaryDomainId?, secondaryDomainIds?, unlocked?) | `createSkill(title, primaryDomainId, secondaryDomainIds)` + `setSkillUnlocked` | New skills default locked unless told otherwise |
| `create_habit` (title, measurement, target?, period?, intent?, attributeEvidence?) | `createItem('habit')` + `updateItemMetadata` (HabitMeta) + attribute-evidence config | measurement ∈ binary/count/duration; period ∈ daily/weekly/monthly/custom; intent ∈ build/quit; attributeEvidence = list of {attributeId, weight} |
| `link_items` (sourceId, relationType, targetId) | `setRelation` | Generic relation (e.g. `habitSkill`, `missionSkill`) |
| `set_focus` (label, weights) | `setFocus(label, weights)` | weights = { domainId: number } |

`create_item` (existing) still handles Domains (`area`) and Tasks. Each new tool gets a `preview()` string for the confirmation card (e.g. `Create skill "Spanish" in Growth`, `Create habit "Meditate" (10 min daily)`).

### 2. Individual confirmation — `AssistantOverlay.tsx`

Today the pending-action card has one Confirm-all / Cancel-all button. The loop (`resolveAssistantActions`) already accepts per-action `decisions: [{call, confirmed}]`, so only the UI changes:

- Each proposed action renders its own row with an **Accept / Skip** toggle (default: undecided).
- A single **Done** button submits the collected decisions (accepted → executed, skipped → `{cancelled:true}`).
- A **Skip all** shortcut remains for convenience.

This satisfies the "confirm each item individually" requirement and is a general UX win (accept some, reject others in one turn).

### 3. Guided onboarding mode

- **Entry:** a "Set up my system" button on the assistant overlay's empty state. Tapping it submits a kickoff message (e.g. "Guide me through setting up my whole system") — nothing more than a seeded prompt.
- **Behavior:** the web system prompt (`assistant.web.ts`) gains an onboarding section instructing the model, when onboarding, to run a short structured interview — life areas (map to / rename the 6 Domains) → goals become Missions → capabilities become Skills → routines become measurable Habits → set a Focus — proposing concrete tool calls at each step for the user to accept/skip individually. It references existing Domain/Attribute IDs from context rather than inventing them.
- No separate screen or state machine — it's a prompt + a button + the existing confirm flow.

## Testing

- Unit: `previewAssistantTool` cases for each new tool (pure, in `assistantTools.test.ts`).
- Manual/browser: run the flow signed in — "Set up my system", confirm the interview proposes correctly-linked Skills/Habits/Missions, accept some and skip others, verify DB state (skill has domain link, habit has measurement + evidence, focus set).

## Future (documented, not built)

- Routines/achievements creation tools (same wrapper pattern).
- Onboarding that reads the Daily Check-In for context.
- A native equivalent once native's assistant becomes agentic.
