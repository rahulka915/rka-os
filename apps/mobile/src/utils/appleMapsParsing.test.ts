// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGeocodeResponse, parseEtaResponse, parseEtasResponse, parseSearchAutocompleteResponse, parseReverseGeocodeResponse } from './appleMapsParsing.ts';

test('parseGeocodeResponse: extracts the first result coordinate', () => {
  const body = {
    results: [
      { coordinate: { latitude: 37.3301996, longitude: -122.0106415 }, name: 'Apple Park' },
      { coordinate: { latitude: 1, longitude: 1 } },
    ],
  };
  assert.deepEqual(parseGeocodeResponse(body), { latitude: 37.3301996, longitude: -122.0106415 });
});

test('parseGeocodeResponse: returns null when results are empty', () => {
  assert.equal(parseGeocodeResponse({ results: [] }), null);
});

test('parseGeocodeResponse: returns null on malformed body', () => {
  assert.equal(parseGeocodeResponse({ nonsense: true }), null);
  assert.equal(parseGeocodeResponse(null), null);
});

test('parseEtaResponse: extracts expectedTravelTimeSeconds and distanceMeters from the first eta', () => {
  const body = {
    etas: [
      { destination: { latitude: 1, longitude: 1 }, transportType: 'AUTOMOBILE', distanceMeters: 1560, expectedTravelTimeSeconds: 1560, staticTravelTimeSeconds: 1500 },
    ],
  };
  assert.deepEqual(parseEtaResponse(body), { durationSeconds: 1560, distanceMeters: 1560 });
});

test('parseEtaResponse: falls back to staticTravelTimeSeconds when expectedTravelTimeSeconds is missing', () => {
  const body = { etas: [{ distanceMeters: 800, staticTravelTimeSeconds: 900 }] };
  assert.deepEqual(parseEtaResponse(body), { durationSeconds: 900, distanceMeters: 800 });
});

test('parseEtaResponse: returns null when etas is empty or malformed', () => {
  assert.equal(parseEtaResponse({ etas: [] }), null);
  assert.equal(parseEtaResponse({}), null);
  assert.equal(parseEtaResponse(null), null);
});

test('parseEtasResponse: returns one result per destination, position-aligned', () => {
  const body = {
    etas: [
      { distanceMeters: 1000, expectedTravelTimeSeconds: 300 },
      { distanceMeters: 2000, staticTravelTimeSeconds: 600 },
    ],
  };
  assert.deepEqual(parseEtasResponse(body), [
    { durationSeconds: 300, distanceMeters: 1000 },
    { durationSeconds: 600, distanceMeters: 2000 },
  ]);
});

test('parseEtasResponse: keeps position by inserting null for a malformed entry rather than dropping it', () => {
  const body = { etas: [{ distanceMeters: 1000, expectedTravelTimeSeconds: 300 }, { distanceMeters: 500 }] };
  assert.deepEqual(parseEtasResponse(body), [{ durationSeconds: 300, distanceMeters: 1000 }, null]);
});

test('parseEtasResponse: returns empty array on malformed body', () => {
  assert.deepEqual(parseEtasResponse(null), []);
  assert.deepEqual(parseEtasResponse({}), []);
});

test('parseSearchAutocompleteResponse: maps displayLines to title/subtitle and pulls location (real API shape: latitude/longitude)', () => {
  const body = {
    results: [
      { displayLines: ['Eiffel Tower', 'Paris, France'], location: { latitude: 48.8584, longitude: 2.2945 } },
      { displayLines: ['Museum'], location: { latitude: 1, longitude: 2 } },
    ],
  };
  assert.deepEqual(parseSearchAutocompleteResponse(body), [
    { title: 'Eiffel Tower', subtitle: 'Paris, France', latitude: 48.8584, longitude: 2.2945 },
    { title: 'Museum', subtitle: undefined, latitude: 1, longitude: 2 },
  ]);
});

test('parseSearchAutocompleteResponse: also accepts the documented-but-unobserved lat/lng shape', () => {
  const body = { results: [{ displayLines: ['Somewhere'], location: { lat: 5, lng: 6 } }] };
  assert.deepEqual(parseSearchAutocompleteResponse(body), [{ title: 'Somewhere', subtitle: undefined, latitude: 5, longitude: 6 }]);
});

test('parseSearchAutocompleteResponse: skips results missing a title or coordinate', () => {
  const body = { results: [{ displayLines: [], location: { latitude: 1, longitude: 1 } }, { displayLines: ['No coords'] }] };
  assert.deepEqual(parseSearchAutocompleteResponse(body), []);
});

test('parseSearchAutocompleteResponse: returns empty array on malformed body', () => {
  assert.deepEqual(parseSearchAutocompleteResponse(null), []);
  assert.deepEqual(parseSearchAutocompleteResponse({}), []);
});

// --- parseReverseGeocodeResponse -------------------------------------------

test('parseReverseGeocodeResponse: prefers structuredAddress.locality', () => {
  const body = { results: [{ name: 'Some Street', structuredAddress: { locality: 'London' } }] };
  assert.equal(parseReverseGeocodeResponse(body), 'London');
});

test('parseReverseGeocodeResponse: falls back to the place name when locality is missing', () => {
  const body = { results: [{ name: 'Apple Park' }] };
  assert.equal(parseReverseGeocodeResponse(body), 'Apple Park');
});

test('parseReverseGeocodeResponse: returns null on malformed or empty body', () => {
  assert.equal(parseReverseGeocodeResponse({ results: [] }), null);
  assert.equal(parseReverseGeocodeResponse(null), null);
});
