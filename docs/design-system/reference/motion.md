# Motion

No formal motion-design brief exists yet — this page currently just catalogs the timing/spring values already in real use, pulled from Reanimated code, rather than inventing principles nobody has actually decided on. Add a real "principles" section once a deliberate motion-language decision gets made (e.g. "sheets always spring, never ease-timing"); until then, treat the table below as description, not prescription.

## Spring/timing values in current use

| Component | Motion | Config |
|---|---|---|
| `BottomSheet.tsx` | Sheet entrance | `withSpring(1, { stiffness: 350, damping: 32, mass: 0.8 })` |
| `BottomSheet.tsx` | Sheet exit | `withSpring(0, { stiffness: 400, damping: 40 })` |
| `BottomSheet.tsx` | Backdrop fade in/out | `withTiming(1, { duration: 220 })` / `withTiming(0, { duration: 180 })` |
| `BottomSheet.tsx` | Drag-release snap-back | `withSpring(0, { stiffness: 350, damping: 32 })` |
| `TaskSwipeItem.tsx` | Swipe snap-back | `withSpring(0, { damping: 10, mass: 1, overshootClamping: false })` |
| `TaskSwipeItem.tsx` | Swipe reveal-in | `withTiming(1, { duration: 200 })` |
| `TaskSwipeItem.tsx` | Delete slide-out | `withTiming(-300, { duration: 180 })` then height/opacity collapse (`200`ms / `150`ms) |
| `ContextMenu.tsx` | Long-press scale bounce | `Animated.timing` 100ms down to 0.95, 100ms back to 1 |

## Known gaps

- No documented `prefers-reduced-motion`-equivalent policy for native yet — the retired PWA had this rule for web; mobile hasn't stated an equivalent.
- No named "motion tokens" (e.g. a shared `SPRING_STANDARD` constant) — each component currently defines its own spring config inline. Worth consolidating once a third or fourth component needs the "same" spring and copies values by hand instead of importing one.
