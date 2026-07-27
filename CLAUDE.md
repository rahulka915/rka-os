# RKA OS - Claude Code Configuration

## Project Info

**RKA OS** is a personal operating system app. It ships as a native iOS app built with React Native + Expo, living at `apps/mobile/` — see [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) for the platform-specific guide (stack, component structure, design patterns, known constraints).

The project previously also shipped a Progressive Web App (Vite + React + Dexie.js at repo root); that PWA has been fully retired now that the mobile app covers everything it did. This root `CLAUDE.md` only covers repo-wide concerns (skills, git conventions, docs index, shared backend); all app-specific guidance lives in `apps/mobile/CLAUDE.md`.

**Status:** Active development (mobile only)

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
- **claude-code-guide** — Questions about Claude Code, Agent SDK, Anthropic API
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
- Include `Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>`

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
| **Tool Questions** | `claude-code-guide` | "How do I use X?", "What does feature Y do?" |

---

## Key Documentation

**Design & UX Reference:**
- `docs/design-system/` — The RKA.OS Design System: `reference/` (AI-facing tokens, components, iconography, motion, writing, decision log) and `handbook/` (human-facing visual tour). Start here before any styling work.

**Mobile App:**
- `apps/mobile/CLAUDE.md` — Platform guide: stack, component structure, design patterns, known constraints, quick reference
- `apps/mobile/DESIGN_CHECKLIST.md` — Live, in-progress visual-refresh tracker (source of truth over its human-facing artifact mirror)
- `apps/mobile/THINGS_3_DESIGN.md` — Interaction pattern reference
- `apps/mobile/FLOWS.md` — Audit of what every tappable element actually does
- `apps/mobile/SCHEMA.md` — Data model reference
- `docs/migration/REACT_NATIVE_SETUP.md` — Full RN/Expo setup guide, architecture, file map

**Shared backend:**
- Firebase (Auth + Firestore) is the shared backend for sync/backup and the AI assistant — see `apps/mobile/src/lib/firebase.ts`, `services/backupSync.ts`, `services/ai/assistant.ts`. The `supabase/` directory at repo root is a leftover from a prior backend and is no longer wired up to the app.

## Launcher

**RKA OS is managed by RKA Launcher** — a separate top-level project at `../rka-launcher/`.

The launcher (Tauri v2 macOS app) handles starting/stopping dev servers for this project and others. It is **not** part of this repo. To work on the launcher, open `../rka-launcher/` as a separate Claude Code session.

Registered in the launcher as:
- **RKA OS Mobile** — `npx expo start --go` on port 8081, path: `apps/mobile/`

The launcher may still have a stale **RKA OS (PWA)** entry from before the web app was retired — that needs removing in a separate session against `../rka-launcher/`, since this repo can't edit it.
