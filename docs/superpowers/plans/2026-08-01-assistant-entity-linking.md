# Assistant Response Entity Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assistant's responses render `**bold**` as bold and `[[id:Title]]`-wrapped item references as tappable text that navigates to the real item, instead of one flat plain-text bubble.

**Architecture:** The data context gains item `id`s and the system prompt teaches the model a `[[id:Title]]` link syntax. A new pure parser (`parseAssistantMessage`) turns raw response text into typed segments; `AssistantOverlay.tsx` renders those segments as nested `<Text>` runs and handles tap-to-navigate on link segments via the existing `useOpenItem()` dispatcher.

**Tech Stack:** React Native + Expo (apps/mobile), TypeScript. `parseAssistantMessage` is pure logic and gets a real `node:test` file (project convention, `npm test`); the rendering/navigation wiring is manual-verified (no automated UI test suite).

## Global Constraints

- Only assistant (`role: 'model'`) turns are parsed — user turns render as plain text unchanged, since users don't type this syntax.
- Plain category words ("domains", "tasks") are never wrapped as links — only specific named items, and only when the model chooses to reference one by exact `id`.
- Tapping a link for an item that no longer exists is a silent no-op (no error dialog) — matches the assistant's existing "best effort, read-only" posture.
- No new data exposed to the model beyond `id` — everything else in the context payload (`type`/`title`/`status`/etc.) stays as-is.

---

### Task 1: Add `id` to context + teach the link syntax

**Files:**
- Modify: `apps/mobile/src/services/ai/assistantContext.ts`
- Modify: `apps/mobile/src/services/ai/assistant.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: context JSON entries now include `id`; system prompt instructs the `[[id:Title]]` syntax. Consumed implicitly by the model's own output — no code-level interface, but Task 3's tap handler assumes ids in link segments correspond to real `items.id` values, which this task guarantees by including them in context.

- [ ] **Step 1: Add `id` to each context entry**

In `apps/mobile/src/services/ai/assistantContext.ts`, find:
```ts
    const entry: Record<string, unknown> = {
      type: item.type,
      title: item.title,
      status: item.status,
    };
```
Replace with:
```ts
    const entry: Record<string, unknown> = {
      id: item.id,
      type: item.type,
      title: item.title,
      status: item.status,
    };
