# RKA OS - Claude Code Configuration

## Project Info

**RKA OS** is a personal operating system PWA built with React, Vite, and TypeScript. Local-first architecture using Dexie.js for IndexedDB storage. Mobile-first design with iOS safe-area handling.

**Stack:** React + Vite + TypeScript + Dexie.js + Lucide icons  
**Target:** Mobile-first PWA (iOS/Android)  
**Status:** Active development

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

### UI/Mobile-Specific
- Mobile-first responsive design
- iOS safe-area awareness (`env(safe-area-inset-*)`)
- Touch targets minimum 44×44pt
- Respect `prefers-reduced-motion` for animations
- Support Dynamic Type text scaling
- Test on actual devices or preview before claiming success

### Testing & Verification
- Always verify UI changes in the browser preview before finishing
- Test golden path AND edge cases
- Monitor for regressions in other features
- Use `preview_*` tools to verify visual changes

### Git & Commits
- Create NEW commits (don't amend unless explicitly asked)
- Prefix by type: `fix:`, `feat:`, `refactor:`, `chore:`, `test:`, `docs:`
- Use clear commit messages focused on WHY, not WHAT
- Include `Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>`

---

## Project Files & Conventions

### Key Directories
- `src/components/` - React components (organized by feature)
- `src/components/ui/` - UI primitives (buttons, sheets, modals, etc.)
- `src/db/` - Database schema, queries, and entity creation
- `src/pages/` - Page-level components
- `src/utils/` - Utilities (haptics, formatting, etc.)

### Naming Conventions
- **Components:** PascalCase (e.g., `InboxSheet.tsx`)
- **Files:** kebab-case for CSS (e.g., `primitives.css`)
- **Props/State:** camelCase
- **CSS Classes:** kebab-case with `rka-` prefix (e.g., `.rka-sheet-overlay`)

### Color & Design Tokens
- All colors use CSS custom properties (e.g., `var(--rka-blue)`, `var(--rka-bg)`)
- Spacing: 4dp/8dp incremental system
- Border radius: `var(--rka-radius-control)` (default), larger for containers
- Shadows: `var(--rka-shadow-soft)` (low emphasis), `.rka-shadow-elevated` (prominent)

### Component Patterns
- **Bottom Sheets:** Use `BottomSheet` primitive (not `NativeBottomSheet`)
- **Lists:** Use `ActionList` component with polymorphic Item model
- **Modals:** Use `Drawer` or `BottomSheet` depending on context
- **Icons:** Lucide React only (SVG, no emojis)

---

## Known Constraints & Lessons Learned

### iOS/Safari Quirks
- Flexbox on bottom nav requires `position: absolute` to prevent overscroll bounce
- Viewport units (`dvh`) needed for safe area calculations
- Bottom bar needs safe-area padding: `env(safe-area-inset-bottom)`
- Hide bottom nav when keyboard is active to prevent iOS layout shift

### Dexie.js & IndexedDB
- Queries are reactive via `useLiveQuery` hook
- Always await database operations (async/await)
- Item model is polymorphic (task, habit, medication, workout-template)
- Status field drives filtering: 'inbox' | 'active' | 'completed' | 'archived'

### Bottom Sheet Behavior
- **Don't use:** `NativeBottomSheet` with Vaul drawer (flex layout constraints)
- **Do use:** `BottomSheet` primitive for simpler, more reliable behavior
- **Sizing:** Set `minHeight` on content wrapper to ensure proper viewport expansion
- **Dismissal:** Ensure click-outside and Escape key handlers are always present
- **Scroll behavior:** Use `overscroll-behavior: contain` on scrollable content to prevent momentum bounce bubbling
- **iOS momentum:** Always include `-webkit-overflow-scrolling: touch` for native feel
- **See:** `SCROLL_BEHAVIOR.md` for detailed scroll handling patterns

### Layout & Spacing Rules
- **Page sections gap:** 12px (reduced from 28px for compact layout)
- **Section items gap:** 8px (`.rka-section`)
- **Time-of-day blocks:** 4px gap (ANYTIME/MORNING/AFTERNOON/EVENING must be tightly stacked)
- **Page padding:** 0px top, reduced bottom (reserved for nav safety area)
- **App header layout:** Profile icon (left) | RKA OS (center) | Sync status (right)
- **Bottom nav:** 4 items in pill + separate FAB (no profile icon in nav)
- **Page title:** 24px (not oversized, allows content to fit on screen)
- **Rule:** Entire home page must fit on screen without scroll when all sections collapsed
- **See:** `FIX_LOG.md` (Optimization #2) for complete spacing reference

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
- `RKA_UI_HANDBOOK.md` — Comprehensive 3300+ line handbook covering mobile, desktop, motion, haptics, polish, and project-level design rules

**Web PWA Guides:**
- `SCROLL_LIMITS.md` — Navigation scroll boundaries
- `IOS_BOTTOM_NAV.md` — iOS bottom navigation patterns
- `SCROLL_BEHAVIOR.md` — iOS/mobile scroll behavior
- `MOBILE_IMPLEMENTATION_GUIDE.md` — PWA mobile feature patterns
- `AUDIT_LOG.md` — Issue tracking
- `FIX_LOG.md` — Implementation details and fixes

**React Native Guides:**
- `docs/migration/REACT_NATIVE_SETUP.md` — Full setup guide, architecture, file map, what works where
- `docs/migration/MAINTENANCE_MODE.md` — PWA maintenance mode policy
- `docs/migration/SHARED_LOGIC.md` — How to keep shared logic in sync between platforms

## Launcher

**RKA OS is managed by RKA Launcher** — a separate top-level project at `../rka-launcher/`.

The launcher (Tauri v2 macOS app) handles starting/stopping dev servers for this project and others. It is **not** part of this repo. To work on the launcher, open `../rka-launcher/` as a separate Claude Code session.

Registered in the launcher as:
- **RKA OS (PWA)** — `npm run dev` on port 5173, path: this repo root
- **RKA OS Mobile** — `npx expo start --go` on port 8081, path: `apps/mobile/`

---

## Status: DUAL PLATFORM (TRANSITIONING)

**Primary:** React Native + Expo (iOS) — ACTIVE DEVELOPMENT
**Secondary:** PWA (Web/macOS) — MAINTENANCE MODE (bug fixes only, no new features)

### PWA (Web)
✅ Mobile navigation working (4+1 pill layout)
✅ App header reorganized (Profile | RKA OS | Sync)
✅ Inbox sheet fully functional with all items visible
✅ Bottom sheet dismissal (click, Escape) working
✅ Scroll behavior optimized (momentum, nested scrolls, overscroll)
✅ Safe area handling for iOS
✅ Home page layout compacted (fits on screen without scroll when collapsed)

### React Native (iOS) — `apps/mobile/`
✅ Expo SDK 54 project bootstrapped (Expo Go compatible)
✅ SQLite database (expo-sqlite) with full schema matching web app
✅ Home screen with real live data
✅ Inbox — add, activate, archive, delete with swipe + context menu
✅ Quick add via FAB (drops to inbox)
✅ Custom floating pill nav + FAB matching web design
✅ App header (Profile | RKA OS | Synced)
✅ Haptics on all interactions
✅ Push notifications + badge count
✅ Reanimated swipe gestures (spring physics)
✅ Background sync task (15min interval)
✅ Location permissions + geofencing service
✅ EAS build config (development/preview/production profiles)
✅ All iOS permissions declared in app.json
✅ Ronin 3D companion (real GLB, mood-driven, app-wide reusable — see `apps/mobile/CLAUDE.md` "Ronin 3D Companion"; currently visualized only in Profile "Me" bench while Fable 5 continues improving him)

### Next: EAS Development Build
⏳ Run `eas build --platform ios --profile development` (Xcode installed ✅, free Apple ID ✅)
⏳ HealthKit integration (`react-native-health` — needs dev build)
⏳ Calendar screen
⏳ Profile screen
⏳ Supabase sync wired to backgroundSync.ts
⏳ Deep links (`rkaos://` scheme)
⏳ @shopify/react-native-skia (charts/custom UI)
⏳ rive-react-native (micro-animations)
⏳ True background fetch (limited in Expo Go)
⏳ TestFlight / App Store distribution

---

## Quick Reference

- **Preview server:** Already running
- **Database:** Dexie.js (local IndexedDB)
- **Component library:** Lucide React icons only
- **CSS approach:** CSS custom properties (CSS variables) for theming
- **Responsive:** Mobile-first, test on 375px—1440px+
