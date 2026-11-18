/**
 * Server-side Web Push Notification Dispatcher
 * Sends real-time system alerts directly to students' and faculty members' phones
 * and computers via the W3C Web Push Protocol (Google FCM, Apple APNs, Mozilla Autopush)
 * so that notifications arrive EVEN WHEN THE BROWSER APP IS CLOSED.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setVapidDetails, sendNotification } from "web-push";
import { getSql } from "./db.ts";
import {
  batches,
  rooms,
  subjects,
  teachers,
  forBatch,
  forTeacher,
  SLOTS,
  getCampusMinutes,
  type ClassEntry,
} from "./schedule.ts";
import { serverGetAllActiveCancellations } from "./cancellations.server.ts";
import { serverGetActiveMakeupClasses } from "./makeup.server.ts";
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
  setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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
  customSchedule?: ClassEntry[] | null;
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
        custom_schedule JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    try {
      await sql.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS custom_schedule JSONB`);
    } catch {
      // Column may already exist
    }
    try {
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_push_sub_batch ON push_subscriptions(batch_id)`);
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_push_sub_teacher ON push_subscriptions(teacher_id)`);
    } catch {
      // Index may already exist
    }
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
  customSchedule?: ClassEntry[] | null;
}): Promise<boolean> {
  const record: PushSubscriptionRecord = {
    endpoint: data.endpoint,
    p256dh: data.keys.p256dh,
    auth: data.keys.auth,
    userType: data.userType || "student",
    batchId: data.batchId ?? null,
    teacherId: data.teacherId ?? null,
    leadMinutes: data.leadMinutes ?? 10,
    customSchedule: data.customSchedule ?? null,
  };

  try {
    await ensurePushSubscriptionsTable();
    const sql = await getSql();
    await sql.query(
      `
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_type, batch_id, teacher_id, lead_minutes, custom_schedule, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_type = EXCLUDED.user_type,
        batch_id = EXCLUDED.batch_id,
        teacher_id = EXCLUDED.teacher_id,
        lead_minutes = EXCLUDED.lead_minutes,
        custom_schedule = EXCLUDED.custom_schedule,
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
        record.customSchedule ? JSON.stringify(record.customSchedule) : null,
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
    const pushPromise = sendNotification(pushSubscription, notificationPayload, {
      TTL: 86400, // 24 hours
      urgency: "high",
    });
    // Add 4-second safety timeout so dead endpoints or stalled connections never hang the server
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Push dispatch timeout")), 4000);
    });
    try {
      await Promise.race([pushPromise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
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
    title: "🔔 FORTIS Background Push Active!",
    body: "Success! Real-time alerts will reach your phone lock screen even when this app is completely closed.",
    tag: "test-bg-push",
    data: { url: "/" },
  });
}

// Daily deduplication cache to prevent re-notifying the same slot on the same day
const sentRemindersToday = new Set<string>();
let lastDedupeDateStr = "";

/**
 * Server-Side Background Push Dispatcher
 * Evaluates all student and faculty push subscriptions against current campus time
 * and sends lock-screen notifications directly to phones and laptops even when app is closed.
 */
