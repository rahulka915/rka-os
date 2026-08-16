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
const DAY_MS = 24 * 60 * 60 * 1000;

function bucketCenters(sunTimes: SunTimes): Record<TimeOfDayBucket, number> {
  const sunriseMs = sunTimes.sunrise.getTime();
  const sunsetMs = sunTimes.sunset.getTime();
  const solarNoonMs = (sunriseMs + sunsetMs) / 2;
  const dawnEndMs = sunriseMs + HALF_TWILIGHT_MS;
  const duskStartMs = sunsetMs - HALF_TWILIGHT_MS;
  const duskEndMs = sunsetMs + HALF_TWILIGHT_MS;
  // Tomorrow's dawn-start isn't known (only today's sun times are passed
  // in), so approximate it as today's dawn-start + 24h — day length barely
  // changes day to day, so this is accurate to within a minute or two.
  const nextDawnStartMs = sunriseMs - HALF_TWILIGHT_MS + DAY_MS;

  return {
    dawn: sunriseMs,
    morning: (dawnEndMs + solarNoonMs) / 2,
    midday: (solarNoonMs + duskStartMs) / 2,
    dusk: sunsetMs,
    // Night's center is the midpoint of the dusk-end -> next-dawn-start span.
    night: (duskEndMs + nextDawnStartMs) / 2,
  };
}

export function getSkyBlend(sunTimes: SunTimes, now: Date): { bucketA: TimeOfDayBucket; bucketB: TimeOfDayBucket; blend: number } {
  const centers = bucketCenters(sunTimes);
  const nowMs = now.getTime();

  // Build a sorted list of [bucket, centerMs] pairs, extended by one cycle
  // on each side so `now` can always be bracketed even near midnight.
  const entries: Array<[TimeOfDayBucket, number]> = [];
  for (const offset of [-1, 0, 1]) {
    for (const bucket of TIME_OF_DAY_BUCKETS) {
      entries.push([bucket, centers[bucket] + offset * DAY_MS]);
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
