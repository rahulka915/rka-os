# Scroll Behavior Guide - RKA OS

**Purpose:** Document iOS/mobile scroll behavior patterns, quirks, and best practices to prevent common UX issues.

**Related:** Read §17 (Bottom Sheets), §18 (Mobile Gestures), §21 (Motion Design), and §30.3 (Project Rules) in `RKA_UI_HANDBOOK.md` for design principles that inform this technical guide.

---

## Core Concepts

### 1. Momentum Scrolling (iOS/WebKit)

iOS uses kinetic/momentum scrolling—when you release your finger, the content continues scrolling with deceleration (the "bouncy" feel).

```css
.scrollable {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
}
```

**Why it matters:**
- Users expect this on iOS (native feel)
- Without it, scrolling feels stiff and unresponsive
- Requires CSS optimization to avoid jank

**Applied in RKA OS:**
- `.rka-sheet-body` has `-webkit-overflow-scrolling: touch`
- InboxSheet scrollable items use it too

---

### 2. Elastic Overscroll (Rubber Band Effect)

iOS bounces past the scroll boundary and rubber-bands back. **This cannot be disabled via CSS.** It's built into WebKit.

**Problem:** If a parent container also scrolls, the bounce can bubble up and cause unwanted scrolling.

**Solution:** Use `overscroll-behavior: contain` to trap the bounce inside the scrolling element.

```css
.sheet-items {
  overflow-y: auto;
  overscroll-behavior: contain; /* ← Stops bounce from bubbling */
  -webkit-overflow-scrolling: touch;
}
```

**Applied in RKA OS:**
- `.rka-sheet-body` has `overscroll-behavior: contain`
- InboxSheet items container uses `overscrollBehavior: 'contain'`

---

### 3. Nested Scroll Trap

When you have scrollable content **inside** a scrollable sheet:

```
┌─────────────────────────┐
│  Bottom Sheet (scroll)  │
├─────────────────────────┤
│  List Items (scroll)    │  ← Nested scroll
│  1. Item A              │
│  2. Item B              │
│  3. Item C              │
└─────────────────────────┘
```

**Expected:** User scrolls on list → list scrolls ✅  
**Problem:** List reaches bottom → user keeps scrolling → sheet scrolls up ❌

**Solution:** `overscroll-behavior: contain` prevents the scroll from bubbling to the parent sheet.

```css
.list-items {
  overflow-y: auto;
  overscroll-behavior: contain; /* Don't bubble to parent sheet */
}
```

---

## iOS-Specific Quirks

### Safe Area & Scroll Position

iOS respects `env(safe-area-inset-*)` but scroll position doesn't account for it automatically.

**Fix:** Always add bottom padding when scrolling near safe-area edge:

```css
.scrollable {
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
}
```

**Applied in RKA OS:**
- `.rka-sheet-footer` has this padding
- Inbox items have `24px + safe-area` padding

### Scroll Lock on Body

When a modal/sheet opens, prevent background from scrolling:

```javascript
// Lock
document.body.style.overflow = 'hidden';

// Unlock  
document.body.style.overflow = '';
```

**Better approach** (preserves scroll position):

```javascript
const scrollY = window.scrollY;
document.body.style.position = 'fixed';
document.body.style.top = `-${scrollY}px`;
document.body.style.width = '100%';

// Unlock
document.body.style.position = '';
document.body.style.top = '';
window.scrollTo(0, scrollY);
```

---

## Bottom Sheet Scroll Behavior

### Correct Pattern

```jsx
// Outer: Fixed overlay (no scroll)
<div className="rka-sheet-overlay">  {/* overflow: hidden */}
  
  // Middle: Sheet container (doesn't scroll, just contains)
  <div className="rka-sheet">  {/* flex column */}
    
    // Top: Header (fixed, no scroll)
    <div className="rka-sheet-header">Inbox</div>
    
    // Bottom: Scrollable content (independent scroll)
    <div className="rka-sheet-body">  {/* overscroll-behavior: contain */}
      {/* Items here scroll independently */}
    </div>
    
  </div>
</div>
```

### CSS Requirements

| Element | Property | Value | Why |
|---------|----------|-------|-----|
| `.rka-sheet-overlay` | `overflow` | `hidden` | Prevents scroll bubbling from sheet to page |
| `.rka-sheet-overlay` | `position` | `fixed` | Locks to viewport |
| `.rka-sheet-body` | `overflow-y` | `auto` | Enables scrolling |
| `.rka-sheet-body` | `overscroll-behavior` | `contain` | Stops momentum bounce from bubbling |
| `.rka-sheet-body` | `-webkit-overflow-scrolling` | `touch` | iOS momentum scrolling |

---

## Common Mistakes

### ❌ Missing `overscroll-behavior`

