import { registerNotificationServiceWorker } from "./notifications.ts";
import {
  getVapidPublicKeyServerFn,
  savePushSubscriptionServerFn,
  sendTestPushServerFn,
} from "./push-server-fn.ts";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushNotificationSupported(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToWebPush(
  options: {
    batchId?: number | null;
    teacherId?: number | null;
    leadMinutes?: number;
    userType?: "student" | "faculty";
  } = {},
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined") return { success: false, error: "Window undefined" };

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { success: false, error: "Web Push not supported on this browser" };
  }

  try {
    // 1. Ensure SW is registered & active
    const reg = await registerNotificationServiceWorker();
    if (!reg) return { success: false, error: "Service Worker registration failed" };

    const activeReg = await navigator.serviceWorker.ready;

    // 2. Get Public VAPID Key from server
    const { publicKey } = await getVapidPublicKeyServerFn();
    const convertedKey = urlBase64ToUint8Array(publicKey);

    // 3. Get existing or subscribe to new push subscription
    let sub = await activeReg.pushManager.getSubscription();
    if (!sub) {
      sub = await activeReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    const subJson = sub.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return { success: false, error: "Invalid subscription keys" };
    }

    // 4. Save to Neon PostgreSQL / server
    await savePushSubscriptionServerFn({
      data: {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        batchId: options.batchId ?? null,
        teacherId: options.teacherId ?? null,
        leadMinutes: options.leadMinutes ?? 10,
        userType: options.userType || "student",
      },
    });

    return { success: true };
  } catch (err) {
    console.warn("[push-client] Push subscription error:", err);
    return { success: false, error: String(err) };
  }
}

export async function sendServerTestPush(): Promise<boolean> {
  try {
    const sub = await getActivePushSubscription();
    if (!sub) return false;
    const res = await sendTestPushServerFn({
      data: {
        endpoint: sub.endpoint,
      },
    });
    return res.success;
  } catch (err) {
    console.error("[push-client] Server test push failed:", err);
    return false;
  }
}
