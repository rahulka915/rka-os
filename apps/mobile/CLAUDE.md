# RKA OS Mobile — Claude Code Configuration

**Platform:** React Native + Expo SDK 54 (iOS-first)  
**Database:** SQLite (expo-sqlite)  
**Design System:** Things 3-inspired interaction patterns (this file, below); visual look is a separate, actively-evolving Moonly/Ronin-inspired refresh — see `DESIGN_CHECKLIST.md` for current tokens, motifs, and per-component status before touching any styling. Settled/graduated decisions live in `../../docs/design-system/` (`reference/` for AI-facing spec + rationale, `handbook/` for a human-facing visual tour) — check there for anything not actively in flux on the checklist.  
**Status:** Ready for Expo development build; features requiring native code (HealthKit, true background fetch) need a dev client and Apple Developer signing

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

### Things 3 Flow Handoff

Use the following Mobbin references as the current source of truth for Things 3-style mobile flow work:

- [Creating a new to do (shortcut)](https://mobbin.com/flows/b88466ae-38b3-4c00-bfd1-a30197abf09c)
- [Creating a new to-do](https://mobbin.com/flows/b1fa3cd6-e51a-4c76-9b52-747df82afefe)
- [Creating a new project](https://mobbin.com/flows/1999adcb-b259-4ae5-a6f2-2ea992810fbb)
- [Task detail screen 1](https://mobbin.com/screens/18b05379-2af1-41ab-afef-0ca4870933c1)
- [Task detail screen 2](https://mobbin.com/screens/838b35e9-1462-4b3b-bbae-215fb9cc12a0)
- [Task detail screen 3](https://mobbin.com/screens/8de8b342-f6ab-40c7-ac9b-0599039b105f)
- [Task detail screen 4](https://mobbin.com/screens/34ad19d8-7254-455e-a9f8-360e215228eb)

Handoff summary for Claude:

- Treat Things 3 as the flow reference, not the exact visual target.
- Optimize for fast capture first, then progressive disclosure.
- Keep creation flows short, modal, and keyboard-friendly.
- Prefer bottom sheets / capture sheets over full-screen form stacks for quick actions.
- Keep list views flat and lightweight: text first, minimal chrome, clear separators, obvious swipe affordances.
- Project creation should feel guided and structured, not like a blank settings form.
- Task detail should expose notes, schedule, and metadata without overwhelming the primary action.
- If a UX change adds friction to capture, it needs a strong reason.

### Reference Board

Use these Mobbin references for the current RKA mobile visual direction:

**Ronin hero / avatar direction**
- [Shadow Ronin hero page](https://mobbin.com/screens/74201708-1b1b-4b6d-b804-92f9eb2d65c9)
- [Shadow Ronin companion / avatar variants](https://mobbin.com/screens/00604675-8c71-49e9-b454-4924ace45e4d)
- [Shadow Ronin avatar customization](https://mobbin.com/screens/68a30b4e-5c83-4deb-adcc-6c894e36692d)

**Motion-heavy / never-static references**
- [Not Boring Calculator onboarding](https://mobbin.com/flows/ee3a1e29-332d-4141-b2f1-781022885bf7)
- [Not Boring Weather onboarding](https://mobbin.com/flows/9b497adc-67c2-4da9-b1bc-9fc583083113)
- [Finch onboarding](https://mobbin.com/flows/80ef83ef-f872-4825-b18d-6b193d60a9aa)
- [Gentler Streak onboarding](https://mobbin.com/flows/8d4fa57c-117e-4557-8d5c-4d241bfdf9d4)
- [Opal celebration 1](https://mobbin.com/screens/5e08d4e5-1964-43b1-9261-9d7f470a6ba5)
- [Opal celebration 2](https://mobbin.com/screens/1d74f26a-b6c3-4a99-9c7e-0574d6147482)

**Quick add / bottom sheet flow**
- [Things 3 new to-do](https://mobbin.com/flows/b1fa3cd6-e51a-4c76-9b52-747df82afefe)
- [Things 3 shortcut quick add](https://mobbin.com/flows/b88466ae-38b3-4c00-bfd1-a30197abf09c)
- [Tiimo add task](https://mobbin.com/flows/704b09e2-a516-4150-ba3e-14b0d411e4a5)
- [Evernote new task](https://mobbin.com/flows/2954b6d8-6c44-40c7-ae25-648861602dbc)
- [Asana new task](https://mobbin.com/flows/38f5c2dc-1887-4888-98ce-ee986910816d)

Claude should treat these as direct design references and not invent a competing visual language unless the task explicitly calls for it.

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

- **backgroundSync.ts** — 15-min background task (expo-background-task, guarded import for runtimes without native support)
- **locationReminders.ts** — geofencing with arrive/leave notifications

### Theme (`src/theme/`)

- **colors.ts** — all palette tokens as TS constants
- **spacing.ts** — spacing scale, radius, shadows, font sizes
- **index.ts** — exported constants used in StyleSheet definitions

### Ronin 3D Companion

A real, working 3D character (Fable 5's GLB export, `assets/ronin/model/ronin_companion_v0.glb`)
is available app-wide via `src/components/home/RoninCharacter.tsx`. It's mood-driven
(`RoninMood` → animation clip, see `src/domain/ronin/roninModel.ts`), renders through an Expo
DOM component (`Ronin3DDom.tsx` — web three.js in a webview, no native modules needed), and
falls back to a static PNG automatically if the GL scene fails. The renderer is transparent
(`alpha: true`, no scene background) — droppable into any container, no box/border required,
though the character is near-black and reads best against a mid-to-dark backdrop given the
current static lighting rig.

**Current mount:** only `ProfileScreen.tsx`'s `Ronin3DBench` (`__DEV__`-only, all 6 moods
switchable) — kept as the single live visualization surface while Fable 5 continues
improving the character (richer idle motion now; a skinned rig for real gestures/tap
reactions later — see model manifest `notes.limitations`). **Not currently mounted on Home**
— `RoninHero.tsx` renders only the status/XP card (`RoninGreetingCard.tsx`); the 3D stage
component (`RoninStage.tsx`, full-width 300px stage with time-of-day gradient) still exists
and is ready to drop back in once the character is ready to be the default Home experience.
No other screen currently uses `RoninCharacter` — do so freely; each mount does its own GLB
load and spins up its own WebGL context, so avoid mounting many instances at once (e.g. in a
list).

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

### Dev Build Requirements
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
5. **Deep links** — `rkaos://inbox`, `rkaos://item/:id`
7. **Skia charts** — progress rings on home stats
8. **Rive animations** — loading, empty states, check animations

---

## Quick Reference

### Run the Dev Client
```bash
cd apps/mobile
npm start -- --clear
# Open the installed RKA OS dev client and scan the QR code
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
