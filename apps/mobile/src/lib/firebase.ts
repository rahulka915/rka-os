import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, type Auth, type Persistence } from 'firebase/auth';
// @firebase/auth's own exports map correctly conditions this helper behind a
// `react-native` branch, but a top-level `"types"` key on the same export entry
// shadows it for tsc's resolution (TS treats "types" as always-satisfied and
// resolves there before checking customConditions) — the real implementation
// still loads fine at runtime via Metro's resolver, which isn't affected by this
// shadowing, so this is purely a type-checking gap, not a runtime issue.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('@firebase/auth') as {
  getReactNativePersistence: (storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }) => Persistence;
};
import { getFirestore, type Firestore } from 'firebase/firestore';

const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim();
const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim();

export const hasFirebaseConfig = Boolean(apiKey && authDomain && projectId && appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

if (hasFirebaseConfig) {
  app = initializeApp({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId });
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  firestore = getFirestore(app);
}

export { app, auth, firestore };
