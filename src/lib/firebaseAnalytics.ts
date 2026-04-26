import { getAnalytics, isSupported, logEvent, setUserId, setUserProperties, type Analytics } from 'firebase/analytics';
import { getFirebaseApp } from './firebase';

let analytics: Analytics | null = null;

export async function initFirebaseAnalytics(): Promise<void> {
  const app = getFirebaseApp();
  if (!app || !import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return;
  if (!(await isSupported())) return;
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn('[analytics] init skipped', e);
  }
}

function safeLog(name: string, params?: Record<string, string | number | boolean>): void {
  if (!analytics) return;
  logEvent(analytics, name, params);
}

export const analyticsDashboard = {
  identifyUser: (userId: string, properties?: Record<string, string | number | boolean>) => {
    if (!analytics) return;
    setUserId(analytics, userId);
    if (properties) {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(properties)) {
        flat[k] = String(v);
      }
      setUserProperties(analytics, flat);
    }
  },
  tutorialStart: () => safeLog('tutorial_start'),
  tutorialComplete: (seconds: number) => safeLog('tutorial_complete', { time_spent_seconds: seconds }),
  tutorialSkip: (step: number) => safeLog('tutorial_skip', { step_reached: step }),
  matchStart: (mode: string, age: number) => safeLog('match_start', { game_mode: mode, starting_age: age }),
  matchEnd: (mode: string, result: 'victory' | 'defeat', durationSec: number, kills: number, age: number) =>
    safeLog('match_end', {
      game_mode: mode,
      result,
      duration_seconds: durationSec,
      total_kills: kills,
      final_age: age,
    }),
  ageUp: (ageName: string, seconds: number) => safeLog('age_up', { new_age: ageName, time_to_reach_seconds: seconds }),
  purchase: (productId: string, value: number, currency: string) =>
    safeLog('aow_purchase', { product_id: productId, value, currency }),
  share: (contentType: string) => safeLog('share', { content_type: contentType, method: 'native_share' }),
  sessionStart: () => safeLog('session_start'),
  sessionEnd: (durationSec: number) => safeLog('session_end', { session_duration_seconds: durationSec }),
};
