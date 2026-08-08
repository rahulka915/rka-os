---
target: Home screen
total_score: 22
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 2
timestamp: 2026-08-08T07-31-46Z
slug: apps-mobile-src-screens-homescreen-tsx
---
Method: dual-agent (A: home-design-review · B: home-technical-evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Completion has haptics + a timed disc animation but no persisted confirmation; medication "Take" gives no visible log confirmation beyond a haptic buzz. |
| 2 | Match System / Real World | 3 | Standard GTD vocabulary (Today/Upcoming/Anytime/Someday/Logbook); "Overall Potential" is coined but is the product's actual mechanic, not jargon for its own sake. |
| 3 | User Control and Freedom | 2 | No undo after complete/delete/move-to-someday (`HomeScreen.tsx:141-190`, all fire-and-refresh). Delete has zero confirmation. |
| 4 | Consistency and Standards | 3 | Row components share `LacquerDiscControl`/typography/44pt targets consistently. One split: Today uses drag-reorder, the other three task tabs use long-press action sheet — same-looking rows, two gesture vocabularies. |
| 5 | Error Prevention | 2 | Delete fires immediately from an action sheet with no second gate. Medication dosing has a good "too soon" override guard — a precedent not extended to destructive task actions. |
| 6 | Recognition Rather Than Recall | 3 | Chips/icons are visible and labeled. Minor: the Journey card's tap-to-react has no visible affordance beyond an accessibility hint. |
| 7 | Flexibility and Efficiency | 2 | No swipe-to-complete/delete (the Things-3 gesture this app cites as its own reference), no bulk actions. Drag reorder + up/down buttons on Today is a genuine accessibility strength, though. |
| 8 | Aesthetic and Minimalist Design | 3 | Individually restrained (empty widgets render `null`), but the Today view stacks 5 units before the task list — a lot of weight ahead of the ostensibly primary content. |
| 9 | Error Recovery | 2 | No undo surface anywhere reviewed; recovering from a wrong tap means reopening the item and manually reverting status, with no visible hint that's possible from Home. |
| 10 | Help and Documentation | n/a | Single-user, self-built app — no help system is correct here, not a gap. |
| **Total** | | **22/36** | **Acceptable (61%) — functional and coherent, but undo/confirmation/error-recovery is underbuilt relative to how many write paths Home exposes (complete, delete, reorder, move-to-someday, log medication, log habit).** |

## Design Specificity Verdict

**LLM assessment**: Grounded in this product, not a generic wrapper. The Ronin journey hero, the sunset-trail art, the walker rig, the shared River Stone chip material across both tab systems, and the Domain/Potential/Focus strip are all specific to RKA OS's confirmed Moonly/River-Stone/Ronin brand commitment — none of it would drop unchanged into another app. No stock card grid, no generic icon set. This is authored work.

**Deterministic scan**: No web detector applies (native RN source, no HTML/CSS/browser target) — Assessment B ran a manual technical pass instead. It found: 3 hard accessibility-label gaps (the Upcoming "View all" row, the Today/Upcoming segment, the 5 view chips all lack role/state), one unambiguous Reduce Motion violation (`HomeScreen.tsx:265` forces `ReduceMotion.Never` on every tab-switch fade with no check of the user's actual system setting — inconsistent with the correct handling in the same screen's own `RoninJourneyPrototype.tsx`), and a concentration of hard-coded hex/no-dark-mode-branching in the Journey hero card specifically (7 literals, isolated to that one component — everywhere else on Home pulls consistently from `getThemeColors`). Touch targets were checked and found compliant everywhere (`LacquerDiscControl`, `DragHandleButton`, `HabitHoldButton` all meet or exceed 44pt) — a genuine strength, not just an absence of problems. No false positives from the detector side since there was no detector; the technical pass flagged its own judgment calls explicitly (see below).

## Overall Impression

The Journey hero is real brand differentiation and the row-level interaction craft (drag handles, accessibility actions, haptic discipline) is well above average for a personal project. But Home's actual job — "what do I do next" — is buried under its own front matter: a 270px animated hero, a data-readout strip, and two widgets all sit above the task list, on the screen you land on more than any other. Combined with zero undo/confirm on any destructive action, the biggest opportunity here isn't more polish on what exists, it's reordering what's already built and adding one cheap safety net (an undo toast) that would fix the power-user speed complaint and the safety gap simultaneously.

## What's Working

1. **The Journey hero is genuine differentiation, not decoration** — real data (completion ratio, potential percent) drives an emotionally resonant visual metaphor, with accessibility handled correctly (Reduce Motion checked and honored, full labels/hints).
2. **Empty states are deliberately invisible, not defaulted** — `HabitsWidget`/`MedicationQuickLogWidget` return `null` rather than an empty card shell, a considered anti-clutter call that works.
3. **Row-level consistency and touch-target discipline** — every row on Home shares `LacquerDiscControl`, the 44pt minimum, and a consistent badge system; all three custom controls checked (disc, drag handle, habit-hold) meet or beat the 44pt floor.

## Priority Issues

**[P1] No confirmation before destructive delete**
- Why it matters: `HomeScreen.tsx:184-190` fires `deleteItem(item.id)` straight from an action-sheet tap, no second gate. A mis-tap in a fast action-sheet flow (thumb, on the go) permanently removes a task with no recovery path visible from Home.
- Fix: add a confirm step for delete specifically (the app already has this exact pattern for medication "too soon" overrides — reuse it), or ship the undo toast below and treat that as the safety net instead of a blocking confirm.
- Suggested command: `/impeccable harden`

**[P1] No undo affordance anywhere on Home**
- Why it matters: complete, delete, and move-to-someday are all fire-and-refresh (`HomeScreen.tsx:132-190`). This is the heuristic 3/9 gap and it compounds issue 1 — completing or deleting the wrong item (easy in a reordered list) has no visible way back except reopening the item and manually reverting status, which most users won't know is possible.
- Fix: a lightweight "Undo" toast/snackbar after complete/delete/move — standard iOS pattern, cheap relative to the exposure (six write paths on one screen: complete, delete, reorder, move-to-someday, log medication, log habit).
- Suggested command: `/impeccable harden`

**[P2] Visual hierarchy inverts stated priority**
- Why it matters: the Journey hero and Potential/Focus strip outrank the actual task list in both position and visual weight, on the screen whose core job is task triage. Every single open of Home (per the Owner persona, dozens/day) scrolls past two ambient/meta widgets before reaching the primary content.
- Fix: reconsider stacking order, or make the hero collapsible after first view of the day so repeat opens go straight to the list.
- Suggested command: `/impeccable layout`

**[P2] Two independent, simultaneously-visible tab systems**
- Why it matters: `HomeScreen`'s 5 view-chips and `TodayCard`'s own internal Today/Upcoming segment are separate state machines that both use "Today"/"Upcoming" language — a user can be on the outer "Today" chip while the inner segment shows "Upcoming," looking at upcoming items while the outer nav implies Today. Genuine "which mode am I in" recognition risk.
- Fix: either merge into one selector, or visually/semantically differentiate the two so they don't read as the same control twice.
- Suggested command: `/impeccable layout`

**[P2] Interaction-model split between Today and the other three task tabs**
- Why it matters: Today uses drag-to-reorder with no long-press menu; Anytime/Someday/Upcoming use long-press → action sheet with no drag. Same-looking rows, two different gesture vocabularies depending on which chip is active — a consistency violation a user will trip over by expectation transfer.
- Fix: decide deliberately whether "Today is curated, others are filtered views" is the intended rule, and if so make the visual affordance (e.g. drag handle presence/absence) communicate that distinction rather than leaving it implicit.
- Suggested command: `/impeccable layout`

**[P2] Reduce Motion forced off on tab-switch fade**
- Why it matters: `HomeScreen.tsx:265` passes `ReduceMotion.Never` to the `FadeIn` on every view-chip switch with no check of the user's actual system Reduce Motion setting — the opposite of what that setting should do, and inconsistent with the same screen's own `RoninJourneyPrototype.tsx`, which checks and honors it correctly one component away.
- Fix: read `AccessibilityInfo.isReduceMotionEnabled()` (already used elsewhere on this screen) and branch the transition accordingly, or drop the explicit `reduceMotion` override and let the default system behavior apply.
- Suggested command: `/impeccable harden`

**[P3] Missing accessibility roles/state on custom tab controls**
- Why it matters: the 5 view chips and the Today/Upcoming segment (`HomeScreen.tsx:239-260`, `TodayCard.tsx:126-144`) have no `accessibilityRole`/`accessibilityState={{selected}}` — VoiceOver reads the label but never which one is active. The Upcoming "View all" row also lacks a role/label beyond its raw text.
- Fix: add `accessibilityRole="tab"` + `accessibilityState={{ selected }}` to both chip sets, and a proper label to the "View all" row.
- Suggested command: `/impeccable harden`

## Persona Red Flags

**Alex (Power User — the actual and only user)**
- No swipe-to-complete/swipe-to-delete anywhere, despite Things 3 being this app's own explicitly cited interaction reference — every non-Today action is long-press → wait for sheet → tap, three touches deep versus the one-swipe pattern Alex would expect.
- No bulk actions — completing 5 tasks means 5 separate disc taps, each waiting out `LACQUER_DISC_COMPLETION_DURATION`.
- Delete is fast to reach but unrecoverable, and undo doesn't exist anywhere — the two failure modes are backwards from what a power user wants (fast delete is fine *if* undo exists).

**Casey (Distracted, one-handed, on the go)**
- The actually-actionable content (task list) sits at the bottom of a long stack (hero → strip → med widget → habits → task card), outside comfortable one-handed thumb reach on first landing.
- The view-chip row is a plain horizontal `ScrollView` under the header with no confirmed "next chip peeking" treatment — on a 5-second glance, overflow past Logbook is easy to miss entirely.
- Medication logging nests widget → action sheet → alert → possible second override alert with no mid-flow state persistence — an app-switch interruption mid-sequence means starting over.

**The Owner (project-specific, from PRODUCT.md's single-user framing)**
- Checks Home dozens of times a day as an actual life dashboard. The Journey/Potential front matter is delightful the first few opens but becomes pure scroll-tax at that frequency, with no way to collapse or reprioritize it — notably, the reorder infrastructure (`useHapticReorder`) already exists for tasks but was never pointed at Home's own section order.

## Minor Observations

- `HomeScreen.tsx:216-238`'s Logbook row (`renderSimpleRow`) duplicates styling that already exists in `HomeTaskRow`/`TodayTaskRow` instead of reusing it — a consistency-drift risk as the shared rows evolve and this one doesn't.
- `MedicationQuickLogWidget` is boxed at `width:'31%'` with a comment noting "3 square widgets fit side by side," but only one ever renders — leaves visible dead space reading as an unfinished layout.
- `JourneySummaryStrip`'s all-caps 800-weight "OVERALL POTENTIAL" label is noticeably heavier than any other text on Home (rows use 600) — worth checking against the design system's stated hierarchy.
- Empty-state copy register is inconsistent: Today's "Nothing to do today / Enjoy the calm" is warm; Upcoming/Anytime/Someday/Logbook's "Nothing here." is flat, in the same screen.
- Habit completion has the same no-undo gap as task completion, for the same reason.

## Questions to Consider

- If the Journey hero and Potential strip are a *daily check-in* rather than persistent chrome, what would it look like to let them collapse after the first view of the day, so the 500th daily open shows the task list first?
- `useHapticReorder`/`DragHandleButton` already exist and are wired into Today's list — was leaving the other three task tabs on long-press-only a deliberate "Today is curated, others are filtered views" decision, or incidental per-PR scope?
- Is zero-confirm, zero-undo delete the actual intended trust model for a single-user app, or would one cheap undo toast — reused everywhere on Home — resolve both the speed want and the safety gap at once?
