# RKA OS Mobile — Claude Code Configuration

**Platform:** React Native + Expo SDK 54 (iOS-first)  
**Database:** SQLite (expo-sqlite)  
**Design System:** Things 3-inspired flat, minimal aesthetic  
**Status:** Functional in Expo Go; features requiring native code (HealthKit, true background fetch) blocked on Apple Developer account

---

## Design Patterns

### Things 3-Style UI

All sheets, forms, and input flows follow Things 3's minimalist patterns:

#### Capture Sheets (QuickAddScreen, InboxScreen bottom row)
- **Transparent modal backdrop** with `~45%` dark overlay (tappable to dismiss)
- **Bottom-anchored sheet** rising with keyboard, rounded top corners (20pt radius)
- **Title input** — large unstyled TextInput (20-22px, bold), autofocused
- **Notes input** — secondary smaller input with hairline separator above
- **Metadata pills** — optional tags/when/priority (visual, wiring TBD)
- **Toolbar pattern** — single row at bottom: **Cancel** (left, gray) | future center area | **Save** (right, blue, disabled until text)

#### Inbox-Style Lists (InboxScreen)
- **Flat rows** — no cards, no backgrounds, no shadows
- **Circle checkbox** on left (22×22pt, 1.5pt border, hollow until active)
- **Title + notes** right of circle (text not card)
- **Hairline separators** between rows (indented to text baseline, not full-width)
- **Swipe actions** on left/right (preserved from SwipeableItem)
- **Long-press context menu** (preserved from ContextMenu)
- **Capture row** at bottom (dashed circle + placeholder input, persistent)

#### Toolbars (LogDoseSheet, etc.)
- **Single-row pattern** at top: **Cancel** (left) | **Title/Subtitle** (center) | **Save** (right, blue)
- **Alignment:** both sides are fixed 64pt wide, center area flexible
- **Styling:** no separators, just hairline borders where needed

#### Color Palette (Theme-Aware)
```
Light Mode:
  bg: #f2f2f7
  text: #000000
  textSecondary: rgba(0,0,0,0.38)
  textTertiary: rgba(0,0,0,0.30)
  surface: #ffffff
  separator: rgba(0,0,0,0.08)
  primary: #007aff (blue)
  success: #34a853 (green)
  error: #ff3b30 (red)

Dark Mode:
  bg: #0c0c0c
  text: #f2f2f2
  textSecondary: rgba(255,255,255,0.40)
  textTertiary: rgba(255,255,255,0.28)
  surface: #1c1c1e
  separator: rgba(255,255,255,0.10)
  (primary/success/error unchanged)
```

---

## Component Structure

### Screens (`src/screens/`)

| File | Pattern | Notes |
|------|---------|-------|
| `HomeScreen.tsx` | Tamagui XStack/YStack | Real DB data, stats, time blocks |
| `InboxScreen.tsx` | RN primitives (FlatList, StyleSheet) | Things 3 flat rows + capture |
| `QuickAddScreen.tsx` | RN primitives (Modal, TextInput, StyleSheet) | Things 3 sheet with toolbar |
| `MedicationsScreen.tsx` | Tamagui | Timer, take button, LogDoseSheet |
| `CalendarScreen.tsx` | Tamagui + custom timeline | Week strip, protocol-style instances |
| `MenuScreen.tsx` | Tamagui | Navigation stubs |
| `ProfileScreen.tsx` | Tamagui | Placeholder |

### Components (`src/components/`)

| File | Uses | Purpose |
|------|------|---------|
| `AppHeader.tsx` | Tamagui | Profile | RKA OS | Synced (top-level) |
| `SwipeableItem.tsx` | RN Gesture Handler + Reanimated | Swipe left/right with haptics |
| `ContextMenu.tsx` | RN long-press | 3D Touch-style menu |
| `LogDoseSheet.tsx` | Tamagui + RN Modal | LogDose form with Things 3 toolbar |
| `AvatarCompanion.tsx` | Tamagui | Placeholder avatar/initials |

### Database (`src/db/`)

- **database.ts** — SQLite init, schema, all CRUD functions
- **types.ts** — TypeScript interfaces for Item, ItemInstance, ActivityLog
- **Key functions:**
  - `createItem(type, title, status, scheduledDate?, notes?)` — now accepts optional `notes`
  - `getInboxItems()`, `getTodayItems()`, `getItemsByStatus()`
  - `logMedicationTaken(itemId, takenAt?)`, `getMedicationLogs()`, `editMedicationLog()`, `deleteMedicationLog()`

