# RKA OS Custom Icon Audit

Last reviewed: 15 July 2026

## Rule

Use commissioned RKA artwork for entities, destinations, time-of-day identity, and major branded states. Keep simple vector glyphs for universal actions such as back, close, delete, play, pause, upload, and disclosure.

## Existing branded assets

| Concept | Asset | Current coverage |
| --- | --- | --- |
| Home | Torii artwork | Dock |
| Calendar | Sundial artwork | Dock |
| Menu | Enso artwork | Dock and menu header |
| Profile | Ronin mon portrait | Dock |
| Task | Task note artwork | Menu, Calendar, task editor, Next Up |
| Project | Portfolio artwork | Menu, Calendar, task editor, project forms and lists, Next Up |
| Area | Bonsai artwork | Menu, Calendar, area forms and lists, Next Up |
| Medication | Bottle artwork | Menu, Calendar, medication screens, dose log, Home and Next Up |
| Time of day | Anytime, morning, afternoon and evening islands | Home timeline and Calendar |
| Calendar day | Default, selected and today badges | Calendar week strip |
| Date | Tear-off desk calendar artwork | Item editor and date picker |
| Time | Lacquer desk clock artwork | Item editor and time picker |
| Tags | Washi label artwork | Item editor and tag selection |
| Inbox | Empty, active and full trays | Home inbox card and hero environment |
| Completion | Lacquer disc | Tasks, Inbox, timeline and project tasks |

## Missing entity artwork — priority

1. **Workout / training** — still represented by generic fire/dumbbell vectors in Menu, Calendar, Practice cards and Next Up. Create one primary workout asset that remains legible at 20–34 pt.
2. **Habit / ritual** — still represented by Sparkles or a generic list glyph. Create a repeatable ritual/tally object that reads clearly at small sizes.
3. **Meal** — still represented by a Clock in Calendar. Create a meal or bento asset.
4. **Exercise** — the data model distinguishes exercises from workout templates; create a small exercise asset if exercises become visible independently.
5. **Workout block / set** — create only when blocks become first-class UI; it should be visually related to the workout asset rather than a separate style.

## Future collection artwork

- **Study** — currently a generic folder placeholder in Home practices.
- **Music** — currently a generic music-note placeholder in Home practices.

These can wait until the collections are functional.

## Optional branded metadata controls

- Priority pennant or rank marks
- Archive / someday container

These should be reusable vector controls, not detailed PNG illustrations. They are lower priority than missing entity artwork.

## Keep as system/vector actions

Do not commission PNG artwork for back, close, chevrons, add, delete, edit, play, pause, stop, upload, sync state, warning, or settings. These are universal actions and benefit from familiar, accessible system-style symbols. The custom Date and Time objects identify their fields; the familiar control behaviour and disclosure actions remain native.
