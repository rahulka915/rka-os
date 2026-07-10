import type { RoninMood } from './types';
import manifest from '../../../assets/ronin/model/avatarManifest.json';

// 3D Ronin companion model (locked v0 GLB) — asset reference, manifest, and
// the RoninMood → animation-clip resolver. Rendering lives in Ronin3D.tsx;
// this module stays free of three/R3F imports so the domain layer never
// pulls in GL code.

// Kill switch: set to false to restore the static-PNG-only behavior exactly
// (RoninCharacter never mounts the GL canvas, and never require()s three).
export const RONIN_3D_ENABLED = true;

// Metro asset id — bundled via metro.config.js assetExts ('glb').
// v2 Pass 1 (eyes.png): eyes reverted to single emissive-white shapes, no
// iris/pupil, brows removed (lab build_ronin_v2.py). v0/v1 kept alongside
// as rollback assets.
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const RONIN_MODEL = require('../../../assets/ronin/model/ronin_companion_v2.glb');

export const RONIN_MANIFEST = manifest;

export interface RoninClipState {
  animation: string;
  fallbackAnimation: string;
}

// The GLB has five mood states (see manifest.states); the app has six moods.
// 'alert' ("noticed things waiting" — attentive semantics) maps to the
// focused idle; everything else is 1:1. Unknown moods settle on 'normal'.
const MOOD_TO_STATE: Record<RoninMood, keyof typeof manifest.states> = {
  normal: 'normal',
  alert: 'focused',
  tired: 'tired',
  focused: 'focused',
  overwhelmed: 'overwhelmed',
  resolved: 'resolved',
};

export function getMoodClip(mood: RoninMood): RoninClipState {
  const state = manifest.states[MOOD_TO_STATE[mood] ?? 'normal'] ?? manifest.states.normal;
  return state;
}

// One-shot clips (resolved_nod, blink) play once and settle back to the
// state's fallback idle rather than looping.
export function isOneShotClip(clipName: string): boolean {
  return manifest.animations.oneShot.includes(clipName);
}
