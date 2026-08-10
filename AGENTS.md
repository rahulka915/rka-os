# RKA OS - Codex Configuration

## Project Info

**RKA OS** is a personal operating system app. It ships as a native iOS app built with React Native + Expo, living at `apps/mobile/` — see [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) for the platform-specific guide (stack, component structure, design patterns, known constraints).

**Also shipped: a desktop web app**, `apps/mobile/src/webApp/` (Expo web, `.web.tsx` platform-specific screens, run via `npm run web` from `apps/mobile/`) — a genuinely separate, actively-developed target sharing the same SQLite-backed data layer as iOS but with its own screens, theme, and Sidebar+DetailPanel navigation model. Built 2026-07-30–08-01; deploys to Firebase Hosting. **This is not the retired PWA below** — see `apps/mobile/CLAUDE.md`'s "Desktop Web App" section for current screen parity and conventions before touching it.

The project previously *also* shipped a different, since-retired Progressive Web App (Vite + React + Dexie.js at repo root, last touched 2026-06-23); that PWA has been fully retired now that the mobile app covers everything it did. This root `AGENTS.md` only covers repo-wide concerns (skills, git conventions, docs index, shared backend); all app-specific guidance lives in `apps/mobile/CLAUDE.md`.

**Status:** Active development — native iOS (primary) + desktop web (secondary, partial screen parity)

**Current desktop web app:** `apps/mobile/src/webApp/` + `App.web.tsx`, run via `npm run web`. Screen parity so far: Home, Inbox, Tasks, Areas/Projects, Calendar, Upcoming, Archive, Objects (To Get), Medications, Workouts (+ Exercise Library, Workout Template detail), Habits, Settings. Not yet ported: Potential, Achievements, Focus, Skills, Routines, Workout Trends, Plan Backwards, and Daily Check-In/Daily Log (native-only as of 2026-08-10 — see `HANDOVER_SUMMARY.md`).

**Current native baseline:** Expo SDK `57.0.9` with React Native `0.86.2`. Keep Expo native packages aligned with `npx expo install --check`; mixing earlier SDK 57 patch packages with the current `expo-modules-core` causes iOS launch-time `dyld` failures before JavaScript starts. After changing native or Babel-backed packages, restart Metro with `--clear` so it does not keep an older Worklets/Reanimated transform plugin in memory.

**Current shared FAB:** `apps/mobile/src/components/fab/FabControl.tsx` renders the Create control as independently animated SVG/Reanimated lacquer, washi, ink and brush layers. The older `apps/mobile/assets/fab/` PNG sequence is reference/source art and is not loaded at runtime.

**Header icon pack (shipped):** `apps/mobile/assets/icons/header-v2/` contains the simplified transparent soft-object assets for Settings, light/dark theme states and the three Inbox count states, wired into `apps/mobile/src/components/AppHeader.tsx` (`SettingsMedallionIcon`, `header/ThemeToggleIcon` — Reanimated crossfade, Reduce Motion-aware — and the inbox illustration picker). Its `source/` sheet is provenance only; see the adjacent README for runtime mapping and sizing.

**Approved logo refinement references:** `apps/mobile/assets/branding/logo-reference-crops/` isolates A3/F2/F3/F4 from the accepted negative-space exploration. `F3` is the structural base; `RKA` must remain dark protected negative space formed between exactly eight light contribution blocks, never separately drawn lettering.

**Progression icon system (shipped):** `apps/mobile/src/components/icons/DomainIcons.tsx` is the custom single-weight brass icon family for the fixed eight Domains, resolved app-wide by `src/utils/domainIcons.ts`; the bonsai is reserved for Overall Potential/custom fallback, Health uses a hand-and-leaf mark, and Fitness uses a simplified bicep. Missions deliberately share one universal target mark through `ProjectPortfolioIcon`/`ProjectPlaceholderIcon`. Skills remain identity-led through `SkillIdentityIcon.tsx`, which selects a recognisable capability mark from the Skill title.

**Current collection artwork:** `apps/mobile/src/components/icons/CollectionIcons.tsx` wraps the transparent, high-detail 3D PNGs under `apps/mobile/assets/icons/collections/` for Workout, Habit, To Get and Archive destination identity. Reuse these components instead of generic entity glyphs; keep system icons for universal archive actions.

