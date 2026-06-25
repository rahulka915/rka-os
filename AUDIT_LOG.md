# RKA OS - Audit Log

## Issue #1: Inbox Bottom Sheet Non-Dismissible (CRITICAL)

**Date/Time:** 2026-06-24 17:32 UTC  
**Severity:** CRITICAL - User-Trapping Bug  
**Status:** ✅ FIXED (2026-06-24 17:42 UTC)

### Description

When clicking the Inbox button on the Home page, the bottom sheet modal opens but becomes non-dismissible. Users cannot close it using any standard gesture and must refresh the entire page to escape.

### Observed Behavior

✅ **Works:**
- Inbox button click triggers sheet to open
- Sheet renders with correct UI (header "Inbox", input field, item list)
- Bottom sheet appears on screen

❌ **Broken:**
- Clicking outside the sheet has no effect
- Swiping down on sheet has no effect
- Pressing Escape key has no effect
- No visible close button (X) affordance
- Users trapped until page refresh

### Affected Components

**File:** `src/components/home/InboxSheet.tsx`  
**Component:** `InboxSheet`  
**UI Library:** `NativeBottomSheet` (wrapper around Vaul drawer from `src/components/ui/primitives.tsx`)

### Code Reference

```tsx
<NativeBottomSheet 
  open={open} 
  onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}
  snapPoints={['18%', '60%', '95%']}
  activeSnapPoint={snap}
  setActiveSnapPoint={setSnap}
>
```

The `onOpenChange` callback should fire when user attempts to dismiss, but it does not.

### Root Cause (Hypothesis)

1. **Focus trap** - Focus may be trapped inside the sheet with no escape key handler
2. **Backdrop/Overlay** - Click outside gesture may not be wired up or backdrop not clickable
3. **Gesture detection** - Swipe-down gesture may be disabled or misconfigured in Vaul
4. **Missing affordance** - No visible close button means users don't know how to dismiss

### Impact

- **User Experience:** Critical friction - users get stuck and must hard refresh
- **Mobile UX:** Particularly bad on mobile where users expect swipe-to-dismiss
- **Navigation:** Blocks access to all other app features once sheet opens
- **Data Loss Risk:** Hard refresh could lose unsaved state

### Testing Method

1. Navigate to Home page (logged in state)
2. Click "Inbox (7)" button
3. Attempt to close sheet:
   - Click outside sheet boundaries
   - Swipe down on sheet content
   - Press Escape key
   - Look for close button
4. Observe: All dismissal attempts fail
5. Only solution: `Cmd+R` / `Ctrl+R` page refresh

### Prevention Notes for Future

- **Always test dismissal paths** for modals/sheets during implementation, not just opening
- **Verify event handlers fire** - `onOpenChange` was defined but never triggered
- **Mobile gesture support** - Ensure swipe gestures work, especially swipe-to-dismiss
- **Always provide visible affordance** - Users need a clear way to close (close button, or clear swipe hint)
- **Test keyboard escape** - Modal should respond to Escape key
- **Test backdrop click** - Clicking outside modal should close it
- **Accessibility** - Ensure modal can be dismissed for users on keyboard + screen readers

### ✅ SOLUTION IMPLEMENTED

**File Modified:** `src/components/ui/primitives.tsx` (NativeBottomSheet component)

**What Was Done:**
1. Added explicit `handleOverlayClick` function to detect clicks on the overlay background
2. Added explicit `handleKeyDown` function to detect Escape key presses
3. Both handlers call `onOpenChange(false)` to close the sheet
4. Applied handlers to `VaulDrawer.Overlay` component

**Why It Works:**
The Vaul drawer's `onOpenChange` callback wasn't being triggered by user interactions. By adding explicit event handlers on the overlay itself, we bypass the Vaul component's internal behavior and ensure the sheet can always be dismissed.

**Testing Performed:**
- ✅ Overlay click → sheet closes, returns to Home
- ✅ Escape key → sheet closes, returns to Home
- ✅ Multiple cycles → all work consistently

**Files Updated:**
- `src/components/ui/primitives.tsx` - Added event handlers
- `AUDIT_LOG.md` - Marked as FIXED
- `FIX_LOG.md` - Documented fix attempt and results

---


---

## Issue #2: Inbox Sheet Content Not Visible (CRITICAL)

**Date/Time:** 2026-06-24 17:38 UTC  
**Severity:** CRITICAL - Feature doesn't work  
**Status:** OPEN - Content not rendering

### Description

The Inbox sheet opens but the content (list of inbox items) is not visible. The sheet appears as a blurry gray area with no actionable items displayed, despite the database containing 7 inbox items.

### Expected Behavior

When the Inbox sheet opens, users should see:
1. Header: "Inbox" with count (e.g., "7 waiting")
2. Input field for capturing new items
3. **Scrollable list of 7 inbox items** using ActionList component
4. Each item should be clickable/actionable

### Observed Behavior

✅ Sheet opens successfully  
❌ **Content is not visible** - appears as blurry/blank gray area  
❌ Cannot see the 7 inbox items  
❌ Cannot interact with any items

### Likely Root Causes

1. **Z-index stacking issue** - Overlay covering content despite z-index: 201
2. **Content not rendering** - ActionList or item components not displaying
3. **Flex layout broken** - Parent container not properly showing flex children
4. **Vaul wrapper issue** - Content not properly positioned in Vaul portal
5. **CSS overflow hidden** - Content clipped by ancestor overflow

### Files Involved

- `src/components/home/InboxSheet.tsx` - Sheet structure and layout
- `src/components/ui/primitives.tsx` - NativeBottomSheet wrapper
- `src/components/actions/ActionList.tsx` - Item list component
- `src/components/ui/primitives.css` - Sheet and overlay styling
- `src/components/actions/actions.css` - Action item styling

### Testing Method

1. Click Inbox button on Home
2. Wait for sheet to open
3. Observe: Should see "Inbox", input field, and 7 items below
4. Current: See only blurry gray area, no items visible


---

## Resolution Approach

**Decision: Fix NativeBottomSheet/Vaul, don't replace with custom primitive**

We'll work with the existing Vaul drawer implementation and solve the flex layout constraint that's preventing the wrapper from sizing correctly.

**Key Insight:**
The Vaul drawer is fundamentally a flex container. The wrapper inside needs to be sized correctly within that context. Solutions to explore:

1. **CSS approach**: Add rules to primitives.css for Vaul-specific flex handling
2. **Wrapper pattern**: Use `minHeight: 0` + `flex: 1` pattern (common flex issue fix)
3. **Vaul config**: Check if Vaul has props for controlling inner sizing
4. **Parent sizing**: Ensure `.rka-vaul-sheet` is properly constraining child dimensions

**Why not replace?**
- Vaul provides native-feeling mobile sheet behavior
- Avoiding custom implementation complexity
- Focus on fixing the constraint rather than rewriting

