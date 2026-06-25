# Mobile Implementation Guide - RKA OS

**Purpose:** Connect all mobile UX/implementation pieces so new features follow the same patterns.

---

## The Three-Layer Framework

### Layer 1: Design Principles (RKA_UI_HANDBOOK.md)
**What:** Why we design mobile a certain way

**Key Sections:**
- §13-15: Mobile UI/Layout rules
- §17-18: Bottom sheets and gestures
- §14: Bottom navigation structure
- §30: Project-level rules

**When to Reference:** Before designing any new mobile screen

---

### Layer 2: iOS-Specific Behavior (IOS_BOTTOM_NAV.md + SCROLL_BEHAVIOR.md)
**What:** How iOS quirks affect implementation

**Bottom Nav Specifics:**
- Position: absolute (never fixed)
- Safe area padding: `env(safe-area-inset-bottom)`
- Page padding: `nav-height + safe-area + breathing-room`
- Keyboard: hide nav when input focused

**Scroll Specifics:**
- Momentum scrolling: `-webkit-overflow-scrolling: touch`
- Elastic bounce: `overscroll-behavior: contain`
- Nested scrolls: trap bounce to prevent bubbling
- Safe areas: respect all `env()` values

**When to Reference:** During implementation, before testing

---

### Layer 3: Code Patterns (CLAUDE.md + Component Examples)
**What:** How to implement following the patterns

**Navigation:**
- Use `BottomTabNav` component
- Always include safe area padding
- Hide on keyboard focus

**Scrolling:**
- Add `overscroll-behavior: contain` to scrollable containers
- Add `-webkit-overflow-scrolling: touch` for momentum
- Add bottom padding to page content