```css
/* Bad: Bounce bubbles to parent */
.sheet-items {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
```

**Result:** User scrolls list → reaches bottom → feels like sheet is scrolling up

**Fix:** Add `overscroll-behavior: contain`

---

### ❌ Nested `position: fixed` with scroll

```jsx
<div style={{ position: 'fixed', overflow: 'auto' }}>
  {/* Causes scroll jank on iOS */}
</div>
```

**Result:** Scroll feels stiff, doesn't use momentum

**Fix:** Use `position: absolute` inside scrollable parent, or just `overflow: auto` without fixed positioning

---

### ❌ Animating during scroll

```javascript
window.addEventListener('scroll', () => {
  element.style.transform = `translateY(${window.scrollY}px)`;
});
```

**Result:** Jank, conflicts with momentum scrolling

**Fix:** Animate **after** scroll ends, not during:

```javascript
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    // Animate here, after scroll settles
  }, 100);
});
```

---

### ❌ `overflow: hidden` on body without restoring scroll

```javascript
// User opens sheet
document.body.style.overflow = 'hidden';

// User closes sheet
// Scroll position lost!
document.body.style.overflow = '';
```

**Result:** Page jumps to top when sheet closes

**Fix:** Save/restore scroll position (see Safe Area & Scroll Position section above)

---

## RKA OS Implementation Checklist

- ✅ `.rka-sheet-overlay` has `overflow: hidden`
- ✅ `.rka-sheet-body` has `overflow-y: auto`
- ✅ `.rka-sheet-body` has `overscroll-behavior: contain`
- ✅ `.rka-sheet-body` has `-webkit-overflow-scrolling: touch`
- ✅ `InboxSheet` items container has `overscrollBehavior: 'contain'`
- ✅ `InboxSheet` items container has `WebkitOverflowScrolling: 'touch'`
- ✅ Bottom padding includes `env(safe-area-inset-bottom)` for iOS
- ✅ `BottomSheet` component prevents scroll bubbling with overlay click handlers

---

## Testing on iOS

### Real Device (Required)
- iOS simulator doesn't bounce the same way as real devices
- Test on actual iPhone/iPad to verify momentum scrolling feel

### Checklist
1. Open Inbox sheet
2. Scroll through items smoothly — should feel kinetic
3. Scroll past the last item — should rubber-band and return
4. Scroll back to top — should feel responsive
5. Close sheet and verify home page didn't jump
6. Open sheet again — scroll position should be preserved

### Debug Tips
- Use Safari DevTools (iPad) to inspect scroll metrics
- Check `-webkit-overflow-scrolling` is not overridden by parent styles
- Verify no `overflow: hidden` on intermediate parents
- Check z-index doesn't create stacking context conflicts

---

## Emil Design Engineering Perspective

**Never animate during scroll.** It conflicts with momentum scrolling and makes the UI feel janky.

Instead:
- Animate **after** scroll settles
- Or animate scroll-independent elements (header, buttons)
- Use scroll event throttling/debouncing

**Example:** Fade out header while scrolling

```javascript
// Bad: Updates during every scroll event
window.addEventListener('scroll', () => {
  header.style.opacity = 1 - (scrollY / 100); // Jank
});

// Good: Throttle and update after scroll stops
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    header.style.opacity = 1 - (scrollY / 100); // Smooth
  }, 100);
});
```

---

## References & Related Documentation

### Project References
- **RKA_UI_HANDBOOK.md** — Design principles for scroll behavior:
  - §17: Bottom Sheets (structure, dismissal, preservation of context)
  - §18: Mobile Gestures (swipe patterns, momentum, discoverability)
  - §21: Motion Design (never animate during scroll, use after scroll settles)
  - §30.3: Project Rule — "One section scrolls in one direction" (prevents nested scroll conflicts)

### Technical References
- **MDN:** [`overscroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)
- **WebKit:** [`-webkit-overflow-scrolling`](https://webkit.org/blog/3991/safari-9-1-release-notes/)
- **Apple HIG:** Safe Areas & Scroll Behavior
- **Emil Kowalski:** Animation & Scroll Interactions (animations.dev)

---

## Lessons Learned

1. **iOS bounce is unavoidable** — Use `overscroll-behavior: contain` to trap it
2. **Nested scrolling requires explicit handling** — Always set `overscroll-behavior`
3. **Test on real iOS devices** — Simulator doesn't replicate momentum or bounce behavior
4. **Safe areas affect scroll position** — Add bottom padding with `env(safe-area-inset-*)`
5. **Don't animate during scroll** — Wait for scroll to settle to animate other elements
6. **Scroll position must be preserved** — Save/restore when opening/closing modals

---

**Last Updated:** 2026-06-24  
**Status:** ✅ Implemented in RKA OS primitives and InboxSheet
