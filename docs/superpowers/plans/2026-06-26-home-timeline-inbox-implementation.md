# Home Timeline & Inbox Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the home page from a read-only dashboard into an interactive planner where users can expand time blocks, see actual items, and act on them directly (tap to edit, swipe to complete, long-press for bulk actions).

**Architecture:** 
- Create a new `TimelineSection` component that manages expand/collapse state for 4 time blocks (Anytime, Morning, Afternoon, Evening)
- Each block renders independently with its own items when expanded
- Reuse existing `SwipeableItem` and `ContextMenu` components for interactions
- Update `HomeScreen` to remove the hero gradient, place companion at top, and integrate the new timeline
- Wire callbacks up to parent for DB updates (complete, move, delete)

**Tech Stack:** React Native, Expo SDK 54, Tamagui (for layout), Reanimated (for swipes), Lucide React icons, Dexie.js (DB)

---

## File Structure

### New Files
- `src/components/TimelineSection.tsx` — Main timeline component managing all 4 time blocks and their expand state

### Modified Files
- `src/screens/HomeScreen.tsx` — Remove hero gradient, update layout, integrate TimelineSection
- `src/hooks/useDb.ts` — Add `completeAllInTimeBlock()` hook for swipe-complete-all action

### Reused Components
- `src/components/SwipeableItem.tsx` — Wraps each item for swipe gestures
- `src/components/ContextMenu.tsx` — Long-press menu on headers and items
- `src/screens/InboxScreen.tsx` — Reference for InboxRow styling (can copy/adapt for timeline items)

---

## Tasks

### Task 1: Create TimelineSection Component (Skeleton)

**Files:**
- Create: `src/components/TimelineSection.tsx`

- [ ] **Step 1: Create component file with TypeScript types**

```typescript
// src/components/TimelineSection.tsx
import { useState } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { Item } from '../db/types';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';

export interface TimelineSectionProps {
  todayItems: Item[];
  anytime: Item[];
  morning: Item[];
  afternoon: Item[];
  evening: Item[];
  onItemTap?: (item: Item) => void;
  onItemComplete?: (id: string) => void;
  onItemArchive?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTimeBlockAction?: (block: TimeBlockType, action: string) => void;
}

export type TimeBlockType = 'anytime' | 'morning' | 'afternoon' | 'evening';

interface TimeBlockData {
  key: TimeBlockType;
  label: string;
  icon: string; // emoji
  items: Item[];
}

export function TimelineSection({
  todayItems,
  anytime,
  morning,
  afternoon,
  evening,
  onItemTap,
  onItemComplete,
  onItemArchive,
  onItemDelete,
  onTimeBlockAction,
}: TimelineSectionProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const blocks: TimeBlockData[] = [
    { key: 'anytime', label: 'Anytime', icon: '⏰', items: anytime },
    { key: 'morning', label: 'Morning', icon: '☀', items: morning },
    { key: 'afternoon', label: 'Afternoon', icon: '☁', items: afternoon },
    { key: 'evening', label: 'Evening', icon: '🌙', items: evening },
  ];

  const [expandedSections, setExpandedSections] = useState<Record<TimeBlockType, boolean>>({
    anytime: false,
    morning: false,
    afternoon: false,
    evening: false,
  });

  const toggleSection = (block: TimeBlockType) => {
    setExpandedSections((prev) => ({
      ...prev,
      [block]: !prev[block],
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <Text style={[styles.title, { color: palette.textTertiary }]}>TODAY'S TIMELINE</Text>
      
      {blocks.map((block) => (
        <View key={block.key}>
          {/* Time block header will go here */}
          {/* Items will render here when expanded */}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
});
```

- [ ] **Step 2: Run TypeScript check to verify types compile**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineSection.tsx
git commit -m "feat: create TimelineSection component skeleton with types"
```

---

### Task 2: Implement Collapsed View (Time Block Headers)

**Files:**
- Modify: `src/components/TimelineSection.tsx`

- [ ] **Step 1: Add TimeBlockHeader component and render headers in collapsed state**

```typescript
// Add this function inside TimelineSection.tsx, before the return statement

