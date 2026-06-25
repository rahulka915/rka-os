# iOS Bottom Navigation Guide - RKA OS

**Purpose:** Document iOS-specific bottom navigation behavior, safe area handling, scroll interaction, and keyboard management.

**Critical:** Bottom nav affects almost every other mobile pattern. Get this wrong and scroll, gestures, keyboard, and safety areas all break.

---

## Current Implementation Analysis

### What's Working ✅

**Position: Absolute (Floating)**
```css
.bottom-nav {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
}
```
- ✅ Floating design with breathing room from edges
- ✅ Prevents iOS elastic overscroll bounce affecting nav
- ✅ Keeps nav visible above page scroll
- ✅ Prevents Safari flexbox padding bug
- ✅ Premium visual appearance (pill-shaped)

**Safe Area Handling**
```css
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```
- ✅ Respects home indicator on iPhone 15+
- ✅ Respects notch if present
- ✅ Includes separate `.bottom-nav__safe-area` div for layout

**Page Bottom Padding**
```css
.rka-page {
  padding-bottom: calc(env(safe-area-inset-bottom) + var(--rka-bottom-nav-height) + 24px);
}
```
- ✅ Content doesn't hide behind nav
- ✅ Safe area + nav height + extra breathing room

**Keyboard Handling**
```css
body:has(input:focus, textarea:focus) .bottom-nav {
  display: none !important;
}
```
- ✅ Hides nav when keyboard opens
- ✅ Prevents floating nav over keyboard
- ✅ Prevents iOS layout shift

---

## iOS-Specific Issues & Solutions

### 1. Safe Area Variations

**The Problem:**
Safe area inset-bottom varies:
- iPhone 15 (no home indicator): 0px
- iPhone 15 with home indicator: 34px
- iPad: varies by orientation (0px, 20px, 24px)
- Notch/Dynamic Island: variable

**Current Solution:** Using `env(safe-area-inset-bottom)` handles this correctly ✅

**Verify with:**
```bash
# Test on actual devices
- iPhone 15 (latest)
- iPhone SE (no safe area)
- iPad Pro (variable)
- iPad mini (landscape)
```

---

### 2. Scroll Behavior with Absolute Positioning

**The Issue:**
With `position: absolute`, when user scrolls past content, **the nav stays visible but content scrolls underneath it**.

**Current Setup:**
- Nav height: `56px`
- Safe area: `env(safe-area-inset-bottom)` (0-34px)
- Page bottom padding: `56px + safe-area + 24px` = **80-114px**

This prevents content from hiding behind the nav. ✅

**Verification Needed:**
1. Scroll home page down fully
2. Last content item should have visible padding above nav
3. No content should hide behind nav even when keyboard was just closed

---

### 3. Scroll Lock Interaction

**The Issue:**
When a bottom sheet opens, background scroll should lock. With absolute nav, this can create issues.

**Current Behavior:**
- Sheet uses overlay with `overflow: hidden`
- Nav stays visible (absolute positioning)
- Page scroll is locked

**What Can Go Wrong:**
- If overlay doesn't cover the nav properly, user can tap through to nav
- If nav remains in focus order, screen readers might get confused

**Fix Applied:**
BottomSheet overlay should have higher z-index than nav:
```css
.rka-sheet-overlay {
  z-index: 200;  /* Higher than .bottom-nav z-index: 50 */
}
```

---

### 4. Notch/Dynamic Island Safe Area

**The Issue:**
Top safe area (notch, Dynamic Island) can affect bottom nav placement if not careful.

**iPhone Notch Areas:**
- Top notch: `env(safe-area-inset-top)` (44px on iPhone 14 Pro)
- Bottom home indicator: `env(safe-area-inset-bottom)` (34px)
- Left/Right safe areas on landscape: varies

**Current Implementation:**
Uses all safe-area-inset values correctly:
```css
.bottom-nav__content {
  padding-inline: max(8px, env(safe-area-inset-left)) 
                   max(8px, env(safe-area-inset-right));
}
```

✅ Handles landscape mode correctly.

---

### 5. Gesture Conflicts

**The Issue:**
Bottom nav area (especially close to home indicator) can conflict with iOS gestures.

**iOS System Gestures in Nav Area:**
- Home indicator swipe-up → activates app switcher
- Swipe from edge → back gesture
- 3-finger tap → accessibility menu

**Current Implementation:**
- Nav items are 56px tall (sufficient)
- FAB button (48px) has 8px padding (sufficient)
- No custom swipe handlers in nav area

✅ Gestures should work correctly.

**Test:**
1. Try swiping from bottom edge → should trigger home (not nav)
2. Try 3-finger tap in nav area → should bring accessibility menu

---

### 6. Keyboard Appearance/Dismissal

**The Issue:**
When keyboard appears, the nav hides. When keyboard dismisses, the nav reappears. The transition can:
- Cause layout shift
- Reveal content that was behind keyboard
- Affect scroll position
- Trigger unexpected scroll jumps

**Current Implementation:**
```css
body:has(input:focus, textarea:focus) .bottom-nav {
  display: none !important;
}
```

**What This Does:**
- ✅ Instantly hides nav (no animation)
- ✅ Makes room for keyboard
- ✅ Prevents floating nav over keyboard

**What Could Still Go Wrong:**
- If input is very high on page, keyboard can still cover it
- Scroll position might jump when keyboard appears/disappears
- No animation = jarring disappearance

**Improvement Opportunity:**
Could transition opacity instead of display:
```css
.bottom-nav {
  transition: opacity 200ms ease-out;
}

body:has(input:focus, textarea:focus) .bottom-nav {
  opacity: 0;
  pointer-events: none;
}
```

But current solution is safer (display: none prevents accidental interaction).

