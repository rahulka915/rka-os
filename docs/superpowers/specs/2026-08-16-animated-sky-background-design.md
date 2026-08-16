# Animated Time-of-Day + Weather Sky Background — Design

## Problem

`RoninJourneyPrototype.tsx`'s Home journey widget currently shows one static
painted scene (`assets/ronin/journey/sunset-trail-background-v1.jpg` — a
mountain + torii gate illustration, always the same sunset lighting)
regardless of the real time of day or current weather. The goal is a
background that slowly, continuously shifts to match reality: darker at
night, bright at midday, tinted by real sunrise/sunset, and reflecting
current weather (clear/cloudy/rain) — built as a reusable component so it
isn't locked to this one widget.

## Goals

- A `AnimatedSkyBackground` component that fetches its own location/weather
  (no prop wiring required from a consumer) and renders a painted scene that
  continuously, near-imperceptibly shifts through 5 time-of-day states based
  on the device's real sunrise/sunset.
- Weather (clear/cloudy/rain) changes which painted variant is shown,
  crossfading in over a few seconds when it changes.
- Fails soft — no permission/network dependency ever blocks rendering.
- Drop-in replacement for `RoninJourneyPrototype`'s current static background,
  with no other change to that widget.

## Non-goals

- No procedural/generated sky (explicitly rejected — full painted art matrix
  instead).
- No snow-specific variant in v1 (Snow's WeatherKit codes map into the
  `rain` bucket for now — see §4).
- No new npm dependency (solar time is a small formula, not a library).
- No web port in this pass (native/iOS only, matching the existing
  journey-widget asset work).

## Design

### 1. Solar time (`src/utils/solarTime.ts`)

`computeSunTimes(latitude: number, longitude: number, date: Date): { sunrise: Date; sunset: Date }` —
a standard NOAA-style solar-position approximation (day-of-year + solar
declination + hour angle), pure and deterministic for a given lat/lon/date.
Accurate to within a few minutes, which is more than sufficient for an
ambient background. Unit-tested against known sunrise/sunset times for a
few reference lat/lon/date combinations (tolerance ±10 minutes).

### 2. Time-of-day buckets (`src/utils/skyTimeOfDay.ts`)

```ts
export type TimeOfDayBucket = 'dawn' | 'morning' | 'midday' | 'dusk' | 'night';
```

Given `{ sunrise, sunset }` and `now`, boundaries are derived (not fixed
clock hours):
- `solarNoon` = midpoint of sunrise/sunset.
- **Dawn**: `sunrise - 45min` to `sunrise + 45min`.
- **Dusk**: `sunset - 45min` to `sunset + 45min`.
- **Night**: dusk-end to next day's dawn-start (wraps midnight).
- **Morning**: dawn-end to `solarNoon`.
- **Midday**: `solarNoon` to dusk-start.

`getSkyBlend(sunTimes, now): { bucketA: TimeOfDayBucket; bucketB: TimeOfDayBucket; blend: number }` —
each bucket has an implicit "center" (midpoint of its own range); the
function finds the current time's position between the two nearest bucket
centers (walking the 5-bucket cycle in order, wrapping midnight) and
returns `blend` as the 0–1 fraction from `bucketA` toward `bucketB`. This is
the function the component re-runs every 60s to advance the crossfade.
Unit-tested with fixed sunrise/sunset and a sweep of `now` values spanning a
full day, asserting bucket order and blend monotonicity within each pair.

### 3. Weather category (`src/utils/weatherParsing.ts` addition)

```ts
export type SkyWeatherCategory = 'clear' | 'cloudy' | 'rain';
export function getSkyWeatherCategory(conditionCode: string): SkyWeatherCategory;
```

Mapping of the existing `CONDITION_LABELS` code set:
- `clear`: `Clear`, `MostlyClear`
- `cloudy`: `PartlyCloudy`, `MostlyCloudy`, `Cloudy`, `Haze`, `Fog`, `Windy`, `Breezy`
- `rain`: `Drizzle`, `Rain`, `HeavyRain`, `Thunderstorms`, `Snow`, `HeavySnow`, `Flurries`
- Any unrecognized code defaults to `clear`.

