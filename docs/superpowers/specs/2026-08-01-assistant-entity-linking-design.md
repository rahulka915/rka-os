# Assistant Response Entity Linking

**Date:** 2026-08-01
**Status:** Approved (design), pending implementation plan

## Problem

The in-app AI assistant (`apps/mobile/src/components/assistant/AssistantOverlay.tsx`, backed by `apps/mobile/src/services/ai/assistant.ts`) renders every response as a single plain `<Text>` node. When it mentions a specific item by name (e.g. "MUSIC", "APP DEVELOPMENT" when listing domains), there's no way to jump to that item — and separately, the model's own markdown (`**bold**`) renders as literal asterisks since nothing parses it.

## Goal

When the assistant refers to a specific item by name, render it as tappable text that navigates to that item's real screen. Input-side @mention autocomplete is an explicit follow-up, not part of this pass.

## Non-goals

- No input-side autocomplete/mention chips (separate future spec).
- No changes to what data the assistant can see beyond adding `id` to each entry (still read-only, same fields otherwise).
- No general markdown support (lists, links, headers, italics) — only `**bold**`, fixed as a natural side-effect of building the same parser, and the new `[[id:Title]]` entity-link syntax.

## Design

### 1. Context gains `id`

`apps/mobile/src/services/ai/assistantContext.ts`'s `buildAssistantContext()` adds `id: item.id` to every slim entry (currently `type`/`title`/`status`/etc., no id at all). Needed so the model can reference a specific item unambiguously — matching purely on title text is fragile (titles can repeat or be ambiguous, e.g. two tasks named "Follow up").

### 2. System prompt teaches the link syntax

`apps/mobile/src/services/ai/assistant.ts`'s `SYSTEM_PROMPT_PREFIX` gains an instruction: when referring to a specific item from the data by name, wrap it as `[[id:Title]]` using that item's exact `id` field, e.g. `[[a1b2c3:MUSIC]]`. Plain category words ("domains", "tasks") are NOT wrapped — only actual named items, since categories don't map to a single id.

### 3. Message renderer parses both link and bold syntax

New helper, `apps/mobile/src/components/assistant/parseAssistantMessage.ts`:

```ts
export type MessageSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; id: string; text: string };

export function parseAssistantMessage(raw: string): MessageSegment[]
```

Single regex pass over the raw string matching `\[\[([^:\]]+):([^\]]+)\]\]` (link) and `\*\*([^*]+)\*\*` (bold), in source order, producing an ordered list of segments (plain runs between matches become `{ kind: 'text' }`). User-turn bubbles don't need parsing (users don't type this syntax) — only assistant (`role: 'model'`) turns run through it.

### 4. Rendering + tap-to-navigate

`AssistantOverlay.tsx`'s message bubble `<Text>` renders `parseAssistantMessage(turn.text)` as nested `<Text>` spans (React Native supports nested `Text` for inline-styled runs within one paragraph): plain segments unstyled, bold segments `fontWeight: '700'`, link segments in the existing accent color with an `onPress`.

Tapping a link segment:
1. Looks up `getItemWithMetadata(id)` (`apps/mobile/src/db/database.ts`) — already synchronous, already used throughout the app.
2. If found: calls the existing `onClose` prop (same as the X button) to dismiss the overlay, then `useOpenItem()`'s dispatcher (`apps/mobile/src/hooks/useOpenItem.ts`, unchanged) with that item — Areas/Missions/Habits/Objects go to their dedicated detail screens, everything else opens the generic item editor, exactly as every other "open this item" tap in the app already behaves.
3. If not found (deleted since the response was generated): no-op — matches the assistant's already-established "best effort, read-only" posture; no error dialog for a stale reference.

## Data flow

- Read: `buildAssistantContext()`'s existing per-turn DB read gains one more field (`id`) — no new query, no new round trip.
- Write: none — this is a read/navigate-only feature, consistent with the assistant's existing read-only scope.

## Testing

Manual verification in the simulator/dev build (project convention — no automated UI test suite):
- Ask "how many domains do I have?" — confirm the response's `**5**` renders bold (not literal asterisks) and each domain name (MUSIC, APP DEVELOPMENT, etc.) renders as a tappable link.
- Tap a linked domain — confirm the assistant overlay closes and the app navigates to that Area's detail screen.
- Tap a linked task/habit/mission — confirm each opens its correct destination (generic editor for tasks, `HabitDetail` for habits, `ProjectDetail` for missions).
- Ask about an item, then delete that item, then (in a fresh assistant session referencing stale context, or by re-triggering a response containing the old link) tap its stale link — confirm nothing happens (no crash, no error).
- Confirm plain category words ("Domains", "Tasks") in a response are NOT rendered as tappable links — only specific named items are.
