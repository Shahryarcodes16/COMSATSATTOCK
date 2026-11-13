/**
 * Server-side Web Push Notification Dispatcher
 * Sends real-time system alerts directly to students' and faculty members' phones
 * and computers via the W3C Web Push Protocol (Google FCM, Apple APNs, Mozilla Autopush)
 * so that notifications arrive EVEN WHEN THE BROWSER APP IS CLOSED.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import webpush from "web-push";
import { getSql } from "./db.ts";
import { batches, rooms, subjects, teachers } from "./schedule.ts";
import type { ClassCancellationRecord } from "./timetable-types.ts";
import type { MakeupClassRecord } from "./makeup-classes.ts";

export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BE15CZsR1hucocRGKZTxWrpAKmUnxo_F8tv065oGVk87jHftyk9kKuG_85YsP2N69WHrdYfebHE6NDjdeC0p5Tk";

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "ElqAy_GPF5RWE3OjvZBRoSDIzg9PpKy6REbfFBjvvUY";

export const VAPID_SUBJECT = "mailto:admin@attock.comsats.edu.pk";

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn("[push.server] VAPID configuration error:", e);
}

export interface PushSubscriptionRecord {
  id?: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userType: "student" | "faculty";
  batchId: number | null;
  teacherId: number | null;
  leadMinutes: number;
  createdAt?: string;
  updatedAt?: string;
}

let tableEnsured = false;
const inMemorySubs = new Map<string, PushSubscriptionRecord>();
const SUBS_DISK_BACKUP = path.join(os.tmpdir(), "cui_push_subscriptions_v1.json");

function readDiskSubs(): PushSubscriptionRecord[] {
  try {
    if (fs.existsSync(SUBS_DISK_BACKUP)) {
      const parsed = JSON.parse(fs.readFileSync(SUBS_DISK_BACKUP, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // Ignore read error
  }
  return [];
}

function writeDiskSubs(subs: PushSubscriptionRecord[]) {
  try {
    fs.writeFileSync(SUBS_DISK_BACKUP, JSON.stringify(subs), "utf8");
  } catch {
    // Ignore write error
  }
}

function hydrateFallbackFromDisk() {
  if (inMemorySubs.size > 0) return;
  for (const s of readDiskSubs()) {
    inMemorySubs.set(s.endpoint, s);
  }
}

export async function ensurePushSubscriptionsTable() {
  if (tableEnsured) return;
  const sql = await getSql();

  try {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_type VARCHAR(20) DEFAULT 'student',
        batch_id INT,
        teacher_id INT,
        lead_minutes INT DEFAULT 10,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_push_sub_batch ON push_subscriptions(batch_id);
      CREATE INDEX IF NOT EXISTS idx_push_sub_teacher ON push_subscriptions(teacher_id);
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn("[push.server] DB table init failed, utilizing in-memory/disk fallback:", err);
    hydrateFallbackFromDisk();
  }
}

/**
 * Save or update a client's Web Push subscription
 */
export async function savePushSubscription(data: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userType?: "student" | "faculty";
  batchId?: number | null;
  teacherId?: number | null;
  leadMinutes?: number;
}): Promise<boolean> {
  const record: PushSubscriptionRecord = {
    endpoint: data.endpoint,
    p256dh: data.keys.p256dh,
    auth: data.keys.auth,
    userType: data.userType || "student",
    batchId: data.batchId ?? null,
    teacherId: data.teacherId ?? null,
    leadMinutes: data.leadMinutes ?? 10,
  };

  try {
    await ensurePushSubscriptionsTable();
    const sql = await getSql();
    await sql.query(
      `
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_type, batch_id, teacher_id, lead_minutes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_type = EXCLUDED.user_type,
        batch_id = EXCLUDED.batch_id,
        teacher_id = EXCLUDED.teacher_id,
        lead_minutes = EXCLUDED.lead_minutes,
        updated_at = NOW();
    `,
      [
        record.endpoint,
        record.p256dh,
        record.auth,
        record.userType,
        record.batchId,
        record.teacherId,
        record.leadMinutes,
      ],
    );
  } catch (err) {
    console.warn("[push.server] DB upsert failed, storing in fallback:", err);
    hydrateFallbackFromDisk();
    inMemorySubs.set(record.endpoint, record);
    writeDiskSubs(Array.from(inMemorySubs.values()));
  }

  return true;
}

/**
 * Delete stale subscription (e.g. after user unsubscribes or endpoint returned 410 Gone)
 */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  try {
    const sql = await getSql();
    await sql.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
  } catch {
    // Ignore DB error
  }
  hydrateFallbackFromDisk();
  inMemorySubs.delete(endpoint);
  writeDiskSubs(Array.from(inMemorySubs.values()));
}

/**
 * Send a web push notification payload to a subscription record
 */