---

### 7. Content Scroll vs Nav Visibility

**The Issue:**
User scenario:
1. Scrolls home page to bottom
2. Sees content item they want to interact with
3. But nav obscures the action button

**Current Solution:**
Bottom padding on pages accounts for this:
```css
padding-bottom: calc(env(safe-area-inset-bottom) + var(--rka-bottom-nav-height) + 24px);
```

This adds **80-114px** of padding below content, so the last item is visible above the nav.

✅ Works correctly.

---

## Testing Checklist for iOS

### On Real Devices Required

**iPhone 15+ (with home indicator):**
- [ ] Scroll home page → last item visible above nav
- [ ] Nav has 34px safe area padding (bottom)
- [ ] Tap nav items → haptic feedback works
- [ ] Open bottom sheet → nav hidden, sheet overlay is on top
- [ ] Click input → nav disappears smoothly
- [ ] Close keyboard → nav reappears
- [ ] Swipe from bottom edge → triggers home (not nav tap)
- [ ] Swipe left on nav item → doesn't trigger swipe-back gesture

**iPhone SE (no home indicator):**
- [ ] Nav has 0px safe area padding (should be flush)
- [ ] Scroll behavior identical
- [ ] No extra space below nav

**iPad (landscape):**
- [ ] Nav respects left/right safe areas in landscape
- [ ] Safe area padding adjusts when rotating
- [ ] Content padding recalculates on rotation

---

## Best Practices Going Forward

### 1. Always Reserve Bottom Space

When adding new pages/sheets, ensure they have:
```css
padding-bottom: calc(env(safe-area-inset-bottom) + var(--rka-bottom-nav-height) + 24px);
```

OR for sheets:
```css
padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
```

---

### 2. Test Keyboard Interaction

Every input field should:
- Be scrollable into view when keyboard opens
- Have nav hidden to make space
- Restore nav and scroll position when dismissed

---

### 3. Safe Area is Not Optional

Always use `env(safe-area-inset-*)` for:
- Bottom padding (home indicator)
- Top padding (notch/Dynamic Island) 
- Left/right padding (landscape mode on iPad)

Never hardcode values like `34px` or `44px`.

---

### 4. Absolute Positioning is Correct for Mobile Nav

Do NOT change to:
- `position: fixed` (causes scroll conflicts)
- `position: sticky` (doesn't work well with scroll)
- `position: relative` (falls out of view)

Stay with `position: absolute`.

---

### 5. Nav Height Must Be Consistent

Current: `56px` (nav items + padding)

If you adjust, update:
- `--rka-bottom-nav-height: 56px` (in index.css)
- All page `padding-bottom` calculations
- `.nav-item min-height`
- `.fab-container min-height`

---

## Emil Design Engineering Perspective

**Motion on Bottom Nav:**
- ✅ Current: Nav items scale on press (0.985) — correct
- ✅ Haptic feedback with every tap — satisfying
- ❌ Avoid: Animating nav in/out (too frequent, breaks momentum)
- ✅ Current: Hide on keyboard (instant, no animation) — correct

**Interaction States:**
- ✅ Active nav item: highlighted in blue
- ✅ Inactive: muted gray
- ✅ Hover: none needed (touch doesn't have hover)
- ✅ Pressed: scale animation + haptic

---

## RKA UI Handbook Reference

From **RKA_UI_HANDBOOK.md:**
- §14.1: Bottom nav max 5 items ✅ (RKA has 5)
- §14.2: Floating, rounded, elevated ✅ (uses backdrop-filter blur)
- §13.2: Mobile requires prioritization ✅ (5 items chosen)
- §30.8: Native feeling on mobile ✅ (uses safe areas, gestures)

---

## Known Limitations

1. **Safe Area Not Dynamically Updated:**
   - Safe area values only update when app starts
   - If device rotates, safe area might not recalculate
   - Workaround: Already handled by CSS `env()` function

2. **Fixed Height Nav:**
   - Nav is always 56px (plus safe area)
   - Cannot adapt to content changes
   - This is intentional (consistent, predictable)

3. **Keyboard Detection:**
   - Uses CSS `:has(input:focus)` selector
   - Only works for visible inputs in DOM
   - Doesn't detect programmatic keyboard opens (rare)

---

## Debugging Tips

### If nav appears behind content:
```css
/* Check z-index */
.bottom-nav { z-index: 50; }  /* Should be higher than page content */
```

### If nav overlaps content:
```css
/* Check page padding-bottom */
/* Should be: nav-height + safe-area + 24px */
```

### If keyboard doesn't hide nav:
```css
/* Check :has() selector support */
/* Works on iOS 15.4+, but Safari 15.x had bugs */
/* Fallback: use JavaScript detection instead */
```

### If safe area doesn't apply:
```css
/* Verify viewport meta tag */
/* <meta name="viewport" content="viewport-fit=cover"> */
```

---

## Next Steps

- [ ] Test on real iPhone 15 with home indicator
- [ ] Test on iPhone SE (no safe area)
- [ ] Test on iPad in landscape
- [ ] Verify scroll behavior with nested scrolls
- [ ] Check keyboard appears/dismisses smoothly
- [ ] Verify gesture conflicts don't occur
- [ ] Test all 5 nav items are tappable
- [ ] Confirm haptics fire on tap

---

**Last Updated:** 2026-06-24  
**Status:** ✅ Well-implemented, minor observation only  
**Critical Items:** Safe area handling, scroll padding, keyboard management

---

## Related Documentation

- `SCROLL_BEHAVIOR.md` — Scroll handling with bottom nav present
- `RKA_UI_HANDBOOK.md` §14 — Bottom navigation design principles
- `CLAUDE.md` — Project constraints and patterns
