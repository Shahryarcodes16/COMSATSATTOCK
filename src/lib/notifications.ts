export interface NotificationSettings {
  enabled: boolean;
  leadMinutes: 5 | 10 | 15;
  sound: boolean;
  source: "pinned" | "custom";
}

const STORAGE_KEY = "cui_class_notifications_v1";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  leadMinutes: 10,
  sound: true,
  source: "pinned",
};

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.error("Failed to request notification permission:", err);
    return "denied";
  }
}

export function getStoredNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save notification settings:", err);
  }
}

/**
 * Play a gentle, pleasant 2-tone notification chime using Web Audio API
 */
export function playNotificationChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: A5 (880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn("Unable to play audio notification chime", e);
  }
}

/**
 * Display a system notification
 */
export async function sendSystemNotification(
  title: string,
  options: NotificationOptions & { playChime?: boolean } = {},
): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const { playChime = true, ...notifOpts } = options;

  if (playChime) {
    playNotificationChime();
  }

  const notificationOptions: NotificationOptions = {
    icon: "/crest.png",
    badge: "/crest.png",
    ...notifOpts,
  };

  try {
    // Check if service worker is active
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    }

    new Notification(title, notificationOptions);
    return true;
  } catch (e) {
    console.error("Error creating notification:", e);
    return false;
  }
}

/**
 * Check whether a specific class slot has already been notified today
 */
export function hasNotifiedToday(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const sentKey = `cui_notif_${todayStr}_${key}`;
    return sessionStorage.getItem(sentKey) === "1";
  } catch {
    return false;
  }
}

/**
 * Mark a class slot as notified today
 */
export function markNotifiedToday(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const sentKey = `cui_notif_${todayStr}_${key}`;
    sessionStorage.setItem(sentKey, "1");
  } catch {
    // Ignore storage errors
  }
}