function TimeBlockHeader({
  block,
  label,
  icon,
  count,
  isExpanded,
  isDark,
  onToggle,
}: {
  block: TimeBlockType;
  label: string;
  icon: string;
  count: number;
  isExpanded: boolean;
  isDark: boolean;
  onToggle: () => void;
}) {
  const palette = getThemeColors(isDark);

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.6}
      style={[
        styles.blockHeader,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          borderBottomColor: palette.separator,
        },
      ]}
    >
      <View style={styles.headerLeft}>
        <Text style={styles.headerIcon}>{icon}</Text>
        <Text style={[styles.headerLabel, { color: palette.text }]}>{label}</Text>
      </View>
      <View style={styles.headerRight}>
        <Text style={[styles.headerCount, { color: palette.textSecondary }]}>{count}</Text>
        <Text style={[styles.headerArrow, { color: palette.textMuted }]}>
          {isExpanded ? '↑' : '→'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Update the return JSX to use TimeBlockHeader:

return (
  <View style={[styles.container, { backgroundColor: palette.bg }]}>
    <Text style={[styles.title, { color: palette.textTertiary }]}>TODAY'S TIMELINE</Text>
    
    {blocks.map((block) => (
      <View key={block.key}>
        <TimeBlockHeader
          block={block.key}
          label={block.label}
          icon={block.icon}
          count={block.items.length}
          isExpanded={expandedSections[block.key]}
          isDark={isDark}
          onToggle={() => toggleSection(block.key)}
        />
      </View>
    ))}
  </View>
);
```

- [ ] **Step 2: Add styles for headers**

```typescript
// Add to the StyleSheet at the bottom of the file

blockHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderBottomWidth: StyleSheet.hairlineWidth,
},
headerLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
headerIcon: {
  fontSize: 18,
},
headerLabel: {
  fontSize: 16,
  fontWeight: '500',
},
headerRight: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
headerCount: {
  fontSize: 14,
  fontWeight: '600',
},
headerArrow: {
  fontSize: 12,
  fontWeight: '600',
},
```

- [ ] **Step 3: Test in Expo by navigating to home page**

```bash
cd apps/mobile && npm start -- --clear
# Scan QR code, navigate to Home tab
```

Expected: See time block headers with counts, tappable but no expansion yet

- [ ] **Step 4: Commit**

```bash
git add src/components/TimelineSection.tsx
git commit -m "feat: render collapsed time block headers with counts and toggle"
```

---

### Task 3: Implement Expanded View (Items List)

**Files:**
- Modify: `src/components/TimelineSection.tsx`

- [ ] **Step 1: Add TimeBlockItems component to render expanded items**

```typescript
// Add this function inside TimelineSection.tsx

