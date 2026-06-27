# Things 3 Design System — Mobile

This document defines the Things 3-inspired design patterns used in RKA OS Mobile. All new UI components should follow these patterns for consistency.

---

## Core Principles

1. **Flat & minimal** — no gradients, minimal shadows, rely on typography and color for hierarchy
2. **Whitespace-heavy** — generous padding, hairline separators instead of borders
3. **Toolbar-based** — forms use top/bottom toolbars, not floating buttons or modals within modals
4. **Circle checkboxes** — the primary interaction affordance for lists (activate/complete)
5. **Inline capture** — text input at the bottom of sheets, not as a separate modal
6. **Haptics on everything** — user feedback via vibration, not animation

---

## UI Patterns

### Pattern 1: Capture Sheet (Modal Input)

Used for: QuickAddScreen, inline capture in InboxScreen

**Anatomy:**
```
┌─ top of screen ─────────────────────┐
│  (blur + dark overlay)              │
├─────────────────────────────────────┤
│   ⎯⎯⎯ (drag handle)                │  16pt from top
├─────────────────────────────────────┤
│   Title Input (20pt, bold)          │  autofocused, unstyled
│   (no border, no box)               │
├─────────────────────────────────────┤
│   Notes Input (15pt, secondary)     │  optional, smaller
├─────────────────────────────────────┤
│   💙 When  🏷️ Tags  🚩 Priority    │  metadata pills (visual)
├─────────────────────────────────────┤
│   [Cancel]  [empty]  [Save→]       │  toolbar: disabled if no text
└─────────────────────────────────────┘
```

**Colors:**
- Sheet bg: light #ffffff | dark #1c1c1e
- Backdrop: rgba(0,0,0,0.45)
- Title text: light #000000 | dark #ffffff
- Placeholder: light rgba(0,0,0,0.22) | dark rgba(255,255,255,0.28)
- Pills: $blue pill highlighted, others muted gray

**Implementation:**
- Modal with `transparent` + backdrop View
- KeyboardAvoidingView for iOS
- Hairline separators between sections
- Save button disabled (`opacity: 0.28`) until input.length > 0

**Files:**
- QuickAddScreen.tsx — full-screen capture
- InboxScreen.tsx — bottom capture row (CaptureRow component)

---

### Pattern 2: Flat List (No Cards)

Used for: InboxScreen items, Dose history

**Anatomy:**
```
┌─ Header ───────────────────────────┐
│  Inbox (Large Title)               │  28pt bold, -0.5 letter-spacing
│  12 items to process (Subtitle)    │  13pt, secondary color
└─────────────────────────────────────┘

┌─ List Items ────────────────────────┐
│  ○ First To-Do                      │  circle checkbox on left
│    Optional notes here              │  secondary text, smaller
├─ (hairline separator) ─────────────┤  not full-width, indented
│  ○ Second To-Do                     │
│                                     │
├─────────────────────────────────────┤  <- swipe left/right
│  + New To-Do                        │  dashed circle + input (persistent capture)
└─────────────────────────────────────┘
```

**Colors:**
- Circle border: light rgba(0,0,0,0.18) | dark rgba(255,255,255,0.22)
- Separator: light rgba(0,0,0,0.06) | dark rgba(255,255,255,0.07)
- Title: light #000000 | dark #ffffff
- Notes: light rgba(0,0,0,0.38) | dark rgba(255,255,255,0.40)

**Gestures:**
- Tap circle → activate item (haptic: success)
- Swipe left → archive action
- Swipe right → activate/complete action
- Long press → context menu (Activate | Archive | Delete)

**Implementation:**
- FlatList with `keyExtractor` and `renderItem`
- StyleSheet for row/circle styles (hardcoded light/dark colors)
- SwipeableItem wrapper for swipe actions
- ContextMenu wrapper for long-press
- Hairline: `StyleSheet.hairlineWidth`
- Capture row at bottom with dashed border-style

**Files:**
- InboxScreen.tsx — main inbox list + capture row

---

### Pattern 3: Toolbar (Top Button Row)

Used for: LogDoseSheet, form headers with Save/Cancel

**Anatomy:**
```
┌─ Toolbar ─────────────────────────────┐
│  [Cancel]  Dose Log  [Save→]         │  fixed-width sides (64pt each)
├───────────────────────────────────────┤  hairline separator below
│  Content...                           │
└───────────────────────────────────────┘
```

**Colors:**
- Cancel: light rgba(0,0,0,0.32) | dark rgba(255,255,255,0.38)
- Title (center): light #000000 | dark #ffffff
- Save: #007aff (always, no dim)
- Separator: hairline gray