```

- [ ] **Step 2: Teach the model the link syntax in the system prompt**

In `apps/mobile/src/services/ai/assistant.ts`, find:
```ts
const SYSTEM_PROMPT_PREFIX = `You are the personal assistant embedded in RKA OS, a personal task/life
management app. You have READ-ONLY access to the user's current data, given below as JSON —
you cannot add, edit, or delete anything (that capability doesn't exist yet). Answer questions,
summarize, and help the user think through their tasks, missions, medications, and domains.
Be concise and conversational. If asked to change something, explain you can't yet and suggest
they do it in the app directly.

Today's date: ${new Date().toISOString().slice(0, 10)}

Current data (JSON array of items):
`;
```
Replace with:
```ts
const SYSTEM_PROMPT_PREFIX = `You are the personal assistant embedded in RKA OS, a personal task/life
management app. You have READ-ONLY access to the user's current data, given below as JSON —
you cannot add, edit, or delete anything (that capability doesn't exist yet). Answer questions,
summarize, and help the user think through their tasks, missions, medications, and domains.
Be concise and conversational. If asked to change something, explain you can't yet and suggest
they do it in the app directly.

When you refer to a SPECIFIC item from the data below by name (a particular domain, mission,
task, habit, medication, or object — not a general category like "domains" or "tasks"), wrap
it exactly as [[id:Title]] using that item's own "id" field from the JSON, e.g. [[a1b2c3:MUSIC]].
Only wrap specific named items this way, never general category words.

Today's date: ${new Date().toISOString().slice(0, 10)}

Current data (JSON array of items):
`;
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors other than the pre-existing, unrelated ones under `src/webApp/` (retired PWA code).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/services/ai/assistantContext.ts apps/mobile/src/services/ai/assistant.ts
git commit -m "feat: teach assistant to reference items by id with [[id:Title]] links"
```

---

### Task 2: `parseAssistantMessage` parser + tests

**Files:**
- Create: `apps/mobile/src/components/assistant/parseAssistantMessage.ts`
- Create: `apps/mobile/src/components/assistant/parseAssistantMessage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MessageSegment` union type and `parseAssistantMessage(raw: string): MessageSegment[]`. Consumed by Task 3 (`AssistantOverlay.tsx`).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/mobile/src/components/assistant/parseAssistantMessage.test.ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAssistantMessage } from './parseAssistantMessage.ts';

test('plain text with no markup is a single text segment', () => {
  assert.deepEqual(parseAssistantMessage('Hello there'), [
    { kind: 'text', text: 'Hello there' },
  ]);
});

test('parses bold markup', () => {
  assert.deepEqual(parseAssistantMessage('You have **5** domains'), [
    { kind: 'text', text: 'You have ' },
    { kind: 'bold', text: '5' },
    { kind: 'text', text: ' domains' },
  ]);
});

test('parses an entity link', () => {
  assert.deepEqual(parseAssistantMessage('Try [[abc-123:MUSIC]] first'), [
    { kind: 'text', text: 'Try ' },
    { kind: 'link', id: 'abc-123', text: 'MUSIC' },
    { kind: 'text', text: ' first' },
  ]);
});

test('parses bold and links together, in source order', () => {
  assert.deepEqual(parseAssistantMessage('**Domains:** [[a1:MUSIC]] and [[a2:FINANCE]]'), [
    { kind: 'bold', text: 'Domains:' },
    { kind: 'text', text: ' ' },
    { kind: 'link', id: 'a1', text: 'MUSIC' },
    { kind: 'text', text: ' and ' },
    { kind: 'link', id: 'a2', text: 'FINANCE' },
  ]);
});

test('returns an empty array for an empty string', () => {
  assert.deepEqual(parseAssistantMessage(''), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npm test`
Expected: FAIL — `parseAssistantMessage.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// apps/mobile/src/components/assistant/parseAssistantMessage.ts
export type MessageSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; id: string; text: string };

const TOKEN_PATTERN = /\[\[([^:\]]+):([^\]]+)\]\]|\*\*([^*]+)\*\*/g;

// Single regex pass over the raw assistant response: matches either an
// entity link ([[id:Title]]) or bold markup (**text**), in source order,
// with everything in between falling back to plain text segments.
export function parseAssistantMessage(raw: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: raw.slice(lastIndex, match.index) });
    }
    const [, linkId, linkTitle, boldText] = match;
    if (linkId !== undefined) {
      segments.push({ kind: 'link', id: linkId, text: linkTitle });
    } else {
      segments.push({ kind: 'bold', text: boldText });
    }
    lastIndex = TOKEN_PATTERN.lastIndex;
  }
  if (lastIndex < raw.length) {
    segments.push({ kind: 'text', text: raw.slice(lastIndex) });
  }
  return segments;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npm test`
Expected: PASS — all 5 `parseAssistantMessage.test.ts` tests green, plus every pre-existing test file still passing.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/assistant/parseAssistantMessage.ts apps/mobile/src/components/assistant/parseAssistantMessage.test.ts
git commit -m "feat: add parseAssistantMessage for bold/link markup"
```

---

### Task 3: Render segments + tap-to-navigate in `AssistantOverlay`

**Files:**
- Modify: `apps/mobile/src/components/assistant/AssistantOverlay.tsx` (current full content below — the entire file as of the last commit)

**Interfaces:**
- Consumes: `parseAssistantMessage`, `MessageSegment` (Task 2); `getItemWithMetadata(id: string): Item | null` (`apps/mobile/src/db/database.ts`, already used identically throughout the app); `useOpenItem()` (`apps/mobile/src/hooks/useOpenItem.ts`, returns `(options: OpenItemEditorOptions) => void`, unchanged).
- Produces: nothing consumed elsewhere — this is the last task.

The current full content of `apps/mobile/src/components/assistant/AssistantOverlay.tsx`:

```tsx
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { askAssistant, hasAssistant, type AssistantTurn } from '../../services/ai/assistant';
import { X, Sparkles } from '../../icons';
import PaperAirplaneIcon from 'react-native-heroicons/solid/PaperAirplaneIcon';