export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
  },
): Promise<boolean> {
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/crest.png",
    badge: payload.badge || "/crest.png",
    tag: payload.tag || "cui-alert",
    vibrate: [200, 100, 200],
    data: payload.data || { url: "/" },
  });

  try {
    await webpush.sendNotification(pushSubscription, notificationPayload, {
      TTL: 86400, // 24 hours
      urgency: "high",
    });
    return true;
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // Endpoint is expired/unregistered, clean up
      await deletePushSubscription(sub.endpoint);
    } else {
      console.warn("[push.server] Push delivery error:", err);
    }
    return false;
  }
}

/**
 * Broadcast lecture cancellation push notification to all subscribed devices of that batch
 */
export async function broadcastCancellationPush(cancellation: ClassCancellationRecord): Promise<number> {
  let targetSubs: PushSubscriptionRecord[] = [];

  try {
    await ensurePushSubscriptionsTable();
    const sql = await getSql();
    const res = await sql.query(
      `SELECT endpoint, p256dh, auth, user_type AS "userType", batch_id AS "batchId", teacher_id AS "teacherId", lead_minutes AS "leadMinutes" 
       FROM push_subscriptions 
       WHERE batch_id = $1 OR batch_id IS NULL OR teacher_id = $2`,
      [cancellation.batch, cancellation.teacher],
    );
    targetSubs = res as unknown as PushSubscriptionRecord[];
  } catch {
    hydrateFallbackFromDisk();
    targetSubs = Array.from(inMemorySubs.values()).filter(
      (s) =>
        s.batchId === cancellation.batch ||
        s.batchId === null ||
        s.teacherId === cancellation.teacher,
    );
  }

  if (targetSubs.length === 0) return 0;

  const title = `🚨 Lecture Cancelled: ${cancellation.subjectName}`;
  const body = `${cancellation.teacherName} cancelled ${cancellation.targetDateLabel || "lecture"} in ${cancellation.roomName} (${cancellation.batchName}).`;

  let sent = 0;
  await Promise.allSettled(
    targetSubs.map(async (s) => {
      const ok = await sendWebPush(s, {
        title,
        body,
        tag: `cancel-${cancellation.id}`,
        data: { url: "/?view=notices" },
      });
      if (ok) sent++;
    }),
  );

  return sent;
}

/**
 * Broadcast make-up class push notification to all subscribed devices of that batch
 */
export async function broadcastMakeupPush(makeup: MakeupClassRecord): Promise<number> {
  let targetSubs: PushSubscriptionRecord[] = [];

  try {
    await ensurePushSubscriptionsTable();
    const sql = await getSql();
    const res = await sql.query(
      `SELECT endpoint, p256dh, auth, user_type AS "userType", batch_id AS "batchId", teacher_id AS "teacherId", lead_minutes AS "leadMinutes" 
       FROM push_subscriptions 
       WHERE batch_id = $1 OR batch_id IS NULL OR teacher_id = $2`,
      [makeup.batch, makeup.teacher],
    );
    targetSubs = res as unknown as PushSubscriptionRecord[];
  } catch {
    hydrateFallbackFromDisk();
    targetSubs = Array.from(inMemorySubs.values()).filter(
      (s) =>
        s.batchId === makeup.batch ||
        s.batchId === null ||
        s.teacherId === makeup.teacher,
    );
  }

  if (targetSubs.length === 0) return 0;

  const subName = subjects[makeup.subject] || "Make-up Class";
  const roomName = makeup.room >= 0 ? rooms[makeup.room] : "Room TBA";
  const teacherName = makeup.teacher >= 0 ? teachers[makeup.teacher] : "Faculty";
  const batchName = makeup.batch >= 0 ? batches[makeup.batch] : "Class";

  const title = `⭐ Make-up Class: ${subName}`;
  const body = `Scheduled in ${roomName} on ${makeup.targetDateLabel || "upcoming date"} with ${teacherName} (${batchName}).`;

  let sent = 0;
  await Promise.allSettled(
    targetSubs.map(async (s) => {
      const ok = await sendWebPush(s, {
        title,
        body,
        tag: `makeup-${makeup.id}`,
        data: { url: "/?view=notices" },
      });
      if (ok) sent++;
    }),
  );

  return sent;
}

/**
 * Send immediate test push to verify background delivery while app is closed
 */
export async function sendTestPushToEndpoint(endpoint: string): Promise<boolean> {
  let sub: PushSubscriptionRecord | null = null;

  try {
    await ensurePushSubscriptionsTable();
    const sql = await getSql();
    const res = await sql.query(
      `SELECT endpoint, p256dh, auth, user_type AS "userType", batch_id AS "batchId", teacher_id AS "teacherId", lead_minutes AS "leadMinutes" 
       FROM push_subscriptions WHERE endpoint = $1`,
      [endpoint],
    );
    if (res.length > 0) {
      sub = res[0] as unknown as PushSubscriptionRecord;
    }
  } catch {
    hydrateFallbackFromDisk();
    sub = inMemorySubs.get(endpoint) || null;
  }

  if (!sub) return false;

  return sendWebPush(sub, {
    title: "🔔 CUI Attock Background Push Active!",
    body: "Success! Real-time alerts will reach your phone lock screen even when this app is completely closed.",
    tag: "test-bg-push",
    data: { url: "/" },
  });
}