**Bottom Sheets:**
- Use `BottomSheet` primitive (not `NativeBottomSheet`)
- Content has `overscroll-behavior: contain`
- Overlay has `z-index: 200` (above nav's 50)

---

## Checklist: Adding a New Mobile Page

### 1. Design Phase

- [ ] Read RKA_UI_HANDBOOK.md §13-15 (mobile layout rules)
- [ ] Identify: Is this page focused on one task?
- [ ] Identify: One dominant scroll direction?
- [ ] Plan: Where does bottom nav appear? (should always be visible)
- [ ] Plan: Where are inputs? (keyboard will hide nav)

### 2. Layout Implementation

```tsx
// Use the standard page wrapper with bottom padding
<div className="rka-page" style={{
  paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--rka-bottom-nav-height) + 24px)'
}}>
  {/* Your content here */}
</div>
```

Or in CSS:
```css
.your-page {
  padding-bottom: calc(env(safe-area-inset-bottom) + var(--rka-bottom-nav-height) + 24px);
}
```

- [ ] Add `padding-bottom` (this is non-negotiable)
- [ ] Test: Last content item visible above nav? ✅

### 3. Scroll Implementation

For scrollable sections:
```tsx
<div style={{
  flex: 1,
  overflowY: 'auto',
  overscrollBehavior: 'contain',  // ← Prevent bounce bubbling
  WebkitOverflowScrolling: 'touch' // ← iOS momentum
}}>
  {/* Scrollable content */}
</div>
```

- [ ] Add `overscrollBehavior: 'contain'` to scrollable containers
- [ ] Add `WebkitOverflowScrolling: 'touch'` for native feel
- [ ] Test: Scroll to end, momentum feels smooth? ✅

### 4. Input/Keyboard Implementation

For pages with inputs:
```tsx
<input type="text" placeholder="..." />
{/* Nav will auto-hide via CSS when this is focused */}
```

- [ ] Inputs automatically hide nav (CSS handles this)
- [ ] Test: Type in input, nav disappears? ✅
- [ ] Test: Close keyboard, nav reappears? ✅

### 5. Bottom Sheet Implementation

If adding a modal/sheet:
```tsx
<BottomSheet open={isOpen} onDismiss={onClose}>
  <div style={{ 
    flex: 1, 
    overflowY: 'auto',
    overscrollBehavior: 'contain',  // ← Nested scroll
    WebkitOverflowScrolling: 'touch'
  }}>
    {/* Sheet content */}
  </div>
</BottomSheet>
```

- [ ] Use `BottomSheet` primitive (not custom)
- [ ] Content has `overscroll-behavior: contain`
- [ ] Test: Sheet opens and closes smoothly? ✅
- [ ] Test: Scroll in sheet doesn't bubble to background? ✅

### 6. Testing Phase

**On Real iOS Device:**
- [ ] iPhone 15+ (with home indicator, 34px safe area)
- [ ] iPhone SE (no safe area, 0px)
- [ ] iPad (landscape mode, left/right safe areas)

**Test Each:**
- [ ] Scroll page → last item visible above nav
- [ ] Bottom nav buttons → all tappable (44x44px min)
- [ ] Haptic feedback → fires on tap
- [ ] Keyboard → appears/disappears smoothly
- [ ] Input field → scrolls into view when keyboard opens
- [ ] Bottom sheet → opens/closes smoothly
- [ ] Swipe from bottom → triggers home indicator (not nav)
- [ ] Long scroll → momentum feels native

---

## Common Patterns

### Pattern 1: Page with List + Bottom Nav

```tsx
export function MyPage() {
  return (
    <div className="rka-page">
      {/* Header - fixed at top */}
      <div className="page-header">...</div>
      
      {/* Scrollable content - fills middle */}
      <div className="page-content">
        {/* List items, cards, etc */}
      </div>
      
      {/* Bottom nav stays at bottom - not inside this div */}
    </div>
  );
}
```

CSS:
```css
.rka-page {
  padding-bottom: calc(env(safe-area-inset-bottom) + var(--rka-bottom-nav-height) + 24px);
}

.page-content {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
```

---

### Pattern 2: Page with Input + Bottom Nav

```tsx
export function SearchPage() {
  const [query, setQuery] = useState('');
  
  return (
    <div className="rka-page">
      {/* Input - scrolls away */}
      <input 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      {/* When focused, nav hides automatically */}
      
      {/* Results - scrollable */}
      <div className="results-list">
        {/* Results */}
      </div>
    </div>
  );
}
```

---

### Pattern 3: Page with Bottom Sheet

```tsx
export function ItemDetailPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  
  return (
    <div className="rka-page">
      <div className="item-content">...</div>
      
      <button onClick={() => setSheetOpen(true)}>
        Show Options
      </button>
      
      <BottomSheet open={sheetOpen} onDismiss={() => setSheetOpen(false)}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* Sheet options */}
        </div>
      </BottomSheet>
    </div>
  );
}
```

---

## Decision Tree: Will This Affect Bottom Nav?

```
Does your new feature...

├─ Add a new page?
│  └─ YES → Add padding-bottom to page
│
├─ Add scrollable content?
│  └─ YES → Add overscroll-behavior: contain + webkit-overflow-scrolling
│
├─ Add an input field?
│  └─ YES → Nav hides automatically, no action needed
│
├─ Add a bottom sheet?
│  └─ YES → Use BottomSheet primitive, add overscroll-behavior to content
│
├─ Add navigation between pages?
│  └─ YES → Use BottomTabNav, nav should stay visible
│
└─ Add a gesture?
   └─ YES → Test it doesn't conflict with iOS home indicator swipe
```

---

## FAQ

### "Do I need to test on real iOS?"

**Yes.** Simulator safe areas are wrong. Real iPhone shows:
- Correct home indicator (iPhone 15+: 34px, SE: 0px)
- Correct momentum scrolling behavior
- Correct gesture conflicts (or lack thereof)

You cannot verify this in simulator.

---

### "Can I use position: fixed for bottom nav?"

**No.** Use `position: absolute`. 

Fixed causes:
- Scroll battles with elastic bounce
- Safe area padding ignored
- Content confusion about what's layered

---

### "What if my page has lots of content?"

**Embrace scrolling.** Pages with enormous amounts of content should scroll. The bottom padding ensures the last item is visible.

Do NOT:
- Reduce padding to fit more
- Hide nav to reduce space
- Use multiple scroll directions

DO:
- Let it scroll naturally
- Keep padding-bottom consistent
- Test on real device to see how it feels

---

### "How do I know if my safe area values are right?"

**Test on the device:**
- iPhone 15+ should show 34px space below nav
- iPhone SE should show 0px (flush)
- iPad landscape should show left/right padding

If wrong, check:
1. Is `env(safe-area-inset-bottom)` in your CSS?
2. Do you have `viewport-fit=cover` in HTML meta tag?
3. Have you tested on a real device (not simulator)?

---

## Related Documentation

- **RKA_UI_HANDBOOK.md** — Design principles and patterns
- **IOS_BOTTOM_NAV.md** — iOS bottom nav specifics
- **SCROLL_BEHAVIOR.md** — Scroll behavior and momentum
- **CLAUDE.md** — Project conventions and constraints
- **memory/feedback_ios_bottom_nav.md** — Persistent rules (safe area + padding)

---

## Summary

**Mobile implementation is a three-part system:**

1. **Design** (RKA_UI_HANDBOOK) — What to build and why
2. **iOS Behavior** (IOS_BOTTOM_NAV + SCROLL_BEHAVIOR) — How iOS works
3. **Code** (Patterns above) — How to implement it

When adding anything new to RKA OS mobile:
- ✅ Read the handbook section
- ✅ Follow the pattern
- ✅ Add bottom padding to pages
- ✅ Add overscroll-behavior to scrolls
- ✅ Test on real iOS device

This prevents 80% of mobile bugs before they happen.

---

**Last Updated:** 2026-06-24  
**Status:** ✅ Complete Implementation Guide  
**Next Step:** Verify all documentation is followed on next new feature
