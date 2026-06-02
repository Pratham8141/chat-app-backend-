import admin from "firebase-admin";
import { config } from "./env";
import { logger } from "../utils/logger";

let firebaseApp: admin.app.App | null = null;

export function initFirebase(): void {
  if (!config.firebase.projectId) {
    logger.warn("Firebase config missing — push notifications disabled");
    return;
  }
  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
    });
    logger.info("Firebase Admin initialized");
  } catch (err) {
    logger.error("Firebase init error", err);
  }
}

export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!firebaseApp) return false;
  try {
    await admin.messaging(firebaseApp).send({
      token: fcmToken,
      notification: { title, body },
      data,
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    });
    return true;
  } catch (err) {
    logger.error("FCM send error", err);
    return false;
  }
}

export async function sendMulticastPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!firebaseApp || tokens.length === 0) return;
  try {
    await admin.messaging(firebaseApp).sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });
  } catch (err) {
    logger.error("FCM multicast error", err);
  }
}
