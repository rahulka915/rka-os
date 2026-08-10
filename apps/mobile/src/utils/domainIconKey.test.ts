// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getDomainIconKey } from './domainIconKey.ts';

test('maps the fixed eight Domains to distinct icon identities', () => {
  const titles = [
    'Health & Wellbeing',
    'Finance',
    'Career',
    'Fitness & Performance',
    'Discipline',
    'Growth',
    'Creativity',
    'Relationships',
  ];

  assert.deepEqual(titles.map(getDomainIconKey), [
    'health',
    'finance',
    'career',
    'fitness',
    'discipline',
    'growth',
    'creativity',
    'relationships',
  ]);
});

test('supports familiar renamed Domain variants and a neutral fallback', () => {
  assert.equal(getDomainIconKey('Family & Friends'), 'relationships');
  assert.equal(getDomainIconKey('Learning'), 'growth');
  assert.equal(getDomainIconKey('My custom area'), 'overall');
});