**Current exercise taxonomy:** the 183 exact starter exercises/icons remain individually selectable but resolve to 32 canonical parent movements through `apps/mobile/src/utils/exerciseLibrary.ts`. Generated starters persist `metadata.movementFamily`; older/custom exercise rows fall back to title inference. Exercise browsing and picking group variations under those families, and search matches family labels. Keep the generator and runtime classifiers aligned; tests enforce full classification and the 32-family count.

**Current Home journey prototype:** `apps/mobile/src/components/home/RoninJourneyPrototype.tsx` uses the user-supplied sunset/Fuji background with the local `apps/mobile/assets/rka_journey_rig.riv` Ronin-and-cat state machine. The whole scene is a reliable press target; the Rive walkers loop continuously while the group advances from today's real completion ratio even under Reduce Motion and shows a haptic speech-bubble reaction on tap. The transparent PNG remains only as a loading/error fallback.

**Current Rive journey runtime:** `@rive-app/react-native` and `react-native-nitro-modules` are installed in `apps/mobile/`. The shipping runtime export is `apps/mobile/assets/rka_journey_rig.riv`; `apps/mobile/src/components/home/RoninJourneyRiveWalker.tsx` autoplays `State Machine 1` while the app supplies whole-character bob, progress travel and tap reactions. Rive contains native code, so test this renderer in a freshly regenerated development build rather than Expo Go.

**Next-generation Ronin reference:** `apps/mobile/assets/ronin/model/ronin-cat-side-style-reference-v3.png` is the canonical visual identity reference for all new turnarounds, expressions and activity poses. It is an exact duplicate of the transparent side-on Ronin-and-walking-cat artwork used over the Fuji scene, preserving its compact proportions, softly textured shading and nostalgic illustrated-storybook finish without regeneration drift. It is source/reference art only and is not loaded separately at runtime. The generated v1 front reference and v2 identity sheet are rejected explorations, not visual targets.

**Approved Ronin generation pack:** `apps/mobile/assets/ronin/reference/approved-storybook-v1/` contains the accepted side-neutral, rear, three-quarter, cat-turnaround and front/side expression outputs. Use these together with the canonical v3 side reference when expanding the pose library. They are generation/reference inputs rather than runtime assets; the rear and cat turnaround still need the documented geometry corrections before rigging.

**Approved Ronin structural pack:** `apps/mobile/assets/ronin/reference/approved-structural-v1/` contains approved front-rig, cross-legged, sleeping, working/journaling and celebration references. Its rear-rig image is retained as `rear-rig-needs-sword-correction.png` because the generated view incorrectly shows both an attached sword hilt and a separate scabbard/object in the Ronin's hand; do not rig that view until corrected.

**Approved Ronin activity pack:** `apps/mobile/assets/ronin/reference/approved-activities-v1/` contains approved tea-break, petting, reading and tired/comfort references. The stretching-with-gear image is a travel-stretch concept rather than the intended waking state, and the training-with-gear image must be regenerated without backpack or sword before defining the Workout rig. The corrected single-sword rear rig is `approved-structural-v1/rear-rig-corrected-approved.png`.

**Journey/Domains/Missions/Potential scoring:** Domain scores = live maintenance baseline (from linked `potential-stat` items) + a capped, decaying "achievement lift" from `domainContributions` rows; Overall Potential is a weighted average of Domain scores, weighted by the active `focus` item. Manually-added Achievements must call `setAchievementContributesToScore` to actually create their scoring row — `createAchievement` alone only stores the flag on the item, it does not touch `domainContributions` (fixed 2026-08-05 for the Achievements screen's retrospective add flow, which previously silently no-op'd). See `apps/mobile/SCHEMA.md` (canonical schema/formula reference) and `apps/mobile/src/utils/domainScoring.ts` (pure scoring math) before touching any of this.

**Active Rive rig work:** `RONIN RIG 1` in the Rive desktop app. **`apps/mobile/RONIN_RIVE.md` is the single source of truth** — scene graph, skeleton, IK, ViewModel contract, animations, state machine, interaction model. All earlier Ronin/Rive plans and specs (cloud rig `2478489`, the storybook manifest and its `Journey Controller` contract, v1–v4 art specs, the automation playbook and handoffs) have been **deleted and must not be revived**. Reusable technique learnings live in the `rive-character-rigging` skill's `LEARNING-LOG.md`. `RONIN RIG 1` has not been exported over `rka_journey_rig.riv` yet, so the shipping runtime is unchanged.

---

## Available Skills

