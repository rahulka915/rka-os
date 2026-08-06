# Ronin — `Journey Controller` state machine design

Derived from inspecting the user's **aquarium** Rive remix (artboards `main`, `fish`, `food`,
`grass`, `fern`) on 2026-08-06, read against `RONIN_JOURNEY_RIVE_CONTRACT` in
`src/domain/ronin/journeyAnimation.ts`. The aquarium's `fish` artboard is the reference: 4 layers,
16 linear animations, 42 states, 77 transitions.

---

## 1. The eleven mechanisms worth naming

### 1.1 There are NO state machine inputs. At all.
`inputs: []`. Every condition is a `viewModelComparison` against `VMFish`. The legacy
boolean/number/trigger input API is not used anywhere in the file. **Our contract already declares
`viewModel: 'Journey'`, so we are aligned — but it means the app must drive the rig by setting
view-model properties, never by `setInput`.**

### 1.2 One layer per concern, running in parallel
`fish` = `mouth` | `eyeTracking` | `eye` | `swim`. The donor cat file does the same thing with 27
layers. A layer is the unit of independence: the fish keeps swimming while its eyes change mood and
its mouth cycles idles, because those are three layers, not one graph.

### 1.3 Continuous scalar → banded states
`numHunger` (0–100) is cut into four mood bands by threshold conditions: `<10` happy, `10–50`
neutral, `50–75` sad, `>=75` starving. `numVelocity` is cut into five swim bands: `<20`, `20–50`,
`50–100`, `100–150`, `>=150`. There is no enum anywhere. **This is how `progress` should drive the
Ronin.**

### 1.4 The router/hub state — the reason it isn't N² transitions
An **animation state with no animation assigned**, used purely as a junction:
`#957231` (swim), `#955246` (eye), `#951470`/`#951626`/`#951649` (mouth).
Every band state exits *back to the hub* when its condition stops holding, and the hub holds the
full set of band conditions. So each band needs 2 transitions (in from hub, out to hub), not one to
every sibling. Copy this pattern; it is the single biggest structural idea in the file.

### 1.5 Idle variation = uniform random pick from a hub
Hub `#951470` has **three unconditional exits** to three separate `mouth_idle` states. All
`randomWeight = 1`, so Rive picks uniformly. Each variant holds a **different** exit time —
**800 ms / 1200 ms / 1800 ms** — then returns to the hub and re-rolls. That irregular dwell is what
stops the idle reading as a metronome. There is no random node and no script.

### 1.6 One-shots come from `{Any State}` on a trigger and self-terminate
`{any} -> mouth_eat [trigEat]`, `{any} -> eye_blink [trigBlink]`, `{any} -> emote_eating* [trigEat]`.
Every one returns via an **unconditional transition with `exitTime = 100%`** — play to the end, then
fall back to the hub. No cleanup conditions.

### 1.7 Direction picks a different CLIP, it does not mirror
```
{any} -> emote_eatingRight  [trigEat AND numFacing >= 0]
{any} -> emote_eatingLeft   [trigEat AND numFacing <  0]
```
Two separately authored animations selected by the sign of a number. **This is the pattern the ¾
Ronin needs**: a ¾ character cannot be mirrored, so every direction-dependent action costs two clips
and a sign condition.

### 1.8 Listeners write view-model properties; they never drive states
`eyeTracking_true` = a **`move`** listener on an object literally named `hitbox` → sets
`boolEyeTracking = true`. `eyeTracking_false` = an **`exit`** listener on the same hitbox → sets it
false. The `eyeTracking` *layer* then reacts to the boolean. Chain is always
**listener → VM property → condition → state**, and the listener target is a dedicated invisible
`hitbox`, not the artwork.

### 1.9 Loop-to-loop transitions always wait for the loop to finish
Every transition between two looping states uses `exitTime = 100%`. Nothing is cut mid-cycle. This
is most of why the fish reads as smooth rather than twitchy.

### 1.10 A blend-duration vocabulary, used consistently
| Duration | Used for |
|---|---|
| **0 ms** | swaps inside the same band / entering a one-shot |
| **40 ms** | into a blink |
| **150 ms** | blink → expression |
| **300 ms** | adjacent velocity bands |
| **500 ms** | one mood step |
| **1000 ms** | mode change (swim ↔ starving), eye-tracking off |
Interpolations `linear`, `cubic` and `elastic` are all in use. (Durations are milliseconds; the
`durationIsPercentage` flag is false throughout.)