Unit-tested for full coverage of the existing code list plus the unknown-code
fallback.

### 4. Asset registry (`src/components/sky/skyScenes.ts`)

```ts
export const SKY_SCENES: Record<TimeOfDayBucket, Record<SkyWeatherCategory, ImageSourcePropType>>
```

15 `require()`d images at `assets/sky/<bucket>-<weather>.jpg` (matching the
existing painted mountain/torii illustration style, same aspect ratio as
today's `sunset-trail-background-v1.jpg`):

```
dawn-clear.jpg    dawn-cloudy.jpg    dawn-rain.jpg
morning-clear.jpg morning-cloudy.jpg morning-rain.jpg
midday-clear.jpg  midday-cloudy.jpg  midday-rain.jpg
dusk-clear.jpg    dusk-cloudy.jpg    dusk-rain.jpg
night-clear.jpg   night-cloudy.jpg   night-rain.jpg
```

These are generated externally (same workflow as the character sprite
sheets) — a follow-up message after this spec is approved will give the
exact generation prompt and file checklist.

### 5. `AnimatedSkyBackground` component (`src/components/sky/AnimatedSkyBackground.tsx`)

```ts
interface AnimatedSkyBackgroundProps {
  style?: StyleProp<ImageStyle>;
}
```

On mount: calls `getApproximateLocation()` (existing `deviceLocation.ts`,
already permission-gated/cached/fail-soft) and, once resolved, computes
today's sun times and starts fetching weather via the existing
`getCurrentWeather(lat, lon)` (already cached 20 min, fail-soft to `null`).

Rendering: two stacked `Image` layers for `bucketA`/`bucketB` (from
`getSkyBlend`, both using the current `SkyWeatherCategory`), `bucketB`'s
opacity driven by a Reanimated shared value equal to `blend`. A `setInterval`
(60s) recomputes `getSkyBlend(sunTimes, new Date())` and updates that shared
value — animated via `withTiming` toward the new blend under normal motion,
snapped instantly under Reduce Motion (`AccessibilityInfo.isReduceMotionEnabled`,
same pattern as `RoninJourneyPrototype`'s existing `reduceMotion` state).

A separate top-level pair of layers handles weather changes: when the
resolved `SkyWeatherCategory` differs from the previously-rendered one, the
whole two-time-bucket composite crossfades from the old category's images to
the new category's images over ~3s (`withTiming`, duration 0 under Reduce
Motion). Weather re-fetches piggyback on the same 60s tick (cheap — the
underlying `getCurrentWeather` call is itself cache-gated, so this doesn't
increase actual network calls beyond the existing 20-minute cadence).

**Fallback:** until location + sun times + weather have all resolved (or if
location/weather permission is denied or the calls fail), render the
`midday`/`clear` scene as a static single layer — never a blank view, never
blocked on network.

### 6. Integration

`RoninJourneyPrototype.tsx`: replace
```tsx
background={<Image source={sunsetTrail} resizeMode="cover" style={styles.background} />}
```
with
```tsx
background={<AnimatedSkyBackground style={styles.background} />}
```
No other change to the widget — `AnimatedSkyBackground` handles its own
`resizeMode="cover"` sizing internally to match.

## Testing

Pure logic (`solarTime.ts`, `skyTimeOfDay.ts`, `getSkyWeatherCategory`) is
unit-tested per this codebase's `node:test` convention. The component itself
is verified manually on-device (same convention as the existing
`RoninJourneyPrototype`/`RoninWalkCycleSprite` work): confirm the correct
bucket pair renders for the current real time, confirm Reduce Motion snaps
instead of animating, and confirm the fallback scene shows correctly with
location permission denied (toggle in iOS Settings).
