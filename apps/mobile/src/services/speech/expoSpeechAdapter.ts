import type { SpeechRecognitionAdapter, PermissionResult, RecognitionOptions, FinalTranscript, RecognitionListener } from './types';

let moduleCache: typeof import('expo-speech-recognition') | null = null;
let moduleUnavailable = false;

function getModule() {
  if (moduleUnavailable) return null;
  if (moduleCache) return moduleCache;
  try {
    moduleCache = require('expo-speech-recognition');
    return moduleCache;
  } catch {
    moduleUnavailable = true;
    return null;
  }
}

// Normalize the module's -2..10 dB-ish value to 0..1.
// Values below 0 are inaudible; 0 maps to silence floor, 10 maps to loud.
function normalizeVolume(value: number): number {
  const clamped = Math.max(-2, Math.min(10, value));
  return Math.max(0, Math.min(1, (clamped + 2) / 12));
}

class ExpoSpeechAdapter implements SpeechRecognitionAdapter {
  private listeners: RecognitionListener[] = [];
  private lastFinalTranscript = '';
  private started = false;
  private subscriptions: Array<{ remove(): void }> = [];

  isSupported(): boolean {
    const mod = getModule();
    if (!mod) return false;
    try {
      return mod.ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return true;
    }
  }

  async requestPermission(): Promise<PermissionResult> {
    const mod = getModule();
    if (!mod) return { granted: false, canAskAgain: false };
    try {
      const result = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return { granted: result.granted, canAskAgain: result.canAskAgain };
    } catch {
      return { granted: false, canAskAgain: false };
    }
  }

  private emit(e: Parameters<RecognitionListener>[0]) {
    this.listeners.forEach((fn) => fn(e));
  }

  private attachNativeListeners() {
    const mod = getModule();
    if (!mod) return;

    const m = mod.ExpoSpeechRecognitionModule;

    const onResult = (event: { isFinal: boolean; results: Array<{ transcript: string }> }) => {
      const transcript = event.results[0]?.transcript ?? '';
      if (event.isFinal) {
        this.lastFinalTranscript = transcript;
        this.emit({ type: 'final', transcript });
      } else {
        this.emit({ type: 'interim', transcript });
      }
    };

    const onSpeechStart = () => {
      this.emit({ type: 'speechstart' });
    };

    const onVolume = (event: { value: number }) => {
      this.emit({ type: 'audiolevel', level: normalizeVolume(event.value) });
    };

    const onError = (event: { error: string; message: string }) => {
      this.emit({ type: 'error', message: event.message ?? event.error });
    };

    const onEnd = () => {
      this.emit({ type: 'end' });
    };

    this.subscriptions = [
      m.addListener('result', onResult),
      m.addListener('speechstart', onSpeechStart),
      m.addListener('volumechange', onVolume),
      m.addListener('error', onError),
      m.addListener('end', onEnd),
    ];
  }

  private detachNativeListeners() {
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];
  }

  subscribe(listener: RecognitionListener): () => void {
    this.listeners.push(listener);
    if (this.listeners.length === 1) {
      this.attachNativeListeners();
    }
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== listener);
      if (this.listeners.length === 0) {
        this.detachNativeListeners();
      }
    };
  }

  async start(options?: RecognitionOptions): Promise<void> {
    if (this.started) return;
    const mod = getModule();
    if (!mod) throw new Error('expo-speech-recognition not available');
    this.lastFinalTranscript = '';
    this.started = true;
    try {
      mod.ExpoSpeechRecognitionModule.start({
        lang: options?.lang ?? 'en-US',
        interimResults: options?.interimResults ?? true,
        continuous: false,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
    } catch (e) {
      this.started = false;
      throw e;
    }
  }

  async stop(): Promise<FinalTranscript> {
    const mod = getModule();
    if (mod && this.started) {
      try {
        mod.ExpoSpeechRecognitionModule.stop();
      } catch {
        // ignore
      }
    }
    this.started = false;
    return { transcript: this.lastFinalTranscript };
  }

  async cancel(): Promise<void> {
    const mod = getModule();
    if (mod && this.started) {
      try {
        mod.ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore
      }
    }
    this.started = false;
    this.lastFinalTranscript = '';
  }
}

let adapterSingleton: ExpoSpeechAdapter | null = null;

export function getExpoSpeechAdapter(): SpeechRecognitionAdapter {
  if (!adapterSingleton) adapterSingleton = new ExpoSpeechAdapter();
  return adapterSingleton;
}