**Implementation:**
- XStack with flex: 1 center, fixed 64pt sides
- Left and right are TouchableOpacity
- Center is just Text (or YStack for title + subtitle)
- Top hairline border below toolbar
- Save disabled: `opacity: 0.28` or `color: rgba(..., 0.28)`

**Files:**
- LogDoseSheet.tsx — dose logging form

---

### Pattern 4: Circle Checkbox

Used for: activating/completing items in lists

**Anatomy:**
```
  ○ (inactive, tappable)   [22×22pt, 1.5pt border]
  ● (active, not shown in list; shows checkmark on swipe)
```

**Styling:**
```javascript
const circle = StyleSheet.create({
  width: 22,
  height: 22,
  borderRadius: 11,
  borderWidth: 1.5,
  borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
  flexShrink: 0,  // prevent flex collapse
  marginTop: 1,   // optical alignment with text baseline
});
```

**Interaction:**
- Tap → call `onActivate()` with haptic feedback
- Swipe reveals action buttons with checkmark icon
- No fill/gradient, just border

---

### Pattern 5: Metadata Pills (Optional)

Used for: Capture sheets to hint at advanced features

**Anatomy:**
```
[💙 When] [🏷️ Tags] [🚩 Priority]
```

**Styling:**
```javascript
const pill = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  borderRadius: 6,
  paddingHorizontal: 10,
  paddingVertical: 5,
  backgroundColor: 'rgba(0,122,255,0.10)',  // highlighted
  // or for inactive:
  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
};
```

**Current Status:**
- Visually present in QuickAddScreen and CaptureRow
- Tap handlers wired but features TBD (When = date picker, Tags = tag manager, Priority = flag)

---

## Dark Mode Support

All components must support light + dark seamlessly.

**Pattern:**
```typescript
const { isDark } = useThemeContext();

const textColor   = isDark ? '#f2f2f2' : '#000000';
const bgColor     = isDark ? '#0c0c0c' : '#f2f2f7';
const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';

// Use in StyleSheet
<View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
  <Text style={[styles.text, { color: textColor }]}>Hello</Text>
</View>
```

**Do NOT use:**
- Theme.colors — only use explicit hex/rgba values
- Inverted colors (light colors in dark mode, vice versa) — use desaturated variants
- Color only to convey meaning — always use text/icon alongside

---

## Haptics Map

| Action | Haptic | When |
|--------|--------|------|
| Tap checkbox/button | Light impact | Immediately on tap |
| Form submit | Success notification | After valid input |
| Item action (archive/delete) | Warning notification | Before destructive action |
| Swipe threshold crossed | Light impact | When drag reaches threshold |
| Mode toggle (e.g., How Long Ago → Exact Time) | Light impact | On press |
| List item long-press | Light impact | When menu appears |

---

## File Naming & Location

```
apps/mobile/src/
├── screens/
│   ├── QuickAddScreen.tsx          ← capture sheet
│   ├── InboxScreen.tsx              ← flat list + capture row
│   └── [other screens]
├── components/
│   ├── LogDoseSheet.tsx             ← toolbar + form
│   ├── SwipeableItem.tsx            ← swipe wrapper
│   ├── ContextMenu.tsx              ← long-press menu
│   └── [other components]
└── hooks/
    └── useThemeContext.ts           ← dark mode provider
```

---

## Checklists

### Adding a New Capture Sheet
- [ ] Modal with transparent backdrop
- [ ] Drag handle at top
- [ ] Title input (20pt, autofocused, unstyled)
- [ ] Optional notes input with hairline separator
- [ ] Toolbar: Cancel (left, gray) | Title (center) | Save (right, blue, disabled until text)
- [ ] Theme-aware colors (isDark check)
- [ ] Haptics on submit

### Adding a New List Component
- [ ] FlatList with flat rows (no cards)
- [ ] Circle checkbox on left (22pt)
- [ ] Title + optional notes (two text colors)
- [ ] Hairline separators (indented, not full-width)
- [ ] SwipeableItem + ContextMenu wrappers
- [ ] Empty state with icon + title + subtitle
- [ ] Optional: inline capture row at bottom

### Adding a New Form with Toolbar
- [ ] Top toolbar: Cancel (left) | Title (center) | Save (right)
- [ ] Fixed 64pt width on sides, flex center
- [ ] Hairline border below toolbar
- [ ] All controls below toolbar, not inside
- [ ] Save disabled if form invalid
- [ ] Haptics on mode/state changes

---

## References

- **Design Inspiration:** Things 3 (iOS app)
- **Color System:** `apps/mobile/src/theme/colors.ts`
- **Spacing Scale:** `apps/mobile/src/theme/spacing.ts`
- **Component Examples:** See InboxScreen.tsx, QuickAddScreen.tsx, LogDoseSheet.tsx
