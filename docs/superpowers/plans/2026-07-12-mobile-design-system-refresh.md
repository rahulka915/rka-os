# Mobile Design System Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single maroon/silvery-blue accent system with a 4-color palette (Silver, Deeper Blue, Pastel Pink, Bridging Purple), richen the dark-mode background tones, add shared line-height/letter-spacing typography tokens, and migrate hardcoded hex colors that bypass the token system.

**Architecture:** Token-first change. `apps/mobile/src/theme/colors.ts` is the single source of truth consumed via `getThemeColors(isDark)` across ~28 files — updating it cascades the new palette everywhere `palette.primary` / `palette.blue` is used. A handful of files hardcode old hex values directly (bypassing the token) and need individual fixes. No component structure, layout, or interaction pattern changes.

**Tech Stack:** React Native, Expo SDK 54, TypeScript, StyleSheet (no styling library).

## Global Constraints

- Light mode background/surface tones (`#f6f5f1` / `#ffffff`) stay unchanged — only dark mode bg/surface shift.
- `primary` maps to Deeper Blue (`#2b7ff0`) in **both** light and dark mode — this replaces the old light=maroon / dark=silvery-blue split.
- Orange (`colors.orange`) is unrelated to this refresh and must not change — it's used for its own semantic meaning in `CalendarScreen`, `MedicationsScreen`, `PersistentTimerBanner`.
- Green/red functional colors are unchanged.
- Ronin 3D companion theming (`src/domain/ronin/moodConfig.ts`) is explicitly out of scope per the design spec — do not touch it.
- Font sizes in `fontSize` (spacing.ts) are unchanged — only line-height and letter-spacing are new tokens.

---

### Task 1: Update color tokens with the new palette

**Files:**
- Modify: `apps/mobile/src/theme/colors.ts`

**Interfaces:**
- Produces: `colors.silver`, `colors.silverSoft`, `colors.deeperBlue`, `colors.deeperBlueSoft`, `colors.pink`, `colors.pinkSoft`, `colors.purple`, `colors.purpleSoft` (added to both `colors` and `darkColors` objects — same values in both modes per the spec, except `bg`/`surface`/`surfaceRaised` in dark mode). `themeColors.primary` / `darkThemeColors.primary` both resolve to the new deeper blue. `getThemeColors(isDark)` signature is unchanged.
- Consumes: nothing (this is the foundation task).

- [ ] **Step 1: Replace the full contents of `colors.ts`**

