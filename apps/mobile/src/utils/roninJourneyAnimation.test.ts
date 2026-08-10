// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import {
  RONIN_JOURNEY_ACTIVITIES,
  RONIN_JOURNEY_RIVE_CONTRACT,
  createRoninJourneyPresentation,
} from '../domain/ronin/journeyAnimation.ts';

test('the production Rive contract has stable authoring names', () => {
  assert.deepEqual(RONIN_JOURNEY_RIVE_CONTRACT, {
    artboard: 'Journey',
    stateMachine: 'Journey Controller',
    viewModel: 'Journey',
    properties: {
      activity: 'activity',
      mood: 'mood',
      outfit: 'outfit',
      catState: 'catState',
      progress: 'progress',
      reducedMotion: 'reducedMotion',
      tap: 'tap',
      complete: 'complete',
    },
  });
});

test('activity identifiers are unique and cover the approved structural states', () => {
  assert.equal(new Set(RONIN_JOURNEY_ACTIVITIES).size, RONIN_JOURNEY_ACTIVITIES.length);
  assert.ok(RONIN_JOURNEY_ACTIVITIES.includes('journey'));
  assert.ok(RONIN_JOURNEY_ACTIVITIES.includes('sleeping'));
  assert.ok(RONIN_JOURNEY_ACTIVITIES.includes('working'));
  assert.ok(RONIN_JOURNEY_ACTIVITIES.includes('training'));
  assert.ok(RONIN_JOURNEY_ACTIVITIES.includes('celebrating'));
});

test('presentation defaults match the active Journey experience', () => {
  assert.deepEqual(createRoninJourneyPresentation(), {
    activity: 'journey',
    mood: 'normal',
    outfit: 'journey',
    catState: 'calm',
    progress: 0,
    reducedMotion: false,
  });
});

test('presentation preserves semantic state and clamps progress', () => {
  assert.deepEqual(createRoninJourneyPresentation({
    activity: 'working',
    mood: 'focused',
    outfit: 'base',
    catState: 'watching',
    progress: 1.8,
    reducedMotion: true,
  }), {
    activity: 'working',
    mood: 'focused',
    outfit: 'base',
    catState: 'watching',
    progress: 1,
    reducedMotion: true,
  });

  assert.equal(createRoninJourneyPresentation({ progress: -0.4 }).progress, 0);
  assert.equal(createRoninJourneyPresentation({ progress: Number.NaN }).progress, 0);
});

test('the Rive authoring manifest matches the app contract and resolves its source art', () => {
  const manifestUrl = new URL('../../assets/ronin/for-rive/storybook-journey-rig.manifest.json', import.meta.url);
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));

  assert.equal(manifest.composition.artboard, RONIN_JOURNEY_RIVE_CONTRACT.artboard);
  assert.equal(manifest.composition.stateMachine, RONIN_JOURNEY_RIVE_CONTRACT.stateMachine);
  assert.equal(manifest.composition.viewModel, RONIN_JOURNEY_RIVE_CONTRACT.viewModel);
  assert.deepEqual(manifest.viewModel.activity.values, RONIN_JOURNEY_ACTIVITIES);
  assert.deepEqual(Object.keys(manifest.viewModel), Object.values(RONIN_JOURNEY_RIVE_CONTRACT.properties));

  for (const rig of Object.values(manifest.rigFamilies)) {
    assert.ok(existsSync(new URL(rig.source, manifestUrl)), rig.source);
  }
  for (const source of Object.values(manifest.activityReferences)) {
    assert.ok(existsSync(new URL(source, manifestUrl)), source);
  }
});
