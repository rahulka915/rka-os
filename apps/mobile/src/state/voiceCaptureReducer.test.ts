// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  voiceCaptureReducer,
  initialVoiceState,
} from './voiceCaptureReducer.ts';

// ── Happy path ────────────────────────────────────────────────────────────────

test('OPEN resets state and moves to opening', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, transcript: 'old', interimTranscript: 'x', audioLevel: 0.5 },
    { type: 'OPEN' },
  );
  assert.equal(s.status, 'opening');
  assert.equal(s.transcript, '');
  assert.equal(s.interimTranscript, '');
  assert.equal(s.audioLevel, 0);
});

test('REQUEST_PERMISSION → requesting-permission', () => {
  const s = voiceCaptureReducer({ ...initialVoiceState, status: 'opening' }, { type: 'REQUEST_PERMISSION' });
  assert.equal(s.status, 'requesting-permission');
});

test('PERMISSION_GRANTED → listening', () => {
  const s = voiceCaptureReducer({ ...initialVoiceState, status: 'requesting-permission' }, { type: 'PERMISSION_GRANTED' });
  assert.equal(s.status, 'listening');
});

test('LISTENING_STARTED → listening', () => {
  const s = voiceCaptureReducer({ ...initialVoiceState, status: 'opening' }, { type: 'LISTENING_STARTED' });
  assert.equal(s.status, 'listening');
});

test('SPEECH_DETECTED from listening → speech-detected', () => {
  const s = voiceCaptureReducer({ ...initialVoiceState, status: 'listening' }, { type: 'SPEECH_DETECTED' });
  assert.equal(s.status, 'speech-detected');
});

test('SPEECH_DETECTED from speech-detected stays speech-detected', () => {
  const s = voiceCaptureReducer({ ...initialVoiceState, status: 'speech-detected' }, { type: 'SPEECH_DETECTED' });
  assert.equal(s.status, 'speech-detected');
});

test('INTERIM from listening bumps to speech-detected and sets text', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'listening' },
    { type: 'INTERIM', text: 'hello' },
  );
  assert.equal(s.status, 'speech-detected');
  assert.equal(s.interimTranscript, 'hello');
});

test('INTERIM from speech-detected updates text without changing state', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'speech-detected', interimTranscript: 'hi' },
    { type: 'INTERIM', text: 'hi there' },
  );
  assert.equal(s.status, 'speech-detected');
  assert.equal(s.interimTranscript, 'hi there');
});

test('AUDIO_LEVEL clamps to 0..1 and does not change status', () => {
  const base = { ...initialVoiceState, status: 'listening' as const };
  const s1 = voiceCaptureReducer(base, { type: 'AUDIO_LEVEL', level: 0.6 });
  assert.equal(s1.audioLevel, 0.6);
  assert.equal(s1.status, 'listening');

  const s2 = voiceCaptureReducer(base, { type: 'AUDIO_LEVEL', level: 2.5 });
  assert.equal(s2.audioLevel, 1);

  const s3 = voiceCaptureReducer(base, { type: 'AUDIO_LEVEL', level: -1 });
  assert.equal(s3.audioLevel, 0);
});

test('STOP from listening → processing', () => {
  const s = voiceCaptureReducer({ ...initialVoiceState, status: 'listening' }, { type: 'STOP' });
  assert.equal(s.status, 'processing');
});

test('STOP from speech-detected → processing', () => {
  const s = voiceCaptureReducer({ ...initialVoiceState, status: 'speech-detected' }, { type: 'STOP' });
  assert.equal(s.status, 'processing');
});

test('FINALIZED with text → review, transcript set, interim cleared', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'processing', interimTranscript: 'hey' },
    { type: 'FINALIZED', text: '  buy milk  ' },
  );
  assert.equal(s.status, 'review');
  assert.equal(s.transcript, 'buy milk');
  assert.equal(s.interimTranscript, '');
});

test('EDIT in review updates transcript', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'review', transcript: 'buy milk' },
    { type: 'EDIT', text: 'buy oat milk' },
  );
  assert.equal(s.transcript, 'buy oat milk');
});