```typescript
export const colors = {
  bg: '#f6f5f1',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: 'rgba(255,255,255,0.94)',
  surfaceHover: 'rgba(0,0,0,0.035)',
  fill: 'rgba(118,118,128,0.12)',
  fillStrong: 'rgba(13,13,13,0.08)',
  separator: 'rgba(60,60,67,0.16)',
  separatorStrong: 'rgba(60,60,67,0.24)',
  backdrop: 'rgba(0,0,0,0.42)',
  handle: 'rgba(60,60,67,0.18)',
  iconMuted: 'rgba(13,13,13,0.32)',

  text: '#1c1c1e',
  textSecondary: 'rgba(60,60,67,0.66)',
  textTertiary: 'rgba(60,60,67,0.42)',
  textMuted: 'rgba(60,60,67,0.52)',

  // Accent palette — silver (neutral/secondary), deeper blue (primary),
  // pastel pink (warm accent), bridging purple (balances blue and pink).
  // Same hex values in light and dark mode; only bg/surface differ by mode.
  silver: '#808080',
  silverSoft: 'rgba(128,128,128,0.12)',
  deeperBlue: '#2b7ff0',
  deeperBlueSoft: 'rgba(43,127,240,0.12)',
  pink: '#ffb8d1',
  pinkSoft: 'rgba(255,184,209,0.14)',
  purple: '#d4a8ff',
  purpleSoft: 'rgba(212,168,255,0.14)',

  green: '#34a853',
  greenSoft: 'rgba(52,168,83,0.14)',
  red: '#ff3b30',
  redSoft: 'rgba(255,59,48,0.12)',
  orange: '#ff9500',
  orangeSoft: 'rgba(255,149,0,0.14)',
} as const;

export const darkColors = {
  bg: '#0f0f1a',
  bgElevated: '#1a1a2e',
  surface: '#1a1a2e',
  surfaceRaised: 'rgba(26,26,46,0.94)',
  surfaceHover: 'rgba(255,255,255,0.06)',
  fill: 'rgba(255,255,255,0.05)',
  fillStrong: 'rgba(255,255,255,0.10)',
  separator: 'rgba(255,255,255,0.08)',
  separatorStrong: 'rgba(255,255,255,0.16)',
  backdrop: 'rgba(0,0,0,0.55)',
  handle: 'rgba(255,255,255,0.18)',
  iconMuted: 'rgba(255,255,255,0.38)',

  text: '#f2ede6',
  textSecondary: 'rgba(242,237,230,0.64)',
  textTertiary: 'rgba(242,237,230,0.40)',
  textMuted: 'rgba(242,237,230,0.52)',

  silver: '#c5c5c5',
  silverSoft: 'rgba(197,197,197,0.14)',
  deeperBlue: '#2b7ff0',
  deeperBlueSoft: 'rgba(43,127,240,0.16)',
  pink: '#ffb8d1',
  pinkSoft: 'rgba(255,184,209,0.16)',
  purple: '#d4a8ff',
  purpleSoft: 'rgba(212,168,255,0.16)',

  green: '#3dbb5e',
  greenSoft: 'rgba(61,187,94,0.16)',
  red: '#ff5147',
  redSoft: 'rgba(255,81,71,0.18)',
  orange: '#ff9f5a',
  orangeSoft: 'rgba(255,159,90,0.18)',
} as const;

export const themeColors = {
  ...colors,
  primary: colors.deeperBlue,
};

export const darkThemeColors = {
  ...darkColors,
  primary: darkColors.deeperBlue,
};

export function getThemeColors(isDark: boolean) {
  return isDark ? darkThemeColors : themeColors;
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No new errors. (Existing references to `colors.blue` / `colors.maroon` will now error — that's expected and gets fixed in Task 2.)

- [ ] **Step 3: Commit**

```bash
cd "apps/mobile" && git add src/theme/colors.ts
git commit -m "feat: replace single accent with 4-color palette (silver/deeper-blue/pink/purple)"
```

---

### Task 2: Add typography line-height and letter-spacing tokens

**Files:**
- Modify: `apps/mobile/src/theme/spacing.ts`

**Interfaces:**
- Produces: `lineHeight: { tight, snug, normal, relaxed }` (multipliers) and `letterSpacing: { tight, normal }` (px values) exported from `spacing.ts`.
- Consumes: nothing.

- [ ] **Step 1: Add the new tokens to `spacing.ts`**

Insert after the existing `fontSize` export (after line 32, before `shadows`):

```typescript
// Multipliers — multiply by a fontSize value to get an actual line-height in px.
// e.g. fontSize.title * lineHeight.tight = 24 * 1.15 = 27.6
export const lineHeight = {
  tight: 1.15,   // large titles (fontSize.xl and up)
  snug: 1.3,     // headings (fontSize.lg)
  normal: 1.5,   // body copy (fontSize.base, fontSize.sm)
  relaxed: 1.6,  // dense paragraph text needing extra readability
} as const;

// Absolute px values (not multipliers) — apply directly to `letterSpacing`.
export const letterSpacing = {
  tight: -0.4,  // large titles (fontSize.xl and up)
  normal: 0,    // everything else
} as const;
```

- [ ] **Step 2: Confirm the export surfaces through `theme/index.ts`**

`theme/index.ts` already does `export * from './spacing'` — no change needed there. Run:

```bash
cd apps/mobile && node -e "require('ts-node/register'); const t = require('./src/theme/spacing.ts'); console.log(t.lineHeight, t.letterSpacing)" 2>/dev/null || npx tsc --noEmit
```

Expected: `tsc --noEmit` passes with no new errors (the ts-node one-liner is optional/best-effort — if it errors on missing ts-node, rely on the `tsc --noEmit` result instead).

- [ ] **Step 3: Commit**

```bash
cd "apps/mobile" && git add src/theme/spacing.ts
git commit -m "feat: add lineHeight and letterSpacing typography tokens"
```

---

### Task 3: Apply new typography tokens to Home and Inbox screen titles

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/screens/InboxScreenV2.tsx`

**Interfaces:**
- Consumes: `lineHeight`, `letterSpacing`, `fontSize` from `../theme` (Task 2).

- [ ] **Step 1: Find the large-title style in `HomeScreen.tsx`**

```bash
cd apps/mobile && grep -n "fontSize.title\|fontSize: 24\|fontSize: 28" src/screens/HomeScreen.tsx
```

Expected: at least one match — the page/greeting title style.

- [ ] **Step 2: Add `lineHeight` and `letterSpacing` to that style**

