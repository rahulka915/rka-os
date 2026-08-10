// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getSkillIconKey, getSkillProficiencyLabel } from './skillIconKey.ts';

test('gives common capability types recognisable identities', () => {
  assert.equal(getSkillIconKey('Music Production'), 'music');
  assert.equal(getSkillIconKey('App Development'), 'code');
  assert.equal(getSkillIconKey('Guitar'), 'guitar');
  assert.equal(getSkillIconKey('Medicine'), 'medicine');
  assert.equal(getSkillIconKey('Strength Training'), 'strength');
});

test('uses a distinctive general skill mark for uncategorised capabilities', () => {
  assert.equal(getSkillIconKey('Public speaking'), 'craft');
});

test('turns manual proficiency percentages into the five visible stages', () => {
  assert.deepEqual([0, 20, 40, 60, 80, 100].map(getSkillProficiencyLabel), [
    'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert', 'Expert',
  ]);
});
