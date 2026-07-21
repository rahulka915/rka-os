# Loading/Overlay System — Design Spec

**Date:** 2026-07-21
**Status:** Approved, pending implementation plan
**Scope:** `apps/mobile/`

## Problem

The app has no visible feedback during async waits:

- **Cold start:** `App.tsx` gates rendering on `fontsLoaded` (`if (!fontsLoaded) return null;`), so the JS layer shows nothing while fonts + DB init happen. The native `expo-splash-screen` stays up (static image on `#0F0F10`) the whole time, then `SplashScreen.hideAsync()` fires and the real app appears — an abrupt handoff with no animated/branded loading state.
- **Sign-in / backup / restore:** `useBackup.ts` (`apps/mobile/src/hooks/useBackup.ts`) tracks a `busy` boolean for `signIn`, `backUpNow`, and `restoreLatest`, but `ProfileScreen.tsx` renders nothing different while `busy` is true — no spinner, no disabled state, no status message.
- **No reusable primitive:** there's no shared loading indicator or overlay component other screens can reach for when they add their own async actions later.

## Decisions (via brainstorming session)

- No 3D Ronin character in any loading state — minimal, brand-mark only (avoids spinning up a WebGL context for quick/frequent actions).
- The animated mark is a custom **ensō** (zen circle), reusing the same motif/color (`#4E9E86`) as the existing `EnsoMoreIcon` (Menu tab).
- Animation treatment: **self-drawing arc** — the ring sweeps from 0 to ~cover, retracts, and rotates to loop, rather than a plain spin or a breathing pulse. Calmer, more "brushstroke," matches the zen motif better than a generic spinner.
- Splash composition: **mark + wordmark** ("RKA OS", accent-colored "OS"). No tagline — kept restrained. Text styling is a placeholder; a later pass will improve font treatment app-wide, not scoped to this work.
- Sync/backup feedback: a **bottom status banner**, not a full-screen dimming overlay or an inline-only button state. Chosen specifically to match the existing `PersistentTimerBanner` pattern already used for the medication timer, so the app has one consistent "ambient bottom status" idiom instead of two.
- The reusable overlay system is **banner-only** — no separate blocking/full-dim variant. Nothing in the app currently needs to hard-block interaction during a wait; if that need arises later, it's a separate addition.

## Components

### 1. `EnsoLoader` — `src/components/ui/EnsoLoader.tsx`

The shared animated mark. Everything else in this spec is built on top of it.

- Renders an SVG ring (`react-native-svg`, consistent with `DockIcons.tsx`'s existing use of the library) with `strokeDasharray`/`strokeDashoffset` animated via Reanimated to sweep and retract, combined with a continuous rotation — porting the CSS keyframe behavior validated in the brainstorming mockup (self-drawing arc, ~1.6s cycle, `cubic-bezier(0.65,0,0.35,1)`-equivalent easing).
- Props: `size?: number` (default `56`), `color?: string` (default `#4E9E86`).
- No text, no container styling — purely the mark, so callers control layout/spacing.
- No reduced-motion handling: `docs/design-system/reference/motion.md` notes no RN-side reduced-motion policy exists yet for this app; out of scope here.

### 2. `AppLoadingScreen` — `src/components/AppLoadingScreen.tsx`

Full-screen cold-start loading state.

- Background `#0F0F10` (matches `app.json`'s `expo-splash-screen` `backgroundColor`, both light/dark variants — the native splash is already dark-only).
- Centered `EnsoLoader` (`size=56`) above a static "RKA OS" wordmark (`OS` in the accent teal, rest in `#f2f2f2`), matching the "mark + wordmark" mockup selection.
- Purely presentational — no internal loading logic. `App.tsx` decides when to render it.

**Wiring in `App.tsx`:**
- Replace `if (!fontsLoaded) return null;` with `if (!fontsLoaded) return <AppLoadingScreen />;`.
- Move `SplashScreen.hideAsync()` out of `onRootLayout` (currently gated behind `fontsLoaded`, called via the real app's root `onLayout`) into its own effect that fires once, immediately, on `App.tsx` mount — so the native static-image splash is replaced by `AppLoadingScreen` as early as possible rather than staying up until fonts finish. This is a deliberate behavior change: today the native splash *is* the loading state for the whole font-load window; after this change it only covers the brief moment before React's first paint, and `AppLoadingScreen` covers the rest.
- `onRootLayout` (`App.tsx:303`) currently only calls `hideAsync()` and nothing else — it is removed entirely, along with its `onLayout={onRootLayout}` prop on `GestureHandlerRootView`.

### 3. `LoadingBanner` + `useLoadingBanner` — `src/components/ui/LoadingBanner.tsx`, `src/hooks/useLoadingBanner.ts`

The reusable async-status primitive for any screen.

- `LoadingBanner`: a bottom-anchored `View` reusing `PersistentTimerBanner`'s positioning (`position: 'absolute', left: 0, right: 0, zIndex: 1000, alignItems: 'center'`, offset for safe-area insets), containing a small `EnsoLoader` (`size=18`) and a message `<Text>`. Styled as a rounded surface card consistent with the app's existing surface tokens (`theme/colors.ts` — `surface`/`separator` per light/dark).
- `useLoadingBanner`: a thin hook wrapping the existing `useOverlayHost()` (`src/hooks/useOverlayHost.tsx`). Exposes:
  - `showLoadingBanner(message: string): void` — registers a `LoadingBanner` with a fixed overlay id (e.g. `'loading-banner'`) via `setOverlay`.
  - `hideLoadingBanner(): void` — clears that overlay id.
- Must be called from a component tree already inside `OverlayHostProvider` (already wraps the app in `App.tsx`).
- Multiple concurrent callers share the single fixed overlay id — last call to `showLoadingBanner`/`hideLoadingBanner` wins. This is acceptable for now since nothing in the app triggers two independent async banners simultaneously; if that changes later, the id scheme needs revisiting (not solved here — YAGNI).

### 4. Wiring in `ProfileScreen.tsx`

No changes to `useBackup.ts`. `ProfileScreen` already owns the sign-in form and calls `backup.signIn`, `backup.backUpNow`, `backup.restoreLatest` — wrap each call site:

```
showLoadingBanner('Signing in…');
try {
  await backup.signIn(email, password);
} finally {
  hideLoadingBanner();
}
```

Same pattern for `'Backing up…'` around `backUpNow()` and `'Restoring…'` around `restoreLatest()`. Existing `Alert.alert` error handling stays as-is; the banner only covers the in-flight state, not error display.

## Out of scope

- Full-screen blocking overlay variant (explicitly rejected — banner-only for now).
- Ronin 3D character in any loading state.
- Reduced-motion support.
- Changes to `useBackup.ts`'s internals or error handling.
- Wordmark/typography polish beyond what's needed to place it on the splash screen (a separate, app-wide type pass is expected later).
- Any screen other than `ProfileScreen` adopting `useLoadingBanner` — the hook is built generic/reusable, but no other call site is being wired in this pass.
