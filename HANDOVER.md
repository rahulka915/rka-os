# RKA OS Handover Note

This project is **RKA OS**, a local-first Progressive Web App for personal operations.

## Current Focus

- Unified graph-based data model in `src/db/db.ts`
- Workout workflow redesign
- Dashboard and activity feed polish
- Offline-first experience with Dexie and Vite PWA support

## Core Stack

- React
- TypeScript
- Vite
- Dexie.js
- Vanilla CSS
- Lucide React
- `vite-plugin-pwa`

## Important Data Model Notes

- `items` is the main polymorphic entity table.
- `itemInstances` stores dated occurrences and completion state.
- `entityLinks` handles graph relationships.
- `activityLogs` stores audit/history events.
- Workout execution uses dedicated tables for sessions, exercises, and sets.

## Recent Work

- Workout template builder with drag and drop
- Active workout execution flow with timers and progression stats
- Seeded exercise library with transparent anatomical imagery
- Unified dashboard timeline and activity feed

## Handover Guidance

- Keep the local-first architecture intact.
- Prefer graph links over hardcoding relationships.
- Preserve the premium dark glassmorphic UI language.
- Verify changes with `npm run build` when making structural edits.

## Files Worth Reading First

- `package.json`
- `src/db/db.ts`
- `src/pages/Home.tsx`
- `src/pages/TemplateBuilder.tsx`
- `src/pages/ActiveWorkout.tsx`

