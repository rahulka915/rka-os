// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInboxCaptureInput } from './inboxCapture.ts';

test('voice source sets voiceTranscript, source=voice, entityType null, status inbox, type task', () => {
  const result = buildInboxCaptureInput('Buy oat milk', 'voice');
  assert.equal(result.type, 'task');
  assert.equal(result.status, 'inbox');
  assert.equal(result.voiceTranscript, 'Buy oat milk');
  assert.equal(result.metadata.source, 'voice');
  assert.equal(result.metadata.entityType, null);
  assert.equal(result.title, 'Buy oat milk');
});

test('typed source leaves voiceTranscript undefined', () => {
  const result = buildInboxCaptureInput('Write report', 'typed');
  assert.equal(result.voiceTranscript, undefined);
  assert.equal(result.metadata.source, 'typed');
});

test('trims leading and trailing whitespace from text', () => {
  const result = buildInboxCaptureInput('  clean this up  ', 'voice');
  assert.equal(result.title, 'clean this up');
  assert.equal(result.voiceTranscript, 'clean this up');
});

test('empty text after trim still produces an empty title', () => {
  const result = buildInboxCaptureInput('   ', 'voice');
  assert.equal(result.title, '');
});

test('entityType is null for both sources', () => {
  assert.equal(buildInboxCaptureInput('x', 'voice').metadata.entityType, null);
  assert.equal(buildInboxCaptureInput('x', 'typed').metadata.entityType, null);
});
