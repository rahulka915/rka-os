# Writing

No formal voice/tone brief exists yet. What's real and shipped today:

- **Time-of-day greeting** (`RoninGreetingCard.tsx` via `roninGreeting.ts`) — Japanese greeting word (おはよう/こんにちは/こんばんは) + name, not an English "Good morning/afternoon/evening." Rendered in a single Georgia italic (see [`decision-log.md`](decision-log.md) for the two-font experiment that was tried and reverted).
- **Status line** (`getRoninStatus()` in `roninMood.ts`) — one function produces both the mood and a concrete, number-driven status line together (e.g. tied to real `completedCount`/`totalCount`), specifically so the copy can't drift out of sync with the mood it's describing. Prefer this pattern — copy generated alongside the state it describes — over separate hardcoded flavor-text tables.
- **Hanko seal** — a small kanji stamp (武, "martial/warrior") used as a decorative brand mark on the hero card, not a translated UI string.

## Known gaps

- No empty-state copy guidelines beyond what exists ad hoc in `NextUpCard.tsx`/`InboxScrollCard.tsx`.
- No error-message tone guidance.
- No button-label conventions doc (e.g. verb-first, sentence case vs. title case) — infer from existing screens (Cancel/Save toolbar pattern in `THINGS_3_DESIGN.md`) until a real decision gets made and recorded here.

Add real content here as decisions are actually made — don't pre-fill this with aspirational voice-and-tone guidelines nobody has agreed to yet.
