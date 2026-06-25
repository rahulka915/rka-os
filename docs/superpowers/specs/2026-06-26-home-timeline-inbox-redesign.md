# Home Page: Timeline Section + Inbox Redesign

**Date:** 2026-06-26  
**Status:** Design Phase  
**Objective:** Transform home page from static dashboard to functional planner where users can process work directly without opening additional surfaces.

---

## Problem Statement

Currently, the home page is a read-only dashboard:
- Hero gradient card shows greeting + stats (no interaction)
- Companion message is informational only
- Inbox shortcut just opens a modal
- Timeline shows only item counts, not actual items
- No way to act on items directly from home

The result: users must navigate away from home to get any work done.

**Goal:** Make home a true planner where every section is interactive and actionable.

---

## Architecture Overview

### Conceptual Model

**Two separate work streams:**

1. **Inbox** (decision debt)
   - Temporary holding area for unprocessed inputs
   - Everything captured via Quick Add enters here first
   - Must be processed/moved to timeline before completion
   - Accessed via card that opens full modal

2. **Timeline** (committed work)
   - Shows only scheduled, processed actions for today
   - Organized by time of day (Anytime, Morning, Afternoon, Evening)
   - Fully interactive on home page
   - Items can be completed, edited, or moved directly

### Page Layout

```
┌─────────────────────────────────┐
│      AppHeader (fixed)          │  Profile | RKA OS | Synced
├─────────────────────────────────┤
│                                 │
│      ScrollView content         │
│                                 │
│   ┌─────────────────────────┐   │
│   │ Companion Message       │   │  "Morning clear. What are we..."
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │ Inbox Card              │   │  "3 items to process"
│   │ (opens full modal)       │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │ TimelineSection         │   │  Collapsed or expanded blocks
│   │ (4 time blocks)         │   │
│   │ (individual items)      │   │
│   └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│    Bottom Nav (fixed)           │
└─────────────────────────────────┘
```

---

## Component: TimelineSection

### State Management

```typescript
// Local component state
const [expandedSections, setExpandedSections] = useState({
  anytime: false,
  morning: false,
  afternoon: false,
  evening: false,
});
```

Each time block tracks its own `isExpanded` independently. Expanding one does NOT collapse others.

### Props

```typescript
interface TimelineSectionProps {
  todayItems: Item[];           // All items scheduled for today
  anytime: Item[];              // Items with timeOfDay: 'anytime'
  morning: Item[];              // Items with timeOfDay: 'morning'
  afternoon: Item[];            // Items with timeOfDay: 'afternoon'
  evening: Item[];              // Items with timeOfDay: 'evening'
  onItemTap?: (item: Item) => void;     // Navigate to edit
  onItemComplete?: (id: string) => void;
  onItemArchive?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTimeBlockAction?: (block: TimeBlock, action: string) => void;
}
```

### Visual States

#### Collapsed (default)

```
TODAY'S TIMELINE

⏰ Anytime        0
☀ Morning         2
☁ Afternoon       1
🌙 Evening        0
```

- Single row per time block
- Left: icon + label
- Right: count + arrow indicator
- No items visible

#### Expanded (after tap)

```
TODAY'S TIMELINE

⏰ Anytime

☀ Morning

  💊 Elvanse
  📚 Lecture review

☁ Afternoon        1

🌙 Evening        0
```

- Header remains (always visible)
- Items list below (only when expanded)
- Each item is a swipeable row (similar to InboxRow pattern)
- Hairline separators between items
- No collapse animation required (instant toggle is fine)

---

## Interactions

### Time Block Header

**Tap:**
- Toggle `expandedSections[block]` boolean
- If expanding, load items (already in props)
- If collapsing, hide items

**Long Press:**
- Show context menu with options:
  - **Add item** → Open QuickAddScreen with `scheduledDate: today` and `timeOfDay: block` pre-filled
  - **Move items here** → Open modal showing items from other blocks, select to move
  - **Sort** → Sort items in this block (by title alphabetically, or by creation date — TBD)
  - **Expand all** → Set all `expandedSections` to true
  - **Collapse all** → Set all `expandedSections` to false

**Swipe Left:**
- Complete all items in this block
- Show haptic feedback
- Trigger callback `onTimeBlockAction(block, 'completeAll')`
- Confirm dialog: "Complete X items?" with Cancel/Complete buttons (or direct with undo toast)

**Swipe Right:**
- Quick add into this block
- Show inline text input at bottom of expanded section, or open QuickAddScreen
- If inline: input field appears, submit creates item with `timeOfDay: block`
- If modal: same as long-press "Add item"

### Individual Item (when expanded)

**Tap:**
- Navigate to item detail/edit screen or open edit sheet
- Callback: `onItemTap(item)`

**Swipe Left:**
- Show action menu or quick-complete
- Options: Complete, Edit, Move to..., Delete
- Or quick-complete with undo

**Swipe Right:**
- Reserved for future (no-op for now)

**Long Press:**
- Context menu with actions:
  - Complete
  - Edit
  - Move to [other time block]
  - Delete
  - Copy

