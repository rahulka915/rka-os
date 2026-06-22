# RKA OS Screenshot Pack

Initial captures were taken on 2026-06-19 from the live preview browser at mobile width.

## Routes

- `01-home.png` - Home / Today overview
- `02-today.png` - Today page
- `03-inbox.png` - Inbox page
- `04-projects.png` - Projects page
- `05-calendar.png` - Calendar page
- `06-health.png` - Health page
- `07-profile.png` - Profile page
- `08-settings.png` - Settings page
- `09-template-builder-new.png` - Template builder new route
- `10-active-workout-new.png` - Active workout route loading state

## Shared Surfaces / Workflows

- `11-quick-add-open.png` - Quick Add sheet open
- `12-task-creator.png` - Task creator sheet
- `13-task-timeofday-menu.png` - Task creator time-of-day dropdown
- `14-medication-creator.png` - Medication creator sheet
- `15-medication-frequency-menu.png` - Medication frequency dropdown
- `16-workout-creator.png` - Workout template creator sheet
- `17-habit-creator.png` - Habit creator sheet

## Auth Flow

- `18-auth-email-signup.png` - Auth email step, signup mode
- `19-auth-email-login-mode.png` - Auth email step, login mode
- `20-auth-password-login.png` - Password step, login mode
- `21-auth-create-password.png` - Password step, signup mode
- `22-auth-verification-sent.png` - Verification sent state
- `23-auth-redirect-from-template-builder.png` - Protected route redirect back to auth after logout

## Notes

- These numbered PNGs are the earlier pre-seeded set and should now be treated as historical reference, not the latest truth.
- The current live seeded runtime is healthier than this first pack suggests.

## Verified Runtime Update

Verified later on 2026-06-19 against `http://localhost:5175` after full seed completion.

- Auth works with direct email/password login.
- Seeding now completes with `Seeded 241 items and confirmed Supabase sync.`
- `/home` reloads correctly after completed seed.
- `/projects` reloads correctly after completed seed.
- `/health-search` reloads correctly after completed seed.
- `/calendar` reloads correctly after completed seed.
- Health now shows `2` medications, `3` workout templates, and `193` exercises.
- Health workout template cards now show real exercise counts:
  - `Legs Day 6 exercises`
  - `Pull Day 5 exercises`
  - `Push Day 5 exercises`
- Workout template inspector title bug is fixed in runtime:
  - textbox value is `Push Day`
  - placeholder is empty instead of `Untitled`
- Workout inspector tabs are now uniquely targetable in runtime:
  - `data-testid="workout-dashboard-tab-overview"`
  - `data-testid="workout-dashboard-tab-exercises"`
  - `data-testid="workout-dashboard-tab-history"`
  - `data-testid="workout-dashboard-tab-settings"`
- Template builder is now verified end-to-end from the inspector:
  - `Push Day` opens into `/template-builder/<id>`
  - blocks and exercises are populated

## Next Capture Set Needed

The next binary refresh should replace or extend this pack with:

- seeded home
- seeded health with corrected workout counts
- workout inspector with corrected title behavior
- template builder reached from inspector
- seed progress states

## Capture Constraints

- Disk space is still very low on the machine, around `6.5 GiB` free at the last check.
- The in-app browser can reach `localhost` but not `127.0.0.1`.
- Live verification is working, but exporting fresh screenshot binaries back into the workspace still needs one more pass because the browser-runtime file write path is restricted and large screenshot payload relay is lossy.
