import type { SpeechRecognitionAdapter } from './types';
import { getExpoSpeechAdapter } from './expoSpeechAdapter';

export function getSpeechAdapter(): SpeechRecognitionAdapter {
  return getExpoSpeechAdapter();
}
