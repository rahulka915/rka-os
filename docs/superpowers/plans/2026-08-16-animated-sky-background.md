# Animated Sky Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home journey widget's static sunset image with a reusable `AnimatedSkyBackground` component that continuously shifts through 5 real sunrise/sunset-derived time-of-day states and 3 weather categories (15 painted scenes total), fetching its own location/weather with no prop wiring required.

**Architecture:** Three pure, unit-tested utilities (`solarTime.ts` for real sunrise/sunset, `skyTimeOfDay.ts` for the 5-bucket blend, `getSkyWeatherCategory` for WeatherKit-code → 3-category mapping) feed a static asset registry (`skyScenes.ts`) and a self-contained component (`AnimatedSkyBackground.tsx`) that crossfades two time-of-day layers continuously and a weather layer on change. `RoninJourneyPrototype.tsx` swaps its static background for this component.

**Tech Stack:** React Native 0.86.2 + Expo SDK 57.0.9 (TypeScript), `react-native-reanimated` (crossfade), existing `deviceLocation.ts`/`services/weather.ts` (no new services), Node's built-in test runner (`node:test` + `node:assert/strict`) for unit tests.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-16-animated-sky-background-design.md` — every task below implements part of it.
- No new npm dependencies — the solar calculation is a self-contained formula, not a library.
- Fails soft throughout: no permission/network dependency may ever block rendering or throw. Same principle as every other Apple-integration piece in this codebase (see `apps/mobile/CLAUDE.md`'s Weather/Maps sections).
- iOS-first; no desktop web work in this pass.
- Pure-logic unit tests follow this codebase's existing convention exactly: `node:test` + `node:assert/strict`, a `// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.` header comment, imports using the explicit `.ts` extension. Run via `npm test` (runs `src/**/*.test.ts`) or directly via `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test <file>` from `apps/mobile/`.
- `npx tsc --noEmit` (run from `apps/mobile/`, use `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit` if the default invocation stack-overflows) must stay clean after every task that touches `.ts`/`.tsx` files. A pre-existing unrelated error at `src/db/database.ts(1624,11)` ("skill" not assignable to "achievement" | "mission") is expected and not something to fix here.

---

### Task 1: Solar sunrise/sunset calculation

**Files:**
- Create: `apps/mobile/src/utils/solarTime.ts`
- Test: `apps/mobile/src/utils/solarTime.test.ts`

**Interfaces:**
- Produces: `computeSunTimes(latitude: number, longitude: number, date: Date): { sunrise: Date; sunset: Date }`. Task 2 (`skyTimeOfDay.ts`) consumes this return shape.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/utils/solarTime.test.ts`:

```ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSunTimes } from './solarTime.ts';

function assertCloseToTime(actual: Date, expectedIso: string, toleranceMinutes: number) {
  const diffMs = Math.abs(actual.getTime() - new Date(expectedIso).getTime());
  assert.ok(
    diffMs <= toleranceMinutes * 60 * 1000,
    `expected ${actual.toISOString()} to be within ${toleranceMinutes}min of ${expectedIso}`,
  );
}

test('computeSunTimes: London summer solstice matches published sunrise/sunset', () => {
  const { sunrise, sunset } = computeSunTimes(51.5074, -0.1278, new Date('2026-06-21T12:00:00Z'));
  assertCloseToTime(sunrise, '2026-06-21T03:44:00Z', 10);
  assertCloseToTime(sunset, '2026-06-21T20:23:00Z', 10);
});

test('computeSunTimes: London winter solstice matches published sunrise/sunset', () => {
  const { sunrise, sunset } = computeSunTimes(51.5074, -0.1278, new Date('2026-12-21T12:00:00Z'));
  assertCloseToTime(sunrise, '2026-12-21T08:05:00Z', 10);
  assertCloseToTime(sunset, '2026-12-21T15:55:00Z', 10);
});

test('computeSunTimes: sunrise is always before sunset for a given date', () => {
  const { sunrise, sunset } = computeSunTimes(40.7128, -74.0060, new Date('2026-03-20T12:00:00Z'));
  assert.ok(sunrise.getTime() < sunset.getTime());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/mobile/`): `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/solarTime.test.ts`
Expected: FAIL — `solarTime.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/utils/solarTime.ts`:

```ts
// Standard NOAA-style solar-position approximation (day-of-year + solar
// declination + hour angle) — accurate to within a couple of minutes for
// non-polar latitudes, which is more than sufficient for an ambient sky
// background. No external dependency; this is a self-contained published
// formula (the same approach used by common open-source sun-position
// calculators), not proprietary code.
const RAD = Math.PI / 180;
const J1970 = 2440588;
const J2000 = 2451545;
const DAY_MS = 1000 * 60 * 60 * 24;
const OBLIQUITY = RAD * 23.4397;

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}

function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * DAY_MS);
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(meanAnomaly: number): number {
  const center = RAD * (1.9148 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly) + 0.0003 * Math.sin(3 * meanAnomaly));
  const perihelion = RAD * 102.9372;
  return meanAnomaly + center + perihelion + Math.PI;
}