interface AssistantOverlayProps {
  onClose: () => void;
}

export function AssistantOverlay({ onClose }: AssistantOverlayProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);

  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opacity = useSharedValue(0);
  useState(() => {
    opacity.value = withTiming(1, { duration: reducedMotion ? 120 : 220 });
  });
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput('');
    setError(null);
    const nextTurns: AssistantTurn[] = [...turns, { role: 'user', text: question }];
    setTurns(nextTurns);
    setBusy(true);
    try {
      const answer = await askAssistant(question, turns);
      setTurns([...nextTurns, { role: 'model', text: answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: mat.background, paddingTop: insets.top },
        overlayStyle,
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Sparkles size={16} color={mat.accent} strokeWidth={1.75} />
          <Text style={[styles.title, { color: mat.platinumMuted }]}>Assistant</Text>
        </View>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close assistant"
          hitSlop={12}
        >
          <X size={20} color={mat.platinum} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {turns.length === 0 ? (
            <Text style={[styles.empty, { color: mat.platinumMuted }]}>
              Ask about your tasks, missions, medications, or domains — I can see your current data
              but can't change anything yet.
            </Text>
          ) : null}
          {turns.map((turn, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                turn.role === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: mat.accentSoft }
                  : { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1 },
              ]}
            >
              <Text style={[styles.bubbleText, { color: mat.platinum }]}>{turn.text}</Text>
            </View>
          ))}
          {busy ? (
            <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1 }]}>
              <Text style={[styles.bubbleText, { color: mat.platinumMuted }]}>Thinking…</Text>
            </View>
          ) : null}
          {error ? <Text style={[styles.errorText, { color: '#e0716b' }]}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.inputRow, { borderTopColor: mat.rim, paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={hasAssistant ? 'Ask anything…' : 'Assistant unavailable — Firebase not configured'}
            placeholderTextColor={mat.platinumMuted}
            style={[styles.input, { color: mat.platinum, backgroundColor: mat.fill }]}
            editable={hasAssistant && !busy}
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!hasAssistant || busy || !input.trim()}
            style={[styles.sendBtn, { backgroundColor: mat.accent, opacity: !hasAssistant || busy || !input.trim() ? 0.4 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <PaperAirplaneIcon size={18} color={mat.onAccent} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 999, flexDirection: 'column' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: fontSize.sm, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  messages: { padding: spacing[5], gap: spacing[3], flexGrow: 1 },
  empty: { fontSize: fontSize.base, lineHeight: 22, paddingTop: spacing[8] },
  bubble: { maxWidth: '85%', borderRadius: radius.card, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  bubbleText: { fontSize: fontSize.base, lineHeight: 21 },
  errorText: { fontSize: fontSize.sm, paddingTop: spacing[2] },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 1: Add imports**

Replace:
```tsx
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { askAssistant, hasAssistant, type AssistantTurn } from '../../services/ai/assistant';
import { X, Sparkles } from '../../icons';
import PaperAirplaneIcon from 'react-native-heroicons/solid/PaperAirplaneIcon';
```
with:
```tsx
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { askAssistant, hasAssistant, type AssistantTurn } from '../../services/ai/assistant';
import { parseAssistantMessage } from './parseAssistantMessage';
import { getItemWithMetadata } from '../../db/database';
import { useOpenItem } from '../../hooks/useOpenItem';
import { X, Sparkles } from '../../icons';
import PaperAirplaneIcon from 'react-native-heroicons/solid/PaperAirplaneIcon';
```

- [ ] **Step 2: Add the tap-to-navigate handler**

Replace:
```tsx
export function AssistantOverlay({ onClose }: AssistantOverlayProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
```
with:
```tsx
export function AssistantOverlay({ onClose }: AssistantOverlayProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const openItem = useOpenItem();

  const handleLinkPress = (id: string) => {
    const item = getItemWithMetadata(id);
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
    openItem({ item });
  };
```

- [ ] **Step 3: Render parsed segments instead of a single plain `<Text>`**

Replace:
```tsx
          {turns.map((turn, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                turn.role === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: mat.accentSoft }
                  : { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1 },
              ]}
            >
              <Text style={[styles.bubbleText, { color: mat.platinum }]}>{turn.text}</Text>
            </View>
          ))}
```
with:
```tsx
          {turns.map((turn, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                turn.role === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: mat.accentSoft }
                  : { alignSelf: 'flex-start', backgroundColor: mat.surfaceRaised, borderColor: mat.rim, borderWidth: 1 },
              ]}
            >
              {turn.role === 'model' ? (
                <Text style={[styles.bubbleText, { color: mat.platinum }]}>
                  {parseAssistantMessage(turn.text).map((segment, segIndex) => {
                    if (segment.kind === 'bold') {
                      return (
                        <Text key={segIndex} style={styles.bold}>
                          {segment.text}
                        </Text>
                      );
                    }
                    if (segment.kind === 'link') {
                      return (
                        <Text
                          key={segIndex}
                          style={[styles.link, { color: mat.accent }]}
                          onPress={() => handleLinkPress(segment.id)}
                        >
                          {segment.text}
                        </Text>
                      );
                    }
                    return <Text key={segIndex}>{segment.text}</Text>;
                  })}
                </Text>
              ) : (
                <Text style={[styles.bubbleText, { color: mat.platinum }]}>{turn.text}</Text>
              )}
            </View>
          ))}
```

- [ ] **Step 4: Add the `bold`/`link` text styles**

Replace:
```tsx
  bubbleText: { fontSize: fontSize.base, lineHeight: 21 },
```
with:
```tsx
  bubbleText: { fontSize: fontSize.base, lineHeight: 21 },
  bold: { fontWeight: '700' },
  link: { fontWeight: '600', textDecorationLine: 'underline' },
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors other than the pre-existing, unrelated ones under `src/webApp/`.

- [ ] **Step 6: Manual verification**

Run the app (RKA Launcher tool / `npx expo start --dev-client --port 8082`, per project convention). Open the assistant:
- Ask "how many domains do I have?" — confirm the count renders bold (not literal asterisks) and each domain name renders as an underlined, tappable link in the accent color.
- Tap a domain link — confirm the assistant overlay closes and the app lands on that Area's detail screen.
- Ask about a task or habit by name, tap its link — confirm it opens the correct destination for that type (generic editor for a task, `HabitDetail` for a habit).
- Confirm plain category words like "Domains" or "Tasks" elsewhere in a response are plain text, not links.
- Confirm your own typed messages (user turns) still render as plain text, unaffected.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/assistant/AssistantOverlay.tsx
git commit -m "feat: render assistant links/bold text with tap-to-navigate"
```

---

## Self-Review Notes

- **Spec coverage:** `id` added to context → Task 1 Step 1. System prompt teaches `[[id:Title]]` syntax → Task 1 Step 2. Parser (bold + link, ordered segments) → Task 2. Rendering + tap-to-navigate (close overlay, `useOpenItem`, silent no-op on missing item) → Task 3. Non-goal (input-side autocomplete) — no task added, correctly out of scope.
- **Placeholder scan:** No TBD/TODO; every step has complete code including real unit tests for the one pure-logic file.
- **Type consistency:** `MessageSegment` (Task 2) — `{kind:'text'|'bold', text}` / `{kind:'link', id, text}` — matches exactly how Task 3's `.map()` branches on `segment.kind` and reads `segment.text`/`segment.id`. `parseAssistantMessage(raw: string): MessageSegment[]` signature matches Task 3's call site (`parseAssistantMessage(turn.text)`).
- **Scope check:** Three tasks with a clean dependency chain (prompt/context → parser → rendering), each independently testable and committed separately, matching the spec's single-subsystem scope (output-side linking only, input-side explicitly deferred).
