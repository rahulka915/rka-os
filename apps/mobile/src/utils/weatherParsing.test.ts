// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCurrentWeather, describeConditionCode, getWeatherEmoji } from './weatherParsing.ts';

const VALID_CURRENT_WEATHER = {
  asOf: '2026-08-08T16:00:00Z',
  cloudCover: 0.2,
  conditionCode: 'PartlyCloudy',
  humidity: 0.55,
  precipitationIntensity: 0,
  pressure: 1013,
  pressureTrend: 'steady',
  temperature: 21.4,
  temperatureApparent: 20.1,
  temperatureDewPoint: 12.0,
  uvIndex: 4,
  visibility: 10000,
  windSpeed: 12.5,
};

test('parseCurrentWeather: extracts the fields the widget needs from a real-shaped response', () => {
  const body = { currentWeather: VALID_CURRENT_WEATHER };
  assert.deepEqual(parseCurrentWeather(body), {
    asOf: '2026-08-08T16:00:00Z',
    temperature: 21.4,
    temperatureApparent: 20.1,
    conditionCode: 'PartlyCloudy',
    humidity: 0.55,
    windSpeed: 12.5,
    uvIndex: 4,
  });
});

test('parseCurrentWeather: returns null when currentWeather is missing', () => {
  assert.equal(parseCurrentWeather({}), null);
  assert.equal(parseCurrentWeather(null), null);
});

test('parseCurrentWeather: returns null when a required field is the wrong type', () => {
  const body = { currentWeather: { ...VALID_CURRENT_WEATHER, temperature: 'warm' } };
  assert.equal(parseCurrentWeather(body), null);
});

test('describeConditionCode: uses the curated label when present', () => {
  assert.equal(describeConditionCode('PartlyCloudy'), 'Partly Cloudy');
  assert.equal(describeConditionCode('Clear'), 'Clear');
});

test('describeConditionCode: falls back to splitting PascalCase for an uncurated code', () => {
  assert.equal(describeConditionCode('BlowingSand'), 'Blowing Sand');
});

test('getWeatherEmoji: maps a curated code and falls back to a thermometer otherwise', () => {
  assert.equal(getWeatherEmoji('Clear'), '☀️');
  assert.equal(getWeatherEmoji('SomeUnknownCode'), '🌡️');
});
