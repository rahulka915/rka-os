# Scroll Limits Guide - RKA OS

**Purpose:** Define scroll boundaries so navigation (top & bottom) always remain accessible and content doesn't scroll behind them.

---

## The Rule

> **Navigation should always be visible and accessible. Users must never scroll content to a position where it overlaps or hides the navigation bars.**

---

## Current Implementation

### Top Navigation
- **Status:** ✅ Handled by padding
- **Method:** `padding-top: calc(env(safe-area-inset-top) + 44px + 12px)`
- **Effect:** Content starts below top header, can't scroll behind it

### Bottom Navigation  
- **Status:** ⚠️ Partially handled
- **Method:** `position: absolute; bottom: 16px`
- **Padding:** `padding-bottom: calc(env(safe-area-inset-bottom) + 80px)`
- **Issue:** Content CAN scroll to positions where last item partially goes behind nav

---

## What This Means

### ✅ Current Correct Behavior
```
Scrolled up:
┌──────────────────┐
│   Top Header     │ ← Always visible
├──────────────────┤
│ Content          │
│ (scrollable)     │
│                  │
│ Last item        │
├──────────────────┤
│ Bottom Nav       │ ← Always visible
└──────────────────┘
```

### ❌ What Should NOT Happen
```
Scrolled down (BAD):
┌──────────────────┐
│ Last item ↑      │ ← Should NOT go up here
│ (behind nav)     │
├──────────────────┤
│ Bottom Nav       │ ← Content overlaps!
└──────────────────┘
```

---

## iOS-Specific Scroll Behavior

### Scroll Padding (CSS)
```css
html {
  scroll-padding-top: calc(env(safe-area-inset-top) + 44px);
  scroll-padding-bottom: calc(env(safe-area-inset-bottom) + 80px);
}
```

**What it does:** When you scroll to an element (e.g., via anchor link), it adds this padding to ensure the element doesn't end up behind nav.

**Current state:** NOT implemented in RKA OS.

### Scroll Behavior (JavaScript)
Currently: Nothing prevents scrolling content behind bottom nav.

**Options to add:**
1. **scroll-padding** (CSS) — Passive, affects anchor links only
2. **scroll snap** — Enforces scroll stops
3. **JavaScript boundary** — Active scroll limiting

---

## Best Practice: What Should Happen

### Option A: Scroll Padding (Recommended for Now)
**Simple, CSS-only, handles edge cases**

```css
html {
  scroll-padding-bottom: calc(env(safe-area-inset-bottom) + 80px + 12px);
}
```

✅ **Pros:**
- One-line CSS fix
- Works with anchor links
- Respects safe areas
- No JavaScript needed

❌ **Cons:**
- Doesn't prevent manual scrolling past
- Only affects `.scrollIntoView()` and anchor navigation

### Option B: Scroll Snap (Modern)
**Enforces snap points, feels more controlled**

```css
.main-content {
  scroll-snap-type: y proximity;
}

.bottom-nav {
  scroll-snap-stop: always;
  scroll-snap-align: end;
}
```

✅ **Pros:**
- User can't scroll past nav
- Feels intentional and controlled
- Works on most modern browsers

❌ **Cons:**
- Can feel restrictive
- Some users don't like snap points
- Takes more CSS rules

### Option C: JavaScript Boundary (Full Control)
**Most control, but requires JavaScript**

```javascript
document.addEventListener('scroll', () => {
  const navHeight = document.querySelector('.bottom-nav').offsetHeight;
  const maxScroll = document.documentElement.scrollHeight - navHeight;
  
  if (window.scrollY > maxScroll) {
    window.scrollTo(0, maxScroll);
  }
});
```

✅ **Pros:**
- Full control over scroll behavior
- Can animate smooth stops
- Works everywhere

❌ **Cons:**
- JavaScript adds overhead
- Can feel janky if not smooth
- More code to maintain

---

## Recommendation for RKA OS

**Implement scroll-padding (Option A) — It's the simplest and most "web-standard" approach.**

The padding at the bottom already prevents complete hiding. Adding scroll-padding just makes sure that when content is explicitly scrolled to (via links or `scrollIntoView`), it respects the nav boundary.

**Add this to index.css or shell.css:**

```css
html {
  scroll-padding-top: calc(env(safe-area-inset-top) + 44px + 12px);
  scroll-padding-bottom: calc(env(safe-area-inset-bottom) + 80px + 8px);
}
```

---

## Related iOS Considerations

### Safe Area + Navigation
- Top nav includes safe-area-inset-top (notch, Dynamic Island)
- Bottom nav includes safe-area-inset-bottom (home indicator)
- Scroll padding should also respect these

### Momentum Scrolling
- `-webkit-overflow-scrolling: touch` enables momentum
- Scroll limiting should not interfere with momentum feel
- Avoid hard JavaScript stops — let CSS handle it

### Scroll to Top Button
If you add a "scroll to top" button, it should:
- Scroll to `y: 0` (top content, below header)
- NOT to `y: -(nav height)` (that would hide content)
- Use `behavior: 'smooth'` for feel

---

## Testing Checklist

- [ ] On home page, scroll to bottom → last item visible above nav
- [ ] Scroll back to top → header stays at top
- [ ] Click an anchor link → scrolls but respects nav padding
- [ ] Use `scrollIntoView()` → respects nav padding
- [ ] Test on iPhone 15+ (home indicator) vs iPhone SE (no indicator)
- [ ] Test on iPad (left/right safe areas in landscape)
- [ ] Momentum scrolling feels smooth (no hard stops)

---

## Rules for New Pages

When adding a new page:

✅ **Must have:**
- `padding-top: calc(env(safe-area-inset-top) + 44px + 12px)` (or use `.rka-page`)
- `padding-bottom: calc(env(safe-area-inset-bottom) + 80px)` (or use `.rka-page`)
- `overscroll-behavior: contain` on scrollable containers
- `-webkit-overflow-scrolling: touch` for iOS momentum

✅ **Should have:**
- Test that last item is visible above bottom nav
- Test that header stays at top when scrolling down
- Test that you can see all content without nav overlapping

❌ **Never do:**
- Omit bottom padding (content will hide behind nav)
- Use fixed height instead of viewport-relative (breaks on different devices)
- Disable scrolling entirely (users need to see all content)

---

## Implementation Status

**Current:** ✅ Fully implemented
- Padding prevents full hiding ✅
- Scroll-padding added ✅ (2026-06-24)
- Snap points NOT used (not needed with padding + scroll-padding)
- JavaScript limiting NOT used (not needed with padding + scroll-padding)

**Solution Applied:** Added scroll-padding to `html` selector in `index.css`:
```css
html {
  scroll-padding-top: calc(env(safe-area-inset-top) + 44px + 12px);
  scroll-padding-bottom: calc(env(safe-area-inset-bottom) + 80px + 8px);
}
```

**Result:** Complete scroll boundary protection with minimal code. ✅

---

## Related Documentation

- `IOS_BOTTOM_NAV.md` — Bottom nav specifics
- `SCROLL_BEHAVIOR.md` — Scroll mechanics
- `RKA_UI_HANDBOOK.md` — Design principles
- `MOBILE_IMPLEMENTATION_GUIDE.md` — Implementation patterns

---

**Last Updated:** 2026-06-24  
**Status:** Documentation only (implementation pending)