---

## Data Flow

1. **HomeScreen** queries `useHomeData()`
   - Returns: `todayItems`, `anytime`, `morning`, `afternoon`, `evening`, `inboxCount`

2. **HomeScreen** renders:
   - `<Companion />`
   - `<InboxCard inboxCount={inboxCount} onPress={openInboxModal} />`
   - `<TimelineSection todayItems={todayItems} anytime={anytime} ... />`

3. **TimelineSection** manages:
   - Local `expandedSections` state
   - Rendering time blocks (collapsed or expanded)
   - Passing swipe/tap callbacks

4. **User interactions trigger:**
   - Tap item → callback `onItemTap(item)` → navigate to detail screen
   - Complete item → callback `onItemComplete(id)` → DB update in parent
   - Swipe in timeline section → callback `onTimeBlockAction(block, action)` → bulk action in parent

5. **Parent (HomeScreen)** handles:
   - DB updates via `activateItem()`, `completeItem()`, etc.
   - Calling `refresh()` to re-query data
   - Navigation to item detail/edit screens

---

## Styling & Theme

**Reuse existing patterns:**
- Time block header: similar to current `TimeBlockRow` style
- Item rows: reuse `InboxRow` component or adapt to match Things 3 flat style
- Icons: Lucide React (Clock, Sun, Sunset, Moon)
- Colors: theme-aware via `getThemeColors(isDark)`
- Spacing: 16pt horizontal padding, 12pt row vertical padding, 8pt gap between items

**Dark mode:**
- All colors via `getThemeColors(isDark)`
- Separators: `rgba(255,255,255,0.10)` (dark) vs `rgba(0,0,0,0.08)` (light)

---

## Swipe Gestures

**Implementation:** Reuse `SwipeableItem` component (already used in InboxScreen)
- Left swipe: reveal action buttons (Complete, Archive, Delete)
- Right swipe: reveal Quick Add (or reserved)
- Haptics on swipe start

**Note:** Must ensure swipe doesn't conflict with scroll — use `overscroll-behavior: contain` on scrollable lists.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No items in a time block | Show 0 count, section still tappable (expands to empty), allow Add |
| All sections empty | Show all as collapsed with 0 counts, full page is empty |
| Item created, moved, or deleted | Parent calls `refresh()`, data re-queries and re-renders |
| Swipe "complete all" on empty section | No-op or show toast "No items to complete" |
| User is editing an item and returns to home | Data refreshes automatically (via `useHomeData()` reactivity) |

---

## Testing Strategy

**Unit tests:**
- Expand/collapse state toggles correctly
- Long-press context menu renders all options
- Swipe actions trigger correct callbacks

**Integration tests:**
- Tapping item navigates to detail screen
- Completing an item updates DB and removes from timeline
- Adding item to a block updates that block's item list
- Refresh re-queries and re-renders correctly

**Manual testing:**
- Expand multiple sections simultaneously
- Swipe on items while section is expanded
- Scroll timeline while section expanded (no jank)
- Dark/light mode rendering

---

## Implementation Phases

### Phase 1: TimelineSection Component
- Create `src/components/TimelineSection.tsx`
- Static rendering of 4 time blocks (collapsed state)
- Tap to expand/collapse
- Render items when expanded (using existing `InboxRow` or adapted row component)

### Phase 2: Interactions
- Long-press context menu
- Swipe left/right on items
- Swipe on time block headers

### Phase 3: Home Page Integration
- Remove hero gradient
- Update HomeScreen layout
- Connect TimelineSection to home data flow
- Test data refresh on item actions

### Phase 4: Polish
- Animations for expand/collapse (optional)
- Haptic feedback tuning
- Edge case handling

---

## Related Components

- **InboxScreen.tsx** — Unchanged (separate modal for processing inbox)
- **InboxRow.tsx** — Can be reused or adapted for timeline items
- **SwipeableItem.tsx** — Used for swipe gestures on items
- **ContextMenu.tsx** — Used for long-press menus
- **HomeScreen.tsx** — Updated to remove hero, integrate TimelineSection

---

## Success Criteria

✅ User can expand/collapse time blocks independently on home page  
✅ User can see actual items in each time block without leaving home  
✅ User can tap an item to edit it  
✅ User can swipe to complete/archive items  
✅ User can long-press to access bulk actions (Expand All, Collapse All, Add Item, Move Items)  
✅ Swipe left "complete all" works without opening a new surface  
✅ Swipe right "quick add" creates item directly in that time block  
✅ Page remains responsive with multiple sections expanded  
✅ Dark/light mode rendering is correct  
✅ No jank when scrolling or swiping  

---

## Notes & Future Improvements

- **Sort options** in long-press menu (alphabetical, creation date, priority) — TBD
- **Move items modal** UI design — TBD
- **Animations** for expand/collapse — optional, not required for v1
- **Drag-reorder** items within a section — future enhancement
- **Pull-to-refresh** on timeline — future enhancement
- **Keyboard handling** — ensure keyboard doesn't hide quick-add input

