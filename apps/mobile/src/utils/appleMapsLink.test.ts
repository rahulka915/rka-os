// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAppleMapsDirectionsUrl } from './appleMapsLink.ts';

test('buildAppleMapsDirectionsUrl: includes saddr/daddr/dirflg when both ends are set', () => {
  const url = buildAppleMapsDirectionsUrl('Home', 'Grasso', 'driving');
  assert.equal(url, 'https://maps.apple.com/?daddr=Grasso&dirflg=d&saddr=Home');
});

test('buildAppleMapsDirectionsUrl: omits saddr when start is blank — Apple Maps uses current location', () => {
  const url = buildAppleMapsDirectionsUrl('', 'Grasso', 'transit');
  assert.equal(url, 'https://maps.apple.com/?daddr=Grasso&dirflg=r');
});

test('buildAppleMapsDirectionsUrl: returns null with no destination', () => {
  assert.equal(buildAppleMapsDirectionsUrl('Home', '', 'walking'), null);
  assert.equal(buildAppleMapsDirectionsUrl('Home', '   ', 'walking'), null);
});

test('buildAppleMapsDirectionsUrl: maps every TravelMode to its dirflg', () => {
  assert.match(buildAppleMapsDirectionsUrl('', 'X', 'driving'), /dirflg=d/);
  assert.match(buildAppleMapsDirectionsUrl('', 'X', 'walking'), /dirflg=w/);
  assert.match(buildAppleMapsDirectionsUrl('', 'X', 'transit'), /dirflg=r/);
});