### 1.11 Randomness and timing come from outside the rig
`VMMain.numRandomizerTime` is a plain number property, and `trigBlink` is fired externally. Rive is
not generating the randomness — the host is.

---

## 2. What to copy / what to replace

| Aquarium mechanism | Verdict | For `Journey Controller` |
|---|---|---|
| No SM inputs; all conditions are VM comparisons | **COPY verbatim** | Contract already says `viewModel: 'Journey'`. App sets properties only. |
| One layer per concern | **COPY** | 5 layers: `body` (activity), `face` (mood), `cat` (catState), `travel` (progress), `oneshots` (tap/complete). |
| Router/hub empty animation state | **COPY** | One hub per layer. Non-negotiable — without it the `activity` layer is 12×11 transitions. |
| Idle variation: N unconditional exits, unequal exit times | **COPY** | 3 `idle` variants at ~900/1400/2000 ms off the `body` hub. Cheapest life-per-path in the whole rig. |
| `{any}` + trigger + `exitTime 100%` one-shot | **COPY verbatim** | `tap` and `complete` are already triggers in the contract. |
| Boolean with entry-branch + both-way live transitions | **COPY** | `reducedMotion` uses exactly the `boolEyeTracking` shape. |
| Sign-of-a-number picks left/right clip | **COPY — and budget for it** | The ¾ rig cannot mirror. Every directional action = 2 clips. |
| `exitTime = 100%` on all loop→loop | **COPY** | Never cut the walk mid-stride. |
| Blend-duration vocabulary (0/150/300/500/1000 ms) | **COPY** | Gives a consistent feel for free. |
| Listener → VM property → condition | **COPY**, incl. the dedicated `hitbox` | Tap must hit an invisible hitbox, not `head-face`. |
| **`swim` layer's 16-state cross product** | **DO NOT COPY** | 5 velocity bands × 2 hunger modes enumerated by hand = 36 transitions. That is the cost of two axes on one layer. Split `activity` and `mood` onto separate layers so we never pay it. |
| `numHunger` / `numVelocity` semantics | **REPLACE** | → `progress` (0–1) and `activity`. |
| `VMMain` with 5× nested `VMFish` + 5× `VMFood` | **REPLACE** | One Ronin. Keep the nesting idea in reserve only if the pet cat gets its own VM. |
| Hungarian prefixes (`num`/`bool`/`trig`/`color`) | **REPLACE** | Contract names are fixed in TypeScript and already shipped. Do not rename. |
| Per-part `color*` properties on `VMFish` (9 of them) | **DEFER** | Runtime recolour is a real option for `outfit`, but outfit layering is already deferred. |

## 3. Gaps this exposes in `RONIN_JOURNEY_RIVE_CONTRACT`

The contract has `activity, mood, outfit, catState, progress, reducedMotion, tap, complete`.
The aquarium shows three things it is missing:

1. **`blink` trigger** — the fish blinks from a host-fired `trigBlink`. Without it the Ronin's face
   is static between mood changes. Cheap and high-value.
2. **`randomSeed` / `randomizerTime` number** — the aquarium's randomness is host-supplied
   (`VMMain.numRandomizerTime`). Uniform-weight hub picking (§1.5) covers idle variation without it,
   so this is optional, but it is the escape hatch if idles ever need to correlate.
3. **`facing` number** — §1.7. Not needed for a walk, needed the moment any action is direction-
   dependent. Add it before authoring the first directional clip, not after.

All three are additive to the TS contract and break nothing.

## 4. The seated-pose caveat, restated against this design

`meditating`, `sleeping` and `reading` are seated, out-of-plane poses. A 2D cutout rig cannot rotate
into them, so they are **separately drawn art**, not states blended from the walk. In this design
they are exclusive full-body states on the `body` layer with **blend duration 0** to and from the
hub — a cut, not a blend, because there is no valid interpolation between a standing rig and a
seated drawing. References exist in `assets/ronin/reference/approved-structural-v1/`.
