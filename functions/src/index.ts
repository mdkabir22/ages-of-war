/**
 * Server-side IAP verification (callable functions).
 * Deploy: from repo root, `firebase init functions` (if needed), then `cd functions && npm install && npm run build`,
 * configure Play service account + APPLE_SHARED_SECRET secret, then `firebase deploy --only functions`.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const verifyAndroidPurchase = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const purchaseToken = data?.purchaseToken as string | undefined;
  const productId = data?.productId as string | undefined;
  const packageName = (data?.packageName as string | undefined) || 'com.agesofwar.app';

  if (!purchaseToken || !productId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing purchaseToken or productId');
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_PLAY_KEY_FILE || './service-account.json',
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidPublisher = google.androidpublisher({ version: 'v3', auth });

    const result = await androidPublisher.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken,
    });

    if (result.data.purchaseState === 0) {
      await admin.firestore().collection('players').doc(context.auth.uid).set(
        {
          [`purchases.${productId}`]: {
            purchaseToken,
            purchaseTime: result.data.purchaseTimeMillis,
            verified: true,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
      return { success: true, verified: true };
    }
    return { success: false, error: 'Purchase not valid' };
  } catch (error) {
    console.error('verifyAndroidPurchase', error);
    throw new functions.https.HttpsError('internal', 'Verification failed');
  }
});

export const verifyIOSPurchase = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const receiptData = data?.receiptData as string | undefined;
  const productId = data?.productId as string | undefined;
  if (!receiptData || !productId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing receiptData or productId');
  }

  const sharedSecret = process.env.APPLE_SHARED_SECRET;
  if (!sharedSecret) {
    throw new functions.https.HttpsError('failed-precondition', 'APPLE_SHARED_SECRET not configured');
  }

  const useSandbox = process.env.FUNCTIONS_EMULATOR === 'true';
  const verifyURL = useSandbox
    ? 'https://sandbox.itunes.apple.com/verifyReceipt'
    : 'https://buy.itunes.apple.com/verifyReceipt';

  try {
    const response = await fetch(verifyURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        password: sharedSecret,
      }),
    });

    const result = (await response.json()) as { status?: number; receipt?: { in_app?: Array<{ product_id?: string }> } };

    if (result.status === 0) {
      await admin.firestore().collection('players').doc(context.auth.uid).set(
        {
          [`purchases.${productId}`]: {
            verified: true,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
      return { success: true, verified: true };
    }

    return { success: false, error: 'Invalid receipt', status: result.status };
  } catch (error) {
    console.error('verifyIOSPurchase', error);
    throw new functions.https.HttpsError('internal', 'Verification failed');
  }
});