function declination(eclipticLon: number): number {
  return Math.asin(Math.sin(eclipticLon) * Math.sin(OBLIQUITY));
}

function hourAngle(altitude: number, latitudeRad: number, dec: number): number {
  return Math.acos(
    (Math.sin(altitude) - Math.sin(latitudeRad) * Math.sin(dec)) / (Math.cos(latitudeRad) * Math.cos(dec)),
  );
}

function approxTransit(hourAngleValue: number, longitudeWestRad: number, julianCycleValue: number): number {
  return 0.0009 + (hourAngleValue + longitudeWestRad) / (2 * Math.PI) + julianCycleValue;
}

function solarTransitJ(approxTransitValue: number, meanAnomaly: number, eclipticLon: number): number {
  return J2000 + approxTransitValue + 0.0053 * Math.sin(meanAnomaly) - 0.0069 * Math.sin(2 * eclipticLon);
}

function julianCycle(days: number, longitudeWestRad: number): number {
  return Math.round(days - 0.0009 - longitudeWestRad / (2 * Math.PI));
}

// Sun's altitude at actual sunrise/sunset, accounting for atmospheric
// refraction and the sun's apparent radius.
const SUNRISE_SUNSET_ANGLE = -0.833 * RAD;

export function computeSunTimes(latitude: number, longitude: number, date: Date): { sunrise: Date; sunset: Date } {
  const longitudeWestRad = RAD * -longitude;
  const latitudeRad = RAD * latitude;
  const days = toDays(date);
  const cycle = julianCycle(days, longitudeWestRad);
  const noonApprox = approxTransit(0, longitudeWestRad, cycle);
  const meanAnomaly = solarMeanAnomaly(noonApprox);
  const eclipticLon = eclipticLongitude(meanAnomaly);
  const dec = declination(eclipticLon);
  const solarNoon = solarTransitJ(noonApprox, meanAnomaly, eclipticLon);

  const setHourAngle = hourAngle(SUNRISE_SUNSET_ANGLE, latitudeRad, dec);
  const sunsetJulian = solarTransitJ(approxTransit(setHourAngle, longitudeWestRad, cycle), meanAnomaly, eclipticLon);
  const sunriseJulian = solarNoon - (sunsetJulian - solarNoon);

  return { sunrise: fromJulian(sunriseJulian), sunset: fromJulian(sunsetJulian) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/solarTime.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/solarTime.ts apps/mobile/src/utils/solarTime.test.ts
git commit -m "feat: add solar sunrise/sunset calculation"
```

---

### Task 2: Time-of-day bucket blend

**Files:**
- Create: `apps/mobile/src/utils/skyTimeOfDay.ts`
- Test: `apps/mobile/src/utils/skyTimeOfDay.test.ts`

**Interfaces:**
- Consumes: `computeSunTimes`'s return shape `{ sunrise: Date; sunset: Date }` (Task 1) as the `sunTimes` parameter — this task does not import `computeSunTimes` itself, it takes sun times as input so it stays independently testable with fixed fixtures.
- Produces: `TimeOfDayBucket = 'dawn' | 'morning' | 'midday' | 'dusk' | 'night'`, `TIME_OF_DAY_BUCKETS: TimeOfDayBucket[]` (in cycle order), `getSkyBlend(sunTimes: { sunrise: Date; sunset: Date }, now: Date): { bucketA: TimeOfDayBucket; bucketB: TimeOfDayBucket; blend: number }`. Task 5 (`AnimatedSkyBackground.tsx`) imports all three.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/utils/skyTimeOfDay.test.ts`:

```ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSkyBlend, TIME_OF_DAY_BUCKETS } from './skyTimeOfDay.ts';

// Fixed reference day: sunrise 06:00 UTC, sunset 18:00 UTC (solar noon 12:00,
// a clean 12-hour day makes the bucket boundaries easy to reason about).
const SUN_TIMES = {
  sunrise: new Date('2026-06-01T06:00:00Z'),
  sunset: new Date('2026-06-01T18:00:00Z'),
};

test('TIME_OF_DAY_BUCKETS lists all 5 buckets in cycle order', () => {
  assert.deepEqual(TIME_OF_DAY_BUCKETS, ['dawn', 'morning', 'midday', 'dusk', 'night']);
});

test('getSkyBlend: exact sunrise sits at the center of dawn', () => {
  const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, SUN_TIMES.sunrise);
  assert.ok([bucketA, bucketB].includes('dawn'));
});

test('getSkyBlend: exact solar noon sits at the center of midday', () => {
  const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, new Date('2026-06-01T12:00:00Z'));
  assert.ok([bucketA, bucketB].includes('midday'));
});

test('getSkyBlend: exact sunset sits at the center of dusk', () => {
  const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, SUN_TIMES.sunset);
  assert.ok([bucketA, bucketB].includes('dusk'));
});

test('getSkyBlend: deep night (midnight) sits at the center of night', () => {
  const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, new Date('2026-06-01T00:00:00Z'));
  assert.ok([bucketA, bucketB].includes('night'));
});

test('getSkyBlend: blend is always between 0 and 1 inclusive', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const { blend } = getSkyBlend(SUN_TIMES, new Date(`2026-06-01T${String(hour).padStart(2, '0')}:00:00Z`));
    assert.ok(blend >= 0 && blend <= 1, `hour ${hour}: blend was ${blend}`);
  }
});

test('getSkyBlend: bucketA and bucketB are always adjacent in the cycle', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const { bucketA, bucketB } = getSkyBlend(SUN_TIMES, new Date(`2026-06-01T${String(hour).padStart(2, '0')}:00:00Z`));
    const indexA = TIME_OF_DAY_BUCKETS.indexOf(bucketA);
    const indexB = TIME_OF_DAY_BUCKETS.indexOf(bucketB);
    const expectedB = (indexA + 1) % TIME_OF_DAY_BUCKETS.length;
    assert.equal(indexB, expectedB, `hour ${hour}: bucketA=${bucketA} bucketB=${bucketB}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/skyTimeOfDay.test.ts`
Expected: FAIL — `skyTimeOfDay.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/utils/skyTimeOfDay.ts`:

```ts
export type TimeOfDayBucket = 'dawn' | 'morning' | 'midday' | 'dusk' | 'night';

// Cycle order — getSkyBlend walks this array (wrapping) to find the two
// buckets `now` sits between.
export const TIME_OF_DAY_BUCKETS: TimeOfDayBucket[] = ['dawn', 'morning', 'midday', 'dusk', 'night'];

const HALF_TWILIGHT_MS = 45 * 60 * 1000;

interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

// Each bucket's "center" time today — the moment it's most purely that
// bucket. getSkyBlend interpolates between consecutive centers.
function bucketCenters(sunTimes: SunTimes): Record<TimeOfDayBucket, number> {
  const sunriseMs = sunTimes.sunrise.getTime();
  const sunsetMs = sunTimes.sunset.getTime();
  const solarNoonMs = (sunriseMs + sunsetMs) / 2;
  const dawnEndMs = sunriseMs + HALF_TWILIGHT_MS;
  const duskStartMs = sunsetMs - HALF_TWILIGHT_MS;

  return {
    dawn: sunriseMs,
    morning: (dawnEndMs + solarNoonMs) / 2,
    midday: (solarNoonMs + duskStartMs) / 2,
    dusk: sunsetMs,
    // Night's center is the midpoint of the dusk-end -> next-dawn-start
    // span; since this function only has today's sun times, approximate
    // it as 12 hours after sunset (halfway through a typical night) —
    // good enough for a slow-moving ambient background, and self-correct
    // once tomorrow's sun times are used the next day.
    night: sunsetMs + HALF_TWILIGHT_MS + 12 * 60 * 60 * 1000,
  };
}

export function getSkyBlend(sunTimes: SunTimes, now: Date): { bucketA: TimeOfDayBucket; bucketB: TimeOfDayBucket; blend: number } {
  const centers = bucketCenters(sunTimes);
  const nowMs = now.getTime();

  // Build a sorted list of [bucket, centerMs] pairs, extended by one cycle
  // on each side so `now` can always be bracketed even near midnight.
  const dayMs = 24 * 60 * 60 * 1000;
  const entries: Array<[TimeOfDayBucket, number]> = [];
  for (const offset of [-1, 0, 1]) {
    for (const bucket of TIME_OF_DAY_BUCKETS) {
      entries.push([bucket, centers[bucket] + offset * dayMs]);
    }
  }
  entries.sort((a, b) => a[1] - b[1]);

  let lower = entries[0];
  let upper = entries[entries.length - 1];
  for (let i = 0; i < entries.length - 1; i += 1) {
    if (entries[i][1] <= nowMs && nowMs <= entries[i + 1][1]) {
      lower = entries[i];
      upper = entries[i + 1];
      break;
    }
  }

  const span = upper[1] - lower[1];
  const blend = span === 0 ? 0 : (nowMs - lower[1]) / span;

  return { bucketA: lower[0], bucketB: upper[0], blend: Math.min(1, Math.max(0, blend)) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/skyTimeOfDay.test.ts`
Expected: PASS, 7 tests. If the "adjacent in cycle" test fails, double check the `entries` sort includes all three day offsets — the most common bug here is `now` falling outside the `[-1,0,1]`-day window (shouldn't happen since centers span at most ~36h from `now`, but verify if it does).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/skyTimeOfDay.ts apps/mobile/src/utils/skyTimeOfDay.test.ts
git commit -m "feat: add time-of-day bucket blend calculation"
```

---

### Task 3: Weather-to-sky-category mapping

**Files:**
- Modify: `apps/mobile/src/utils/weatherParsing.ts` (append, after the existing `getWeatherEmoji` function at the end of the file)
- Test: `apps/mobile/src/utils/weatherParsing.test.ts` (append new tests)

**Interfaces:**
- Produces: `SkyWeatherCategory = 'clear' | 'cloudy' | 'rain'`, `getSkyWeatherCategory(conditionCode: string): SkyWeatherCategory`. Task 4 (`skyScenes.ts`) and Task 5 (`AnimatedSkyBackground.tsx`) both import these.

- [ ] **Step 1: Write the failing tests**

Append to `apps/mobile/src/utils/weatherParsing.test.ts` (add the import to the existing `import` line at the top, then add these tests anywhere after the existing ones):

Change the existing import line from:
```ts
import { parseCurrentWeather, describeConditionCode, getWeatherEmoji } from './weatherParsing.ts';
```
to:
```ts
import { parseCurrentWeather, describeConditionCode, getWeatherEmoji, getSkyWeatherCategory } from './weatherParsing.ts';
```

Then append at the end of the file:

```ts
test('getSkyWeatherCategory: Clear and MostlyClear map to clear', () => {
  assert.equal(getSkyWeatherCategory('Clear'), 'clear');
  assert.equal(getSkyWeatherCategory('MostlyClear'), 'clear');
});

test('getSkyWeatherCategory: cloud/haze/fog/wind codes map to cloudy', () => {
  assert.equal(getSkyWeatherCategory('PartlyCloudy'), 'cloudy');
  assert.equal(getSkyWeatherCategory('MostlyCloudy'), 'cloudy');
  assert.equal(getSkyWeatherCategory('Cloudy'), 'cloudy');
  assert.equal(getSkyWeatherCategory('Haze'), 'cloudy');
  assert.equal(getSkyWeatherCategory('Fog'), 'cloudy');
  assert.equal(getSkyWeatherCategory('Windy'), 'cloudy');
  assert.equal(getSkyWeatherCategory('Breezy'), 'cloudy');
});

test('getSkyWeatherCategory: precipitation codes (including snow) map to rain', () => {
  assert.equal(getSkyWeatherCategory('Drizzle'), 'rain');
  assert.equal(getSkyWeatherCategory('Rain'), 'rain');
  assert.equal(getSkyWeatherCategory('HeavyRain'), 'rain');
  assert.equal(getSkyWeatherCategory('Thunderstorms'), 'rain');
  assert.equal(getSkyWeatherCategory('Snow'), 'rain');
  assert.equal(getSkyWeatherCategory('HeavySnow'), 'rain');
  assert.equal(getSkyWeatherCategory('Flurries'), 'rain');
});

test('getSkyWeatherCategory: unrecognized codes default to clear', () => {
  assert.equal(getSkyWeatherCategory('SomeFutureCode'), 'clear');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/weatherParsing.test.ts`
Expected: FAIL — `getSkyWeatherCategory` is not exported yet.

- [ ] **Step 3: Write the implementation**

Append to the end of `apps/mobile/src/utils/weatherParsing.ts`:

```ts
export type SkyWeatherCategory = 'clear' | 'cloudy' | 'rain';

const SKY_WEATHER_CATEGORIES: Record<string, SkyWeatherCategory> = {
  Clear: 'clear',
  MostlyClear: 'clear',
  PartlyCloudy: 'cloudy',
  MostlyCloudy: 'cloudy',
  Cloudy: 'cloudy',
  Haze: 'cloudy',
  Fog: 'cloudy',
  Windy: 'cloudy',
  Breezy: 'cloudy',
  Drizzle: 'rain',
  Rain: 'rain',
  HeavyRain: 'rain',
  Thunderstorms: 'rain',
  Snow: 'rain',
  HeavySnow: 'rain',
  Flurries: 'rain',
};

// Maps WeatherKit's ~16 condition codes down to the 3 painted-scene
// categories AnimatedSkyBackground supports — see
// docs/superpowers/specs/2026-08-16-animated-sky-background-design.md §3.
// Unrecognized codes default to 'clear' rather than throwing, matching this
// file's existing fail-soft conventions (describeConditionCode/getWeatherEmoji).
export function getSkyWeatherCategory(conditionCode: string): SkyWeatherCategory {
  return SKY_WEATHER_CATEGORIES[conditionCode] ?? 'clear';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/weatherParsing.test.ts`
Expected: PASS, all tests (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/weatherParsing.ts apps/mobile/src/utils/weatherParsing.test.ts
git commit -m "feat: add WeatherKit condition code to sky-weather-category mapping"
```

---

### Task 4: Sky scene asset registry (blocked on art)

**Files:**
- Create: `apps/mobile/assets/sky/dawn-clear.jpg`, `dawn-cloudy.jpg`, `dawn-rain.jpg`, `morning-clear.jpg`, `morning-cloudy.jpg`, `morning-rain.jpg`, `midday-clear.jpg`, `midday-cloudy.jpg`, `midday-rain.jpg`, `dusk-clear.jpg`, `dusk-cloudy.jpg`, `dusk-rain.jpg`, `night-clear.jpg`, `night-cloudy.jpg`, `night-rain.jpg` (you place these — generated externally, see below)
- Create: `apps/mobile/src/components/sky/skyScenes.ts`

**Interfaces:**
- Consumes: `TimeOfDayBucket` (Task 2), `SkyWeatherCategory` (Task 3).
- Produces: `SKY_SCENES: Record<TimeOfDayBucket, Record<SkyWeatherCategory, ImageSourcePropType>>`. Task 5 (`AnimatedSkyBackground.tsx`) imports `SKY_SCENES`.

**This task cannot be completed without the 15 art files existing first** — a `require()` of a missing file breaks the Metro bundle for the whole app, not just this screen, so do not write `skyScenes.ts` (Step 2 below) until every file in the Files list above exists on disk.

- [ ] **Step 1: Generate and place the 15 painted scenes**

For each of the 15 filenames above, generate a painted scene image matching the existing `apps/mobile/assets/ronin/journey/sunset-trail-background-v1.jpg` illustration style (mountain + torii gate silhouette landscape, same aspect ratio — check that file's dimensions with `file apps/mobile/assets/ronin/journey/sunset-trail-background-v1.jpg` before generating so the new scenes crop/compose consistently against the widget's existing `resizeMode="cover"` sizing). Use this parameterized prompt, substituting `<TIME_DESCRIPTION>` and `<WEATHER_DESCRIPTION>` per the table below:

> A painted landscape illustration of a mountain (Mount Fuji-style, snow-capped peak) with a traditional Japanese torii gate silhouette in the mid-ground and a pagoda silhouette nearby, pine trees in the foreground — <TIME_DESCRIPTION>. <WEATHER_DESCRIPTION> Soft painterly digital illustration style with a warm, atmospheric gradient sky, matching a premium mobile game's ambient background art. No characters, no text, no watermark. Wide landscape aspect ratio.

| Filename | `<TIME_DESCRIPTION>` | `<WEATHER_DESCRIPTION>` |
|---|---|---|
| `dawn-clear.jpg` | early dawn light, soft pink and lavender sky low on the horizon, sun just below the mountain peak | Clear sky, no clouds, crisp visibility. |
| `dawn-cloudy.jpg` | early dawn light, soft pink and lavender sky low on the horizon, sun just below the mountain peak | Scattered soft grey-pink clouds catching the early light. |
| `dawn-rain.jpg` | early dawn light, muted grey-blue sky, dim pre-sunrise glow | Light rain, overcast grey clouds, slightly hazy visibility. |
| `morning-clear.jpg` | mid-morning, bright warm sunlight, sun well above the horizon | Clear sky, no clouds, crisp bright visibility. |
| `morning-cloudy.jpg` | mid-morning, bright warm sunlight | Scattered white and grey clouds across a blue sky. |
| `morning-rain.jpg` | mid-morning, dim overcast light | Steady rain, thick grey clouds, reduced visibility. |
| `midday-clear.jpg` | full midday sun, bright blue sky, sun near its highest point | Clear sky, no clouds, maximum visibility. |
| `midday-cloudy.jpg` | full midday sun, bright blue sky | Puffy white clouds scattered across a bright blue sky. |
| `midday-rain.jpg` | midday, dim grey daylight | Heavy rain, dark grey storm clouds, low visibility. |
| `dusk-clear.jpg` | sunset, vivid orange and pink sky, sun low near the mountain peak | Clear sky, no clouds, vivid unobstructed sunset colors. |
| `dusk-cloudy.jpg` | sunset, vivid orange and pink sky, sun low near the mountain peak | Dramatic clouds lit orange and pink by the setting sun. |
| `dusk-rain.jpg` | sunset, muted deep orange-grey sky | Light rain at sunset, heavy grey clouds with warm light breaking through. |
| `night-clear.jpg` | deep night, dark navy sky, stars visible, moon present | Clear night sky, no clouds, visible stars. |
| `night-cloudy.jpg` | deep night, dark navy sky, moon partially obscured | Heavy clouds at night, faint moonlight glow through the cloud cover. |
| `night-rain.jpg` | deep night, very dark stormy sky | Heavy night rain, no visible stars or moon, dark storm clouds. |

Save each generated image to `apps/mobile/assets/sky/<filename>` exactly as named in the Files list.

- [ ] **Step 2: Verify all 15 files exist**

Run (from `apps/mobile/`): `ls assets/sky/ | wc -l`
Expected: `15`. Do not proceed to Step 3 until this is true.

- [ ] **Step 3: Write the asset registry**

Create `apps/mobile/src/components/sky/skyScenes.ts`:

```ts
import type { ImageSourcePropType } from 'react-native';
import type { TimeOfDayBucket } from '../../utils/skyTimeOfDay';
import type { SkyWeatherCategory } from '../../utils/weatherParsing';

// Static require() registry of the 15 painted time-of-day x weather scenes —
// see docs/superpowers/specs/2026-08-16-animated-sky-background-design.md §4.
export const SKY_SCENES: Record<TimeOfDayBucket, Record<SkyWeatherCategory, ImageSourcePropType>> = {
  dawn: {
    clear: require('../../../assets/sky/dawn-clear.jpg'),
    cloudy: require('../../../assets/sky/dawn-cloudy.jpg'),
    rain: require('../../../assets/sky/dawn-rain.jpg'),
  },
  morning: {
    clear: require('../../../assets/sky/morning-clear.jpg'),
    cloudy: require('../../../assets/sky/morning-cloudy.jpg'),
    rain: require('../../../assets/sky/morning-rain.jpg'),
  },
  midday: {
    clear: require('../../../assets/sky/midday-clear.jpg'),
    cloudy: require('../../../assets/sky/midday-cloudy.jpg'),
    rain: require('../../../assets/sky/midday-rain.jpg'),
  },
  dusk: {
    clear: require('../../../assets/sky/dusk-clear.jpg'),
    cloudy: require('../../../assets/sky/dusk-cloudy.jpg'),
    rain: require('../../../assets/sky/dusk-rain.jpg'),
  },
  night: {
    clear: require('../../../assets/sky/night-clear.jpg'),
    cloudy: require('../../../assets/sky/night-cloudy.jpg'),
    rain: require('../../../assets/sky/night-rain.jpg'),
  },
};
```

- [ ] **Step 4: Typecheck**

Run (from `apps/mobile/`): `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: only the pre-existing `src/db/database.ts(1624,11)` error, nothing new.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/assets/sky/ apps/mobile/src/components/sky/skyScenes.ts
git commit -m "feat: add the 15 time-of-day x weather sky scene assets"
```

---

### Task 5: `AnimatedSkyBackground` component

**Files:**
- Create: `apps/mobile/src/components/sky/AnimatedSkyBackground.tsx`

**Interfaces:**
- Consumes: `computeSunTimes` (Task 1), `getSkyBlend`/`TimeOfDayBucket` (Task 2), `getSkyWeatherCategory`/`SkyWeatherCategory` (Task 3), `SKY_SCENES` (Task 4), `getApproximateLocation` (existing `../../services/deviceLocation.ts`), `getCurrentWeather` (existing `../../services/weather.ts`).
- Produces: `AnimatedSkyBackground({ style }: { style?: StyleProp<ImageStyle> })` — a React component. Task 6 (`RoninJourneyPrototype.tsx`) imports it.

- [ ] **Step 1: Write the component**

Create `apps/mobile/src/components/sky/AnimatedSkyBackground.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { computeSunTimes } from '../../utils/solarTime';
import { getSkyBlend, type TimeOfDayBucket } from '../../utils/skyTimeOfDay';
import { getSkyWeatherCategory, type SkyWeatherCategory } from '../../utils/weatherParsing';
import { getApproximateLocation } from '../../services/deviceLocation';
import { getCurrentWeather } from '../../services/weather';
import { SKY_SCENES } from './skyScenes';

const TICK_MS = 60 * 1000;
const FALLBACK_BUCKET: TimeOfDayBucket = 'midday';
const FALLBACK_WEATHER: SkyWeatherCategory = 'clear';
const WEATHER_CROSSFADE_MS = 3000;

interface AnimatedSkyBackgroundProps {
  style?: StyleProp<ImageStyle>;
}

export function AnimatedSkyBackground({ style }: AnimatedSkyBackgroundProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [sunTimes, setSunTimes] = useState<{ sunrise: Date; sunset: Date } | null>(null);
  const [weatherCategory, setWeatherCategory] = useState<SkyWeatherCategory>(FALLBACK_WEATHER);
  const [bucketA, setBucketA] = useState<TimeOfDayBucket>(FALLBACK_BUCKET);
  const [bucketB, setBucketB] = useState<TimeOfDayBucket>(FALLBACK_BUCKET);

  const blend = useSharedValue(0);
  const weatherOpacity = useSharedValue(1);
  // Holds the previous weather category's images during a crossfade so the
  // old scene can fade out under the new one instead of popping instantly.
  const [previousWeatherCategory, setPreviousWeatherCategory] = useState<SkyWeatherCategory | null>(null);

  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  // Resolve location once on mount — fails soft to the fallback bucket/weather
  // (never blocks rendering) if permission is denied or it errors.
  useEffect(() => {
    let cancelled = false;
    getApproximateLocation().then((location) => {
      if (cancelled || !location) return;
      locationRef.current = location;
      setSunTimes(computeSunTimes(location.latitude, location.longitude, new Date()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Recomputes the time-of-day blend every minute, and re-fetches weather on
  // the same tick (getCurrentWeather is itself cache-gated at 20 minutes, so
  // this doesn't increase real network calls).
  useEffect(() => {
    function tick() {
      if (sunTimes) {
        const result = getSkyBlend(sunTimes, new Date());
        setBucketA(result.bucketA);
        setBucketB(result.bucketB);
        blend.value = reduceMotion
          ? result.blend
          : withTiming(result.blend, { duration: TICK_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
      }
      const location = locationRef.current;
      if (location) {
        getCurrentWeather(location.latitude, location.longitude).then((weather) => {
          if (!weather) return;
          const category = getSkyWeatherCategory(weather.conditionCode);
          setWeatherCategory((current) => {
            if (current === category) return current;
            setPreviousWeatherCategory(current);
            weatherOpacity.value = 0;
            weatherOpacity.value = withTiming(1, {
              duration: reduceMotion ? 0 : WEATHER_CROSSFADE_MS,
              easing: Easing.inOut(Easing.sin),
              reduceMotion: ReduceMotion.Never,
            });
            return category;
          });
        });
      }
    }
    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [sunTimes, reduceMotion, blend, weatherOpacity]);

  const bucketBStyle = useAnimatedStyle(() => ({ opacity: blend.value }));
  const currentWeatherStyle = useAnimatedStyle(() => ({ opacity: weatherOpacity.value }));
  const previousWeatherStyle = useAnimatedStyle(() => ({ opacity: 1 - weatherOpacity.value }));

  const sceneA = SKY_SCENES[bucketA][weatherCategory];
  const sceneB = SKY_SCENES[bucketB][weatherCategory];

  return (
    <Animated.View style={[styles.fill, currentWeatherStyle]}>
      <Image source={sceneA} resizeMode="cover" style={[styles.fill, style]} />
      <Animated.View style={[styles.fill, bucketBStyle]}>
        <Image source={sceneB} resizeMode="cover" style={[styles.fill, style]} />
      </Animated.View>
      {previousWeatherCategory !== null && (
        <Animated.View style={[styles.fill, previousWeatherStyle]} pointerEvents="none">
          <Image source={SKY_SCENES[bucketA][previousWeatherCategory]} resizeMode="cover" style={[styles.fill, style]} />
          <Animated.View style={[styles.fill, bucketBStyle]}>
            <Image source={SKY_SCENES[bucketB][previousWeatherCategory]} resizeMode="cover" style={[styles.fill, style]} />
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile/`): `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: only the pre-existing `src/db/database.ts(1624,11)` error, nothing new.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/sky/AnimatedSkyBackground.tsx
git commit -m "feat: add AnimatedSkyBackground component"
```

---

### Task 6: Wire `AnimatedSkyBackground` into `RoninJourneyPrototype`

**Files:**
- Modify: `apps/mobile/src/components/home/RoninJourneyPrototype.tsx:17` (import), `:28` (remove unused require), `:207` (background render)

**Interfaces:**
- Consumes: `AnimatedSkyBackground` from `../sky/AnimatedSkyBackground` (Task 5).
- No change to `RoninJourneyPrototype`'s own exported props.

- [ ] **Step 1: Add the import**

In `apps/mobile/src/components/home/RoninJourneyPrototype.tsx`, add after the existing `import { RoninWalkCycleSprite } from './RoninWalkCycleSprite';` line (line 18):

```ts
import { AnimatedSkyBackground } from '../sky/AnimatedSkyBackground';
```

- [ ] **Step 2: Remove the now-unused static background require**

Remove this line (currently line 28):

```ts
const sunsetTrail = require('../../../assets/ronin/journey/sunset-trail-background-v1.jpg');
```

- [ ] **Step 3: Replace the background render**

Replace (currently line 207):

```tsx
      background={<Image source={sunsetTrail} resizeMode="cover" style={styles.background} />}
```

with:

```tsx
      background={<AnimatedSkyBackground style={styles.background} />}
```

- [ ] **Step 4: Typecheck**

Run (from `apps/mobile/`): `node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: only the pre-existing `src/db/database.ts(1624,11)` error, nothing new, and no "unused variable" warning for `sunsetTrail` (it's removed, not just unreferenced). If `Image` is now unused elsewhere in the file (it's still used by the tap-reaction sprite path via `RoninWalkCycleSprite`, so it should still be needed — verify before removing its import).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/home/RoninJourneyPrototype.tsx
git commit -m "feat: use AnimatedSkyBackground as the journey widget's sky"
```

---

### Task 7: On-device verification

**Files:** none (manual verification only).

- [ ] **Step 1: Run the full test suite and typecheck**

Run (from `apps/mobile/`): `npm test && node --stack-size=8000 ./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v webApp`
Expected: all tests pass (including the new `solarTime.test.ts`, `skyTimeOfDay.test.ts`, and the `weatherParsing.test.ts` additions), only the pre-existing `database.ts` typecheck error.

- [ ] **Step 2: Start the dev client and open Home**

Run: `npm start -- --clear` (port 8082 per `apps/mobile/CLAUDE.md`'s convention), open the installed RKA OS dev client, navigate to Home's Today view.

- [ ] **Step 3: Confirm the correct scene renders for the current real time/weather**

Expected: the journey widget's background shows a scene matching the actual current time of day (e.g. bright midday scene if it's early afternoon, dark night scene late at night) and the device's actual current weather condition (check against a weather app). If location/weather permission was previously denied, expect the `midday`/`clear` fallback scene instead — not a blank or broken view.

- [ ] **Step 4: Confirm the fallback with location denied**

In iOS Settings → Privacy & Security → Location Services, deny location for the RKA OS dev client (or the whole device temporarily), relaunch the app, and check the journey widget again. Expected: the `midday`/`clear` fallback scene renders immediately, no crash, no blank view. Restore location permission afterward.

- [ ] **Step 5: Confirm Reduce Motion behavior**

Enable iOS Settings → Accessibility → Motion → Reduce Motion, force-reload the app. Expected: the sky still shows the correct current bucket/weather (the blend value is set directly rather than animated), and if weather happens to change while watching, the crossfade is instant rather than a 3-second fade. Turn Reduce Motion back off afterward.

- [ ] **Step 6: Confirm existing journey widget behavior is unaffected**

Re-run the tap/Jump/Bow button checks from `docs/superpowers/plans/2026-08-16-ronin-jump-bow-buttons.md`'s Task 5 to confirm nothing regressed — the sky change only touches the `background` prop, not the walker/buttons/progress logic.

- [ ] **Step 7: Final commit (if any fixes were needed)**

If verification surfaced a fix, commit it separately with a clear message describing what was wrong; otherwise this task requires no commit.
