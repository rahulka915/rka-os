# RKA OS Workflow Review - 2026-06-19

## Scope

This pass used the local preview at `http://127.0.0.1:5175` after password signup was working.

Goals for this check:

- verify core route flow in preview
- verify whether seeded/demo data survives navigation and reload
- capture a fresh screenshot pack for design review
- note obvious UX, routing, and Supabase-sync issues

## Screenshot Pack

Saved in:

- `rka-os-feedback-shots/home.png`
- `rka-os-feedback-shots/home-spa.png`
- `rka-os-feedback-shots/today.png`
- `rka-os-feedback-shots/today-spa.png`
- `rka-os-feedback-shots/inbox.png`
- `rka-os-feedback-shots/projects.png`
- `rka-os-feedback-shots/calendar.png`
- `rka-os-feedback-shots/calendar-spa.png`
- `rka-os-feedback-shots/health.png`
- `rka-os-feedback-shots/profile.png`
- `rka-os-feedback-shots/me.png`
- `rka-os-feedback-shots/settings.png`
- `rka-os-feedback-shots/quick-add-open.png`
- `rka-os-feedback-shots/task-creator.png`
- `rka-os-feedback-shots/project-inspector.png`

Notes on naming:

- plain route captures include a hard-load version where useful
- `*-spa` captures were taken through in-app navigation to preserve client state

## Workflow Notes

### 1. Auth

- Password signup/login is now the active flow.
- The previous email-link flow is no longer the primary path.
- Auth was good enough to get into the app and stay signed in during testing.

### 2. Seed Flow

- The first blocker was local seeding failing with a Dexie primary-key upgrade error.
- This came from an old IndexedDB schema where `itemTags` used an auto-increment key.
- Local cache was moved to a fresh DB name so preview seeding could run again.
- After that change, seeding succeeded locally.

### 3. Supabase / Persistence

Current verdict: improved, but still not yet trustworthy as a shared-data system.

Evidence:

- auth user and sync user do match during seed
- remote write suppression is `0`
- remote writes were originally `0` because the sync bridge patched the wrong Dexie table handles
- after fixing that, remote writes started happening
- once remote writes were enabled, the app hit `Transaction committed too early`, caused by awaiting network sync inside Dexie transactions
- after moving remote sync to an async queue, hard reload stopped returning a completely empty app
- current reload state hydrates from remote, but seeded data duplicates and counts drift over repeated seed runs

What that suggests:

- Supabase is now partially in the loop instead of being bypassed entirely
- hydration from remote is alive
- remote clearing / reseeding order is still inconsistent
- cross-device sync should still be treated as unverified / not production-safe yet

### 4. Route / Flow Observations

#### Home

- Populated SPA state renders reasonably well.
- Seeding message is visible and helpful.
- Time-block rhythm is better than before, but still slightly fragmented.

#### Today

- Bottom-nav `Today` currently routes to `/home`.
- This makes `Today` functionally a duplicate shell state rather than a distinct execution screen.
- If intentional, rename the nav label.
- If not intentional, the nav target needs fixing.

#### Inbox

- Works as an empty state.
- Good enough visually for feedback.
- Still sparse compared with the intended Things reference density.

#### Projects

- Populated project list is one of the stronger screens in this pass.
- Card density and pill treatment are closer to target than several other screens.

#### Project Inspector

- Inspector originally opened with `Untitled` instead of the selected project name.
- This was traced to the inspector reading the wrong field for projects.
- The header data bug has now been fixed in code.

#### Health

- In SPA state, health renders with populated medications, workout templates, and exercise counts.
- In earlier hard-load state, health fell back to empty data.
- After sync-bridge fixes, reload now hydrates some remote data, but duplicate seeded records can appear.
- This is still primarily a persistence/sync integrity problem rather than a page-level rendering problem.
- Typography is materially better than before, but workout template subtitles still feel under-informed (`0 exercises`).

#### Calendar

- Calendar renders and the agenda layout is readable.
- It still feels more like a generic list than a Things-style calendar/planning surface.

#### Profile

- Profile page is presentable and useful.
- It gives us a working account destination, which the app previously lacked.

#### Settings

- Settings page exists and includes logout.
- This closes a major workflow gap.
- Styling is intentionally darker and more utility-like than the rest of the app, so it still feels somewhat detached from the main system.

#### Quick Add

- Bottom sheet opens correctly.
- The type-picker is one of the clearer reusable surfaces in the app right now.

#### Task Creator

- Form is functional and cleaner than the earlier version.
- Dropdown/select styling is still not yet at the Tiimo level.
- Overall sheet composition is usable, but still reads as custom product UI rather than close reference matching.

## Highest Priority Issues

1. Supabase persistence is still not proven stable.
2. Remote seed/reset logic now duplicates data instead of fully clearing/replacing it.
3. `Today` nav and `/today` page intent are not aligned.
4. Screenshot pack is now good enough for review, but auth states and deep workout flows are still missing from the pack.

## Recommended Next Pass

1. Fix Supabase remote clear / reseed integrity so one seed run replaces remote data cleanly.
2. Verify create/edit/toggle actions persist across reload and across devices.
3. Decide whether `Today` is a real page or just the new name for `Home`.
4. After persistence is stable, capture a second screenshot pack including:
   - auth screens
   - populated reload states
   - active workout
   - template builder
   - deeper inspector states
