// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAssistantMessage } from './parseAssistantMessage.ts';

test('plain text with no markup is a single text segment', () => {
  assert.deepEqual(parseAssistantMessage('Hello there'), [
    { kind: 'text', text: 'Hello there' },
  ]);
});

test('parses bold markup', () => {
  assert.deepEqual(parseAssistantMessage('You have **5** domains'), [
    { kind: 'text', text: 'You have ' },
    { kind: 'bold', text: '5' },
    { kind: 'text', text: ' domains' },
  ]);
});

test('parses an entity link', () => {
  assert.deepEqual(parseAssistantMessage('Try [[abc-123:MUSIC]] first'), [
    { kind: 'text', text: 'Try ' },
    { kind: 'link', id: 'abc-123', text: 'MUSIC' },
    { kind: 'text', text: ' first' },
  ]);
});

test('parses bold and links together, in source order', () => {
  assert.deepEqual(parseAssistantMessage('**Domains:** [[a1:MUSIC]] and [[a2:FINANCE]]'), [
    { kind: 'bold', text: 'Domains:' },
    { kind: 'text', text: ' ' },
    { kind: 'link', id: 'a1', text: 'MUSIC' },
    { kind: 'text', text: ' and ' },
    { kind: 'link', id: 'a2', text: 'FINANCE' },
  ]);
});

test('returns an empty array for an empty string', () => {
  assert.deepEqual(parseAssistantMessage(''), []);
});