Open the matched style block in `HomeScreen.tsx` (a `StyleSheet.create` entry, likely named something like `title` or `greeting`). Add two properties alongside the existing `fontSize` and `fontWeight`:

```typescript
lineHeight: fontSize.title * lineHeight.tight,
letterSpacing: letterSpacing.tight,
```

Import `lineHeight` and `letterSpacing` from `../theme` at the top of the file if not already imported (check the existing `import { fontSize, ... } from '../theme'` line and add to it).

- [ ] **Step 3: Repeat for `InboxScreenV2.tsx`**

```bash
cd apps/mobile && grep -n "fontSize.title\|fontSize: 24\|fontSize: 28" src/screens/InboxScreenV2.tsx
```

Apply the same two properties to the matched title style, importing `lineHeight`/`letterSpacing` from `../theme` as needed.

- [ ] **Step 4: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
cd "apps/mobile" && git add src/screens/HomeScreen.tsx src/screens/InboxScreenV2.tsx
git commit -m "feat: apply refined line-height/letter-spacing to Home and Inbox titles"
```

---

### Task 4: Migrate hardcoded accent hex values to the new tokens

**Files:**
- Modify: `apps/mobile/src/components/home/InboxScrollCard.tsx:21-26`
- Modify: `apps/mobile/src/screens/InboxScreenV2.tsx:286`
- Modify: `apps/mobile/src/components/home/NextUpCard.tsx:148,177` and the `glowBadge` `backgroundColor` at line 174
- Modify: `apps/mobile/src/screens/MedicationsScreen.tsx:326`
- Modify: `apps/mobile/src/screens/WorkoutsScreen.tsx:87` (add inline override; `linkText` static style at line 165 stays as fallback default but is no longer relied on)

**Interfaces:**
- Consumes: `colors.deeperBlue`, `colors.deeperBlueSoft`, `getThemeColors` (Task 1). All five files already import `getThemeColors` and compute a `palette` variable except `WorkoutsScreen.tsx`, which already has `palette` in scope too (confirmed via existing `palette.text` usage).

- [ ] **Step 1: Fix `InboxScrollCard.tsx`**

Replace lines 21-26:

```typescript
  // Dark mode: silvery-blue accent for the "needs attention" state (matching
  // the rest of the theme) instead of the old maroon; light mode keeps
  // maroon. Green stays for the all-clear state in both — it's a semantic
  // success color, not a theme accent.
  const attentionColor = isDark ? palette.blue : '#a41e34';
  const attentionSoft = isDark ? 'rgba(159,184,209,0.14)' : 'rgba(164,30,52,0.12)';
```

with:

```typescript
  // Deeper blue accent for the "needs attention" state in both modes — the
  // theme no longer splits primary color by light/dark. Green stays for the
  // all-clear state in both — it's a semantic success color, not a theme accent.
  const attentionColor = palette.deeperBlue;
  const attentionSoft = palette.deeperBlueSoft;
