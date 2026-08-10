# Harada Setup Walkthrough — Design + Plan

**Status:** Approved, implementing in same pass.
**Scope:** First-launch guided setup for the Domains/Missions/Potential Stats/Focus model shipped 2026-08-04 (see `HANDOVER_SUMMARY.md`). No new DB schema — this is a new screen sequence over existing `database.ts` functions.

## Decisions (from brainstorming)

- **Coverage:** full model in one flow — Domains, then per-Domain Mission + Potential Stat, then Focus.
- **Trigger:** first launch only, when `getItemsByType('area').length === 0`. Skippable at any point. Re-runnable later via a "Redo Setup" row in Settings.
- **Depth:** deeper educational framing — each step opens with 1-2 sentences of plain-language context before the form.
- **Domain seeds:** curated suggestion chips (Health, Career, Relationships, Finances, Craft, Mind), tap to select/deselect, plus "+ Add custom". Selecting creates the real `area` item immediately on continue.
- **Flow shape:** per-Domain loop — after Domains are chosen, step through each one asking for an optional Mission and an optional Potential Stat before advancing, ending with a single Focus step.
- **Required fields:** Mission and Potential Stat are both skippable per Domain (`AreaDetailScreen` already supports adding either later).
- **Visual language:** matches the app's real assets, not a generic flat wizard — full-bleed cinematic hero art (`hero-dawn.png`) on the intro, real `KatanaProgress` component for the closing potential preview, existing icon system (`react-native-heroicons` outline set, matching `SettingsScreen`/`ProfileScreen` conventions) for chip/card glyphs since bespoke Domain-glyph PNG art (torii/cherry-blossom/coin-stack/crane) is out of scope for this pass — flagged below as a follow-up.

## Follow-up (not in this pass)

- Commission a matching Domain-glyph icon set (torii gate, cherry blossom, coin stack, origami crane, etc.) in the same rendered-3D style as `icons/collections/*.png`, to replace the heroicon-outline stand-ins on the chip/card/focus rows.

## Implementation plan

1. `apps/mobile/src/icons.tsx` — add `Briefcase`, `Users`, `Banknotes`, `PuzzlePiece`, `ChartBar`, `Star`, `Trophy` heroicon re-exports for the new screen (Flag already exists).
2. `apps/mobile/src/screens/OnboardingScreen.tsx` — new screen, local step state machine (`intro` → `domains` → `loop` → `focus`):
   - `intro`: `hero-dawn.png` full-bleed header + framing copy, Skip / Begin.
   - `domains`: suggested chips (label + icon) tap-to-select + inline custom-add field; Continue creates one `area` item per selection via `createItem('area', title)`.
   - `loop`: iterates the created Domains one at a time; per Domain, optional Mission title (→ `createItem('project', title, 'active')` + `setRelation(id, 'area', domainId)`) and optional Potential Stat title (→ `createPotentialStat(title, domainId)`), each with its own Skip; Next Domain / auto-advance to `focus` after the last.
   - `focus`: radio list of the created Domains + "Skip — equal weighting"; selecting one and finishing calls `setFocus('<Domain> Focus', { [domainId]: 2 })`; skipping calls nothing. Shows a live `KatanaProgress` preview of `computeOverallPotential()`.
   - Skip button on any step exits immediately (`navigation.reset` to `Main`) without discarding whatever was already created — matches the skippable-per-field decision.
3. `apps/mobile/App.tsx` — register `RootStack.Screen name="Onboarding"`; compute `needsOnboarding` once at boot (`getItemsByType('area').length === 0`) and set it as `RootStack.Navigator`'s `initialRouteName` when true.
4. `apps/mobile/src/screens/SettingsScreen.tsx` — add a "Redo Setup" row under the DATA section navigating to `Onboarding`.
5. Update `apps/mobile/SCHEMA.md` / `HANDOVER_SUMMARY.md` per the multi-agent doc-sync rule (no schema change, but a new user-facing entry point worth recording).

## Testing

No new pure logic beyond existing `database.ts`/`domainScoring.ts` functions (already covered by `domainScoring.test.ts` / `potential.test.ts`). Verification is `npx tsc --noEmit` + on-device walkthrough of: fresh-install trigger, chip selection, per-domain skip vs. fill, Focus selection, and Settings → Redo Setup re-entry.
