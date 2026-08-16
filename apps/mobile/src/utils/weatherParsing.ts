// Pure parsing/formatting for WeatherKit's CurrentWeather data — split out
// from services/weather.ts (which calls the Cloud Function) so it stays
// testable under plain Node, same pattern as appleMapsParsing.ts.
export interface CurrentWeather {
  asOf: string;
  temperature: number;
  temperatureApparent: number;
  conditionCode: string;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
}

// Parses the Weather object relayed by the getWeather Cloud Function
// (WeatherKit's dataSets=currentWeather response) — units are always metric
// (Celsius, km/h) per WeatherKit, no conversion happening here.
export function parseCurrentWeather(body: unknown): CurrentWeather | null {
  const current = (body as { currentWeather?: Record<string, unknown> })?.currentWeather;
  if (!current) return null;
  const { asOf, temperature, temperatureApparent, conditionCode, humidity, windSpeed, uvIndex } = current;
  if (
    typeof asOf !== 'string' ||
    typeof temperature !== 'number' ||
    typeof temperatureApparent !== 'number' ||
    typeof conditionCode !== 'string' ||
    typeof humidity !== 'number' ||
    typeof windSpeed !== 'number' ||
    typeof uvIndex !== 'number'
  ) {
    return null;
  }
  return { asOf, temperature, temperatureApparent, conditionCode, humidity, windSpeed, uvIndex };
}

// A curated subset of Apple's ~40 conditionCode values gets a friendlier
// label; anything else falls back to splitting the PascalCase code into
// words ("MostlyClear" -> "Mostly Clear") rather than hardcoding all of them.
const CONDITION_LABELS: Record<string, string> = {
  Clear: 'Clear',
  MostlyClear: 'Mostly Clear',
  PartlyCloudy: 'Partly Cloudy',
  MostlyCloudy: 'Mostly Cloudy',
  Cloudy: 'Cloudy',
  Haze: 'Hazy',
  Fog: 'Foggy',
  Drizzle: 'Drizzle',
  Rain: 'Rain',
  HeavyRain: 'Heavy Rain',
  Thunderstorms: 'Thunderstorms',
  Snow: 'Snow',
  HeavySnow: 'Heavy Snow',
  Flurries: 'Flurries',
  Windy: 'Windy',
  Breezy: 'Breezy',
};

export function describeConditionCode(conditionCode: string): string {
  if (CONDITION_LABELS[conditionCode]) return CONDITION_LABELS[conditionCode];
  const spaced = conditionCode.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced || conditionCode;
}

const CONDITION_EMOJI: Record<string, string> = {
  Clear: '☀️',
  MostlyClear: '🌤️',
  PartlyCloudy: '⛅',
  MostlyCloudy: '🌥️',
  Cloudy: '☁️',
  Haze: '🌫️',
  Fog: '🌫️',
  Drizzle: '🌦️',
  Rain: '🌧️',
  HeavyRain: '🌧️',
  Thunderstorms: '⛈️',
  Snow: '🌨️',
  HeavySnow: '🌨️',
  Flurries: '🌨️',
  Windy: '💨',
  Breezy: '💨',
};

export function getWeatherEmoji(conditionCode: string): string {
  return CONDITION_EMOJI[conditionCode] ?? '🌡️';
}

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