### Hooks (`src/hooks/`)

- **useDb.ts** — `useInbox()`, `useHomeData()`, `useItems()`, reactive DB queries
- **useNotifications.ts** — badge, scheduling, daily reminders
- **useThemeContext.ts** — dark mode toggle + system preference

### Services (`src/services/`)

- **backgroundSync.ts** — 15-min background task (expo-background-task, dynamic import for Expo Go)
- **locationReminders.ts** — geofencing with arrive/leave notifications

### Theme (`src/theme/`)

- **colors.ts** — all palette tokens as TS constants
- **spacing.ts** — spacing scale, radius, shadows, font sizes
- **index.ts** — exported constants used in StyleSheet definitions

---

## Styling Strategy

### Tamagui vs. StyleSheet

- **Tamagui** — HomeScreen, MenuScreen, calcs that need theme switching (light/dark)
- **StyleSheet** — InboxScreen, QuickAddScreen, LogDoseSheet (static Things 3 patterns with hardcoded light/dark colors in component)

### Dark Mode

- **System preference** — read via `useColorScheme()` in App.tsx
- **Manual toggle** — ThemeContext.toggle() updates both local state and TamaguiProvider `defaultTheme`
- **Component pattern** — `const { isDark } = useThemeContext()` then pass theme-aware colors to RN StyleSheet

### Spacing Scale
```
$1 = 4pt, $2 = 8pt, $3 = 12pt, $4 = 16pt, $5 = 20pt, $6 = 24pt
```
Used in Tamagui (XStack/YStack gap, padding). StyleSheet uses literal pt values.

---

## Known Constraints

### Expo Go Limitations
- **BlurView** — not available; using semi-transparent backgroundColor instead
- **HealthKit** — requires dev build (react-native-health)
- **Skia** — requires dev build (@shopify/react-native-skia)
- **Rive** — requires dev build (rive-react-native)
- **True background fetch** — requires dev build (expo-background-task can run, but no reliable periodic wake)
- **Geofencing** — requires dev build (expo-location basic permission works)

### SDK 54 Gotchas
- `npm install --legacy-peer-deps` required for all packages
- `babel.config.js` must have reanimated plugin, NOT app.json
- tsconfig must NOT extend expo/tsconfig.base
- `lucide-react-native` v1.21.0+
- `react-native-get-random-values` v1.11.0

---

## Next Steps (Prioritized)

1. **Apple Developer Account** — required to build dev client
2. **HealthKit screen** — once dev build available
3. **Wiring metadata pills** — When/Tags/Priority in capture sheets
4. **Calendar screen** — full functionality
5. **Supabase sync** — wire backgroundSync to real API
6. **Deep links** — `rkaos://inbox`, `rkaos://item/:id`
7. **Skia charts** — progress rings on home stats
8. **Rive animations** — loading, empty states, check animations

---

## Quick Reference

### Run Expo Go
```bash
cd apps/mobile
npm start -- --clear
# Scan QR with iPhone
```

### TypeScript Check
```bash
npx tsc --noEmit
```

### File Locations
| Thing | File |
|-------|------|
| DB schema/queries | `src/db/database.ts` |
| Types | `src/db/types.ts` |
| Home/Inbox logic | `src/hooks/useDb.ts` |
| Notifications | `src/hooks/useNotifications.ts` |
| Background sync | `src/services/backgroundSync.ts` |
| Location reminders | `src/services/locationReminders.ts` |
| Colors/spacing | `src/theme/` |
| Inbox + Capture UI | `src/screens/InboxScreen.tsx` |
| Quick add sheet | `src/screens/QuickAddScreen.tsx` |
| Medications + LogDose | `src/screens/MedicationsScreen.tsx` + `src/components/LogDoseSheet.tsx` |

---

## Style Sheet Template

Reusable pattern for flat UI components with theme awareness:

```typescript
import { StyleSheet } from 'react-native';
import { useThemeContext } from '../hooks/useThemeContext';

function MyComponent() {
  const { isDark } = useThemeContext();
  
  const textColor = isDark ? '#f2f2f2' : '#000000';
  const bgColor = isDark ? '#1c1c1e' : '#ffffff';
  
  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>Hello</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 12 },
  text: { fontSize: 16, fontWeight: '500' },
});
```

This ensures light/dark mode support without needing Tamagui's overhead on every component.
