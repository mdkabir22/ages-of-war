import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import type { PlayerProfile } from '../game/progression';
import type { LiveOpsConfig } from '../game/progression';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'REPLACE_ME',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'REPLACE_ME',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ages-of-war-6a76c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'REPLACE_ME',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'REPLACE_ME',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'REPLACE_ME',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const requiredFirebaseEnvMap = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
} as const;

function getMissingFirebaseConfigKeys(): string[] {
  return Object.entries(requiredFirebaseEnvMap)
    .filter(([, value]) => !value || value === 'REPLACE_ME')
    .map(([key]) => key);
}

const missingFirebaseKeys = getMissingFirebaseConfigKeys();
const hasRequiredFirebaseConfig = missingFirebaseKeys.length === 0;

if (!hasRequiredFirebaseConfig && typeof window !== 'undefined') {
  console.warn(
    `[firebase] Disabled: missing env keys -> ${missingFirebaseKeys.join(', ')}. ` +
      'Add them in .env.local to enable auth/firestore features.'
  );
}

const app: FirebaseApp | null = hasRequiredFirebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}

export function isFirebaseEnabled(): boolean {
  return Boolean(app && auth && db);
}

export async function ensureAnonymousAuth(): Promise<string | null> {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser.uid;
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}

export async function loadCloudProfile(uid: string): Promise<Partial<PlayerProfile> | null> {
  if (!db) return null;
  const ref = doc(db, 'players', uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return snapshot.data() as Partial<PlayerProfile>;
}

export async function saveCloudProfile(uid: string, profile: PlayerProfile): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'players', uid);
  await setDoc(
    ref,
    {
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Persists FCM/APNs device token on the player document for server-side campaigns. */
export async function savePlayerPushToken(uid: string, token: string): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'players', uid);
  await setDoc(
    ref,
    {
      pushToken: token,
      pushTokenUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function loadLiveOpsConfigFromCloud(): Promise<Partial<LiveOpsConfig> | null> {
  if (!db) return null;
  const ref = doc(db, 'liveops', 'runtime');
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return snapshot.data() as Partial<LiveOpsConfig>;
}