```

- [ ] **Step 2: Fix `InboxScreenV2.tsx` line 286**

Replace:

```typescript
  fabGlow: {
    shadowColor: '#9fb8d1',
```

with:

```typescript
  fabGlow: {
    shadowColor: '#2b7ff0',
```

(This is inside a static `StyleSheet.create` block with no `isDark` in scope, so the fixed hex value — matching `colors.deeperBlue` — is used directly, consistent with the fact that `deeperBlue` is identical in both light and dark mode.)

- [ ] **Step 3: Fix `NextUpCard.tsx`**

Replace line 148 (`heroLabel` color):

```typescript
  heroLabel: {
    color: '#9fb8d1',
```
→
```typescript
  heroLabel: {
    color: '#2b7ff0',
```

Replace line 174 (`glowBadge` backgroundColor):

```typescript
    backgroundColor: 'rgba(159,184,209,0.20)',
```
→
```typescript
    backgroundColor: 'rgba(43,127,240,0.20)',
```

Replace line 177 (`glowBadge` shadowColor):

```typescript
    shadowColor: '#9fb8d1',
```
→
```typescript
    shadowColor: '#2b7ff0',
```

- [ ] **Step 4: Fix `MedicationsScreen.tsx` line 326**

Replace:

```typescript
              style={[s.saveBtn, { backgroundColor: isDark ? palette.blue : '#007aff', opacity: title.trim() ? 1 : 0.3 }]}
```

with:

```typescript
              style={[s.saveBtn, { backgroundColor: palette.deeperBlue, opacity: title.trim() ? 1 : 0.3 }]}
```

- [ ] **Step 5: Fix `WorkoutsScreen.tsx` line 87**

Replace:

```typescript
              <Text style={styles.linkText}>Create your own template →</Text>
```

with:

```typescript
              <Text style={[styles.linkText, { color: palette.deeperBlue }]}>Create your own template →</Text>
```

The static `linkText: { color: '#007aff' }` in the `StyleSheet.create` block (line 165) can stay as a fallback default — it's now overridden inline, so no further edit needed there.

- [ ] **Step 6: Grep to confirm no old accent hex values remain outside `moodConfig.ts` (intentionally out of scope) and the live activity widget (fixed in Task 5)**

```bash
cd apps/mobile && grep -rn "#a41e34\|#9fb8d1\|#007aff" src --include="*.tsx" --include="*.ts"
```

Expected: only `src/domain/ronin/moodConfig.ts` and `src/liveActivities/MedicationTimerActivity.tsx` remain.

- [ ] **Step 7: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 8: Commit**

```bash
cd "apps/mobile" && git add src/components/home/InboxScrollCard.tsx src/screens/InboxScreenV2.tsx src/components/home/NextUpCard.tsx src/screens/MedicationsScreen.tsx src/screens/WorkoutsScreen.tsx
git commit -m "fix: migrate hardcoded accent hex values to the new deeper-blue token"
```

---

### Task 5: Fix the Medication Timer Live Activity accent color

**Files:**
- Modify: `apps/mobile/src/liveActivities/MedicationTimerActivity.tsx:22`

**Interfaces:**
- Consumes: nothing new — Live Activities run in a native widget scope and cannot import from `src/theme` (per prior project experience: widget-tagged components must keep constants inline in the function body, not module scope, to avoid `ReferenceError` on-device — importing a shared theme module carries the same risk). Use the literal hex value directly.

- [ ] **Step 1: Replace the accent color line**

```typescript
  const accentColor = environment.colorScheme === 'dark' ? '#f2f2f2' : '#a41e34';
```
→
```typescript
  const accentColor = environment.colorScheme === 'dark' ? '#f2f2f2' : '#2b7ff0';
```

(Dark mode already uses a near-white `#f2f2f2` for the widget accent — that's a widget-specific choice unrelated to the app's dark-mode `deeperBlue` token and stays unchanged. Only the light-mode maroon becomes the new deeper blue.)

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
cd "apps/mobile" && git add src/liveActivities/MedicationTimerActivity.tsx
git commit -m "fix: update medication timer live activity accent to deeper blue"
```

---

### Task 6: Visual verification in light and dark mode

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Start the Expo dev server on port 8082**

```bash
cd apps/mobile && npx expo start --dev-client --port 8082
```

(Per project convention, apps/mobile always runs on port 8082, not the Expo default 8081.)

- [ ] **Step 2: Open the app on-device or in Expo Go and check Home screen**

Verify in **light mode**:
- Primary accent (buttons, active states) reads as the new deeper blue (`#2b7ff0`), not maroon.
- Background/surface tones are unchanged (`#f6f5f1` / `#ffffff`).

Verify in **dark mode** (toggle device dark mode or in-app theme switch if present):
- Background reads as a richer navy-black (`#0f0f1a`), not flat near-black.
- Primary accent reads as the same deeper blue as light mode (no more silvery-blue).

- [ ] **Step 3: Check Inbox screen (both modes)**

- FAB glow shadow renders in deeper blue.
- "Needs attention" state on the inbox scroll card renders in deeper blue in both light and dark mode (previously maroon in light mode only).
- Circle checkboxes, swipe actions, and capture row structure are visually unchanged — only colors shifted.

- [ ] **Step 4: Check Profile and QuickAdd screens (both modes)**

- No leftover maroon or old silvery-blue (`#9fb8d1`) anywhere.
- Toolbar Save buttons and any primary CTAs read as deeper blue.

- [ ] **Step 5: Spot-check Medications and Workouts screens (both modes)**

- Medications "Save" button in the add-medication sheet reads as deeper blue.
- Workouts "Create your own template" link reads as deeper blue.
- Orange (medication stock/timer indicators) is unchanged — confirm it did NOT shift.

- [ ] **Step 6: Take a screenshot of Home in light mode and Home in dark mode for the record**

Use the device/simulator screenshot mechanism (or `preview_start`/browser tooling is not applicable here — this is a native app, so capture via the Expo dev client / simulator directly).

- [ ] **Step 7: If any issues are found, fix inline and re-verify from Step 2. Otherwise, this task requires no commit** (verification-only, no code changes).
