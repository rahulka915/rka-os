// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepeatRule, dayMatchesRepeat, nextOccurrenceDate, addDays, repeatLabel } from './repeat.ts';

test('parses the supported rule spellings', () => {
  assert.equal(parseRepeatRule('FREQ=DAILY'), 'DAILY');
  assert.equal(parseRepeatRule('daily'), 'DAILY');
  assert.equal(parseRepeatRule('FREQ=WEEKDAYS'), 'WEEKDAYS');
  assert.equal(parseRepeatRule('FREQ=WEEKLY;BYDAY=MO'), 'WEEKLY:1');
  assert.equal(parseRepeatRule(null), null);
  assert.equal(parseRepeatRule('nonsense'), null);
});

test('addDays does pure calendar arithmetic across months', () => {
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(addDays('2026-08-01', -1), '2026-07-31');
});

test('weekdays rule matches Mon-Fri only', () => {
  // 2026-07-23 is a Thursday, 2026-07-25 a Saturday.
  assert.equal(dayMatchesRepeat('WEEKDAYS', '2026-07-23'), true);
  assert.equal(dayMatchesRepeat('WEEKDAYS', '2026-07-25'), false);
  assert.equal(dayMatchesRepeat('WEEKEND', '2026-07-25'), true);
});

test('nextOccurrenceDate always returns a date strictly after fromDate', () => {
  assert.equal(nextOccurrenceDate('FREQ=DAILY', '2026-07-23'), '2026-07-24');
  // Thursday + weekdays rule -> Friday; Friday -> Monday.
  assert.equal(nextOccurrenceDate('FREQ=WEEKDAYS', '2026-07-23'), '2026-07-24');
  assert.equal(nextOccurrenceDate('FREQ=WEEKDAYS', '2026-07-24'), '2026-07-27');
});

test('nextOccurrenceDate returns null without a usable rule', () => {
  assert.equal(nextOccurrenceDate(null, '2026-07-23'), null);
  assert.equal(nextOccurrenceDate('nonsense', '2026-07-23'), null);
});

test('labels repeat rules for display', () => {
  assert.equal(repeatLabel('FREQ=DAILY'), 'Daily');
  assert.equal(repeatLabel('FREQ=WEEKDAYS'), 'Weekdays');
  assert.equal(repeatLabel('FREQ=WEEKEND'), 'Weekends');
  assert.equal(repeatLabel('FREQ=WEEKLY'), 'Weekly');
  assert.equal(repeatLabel('FREQ=WEEKLY;BYDAY=MO'), 'Every Mon');
  assert.equal(repeatLabel(null), null);
  assert.equal(repeatLabel('nonsense'), null);
});