test('SAVE from review → saving', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'review', transcript: 'buy milk' },
    { type: 'SAVE' },
  );
  assert.equal(s.status, 'saving');
});

test('SAVE_SUCCESS → saved', () => {
  const s = voiceCaptureReducer({ ...initialVoiceState, status: 'saving' }, { type: 'SAVE_SUCCESS' });
  assert.equal(s.status, 'saved');
});

// ── Error paths ───────────────────────────────────────────────────────────────

test('PERMISSION_DENIED → permission-denied', () => {
  const s = voiceCaptureReducer({ ...initialVoiceState, status: 'requesting-permission' }, { type: 'PERMISSION_DENIED' });
  assert.equal(s.status, 'permission-denied');
});

test('UNSUPPORTED → error with errorKind unsupported', () => {
  const s = voiceCaptureReducer(initialVoiceState, { type: 'UNSUPPORTED' });
  assert.equal(s.status, 'error');
  assert.equal(s.errorKind, 'unsupported');
});

test('FINALIZED with empty/whitespace text → no-speech', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'processing' },
    { type: 'FINALIZED', text: '   ' },
  );
  assert.equal(s.status, 'no-speech');
});

test('SAVE_FAILURE → error, errorKind save, PRESERVES transcript', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'saving', transcript: 'buy milk' },
    { type: 'SAVE_FAILURE', message: 'DB error' },
  );
  assert.equal(s.status, 'error');
  assert.equal(s.errorKind, 'save');
  assert.equal(s.errorMessage, 'DB error');
  assert.equal(s.transcript, 'buy milk');
});

test('RECOGNITION_ERROR → error, errorKind transcription, PRESERVES interim and transcript', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'speech-detected', interimTranscript: 'partial', transcript: '' },
    { type: 'RECOGNITION_ERROR', message: 'network' },
  );
  assert.equal(s.status, 'error');
  assert.equal(s.errorKind, 'transcription');
  assert.equal(s.interimTranscript, 'partial');
});

test('RETRY from error+save → saving (re-run save path)', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'error', errorKind: 'save', transcript: 'buy milk' },
    { type: 'RETRY' },
  );
  assert.equal(s.status, 'saving');
});

test('RETRY from no-speech → opening, resets transcripts', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'no-speech', interimTranscript: 'x', transcript: 'y' },
    { type: 'RETRY' },
  );
  assert.equal(s.status, 'opening');
  assert.equal(s.interimTranscript, '');
  assert.equal(s.transcript, '');
});

test('RETRY from error (transcription) → opening, resets', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'error', errorKind: 'transcription' },
    { type: 'RETRY' },
  );
  assert.equal(s.status, 'opening');
});

test('RETRY from permission-denied → opening', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'permission-denied' },
    { type: 'RETRY' },
  );
  assert.equal(s.status, 'opening');
});

test('CANCEL → idle (initialVoiceState)', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'listening', interimTranscript: 'hey', audioLevel: 0.8 },
    { type: 'CANCEL' },
  );
  assert.deepEqual(s, { status: 'idle', interimTranscript: '', transcript: '', audioLevel: 0 });
});

test('RESET → idle', () => {
  const s = voiceCaptureReducer(
    { ...initialVoiceState, status: 'review', transcript: 'buy milk' },
    { type: 'RESET' },
  );
  assert.equal(s.status, 'idle');
  assert.equal(s.transcript, '');
});

test('Unknown/invalid transitions return state unchanged', () => {
  const base = { ...initialVoiceState, status: 'listening' as const };
  // STOP is only valid from listening/speech-detected — test an invalid transition:
  // EDIT is only valid from review; from listening it's a no-op
  const s = voiceCaptureReducer(base, { type: 'EDIT', text: 'should be ignored' });
  assert.deepEqual(s, base);
});

test('SAVE from non-review state is a no-op', () => {
  const base = { ...initialVoiceState, status: 'listening' as const };
  const s = voiceCaptureReducer(base, { type: 'SAVE' });
  assert.deepEqual(s, base);
});
