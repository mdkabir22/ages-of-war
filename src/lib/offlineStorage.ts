import type { PlayerProfile } from '../game/progression';
import { saveCloudProfile } from './firebase';

const DB_NAME = 'AgesOfWarDB';
const DB_VERSION = 1;
const STORE = 'gameData';

let db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE);
      }
    };
  });
}

export async function saveOfflinePendingProfile(uid: string, profile: PlayerProfile): Promise<void> {
  const database = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put({ uid, profile, savedAt: Date.now() }, 'pending_cloud_profile');
  });
}

export async function loadOfflinePendingProfile(): Promise<{ uid: string; profile: PlayerProfile } | null> {
  const database = await openDb();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('pending_cloud_profile');
    req.onsuccess = () => resolve((req.result as { uid: string; profile: PlayerProfile }) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearOfflinePendingProfile(): Promise<void> {
  const database = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete('pending_cloud_profile');
  });
}

/** Push queued profile to Firestore after connectivity returns. */
export async function syncOfflinePendingProfile(): Promise<void> {
  const pending = await loadOfflinePendingProfile();
  if (!pending) return;
  try {
    await saveCloudProfile(pending.uid, pending.profile);
    await clearOfflinePendingProfile();
  } catch (e) {
    console.warn('Offline profile sync deferred:', e);
  }
}
