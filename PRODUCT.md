# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Single user: the developer/owner themselves. RKA OS is a personal operating system, not a multi-tenant or public product — there is no other audience to design for today. Product decisions optimize for the owner's own workflows and taste, not broad accessibility to unknown users, though baseline accessibility (Reduce Motion, VoiceOver on interactive controls) is still honored where already implemented.

Secondary, later possibility (unconfirmed, not a current design driver): the owner may open this to other users eventually. Nothing should be designed around that yet.

## Product Purpose

A unified personal "life operating system" tying together tasks, habits, routines, workouts, medications, and life-domain tracking under one coherent system, instead of separate single-purpose apps (a to-do app, a habit tracker, a workout log, a med reminder) that don't talk to each other. Success is the owner actually using it as their single source of truth for what to do and how they're doing across every area of their life.

## Positioning

Not a task manager with extra widgets bolted on. The differentiating mechanism is the Domains/Missions/Potential-Stat scoring model: every habit, routine, mission, and achievement can feed a scored "Domain" (an area of life — Health, Career, Finance, etc.), rolling up into an "Overall Potential" figure and a Harada-wheel-style visualization. A generic to-do app or habit tracker has no equivalent of this cross-cutting maintenance/achievement scoring layer, and no equivalent of the Ronin companion that visualizes daily progress.

## Operating Context

- Primary surface: native iOS app (React Native + Expo, EAS dev-client build on the owner's physical iPhone).
- Secondary surface: a desktop web app (Expo web) sharing the same SQLite-backed data layer but with its own navigation model (Sidebar + DetailPanel) and screens — actively developed but with partial screen parity to iOS, and treated as a genuinely separate surface with its own conventions, not a resized copy of the iOS UI.
- Data lives entirely on-device (SQLite via expo-sqlite); Firebase (Auth + Firestore) exists for backup/sync and an AI assistant layer, not as the primary datastore.
- Used throughout the day, in short bursts, across varied contexts (daily task/habit check-ins, workout logging mid-session, medication logging on a schedule, weekly domain/potential review).

## Capabilities and Constraints

- Domains: task/habit/project ("Mission") management, routines (step-based, timed sessions), quantified habits (count/duration, not just binary), workout templates + session logging with trend charts, medication tracking with dose history and an optional focus-curve timeline, a Skills layer distinct from Domains, and the Domains/Achievements/Potential scoring system described above.
- Undecided/open: whether and when this becomes multi-user; not a current constraint to design around.
- Expo managed workflow only — no ejecting, no custom native modules; native capability additions go through Expo's own native modules (Rive, Skia, HealthKit, etc.) and require a dev-client rebuild.

## Brand Commitments

- **Interaction pattern**: follows Things 3's UX conventions (bottom-anchored capture sheets, flat minimal lists, circle checkboxes, single-row toolbars, swipe/long-press affordances) — this is a binding interaction reference, not just a starting point.
- **Visual identity**: an actively-evolving Moonly/River-Stone/Ronin-inspired visual language, deliberately distinct from Things 3's own visual style — "Things 3 feel, not Things 3 look." The two must not be merged into a single Things-3-styled appearance; interaction patterns and visual language are treated as separate, independently-owned layers.
- Ronin (a companion character, currently a Rive-driven state machine on Home) and the River Stone / Enso / Stepping Stones progress components are established, named identity elements of the visual language — not generic UI to be redesigned away casually.
- Current tokens, motifs, and per-component visual status are tracked live in `apps/mobile/DESIGN_CHECKLIST.md`, which is the source of truth over any static description of "current" visual state (including this file).

## Evidence on Hand

- Full existing native + web codebase as ground truth for current UI, interaction, and data model.
- `apps/mobile/DESIGN_CHECKLIST.md` — live visual-refresh tracker (per-component status).
- `apps/mobile/THINGS_3_DESIGN.md` — interaction pattern reference.
- `apps/mobile/FLOWS.md` — audit of what every tappable element actually does.
- `docs/design-system/` — settled design-system reference (AI-facing tokens/components) and a human-facing handbook.
- No customer testimonials, case studies, press, or third-party evidence exist or are needed — single-user product.

## Product Principles

1. One coherent system beats several disconnected single-purpose apps — every new feature should strengthen the cross-domain model, not become an isolated silo.
2. Interaction fluency (Things 3-grade capture speed, native-feeling gestures, no friction added to quick capture) outranks visual novelty.
3. Visual identity (Moonly/Ronin/River-Stone) is allowed to be distinctive and expressive precisely because interaction patterns stay disciplined and familiar — the two layers protect each other.
4. Native iOS is the primary design target; the desktop web app is a genuine second surface with its own idiom, not a constraint on the native design.
5. Built for and validated against one real user's actual daily use, not hypothetical broad-audience needs — trust the owner's own judgment over generic best-practice defaults when they conflict.

## Accessibility & Inclusion

No specific external accessibility requirement (single known user). Existing implementation already respects system Reduce Motion and provides VoiceOver accessibility actions on custom gesture controls (e.g. drag-reorder handles) — maintain that baseline going forward rather than treating it as optional polish.
