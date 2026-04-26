import { getFunctions, httpsCallable } from 'firebase/functions';
import { Capacitor } from '@capacitor/core';
import { getFirebaseApp, isFirebaseEnabled } from './firebase';

export async function verifyPurchaseWithServer(productId: string, purchaseData: Record<string, unknown>): Promise<unknown> {
  if (!isFirebaseEnabled()) {
    return { success: false, error: 'Firebase disabled' };
  }
  const app = getFirebaseApp();
  if (!app) return { success: false, error: 'No app' };

  const functions = getFunctions(app);
  const platform = Capacitor.getPlatform();

  try {
    if (platform === 'android') {
      const verifyAndroid = httpsCallable(functions, 'verifyAndroidPurchase');
      return (
        await verifyAndroid({
          purchaseToken: purchaseData.purchaseToken,
          productId,
          packageName: 'com.agesofwar.app',
        })
      ).data;
    }
    if (platform === 'ios') {
      const verifyIOS = httpsCallable(functions, 'verifyIOSPurchase');
      return (await verifyIOS({ receiptData: purchaseData.receiptData, productId })).data;
    }
    return { success: false, error: 'IAP not available on web' };
  } catch (e) {
    console.error('[purchases] verification failed', e);
    throw e;
  }
}

/** Wire to @capacitor-community/in-app-purchases or RevenueCat when you add IAP. */
export async function initiatePlatformPurchase(_productId: string): Promise<Record<string, unknown>> {
  throw new Error('Implement platform IAP (Capacitor IAP plugin)');
}

/** Example flow: buy on device, then verify on server before crediting currency in your profile/game state. */
export async function purchaseGems(amount: number): Promise<{ success: boolean; error?: unknown }> {
  const productId = `gems_${amount}`;
  try {
    const purchaseResult = await initiatePlatformPurchase(productId);
    const verification = (await verifyPurchaseWithServer(productId, purchaseResult)) as { success?: boolean };
    if (verification.success) {
      return { success: true };
    }
    return { success: false, error: new Error('Purchase verification failed') };
  } catch (error) {
    return { success: false, error };
  }
}