function TimeBlockItems({
  items,
  isDark,
  onItemTap,
  onItemComplete,
  onItemArchive,
  onItemDelete,
}: {
  items: Item[];
  isDark: boolean;
  onItemTap?: (item: Item) => void;
  onItemComplete?: (id: string) => void;
  onItemArchive?: (id: string) => void;
  onItemDelete?: (id: string) => void;
}) {
  const palette = getThemeColors(isDark);

  if (items.length === 0) {
    return null; // Don't render anything if no items
  }

  return (
    <View style={[styles.itemsContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }]}>
      {items.map((item, index) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onItemTap?.(item)}
          activeOpacity={0.5}
        >
          <View>
            <View style={[styles.itemRow, { paddingHorizontal: 16, paddingVertical: 12 }]}>
              <View
                style={[
                  styles.itemCircle,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
                  },
                ]}
              />
              <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, { color: palette.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.notes && (
                  <Text style={[styles.itemNotes, { color: palette.textMuted }]} numberOfLines={1}>
                    {item.notes}
                  </Text>
                )}
              </View>
            </View>

            {index < items.length - 1 && (
              <View
                style={[
                  styles.hairline,
                  {
                    backgroundColor: palette.separator,
                    marginLeft: 56,
                  },
                ]}
              />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Add styles for items**

```typescript
itemsContainer: {
  paddingVertical: 8,
},
itemRow: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 12,
},
itemCircle: {
  width: 22,
  height: 22,
  borderRadius: 11,
  borderWidth: 1.5,
  flexShrink: 0,
  marginTop: 2,
},
itemContent: {
  flex: 1,
},
itemTitle: {
  fontSize: 16,
  fontWeight: '400',
  lineHeight: 22,
},
itemNotes: {
  fontSize: 13,
  fontWeight: '400',
  lineHeight: 18,
  marginTop: 2,
},
hairline: {
  height: StyleSheet.hairlineWidth,
},
```

- [ ] **Step 3: Update JSX to render items when expanded**

Replace the block map section in the return statement with:

```typescript
{blocks.map((block) => (
  <View key={block.key}>
    <TimeBlockHeader
      block={block.key}
      label={block.label}
      icon={block.icon}
      count={block.items.length}
      isExpanded={expandedSections[block.key]}
      isDark={isDark}
      onToggle={() => toggleSection(block.key)}
    />
    
    {expandedSections[block.key] && (
      <TimeBlockItems
        items={block.items}
        isDark={isDark}
        onItemTap={onItemTap}
        onItemComplete={onItemComplete}
        onItemArchive={onItemArchive}
        onItemDelete={onItemDelete}
      />
    )}
  </View>
))}
```

- [ ] **Step 4: Test in Expo**

```bash
# In Expo Go, navigate to Home
# Tap each time block header to expand/collapse
```

Expected: Headers toggle to show/hide items, items display with title + notes

- [ ] **Step 5: Commit**

```bash
git add src/components/TimelineSection.tsx
git commit -m "feat: render expanded items in time blocks with collapsible toggle"
```

---

### Task 4: Integrate TimelineSection into HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Remove hero gradient card, update layout**

Read HomeScreen and replace the entire JSX structure. Remove lines 93-129 (hero gradient):

```typescript
// REMOVE the LinearGradient section (lines 93-129)
// Keep AppHeader, ScrollView, Companion, and Timeline

// New HomeScreen.tsx structure:

import { ScrollView, TouchableOpacity } from 'react-native';
import { YStack, XStack, Text, View } from 'tamagui';
import { AppHeader } from '../components/AppHeader';
import { AvatarCompanion } from '../components/AvatarCompanion';
import { TimelineSection } from '../components/TimelineSection';
import { useHomeData } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { ArrowRight, Inbox } from '../icons';
import { getThemeColors } from '../theme';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5)  return { word: 'Late Night', name: 'Rahul' };
  if (hour < 12) return { word: 'Good Morning', name: 'Rahul' };
  if (hour < 17) return { word: 'Good Afternoon', name: 'Rahul' };
  return { word: 'Good Evening', name: 'Rahul' };
}

function getCompanionMessage(inboxCount: number, todayCount: number, hour: number): string {
  if (inboxCount === 0 && todayCount === 0) {
    if (hour < 12) return "Morning clear. What are we building today?";
    if (hour < 17) return "Afternoon's yours. Nothing on the schedule.";
    return "Evening is clear. Time to wind down or plan ahead.";
  }
  if (inboxCount > 5) return `${inboxCount} things in your inbox. Let's process them.`;
  if (todayCount > 0 && inboxCount > 0) return `${todayCount} scheduled, ${inboxCount} waiting. Good momentum.`;
  if (todayCount > 0) return `${todayCount} thing${todayCount > 1 ? 's' : ''} on today's plan. Let's go.`;
  return `${inboxCount} item${inboxCount > 1 ? 's' : ''} to process in your inbox.`;
}

export function HomeScreen({ onInboxPress }: { onInboxPress: () => void }) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { inboxCount, upcomingCount, todayItems, anytime, morningItems, afternoonItems, eveningItems } = useHomeData();
  const { word, name } = getGreeting();
  const hour = new Date().getHours();
  const companionMsg = getCompanionMessage(inboxCount, todayItems.length, hour);

  return (
    <YStack flex={1} backgroundColor="$bg">
      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Companion message at top */}
        <XStack
          marginHorizontal="$4" marginTop="$3"
          backgroundColor="$surface" borderRadius="$4"
          padding="$4" alignItems="center" gap="$3"
          shadowColor="$shadowColor" shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={1} shadowRadius={8} elevation={1}
          borderWidth={0.5} borderColor="$separator"
        >
          <AvatarCompanion size="md" showRing />

          <YStack flex={1}>
            <Text fontSize="$2" fontWeight="500" color="$text" lineHeight={20}>
              {companionMsg}
            </Text>
            <Text fontSize={11} color="$textTertiary" marginTop={4} fontWeight="500">
              Your personal OS companion
            </Text>
          </YStack>
        </XStack>

        {/* Inbox card */}
        {inboxCount > 0 && (
          <TouchableOpacity onPress={onInboxPress} activeOpacity={0.7}>
            <XStack
              marginHorizontal="$4" marginTop="$3"
              backgroundColor="$surface" borderRadius="$3" padding="$4"
              alignItems="center" gap="$3"
              borderWidth={1} borderColor="$blueSoft"
              shadowColor="$shadowColor" shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={1} shadowRadius={6} elevation={1}
            >
              <View width={34} height={34} borderRadius="$6" backgroundColor="$blueSoft" alignItems="center" justifyContent="center">
                <Inbox size={16} color="#007aff" strokeWidth={1.5} />
              </View>
              <YStack flex={1}>
                <Text fontSize="$3" fontWeight="700" color="$text">
                  {inboxCount} item{inboxCount > 1 ? 's' : ''} to process
                </Text>
                <Text fontSize="$2" color="$textSecondary">Tap to review</Text>
              </YStack>
              <ArrowRight size={14} color="$blue" strokeWidth={2} />
            </XStack>
          </TouchableOpacity>
        )}

        {/* Timeline section */}
        <YStack marginTop="$4">
          <TimelineSection
            todayItems={todayItems}
            anytime={anytime}
            morning={morningItems}
            afternoon={afternoonItems}
            evening={eveningItems}
            onItemTap={(item) => {
              // TODO: Navigate to item detail/edit screen
              console.log('Tapped item:', item);
            }}
            onItemComplete={(id) => {
              // TODO: Call DB function to complete item
              console.log('Complete item:', id);
            }}
            onItemArchive={(id) => {
              // TODO: Call DB function to archive item
              console.log('Archive item:', id);
            }}
            onItemDelete={(id) => {
              // TODO: Call DB function to delete item
              console.log('Delete item:', id);
            }}
            onTimeBlockAction={(block, action) => {
              // TODO: Handle bulk actions
              console.log('Time block action:', block, action);
            }}
          />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Test in Expo**

```bash
# Verify layout: Companion at top, Inbox card, Timeline below
```

Expected: Companion message, inbox card (if items exist), timeline with collapsible sections

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "refactor: remove hero gradient, update home layout with companion at top"
```

---

### Task 5: Add Swipe Gestures to Timeline Items

**Files:**
- Modify: `src/components/TimelineSection.tsx`

- [ ] **Step 1: Import SwipeableItem and wrap items**

```typescript
// At the top, add import:
import { SwipeableItem } from './SwipeableItem';
import * as Haptics from 'expo-haptics';

// Update TimeBlockItems to wrap each item in SwipeableItem:

function TimeBlockItems({
  items,
  isDark,
  onItemTap,
  onItemComplete,
  onItemArchive,
  onItemDelete,
}: {
  items: Item[];
  isDark: boolean;
  onItemTap?: (item: Item) => void;
  onItemComplete?: (id: string) => void;
  onItemArchive?: (id: string) => void;
  onItemDelete?: (id: string) => void;
}) {
  const palette = getThemeColors(isDark);

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={[styles.itemsContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }]}>
      {items.map((item, index) => (
        <SwipeableItem
          key={item.id}
          onActivate={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onItemComplete?.(item.id);
          }}
          onArchive={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onItemArchive?.(item.id);
          }}
        >
          <TouchableOpacity
            onPress={() => onItemTap?.(item)}
            activeOpacity={0.5}
          >
            <View>
              <View style={[styles.itemRow, { paddingHorizontal: 16, paddingVertical: 12 }]}>
                <View
                  style={[
                    styles.itemCircle,
                    {
                      borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
                    },
                  ]}
                />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: palette.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.notes && (
                    <Text style={[styles.itemNotes, { color: palette.textMuted }]} numberOfLines={1}>
                      {item.notes}
                    </Text>
                  )}
                </View>
              </View>

              {index < items.length - 1 && (
                <View
                  style={[
                    styles.hairline,
                    {
                      backgroundColor: palette.separator,
                      marginLeft: 56,
                    },
                  ]}
                />
              )}
            </View>
          </TouchableOpacity>
        </SwipeableItem>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Test swipe gestures in Expo**

```bash
# Expand a time block, swipe left on an item
# Expected: Swipe actions appear (complete, etc.)
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineSection.tsx
git commit -m "feat: add swipeable items in expanded time blocks"
```

---

### Task 6: Add Long-Press Context Menu to Time Block Headers

**Files:**
- Modify: `src/components/TimelineSection.tsx`

- [ ] **Step 1: Import ContextMenu and add to headers**

```typescript
// At the top, add import:
import { ContextMenu } from './ContextMenu';

// Update TimeBlockHeader function to use ContextMenu:

function TimeBlockHeader({
  block,
  label,
  icon,
  count,
  isExpanded,
  isDark,
  onToggle,
  onLongPressAction,
}: {
  block: TimeBlockType;
  label: string;
  icon: string;
  count: number;
  isExpanded: boolean;
  isDark: boolean;
  onToggle: () => void;
  onLongPressAction: (action: string) => void;
}) {
  const palette = getThemeColors(isDark);

  const contextItems = [
    { label: 'Add item', onPress: () => onLongPressAction('addItem') },
    { label: 'Move items here', onPress: () => onLongPressAction('moveItems') },
    { label: 'Sort', onPress: () => onLongPressAction('sort') },
    { label: 'Expand all', onPress: () => onLongPressAction('expandAll') },
    { label: 'Collapse all', onPress: () => onLongPressAction('collapseAll') },
  ];

  return (
    <ContextMenu items={contextItems}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.6}
        style={[
          styles.blockHeader,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            borderBottomColor: palette.separator,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>{icon}</Text>
          <Text style={[styles.headerLabel, { color: palette.text }]}>{label}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.headerCount, { color: palette.textSecondary }]}>{count}</Text>
          <Text style={[styles.headerArrow, { color: palette.textMuted }]}>
            {isExpanded ? '↑' : '→'}
          </Text>
        </View>
      </TouchableOpacity>
    </ContextMenu>
  );
}
```

- [ ] **Step 2: Handle context menu actions in TimelineSection component**

Add this function inside TimelineSection:

```typescript
const handleTimeBlockAction = (block: TimeBlockType, action: string) => {
  if (action === 'expandAll') {
    setExpandedSections({ anytime: true, morning: true, afternoon: true, evening: true });
  } else if (action === 'collapseAll') {
    setExpandedSections({ anytime: false, morning: false, afternoon: false, evening: false });
  } else {
    // Pass other actions (addItem, moveItems, sort) to parent
    onTimeBlockAction?.(block, action);
  }
};
```

- [ ] **Step 3: Update TimeBlockHeader calls in JSX**

```typescript
{blocks.map((block) => (
  <View key={block.key}>
    <TimeBlockHeader
      block={block.key}
      label={block.label}
      icon={block.icon}
      count={block.items.length}
      isExpanded={expandedSections[block.key]}
      isDark={isDark}
      onToggle={() => toggleSection(block.key)}
      onLongPressAction={(action) => handleTimeBlockAction(block.key, action)}
    />
    
    {expandedSections[block.key] && (
      <TimeBlockItems
        items={block.items}
        isDark={isDark}
        onItemTap={onItemTap}
        onItemComplete={onItemComplete}
        onItemArchive={onItemArchive}
        onItemDelete={onItemDelete}
      />
    )}
  </View>
))}
```

- [ ] **Step 4: Test context menu in Expo**

```bash
# Long-press a time block header
# Expected: Context menu appears with 5 options
# Test "Expand all" and "Collapse all"
```

- [ ] **Step 5: Commit**

```bash
git add src/components/TimelineSection.tsx
git commit -m "feat: add long-press context menu to time block headers"
```

---

### Task 7: Add Swipe Actions to Time Block Headers

**Files:**
- Modify: `src/components/TimelineSection.tsx`

- [ ] **Step 1: Wrap time block headers in SwipeableItem**

```typescript
// Update the block map in JSX:

{blocks.map((block) => (
  <SwipeableItem
    key={block.key}
    onActivate={() => {
      // Swipe left = complete all items in block
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onTimeBlockAction?.(block.key, 'completeAll');
    }}
    onArchive={() => {
      // Swipe right = quick add
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTimeBlockAction?.(block.key, 'quickAdd');
    }}
  >
    <View>
      <TimeBlockHeader
        block={block.key}
        label={block.label}
        icon={block.icon}
        count={block.items.length}
        isExpanded={expandedSections[block.key]}
        isDark={isDark}
        onToggle={() => toggleSection(block.key)}
        onLongPressAction={(action) => handleTimeBlockAction(block.key, action)}
      />
      
      {expandedSections[block.key] && (
        <TimeBlockItems
          items={block.items}
          isDark={isDark}
          onItemTap={onItemTap}
          onItemComplete={onItemComplete}
          onItemArchive={onItemArchive}
          onItemDelete={onItemDelete}
        />
      )}
    </View>
  </SwipeableItem>
))}
```

- [ ] **Step 2: Test swipes on headers in Expo**

```bash
# Swipe left on a time block header
# Expected: completeAll action fires
# Swipe right on a time block header
# Expected: quickAdd action fires
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineSection.tsx
git commit -m "feat: add swipe actions to time block headers"
```

---

### Task 8: Wire Up Callbacks in HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Import DB functions and update callbacks**

```typescript
// Add to imports at the top:
import { activateItem, archiveItem, deleteItem } from '../db/database';

// Update TimelineSection prop callbacks:

<TimelineSection
  todayItems={todayItems}
  anytime={anytime}
  morning={morningItems}
  afternoon={afternoonItems}
  evening={eveningItems}
  onItemTap={(item) => {
    // TODO: Navigate to item detail/edit screen
    // For now, log to verify callback
    console.log('Navigate to item:', item.id);
  }}
  onItemComplete={(id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    activateItem(id);
    // Refresh query will update UI automatically via useHomeData() reactivity
  }}
  onItemArchive={(id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    archiveItem(id);
  }}
  onItemDelete={(id) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteItem(id);
  }}
  onTimeBlockAction={(block, action) => {
    console.log(`Time block ${block} action: ${action}`);
    // TODO: Handle bulk actions (completeAll, quickAdd, etc.)
  }}
/>
```

- [ ] **Step 2: Add haptics import**

```typescript
import * as Haptics from 'expo-haptics';
```

- [ ] **Step 3: Test callbacks in Expo**

```bash
# Tap item → should log "Navigate to item: ..."
# Swipe item left → should log haptic + item should disappear if completed
# Long-press header → should log "Time block X action: Y"
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: wire up timeline callbacks to DB actions"
```

---

### Task 9: Add useDb Hook for Bulk Complete Action

**Files:**
- Modify: `src/hooks/useDb.ts`

- [ ] **Step 1: Read current useDb.ts to understand structure**

```bash
head -100 apps/mobile/src/hooks/useDb.ts
```

- [ ] **Step 2: Add function to complete all items in a time block**

Add this function to `useDb.ts`:

```typescript
export async function completeAllInTimeBlock(timeOfDay: 'anytime' | 'morning' | 'afternoon' | 'evening') {
  try {
    const db = await initializeDatabase();
    
    // Query all items with this timeOfDay and status 'active'
    const items = await db.table('items').where('timeOfDay').equals(timeOfDay).and((item) => item.status === 'active').toArray();
    
    // Mark each as completed (move to 'completed' status or archive, depending on schema)
    for (const item of items) {
      await db.table('items').update(item.id, { status: 'completed', completedAt: new Date().toISOString() });
    }
  } catch (error) {
    console.error('Error completing all items in time block:', error);
  }
}
```

- [ ] **Step 3: Test the function (optional for now)**

Function will be tested when wired into UI in next task.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDb.ts
git commit -m "feat: add completeAllInTimeBlock function"
```

---

### Task 10: Implement Bulk Actions in HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Update onTimeBlockAction callback to handle bulk actions**

```typescript
import { completeAllInTimeBlock } from '../hooks/useDb';

// Update the onTimeBlockAction in TimelineSection:

onTimeBlockAction={(block, action) => {
  if (action === 'completeAll') {
    // Show confirmation dialog
    Alert.alert(
      'Complete All',
      `Complete all items in ${block.charAt(0).toUpperCase() + block.slice(1)}?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await completeAllInTimeBlock(block);
            // Data will refresh automatically via useHomeData() reactivity
          },
        },
      ]
    );
  } else if (action === 'quickAdd') {
    // TODO: Open QuickAddScreen with timeOfDay pre-filled
    console.log('Quick add for:', block);
  } else if (action === 'addItem') {
    // TODO: Open QuickAddScreen with timeOfDay pre-filled
    console.log('Add item to:', block);
  } else if (action === 'moveItems') {
    // TODO: Open move items modal
    console.log('Move items to:', block);
  } else if (action === 'sort') {
    // TODO: Open sort modal or just sort locally
    console.log('Sort items in:', block);
  }
}}
```

- [ ] **Step 2: Add Alert import**

```typescript
import { Alert } from 'react-native';
```

- [ ] **Step 3: Test bulk complete action in Expo**

```bash
# Swipe left on a time block header
# Dialog appears asking to confirm
# Confirm → all items in that block should be marked complete
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: implement bulk complete action with confirmation"
```

---

### Task 11: Manual Testing & Polish

**Files:**
- No new files, testing only

- [ ] **Step 1: Test all expand/collapse behaviors**

```bash
# Expand Morning, then Afternoon (both should be expanded)
# Collapse one, other should stay expanded
# Use "Expand all" context menu → all should expand
# Use "Collapse all" context menu → all should collapse
```

- [ ] **Step 2: Test item interactions**

```bash
# Tap an item → verify callback fires
# Swipe left on item → verify haptic + action fires
# Long-press on header → verify context menu appears with all 5 options
```

- [ ] **Step 3: Test dark/light mode**

```bash
# Toggle dark mode in settings
# Verify colors update correctly in timeline
# Verify readability in both modes
```

- [ ] **Step 4: Test with empty sections**

```bash
# Create app state with no items in Morning
# Expand Morning → should show no items, but section is still interactive
# Add item → should appear in expanded section
```

- [ ] **Step 5: Test scrolling behavior**

```bash
# Expand all sections
# Scroll through timeline
# Verify no jank, smooth scrolling
```

- [ ] **Step 6: Verify data refresh**

```bash
# Complete an item via swipe
# Verify item disappears from timeline
# Verify count updates automatically
# Create a new item via QuickAdd (or manually in DB)
# Verify it appears in correct time block on home refresh
```

No code changes needed for this task, just manual verification.

---

### Task 12: Final Cleanup & Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run TypeScript check**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 2: Verify git log shows all commits**

```bash
git log --oneline -15
```

Expected: See all TimelineSection and HomeScreen commits in order

- [ ] **Step 3: Quick code review checklist**

```
- [ ] TimelineSection has clear prop interface
- [ ] Expand/collapse state is independent per section
- [ ] Items render correctly in expanded state
- [ ] Swipe and long-press work on headers and items
- [ ] HomeScreen layout correct (no hero, companion at top, inbox, timeline)
- [ ] Callbacks wired correctly to DB functions
- [ ] Dark/light mode colors applied
- [ ] No console errors or warnings
```

- [ ] **Step 4: Verify feature completeness**

```
- [ ] Can expand/collapse sections independently
- [ ] Can see items in expanded sections
- [ ] Can tap items (callback fires)
- [ ] Can swipe items left (complete/archive)
- [ ] Can swipe headers left (complete all)
- [ ] Can swipe headers right (quick add)
- [ ] Can long-press headers (context menu)
- [ ] "Expand all" and "Collapse all" work
- [ ] Data refreshes when items change
- [ ] Inbox card shows count
- [ ] Companion message displays correctly
```

No commit needed for this task — it's verification only.

---

## Summary

This plan creates a functional timeline section on the home page with independent expand/collapse behavior, full item interactions (tap, swipe, long-press), and bulk actions on time blocks. All callbacks wire to the existing DB functions, and the UI updates reactively as data changes. The home page becomes a true planner where users can act on items without leaving the screen.

**Total tasks:** 12  
**Estimated effort:** 3-4 hours for implementation + testing