export async function dispatchUpcomingClassReminders(referenceDate: Date = new Date()): Promise<{
  checked: number;
  sent: number;
  skipped: number;
}> {
  const { dayIndex, minutes: curMinutes } = getCampusMinutes(referenceDate);
  if (dayIndex === null || dayIndex < 0 || dayIndex > 4) {
    return { checked: 0, sent: 0, skipped: 0 }; // Weekend / non-academic day
  }

  const todayStr = referenceDate.toISOString().slice(0, 10);
  if (lastDedupeDateStr !== todayStr) {
    sentRemindersToday.clear();
    lastDedupeDateStr = todayStr;
  }

  // 1. Load all push subscriptions
  let subscriptions: PushSubscriptionRecord[] = [];
  try {
    await ensurePushSubscriptionsTable();
    const sql = await getSql();
    const rows = await sql.query(`
      SELECT endpoint, p256dh, auth, user_type AS "userType", batch_id AS "batchId", 
             teacher_id AS "teacherId", lead_minutes AS "leadMinutes",
             custom_schedule AS "customSchedule"
      FROM push_subscriptions
    `);
    subscriptions = (rows as unknown as PushSubscriptionRecord[]).map((r) => {
      let customSched: ClassEntry[] | null = null;
      if (r.customSchedule) {
        try {
          customSched = typeof r.customSchedule === "string" ? JSON.parse(r.customSchedule) : r.customSchedule;
        } catch {
          customSched = null;
        }
      }
      return { ...r, customSchedule: customSched };
    });
  } catch {
    hydrateFallbackFromDisk();
    subscriptions = Array.from(inMemorySubs.values());
  }

  if (subscriptions.length === 0) {
    return { checked: 0, sent: 0, skipped: 0 };
  }

  // 2. Load active cancellations and makeups
  let cancellations: ClassCancellationRecord[] = [];
  let makeups: MakeupClassRecord[] = [];

  try {
    cancellations = await serverGetAllActiveCancellations();
  } catch (err) {
    console.warn("[push.server] Could not load cancellations:", err);
  }

  try {
    const res = await serverGetActiveMakeupClasses();
    makeups = res.records || [];
  } catch (err) {
    console.warn("[push.server] Could not load makeups:", err);
  }

  const cancelledKeySet = new Set(
    cancellations
      .filter((c) => c.status === "active" && c.day === dayIndex)
      .map((c) => `${c.day}_${c.slot}_${c.teacher}_${c.batch}_${c.room}`),
  );

  let sent = 0;
  let skipped = 0;

  for (const sub of subscriptions) {
    const leadMins = sub.leadMinutes || 10;
    let classesToAlert: ClassEntry[] = [];

    if (sub.userType === "faculty" && sub.teacherId !== null && sub.teacherId !== undefined) {
      // Faculty teaching schedule
      classesToAlert = forTeacher(sub.teacherId).filter((e) => e.day === dayIndex);
    } else {
      // Student schedule
      if (Array.isArray(sub.customSchedule) && sub.customSchedule.length > 0) {
        classesToAlert = sub.customSchedule.filter((e) => e.day === dayIndex);
      } else if (sub.batchId !== null && sub.batchId !== undefined) {
        classesToAlert = forBatch(sub.batchId).filter((e) => e.day === dayIndex);
      }

      // Merge active makeups for this batch
      if (sub.batchId !== null && sub.batchId !== undefined) {
        const batchMakeups = makeups.filter((m) => m.day === dayIndex && m.batch === sub.batchId);
        for (const m of batchMakeups) {
          classesToAlert.push({
            day: m.day,
            slot: m.slot,
            batch: m.batch,
            room: m.room,
            teacher: m.teacher,
            subject: m.subject,
            repeater: false,
            isMakeup: true,
          });
        }
      }
    }

    for (const cls of classesToAlert) {
      const cancelKey = `${cls.day}_${cls.slot}_${cls.teacher}_${cls.batch}_${cls.room}`;
      if (cancelledKeySet.has(cancelKey)) {
        skipped++;
        continue;
      }

      const slotDef = SLOTS[cls.slot];
      if (!slotDef) continue;

      const alertThreshold = slotDef.from - leadMins;
      // Trigger window: within 2 minutes of the target lead time
      if (curMinutes >= alertThreshold && curMinutes <= alertThreshold + 2) {
        const dedupeKey = `${todayStr}_${sub.endpoint}_${cls.slot}_${cls.subject}`;
        if (sentRemindersToday.has(dedupeKey)) {
          skipped++;
          continue;
        }

        sentRemindersToday.add(dedupeKey);

        const subName = subjects[cls.subject] || "Lecture";
        const roomName = cls.room >= 0 ? rooms[cls.room] : "Campus";
        const teacherName = cls.teacher >= 0 ? teachers[cls.teacher] : "";
        const batchName = cls.batch >= 0 ? batches[cls.batch] : "Class";

        const title =
          sub.userType === "faculty"
            ? `🔔 Teaching in ${leadMins}m: ${subName}`
            : `🔔 Class in ${leadMins}m: ${subName}`;

        const body =
          sub.userType === "faculty"
            ? `📍 ${roomName} with ${batchName} (${slotDef.start} – ${slotDef.end})`
            : `📍 ${roomName}${teacherName ? ` · 👤 ${teacherName}` : ""} (${slotDef.start} – ${slotDef.end})`;

        const ok = await sendWebPush(sub, {
          title,
          body,
          tag: `class-${cls.slot}-${cls.subject}`,
          data: { url: sub.userType === "faculty" ? "/?view=faculty-desk" : "/?view=custom" },
        });

        if (ok) sent++;
      }
    }
  }

  return { checked: subscriptions.length, sent, skipped };
}

let reminderWorkerInterval: NodeJS.Timeout | null = null;

export function startPushNotificationWorker() {
  if (reminderWorkerInterval) return;
  // Run background reminder check every 45 seconds
  reminderWorkerInterval = setInterval(() => {
    dispatchUpcomingClassReminders().catch((err) => {
      console.warn("[push.server] Background reminder cycle error:", err);
    });
  }, 45_000);
  if (typeof reminderWorkerInterval.unref === "function") {
    reminderWorkerInterval.unref();
  }

  // Initial immediate check on startup
  const initTimeout = setTimeout(() => {
    dispatchUpcomingClassReminders().catch(() => {});
  }, 4000);
  if (typeof initTimeout.unref === "function") {
    initTimeout.unref();
  }
}

// Auto-start worker on server startup (skip during automated unit tests)
const isTestMode =
  process.env.NODE_ENV === "test" ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.argv.some((arg) => arg.includes("test"));

if (!isTestMode) {
  startPushNotificationWorker();
}