### 🎨 Design & UX
- **ui-ux-pro-max** — AI-powered design intelligence: 67 UI styles, 161 color palettes, 57 font pairings, 99 UX guidelines, 25 chart types
  - *Use for:* UI design, layout, accessibility, animations, color/typography, component patterns
  - *Invoke when:* "Design X", "Choose colors for Y", "Review UX", "Fix spacing"

- **motion-framer** — Animation design patterns with Framer Motion
  - *Use for:* Smooth animations, motion design, transition patterns
  - *Invoke when:* "Add animation to X", "Make this feel more fluid"

- **emil-design-eng** — Design engineering patterns & practices
  - *Use for:* Design-to-code workflows, design systems, component libraries
  - *Invoke when:* "Build design system for X", "Convert design to components"

### 🔧 Development & Testing
- **test-driven-development** — TDD workflows and test-first implementation
  - *Use for:* Writing tests first, test coverage, test architecture
  - *Invoke when:* "Write tests for X", "TDD approach to Y"

- **systematic-debugging** — Structured debugging methodology
  - *Use for:* Debugging complex issues, root cause analysis, fixing bugs systematically
  - *Invoke when:* "Debug this issue", "Why isn't X working?"

- **subagent-driven-development** — Multi-agent workflow for complex tasks
  - *Use for:* Parallelizing work, delegating to specialized agents
  - *Invoke when:* "Handle X in parallel with Y", complex multi-step tasks

### 📋 Planning & Organization
- **writing-plans** — Implementation planning & architecture design
  - *Use for:* Step-by-step plans, complexity breakdown, implementation strategy
  - *Invoke when:* "How should we approach X?", "Plan the implementation of Y"

- **dispatching-parallel-agents** — Running multiple agents in parallel
  - *Use for:* Parallelizing independent queries/tasks
  - *Invoke when:* Need to do multiple things at once

- **organize-stem-libraries** — Library/dependency organization strategies
  - *Use for:* Organizing imports, dependencies, code structure
  - *Invoke when:* "Organize this codebase", "How should I structure X?"

### 💬 Communication & Efficiency (Caveman Skills)
- **caveman** — Terse communication style (fewer tokens, clear message)
- **caveman-commit** — Terse conventional commits with WHY focus
- **caveman-review** — One-line PR comments (location, problem, fix)
- **caveman-help** — Quick-reference cards and one-shot answers
- **caveman-stats** — Real session token usage receipts
- **caveman-compress** — Token compression techniques
- **cavecrew** — Guide on when to delegate to caveman subagents

### 🧠 Foundational Skills
- **notebooklm-skill-master** — NotebookLM integration
- **superpowers-main** — Core contributor guidelines
- **using-skills** — How to discover and use skills

### 🤖 Agent Types (Built-in)
- **Explore** agent — Fast read-only search for locating code by pattern/symbol
- **Plan** agent — Architecture & implementation planning
- **Codex-guide** — Questions about Codex, Agent SDK, Anthropic API
- **general-purpose** agent — Research, multi-step tasks, parallel queries

---

## Development Guidelines

### Code Style
- Prefer editing existing files over creating new ones
- No comments unless the WHY is non-obvious
- No unnecessary error handling for impossible scenarios
- Avoid premature abstractions (3+ similar lines is acceptable)
- Trust internal code and framework guarantees

App-specific conventions (component structure, styling strategy, theme tokens, testing) live in [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) — read that before touching `apps/mobile/`.

