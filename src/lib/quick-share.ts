/**
 * FORTIS QuickShare
 * Ultra-compact URL-based schedule serialization and 1-click WhatsApp cloning engine.
 */
import type { ClassEntry } from "@/lib/schedule";

export interface SharedSchedulePayload {
  v: number; // Schema version
  name?: string; // Optional sender name
  batch?: string; // Optional batch reference
  created?: number; // Timestamp
  slots: [number, number, number, number, number, number, number][]; // [day, slot, batch, room, teacher, subject, repeater]
}

function toUrlSafeBase64(str: string): string {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(str, "utf8").toString("base64url");
    }
  } catch {
    // Browser fallback
  }

  const encoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16)),
  );
  return btoa(encoded)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromUrlSafeBase64(b64: string): string {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(b64, "base64url").toString("utf8");
    }
  } catch {
    // Browser fallback
  }

  let base64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const decoded = atob(base64);
  return decodeURIComponent(
    Array.prototype.map
      .call(decoded, (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join(""),
  );
}

/**
 * Encodes a student's schedule into a compact, URL-safe string
 */
export function encodeScheduleToShareString(
  entries: ClassEntry[],
  options?: { senderName?: string; batchName?: string },
): string {
  const compactSlots: [number, number, number, number, number, number, number][] = entries.map((e) => [
    e.day,
    e.slot,
    e.batch,
    e.room,
    e.teacher,
    e.subject,
    e.repeater ? 1 : 0,
  ]);

  const payload: SharedSchedulePayload = {
    v: 1,
    name: options?.senderName?.trim() || undefined,
    batch: options?.batchName?.trim() || undefined,
    created: Date.now(),
    slots: compactSlots,
  };

  const json = JSON.stringify(payload);
  return toUrlSafeBase64(json);
}

/**
 * Decodes a share string from the URL query parameter back into ClassEntry[]
 */
export function decodeScheduleFromShareString(shareString: string): {
  entries: ClassEntry[];
  senderName?: string;
  batchName?: string;
  created?: number;
} | null {
  if (!shareString || typeof shareString !== "string") return null;

  try {
    const json = fromUrlSafeBase64(shareString.trim());
    const payload: SharedSchedulePayload = JSON.parse(json);

    if (!payload || !Array.isArray(payload.slots)) {
      return null;
    }

    const entries: ClassEntry[] = payload.slots.map(([d, s, b, r, t, sub, rep]) => ({
      day: Number(d),
      slot: Number(s),
      batch: Number(b),
      room: Number(r),
      teacher: Number(t),
      subject: Number(sub),
      repeater: rep === 1,
    }));

    return {
      entries,
      senderName: payload.name,
      batchName: payload.batch,
      created: payload.created,
    };
  } catch (err) {
    console.warn("Failed to decode FORTIS QuickShare string:", err);
    return null;
  }
}

/**
 * Generates the full share URL
 */
export function generateQuickShareUrl(
  entries: ClassEntry[],
  options?: { senderName?: string; batchName?: string; origin?: string },
): string {
  const code = encodeScheduleToShareString(entries, options);
  const base =
    options?.origin ||
    (typeof window !== "undefined" ? window.location.origin : "https://fortis-cuiatk.edu.pk");
  return `${base.replace(/\/$/, "")}/?share=${code}`;
}

/**
 * Generates a pre-filled WhatsApp share link
 */
export function generateWhatsAppShareLink(
  entries: ClassEntry[],
  options?: { senderName?: string; batchName?: string; origin?: string },
): string {
  const shareUrl = generateQuickShareUrl(entries, options);
  const count = entries.length;
  const namePrefix = options?.senderName ? `${options.senderName}'s ` : "My ";
  const text = `Hey! Here is ${namePrefix}clash-free timetable on FORTIS (COMSATS Attock) (${count} lectures). Tap to view and clone to your schedule:\n\n${shareUrl}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
