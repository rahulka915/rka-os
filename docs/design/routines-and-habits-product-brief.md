# Routines and Quantified Habits — Product Brief

This note captures the useful ideas from the supplied Routinery and habit-tracker screenshots. It is product direction, not a detailed implementation plan.

## What fits RKA

### Routines

- Reusable routines made from ordered, individually timed steps.
- A focused player showing one step at a time, with pause, complete, skip, add time and optional auto-next.
- Quick step creation and drag reordering.
- Durable sessions that survive backgrounding or relaunch and produce useful history.
- Later: reminders and an iOS Live Activity for the current step and remaining time.

Routines should be a first-class domain. Do not model them as Missions: Missions carry Harada Method and Potential semantics. A checklist is also insufficient because routine steps need order, timing, reuse and session state. The user-facing name can be decided later; use `routine` internally until then.

### Habits

- Keep binary habits, then add manual `count` and `duration` measurement.
- Support build/quit intent and daily, weekly, monthly or custom target periods.
- Show direct current/target progress and use a contextual action: mark done, add one or enter a value.
- Keep completion reversible and allow an optional completion memo.
- Add restrained weekly/monthly history rather than a dense analytics dashboard.
- Reminders and preferred time windows should use progressive disclosure.

The existing fast completion flow must remain fast. Advanced settings belong behind optional rows or sheets, not in one large form.

## Architectural direction

- Store routine templates and ordered routine steps separately from live routine sessions.
- A live session needs status, current step, timing and accumulated progress; step/session events should be recorded in activity history.
- Extend habit metadata with intent, measurement type, target value/unit, target period and preferred completion action.
- Store manual numeric samples in activity history with value, unit and source, then calculate period progress from those samples.
- Habit progress may contribute through the existing Potential-stat relationship. Routine completion should not affect Potential automatically, or it risks double-counting linked habits/tasks.

## Suggested order

1. Manual quantified habits: binary/count/duration, period targets, contextual controls, undo and basic history.
2. Core routines: templates, ordered timed steps, foreground player, pause/skip/complete/auto-next and durable session logs.
3. Reminders, Live Activity and more polished review views.

## Explicitly deferred

- Apple Health / HealthKit-derived habits. Keep it in the long-term model, but do not add Health dependencies, permissions, synchronization or UI in the first implementation. The existing exploratory plan is `docs/superpowers/plans/2026-08-01-healthkit-steps-integration.md`.
- Apple Watch, voice guidance, location triggers, generated routine suggestions, advanced alerts and ambient audio.

## Product and design guardrails

- Borrow the reference apps' interaction ideas, not their visual style.
- Use RKA's current River Stone surfaces, warm ivory text, brass structure and restrained vermilion emphasis.
- Prefer sensible defaults and progressive disclosure.
- Preserve reversible logging and avoid duplicate Potential credit.
- Sessions must recover safely after interruption.
- Keep Apple Health out of the initial implementation.

