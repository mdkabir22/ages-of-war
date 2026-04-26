import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { ensureAnonymousAuth, isFirebaseEnabled, savePlayerPushToken } from './firebase';

export type PushNotificationData = Record<string, unknown>;

let tapHandler: ((data: PushNotificationData) => void) | null = null;

export function setPushNotificationTapHandler(handler: (data: PushNotificationData) => void): void {
  tapHandler = handler;
}

async function savePushTokenToFirebase(token: string): Promise<void> {
  if (!isFirebaseEnabled()) {
    console.info('[push] Firebase disabled; token not stored server-side');
    return;
  }
  try {
    const uid = await ensureAnonymousAuth();
    if (!uid) return;
    await savePlayerPushToken(uid, token);
  } catch (e) {
    console.error('[push] Failed to save token:', e);
  }
}

export function handleNotificationTap(data: PushNotificationData): void {
  const type = String(data.type ?? '');
  if (type === 'daily_reward') {
    tapHandler?.({ type: 'daily_reward' });
  } else if (type === 'energy_full') {
    tapHandler?.({ type: 'energy_full' });
  } else if (type === 'chest_ready') {
    tapHandler?.({ type: 'chest_ready' });
  } else {
    tapHandler?.(data);
  }
}

export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.info('[push] Native-only; skipping on web.');
    return;
  }

  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== 'granted') {
    console.info('[push] Permission not granted');
    return;
  }

  await PushNotifications.register();

  await PushNotifications.addListener('registration', (token) => {
    void savePushTokenToFirebase(token.value);
  });

  await PushNotifications.addListener('registrationError', (error) => {
    console.error('[push] registrationError', error);
  });

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.info('[push] received', notification.title, notification.body);
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    const data = (event.notification.data ?? {}) as PushNotificationData;
    handleNotificationTap(data);
  });
}

/** Local reminder (uses @capacitor/local-notifications — not part of PushNotifications API). */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  delaySeconds: number,
  id: number,
  data?: PushNotificationData
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== 'granted') return;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        title,
        body,
        id,
        schedule: { at: new Date(Date.now() + delaySeconds * 1000) },
        extra: data ?? {},
      },
    ],
  });
}
