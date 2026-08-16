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
