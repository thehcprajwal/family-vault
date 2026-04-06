import webpush from 'web-push';
import type { PushSubscription, PushPayload } from './types';

// VAPID keys loaded once per Lambda cold start
let vapidInitialised = false;

function ensureVapid(): void {
  if (vapidInitialised) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@familyvault.app';
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars are required');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialised = true;
}

export class PushSubscriptionExpiredError extends Error {
  constructor() {
    super('Push subscription has expired or is no longer valid');
    this.name = 'PushSubscriptionExpiredError';
  }
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<void> {
  ensureVapid();

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err: unknown) {
    // 404/410 means the subscription is gone — caller should remove it
    if (
      err &&
      typeof err === 'object' &&
      'statusCode' in err &&
      (err.statusCode === 404 || err.statusCode === 410)
    ) {
      throw new PushSubscriptionExpiredError();
    }
    throw err;
  }
}
