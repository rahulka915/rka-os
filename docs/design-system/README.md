# RKA.OS Design System

The single source of truth for RKA.OS design decisions — what the app looks and behaves like today, and why.

## Two tracks, one set of facts

- **[`reference/`](reference/)** — the AI Master Design Library. Structured, current-state, prescriptive. Read this before styling anything. Written for agents (Claude, Codex, etc.) and for you when you want the exact spec.
- **[`handbook/`](handbook/)** — the Human Design Library. A short visual tour with screenshots, for browsing rather than implementing from. It narrates and links into `reference/` — it does not repeat the spec.

There is deliberately **one authoritative copy of each fact**, living in `reference/`. The handbook shows what things look like; it never re-states a token value or rule that could drift out of sync. This project already learned that lesson the hard way with `DESIGN_CHECKLIST.md`'s human-facing artifact mirror, whose checkbox state lives in browser localStorage and is known to drift from the real file — see the note at the top of that file. Don't recreate that problem here.

## Where things actually live

| Question | Look here |
|---|---|
| What's our primary blue / current tokens? | [`reference/tokens.md`](reference/tokens.md) |
| How should a card/list/sheet/nav behave? | [`reference/components.md`](reference/components.md) |
| When do we commission art vs. use a vector glyph? | [`reference/iconography.md`](reference/iconography.md) |
| What spring/timing values do we actually use? | [`reference/motion.md`](reference/motion.md) |
| What's our voice/tone, empty-state copy style? | [`reference/writing.md`](reference/writing.md) |
| Reusable prompts for generating on-style assets | [`reference/prompt-library.md`](reference/prompt-library.md) |
| Why did we choose X over Y? When? | [`reference/decision-log.md`](reference/decision-log.md) |
| What does it actually look like right now? | [`handbook/00-overview.md`](handbook/00-overview.md) |
| What's still in progress / not yet settled? | [`apps/mobile/DESIGN_CHECKLIST.md`](../../apps/mobile/DESIGN_CHECKLIST.md) |
| Interaction patterns (capture sheets, lists, toolbars) | [`apps/mobile/THINGS_3_DESIGN.md`](../../apps/mobile/THINGS_3_DESIGN.md) |
| Branded-art inventory | [`docs/design/RKA_CUSTOM_ICON_AUDIT.md`](../design/RKA_CUSTOM_ICON_AUDIT.md) |

## The three lifespans — how this stays current instead of rotting

1. **In-progress / volatile** — `apps/mobile/DESIGN_CHECKLIST.md`. Today's work-in-progress tracker for the visual refresh. Churns constantly. Not meant to be read as history — it's a checklist, not an archive.
2. **Stable / current-state** — everything under `reference/` (except the decision log). "How RKA.OS looks and behaves right now." When something changes, this gets *replaced*, like code — not appended to like a diary.
3. **Historical / append-only** — `reference/decision-log.md`. "Why we chose X over Y, and when." Never edited, only appended to.

### The promotion rule

When a row in `DESIGN_CHECKLIST.md` flips from unstable/in-review to genuinely settled (reviewed and restyled against current tokens, not just discussed), its content graduates into the matching `reference/*.md` file. The checklist row can then shrink to a one-line status instead of carrying full rationale forever. If the settled decision involved real deliberation or a rejected alternative (e.g. a color scheme tried and reverted), add a short entry to `decision-log.md` at the same time.

This is the only mechanism that matters for keeping this useful two years from now: the checklist stays lean because it's temporary, the reference stays accurate because it's replaced not accumulated, and the rationale survives because it's logged once and never touched again.

## What's intentionally not here

Token *values* are not duplicated as prose beyond what's needed to explain them — `reference/tokens.md` links to the actual source files (`apps/mobile/src/theme/colors.ts`, `spacing.ts`, `apps/mobile/tamagui.config.ts`) as the literal source of truth. If a value in `reference/tokens.md` and the code ever disagree, the code is right and the doc needs fixing, not the other way around.

Interaction patterns already documented in `THINGS_3_DESIGN.md` aren't repeated in `reference/components.md` — that file links out instead.

The old companion PWA (and its docs — `SCROLL_LIMITS.md`, `FIX_LOG.md`, etc.) has been fully retired; this design system covers the native iOS app's tokens. It does not cover `apps/mobile/src/webApp/`'s desktop web app, which is a different, current, still-active target with its own separate theme (`theme/webTheme.ts`) — see `apps/mobile/CLAUDE.md`'s "Desktop Web App" section.