### Git & Commits
- Create NEW commits (don't amend unless explicitly asked)
- Prefix by type: `fix:`, `feat:`, `refactor:`, `chore:`, `test:`, `docs:`
- Use clear commit messages focused on WHY, not WHAT
- Include `Co-Authored-By: Codex Haiku 4.5 <noreply@anthropic.com>`

---

## 🚨 Multi-Agent & Developer Synchronization Protocol

Multiple AI agents (Claude, Codex, Antigravity, etc.) and developers work on this repository simultaneously across different sessions. **Strict adherence to documentation synchronization is MANDATORY.**

### 1. Continuous Documentation Updates (Zero Drift)
- **Immediate Doc Synchronization**: Whenever you change backend services, database schemas, component structures, libraries, or architectural patterns, you **MUST** update `AGENTS.md`, `apps/mobile/CLAUDE.md`, and `HANDOVER_SUMMARY.md` in the same turn before finishing your task.
- **Grep & Purge Stale References**: When retiring or replacing a stack component (e.g. Supabase -> Firebase), run a full repository grep search (`grep -rn -i "<old_term>" .`) and remove/update **ALL** references across all docs, specs, plans, and config files.
- **Single Point of Truth**:
  - `apps/mobile/CLAUDE.md`: Primary platform guide for mobile stack, components, and design system.
  - `AGENTS.md`: Global repo configuration, agent skills, and rules.
  - `HANDOVER_SUMMARY.md`: Session-by-session changelog and current system state.

### 2. Mandatory Session Handover Logging
- Before concluding any work session, update `HANDOVER_SUMMARY.md` with:
  1. Date & brief session title.
  2. Summary of changes made and files modified/created/deleted.
  3. Verified working state / test results.
  4. Immediate next steps for the next agent or developer.

### 3. Verification Before Action
- Never assume architecture or backend dependencies from memory or isolated doc snippets. Always inspect `package.json` and active code (e.g. `src/lib/`) to verify real code state before starting work.


---

## When to Use Each Skill

| Scenario | Skill | Trigger |
|----------|-------|---------|
| **Design & Layout** | `ui-ux-pro-max` | "Design X", "Choose colors", "Fix layout", "Review UX", "Improve contrast" |
| **Animations** | `motion-framer` | "Add animation to X", "Make this feel smooth", "Transition design" |
| **Testing** | `test-driven-development` | "Write tests for X", "TDD approach", "Test coverage" |
| **Debugging** | `systematic-debugging` | "Debug this bug", "Why isn't X working?", "Root cause analysis" |
| **Architecture** | `writing-plans` | "Plan the implementation", "Design the system for Y", "Break down X" |
| **Code Search** | `Explore` agent | "Find all uses of X", "Where is Y defined?", "Locate code pattern" |
| **Parallel Work** | `dispatching-parallel-agents` | "Do X and Y in parallel", "Handle multiple tasks" |
| **Design System** | `emil-design-eng` | "Build design system", "Create component library", "Design specs" |
| **Tool Questions** | `Codex-guide` | "How do I use X?", "What does feature Y do?" |

---

## Key Documentation

**Design & UX Reference:**
- `docs/design-system/` — The RKA.OS Design System: `reference/` (AI-facing tokens, components, iconography, motion, writing, decision log) and `handbook/` (human-facing visual tour). Start here before any styling work.

**Mobile App:**
- `docs/design/routines-and-habits-product-brief.md` — Concise product/architecture direction distilled from routine and habit-tracker research; Apple Health is documented but deferred
- `apps/mobile/CLAUDE.md` — Platform guide: stack, component structure, design patterns, known constraints, quick reference
- `apps/mobile/DESIGN_CHECKLIST.md` — Live, in-progress visual-refresh tracker (source of truth over its human-facing artifact mirror)
- `apps/mobile/THINGS_3_DESIGN.md` — Interaction pattern reference
- `apps/mobile/FLOWS.md` — Audit of what every tappable element actually does
- `apps/mobile/SCHEMA.md` — Data model reference
- `docs/superpowers/plans/2026-08-05-routines-quantified-habits.md` — Routines/quantified-habits implementation plan; both phases (quantified habits, routines) shipped
- `docs/migration/REACT_NATIVE_SETUP.md` — Full RN/Expo setup guide, architecture, file map

**Shared backend:**
- `firebase/` — Backend configuration for the shared Firebase backend used by the mobile app (`apps/mobile/src/lib/firebase.ts`, `backup.ts`)
- Native realtime Firestore sync is the live cross-device path. Snapshot backup (`pushBackup`) is intentionally manual/user-triggered only from Settings because serializing the full SQLite database (`items`, `itemInstances`, `activityLogs`, relations, settings) blocks the JS thread and must not run automatically during AppState background/cold-start transitions. Home cold start must render Today first; secondary task tabs and Logbook stay lazy until selected.

## Launcher

**RKA OS is managed by RKA Launcher** — a separate top-level project at `../rka-launcher/`.

The launcher (Tauri v2 macOS app) handles starting/stopping dev servers for this project and others. It is **not** part of this repo. To work on the launcher, open `../rka-launcher/` as a separate Codex session.

Registered in the launcher as:
- **RKA OS Mobile** — `npx expo start --go` on port 8081, path: `apps/mobile/`

The launcher may still have a stale **RKA OS (PWA)** entry left over from the *retired* Vite/Dexie PWA (not today's desktop web app, which isn't yet registered in the launcher at all) — that needs removing in a separate session against `../rka-launcher/`, since this repo can't edit it.
