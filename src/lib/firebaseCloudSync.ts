import type { PlayerProfile } from '../game/progression';
import { isFirebaseEnabled, saveCloudProfile } from './firebase';
import { retryWithBackoff } from './networkRetry';
import { saveOfflinePendingProfile } from './offlineStorage';

export async function saveCloudProfileResilient(uid: string, profile: PlayerProfile): Promise<void> {
  if (!isFirebaseEnabled()) {
    await saveOfflinePendingProfile(uid, profile);
    return;
  }
  try {
    await retryWithBackoff(() => saveCloudProfile(uid, profile), 3, 900);
  } catch (error) {
    console.error('Cloud profile save failed after retries:', error);
    await saveOfflinePendingProfile(uid, profile);
  }
}
