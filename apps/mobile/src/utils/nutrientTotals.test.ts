// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumNutrientLogs } from './nutrientTotals.ts';

test('sumNutrientLogs sums each nutrient key across logs', () => {
  const logs = [
    { details: JSON.stringify({ nutrients: { sodium: 300, potassium: 200 } }) },
    { details: JSON.stringify({ nutrients: { magnesium: 60 } }) },
    { details: JSON.stringify({ nutrients: { sodium: 300 } }) },
  ];
  const totals = sumNutrientLogs(logs);
  assert.equal(totals.sodium, 600);
  assert.equal(totals.potassium, 200);
  assert.equal(totals.magnesium, 60);
  assert.equal(totals.calcium, undefined);
});

test('sumNutrientLogs returns an empty object for no logs', () => {
  assert.deepEqual(sumNutrientLogs([]), {});
});

test('sumNutrientLogs ignores logs with missing or malformed details', () => {
  const logs = [
    { details: null },
    { details: undefined },
    { details: 'not json' },
    { details: JSON.stringify({}) },
    { details: JSON.stringify({ nutrients: { sodium: 100 } }) },
  ];
  const totals = sumNutrientLogs(logs);
  assert.equal(totals.sodium, 100);
});

test('sumNutrientLogs ignores non-numeric nutrient values', () => {
  const logs = [{ details: JSON.stringify({ nutrients: { sodium: 'a lot' } }) }];
  assert.deepEqual(sumNutrientLogs(logs), {});
});
