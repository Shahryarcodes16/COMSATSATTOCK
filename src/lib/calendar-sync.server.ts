/**
 * Server-side Engine for FORTIS LiveSync (Live Dynamic WebCal Calendar Cloud Bridge)
 * Provides RFC 5545 compliant live iCalendar feeds with automatic room/teacher synchronization,
 * cancellation overrides, and makeup class injections.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSql } from "./db.ts";
import { getActiveTimetableServer } from "./timetable-admin.server.ts";
import { serverGetAllActiveCancellations } from "./cancellations.server.ts";
import { serverGetActiveMakeupClasses } from "./makeup.server.ts";
import type { MakeupClassRecord } from "./makeup-classes.ts";
import type { ClassCancellationRecord } from "./timetable-types.ts";
import {
  DAYS,
  SLOTS,
  batches as defaultBatches,
  rooms as defaultRooms,
  teachers as defaultTeachers,
  subjects as defaultSubjects,
  type ClassEntry,
} from "./schedule.ts";

export interface CalendarSyncRecord {
  id: string; // Secret sync token
  title: string;
  studentId?: string | null;
  studentEmail?: string | null;
  batchName?: string | null;
  entries: ClassEntry[];
  lastAccessedAt: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

// In-memory fallback cache
const syncsMemoryStore = new Map<string, CalendarSyncRecord>();
const SYNC_DISK_BACKUP = path.join(os.tmpdir(), "cui_calendar_syncs_v1.json");

function readDiskSyncs(): Record<string, CalendarSyncRecord> {
  try {
    if (fs.existsSync(SYNC_DISK_BACKUP)) {
      const data = fs.readFileSync(SYNC_DISK_BACKUP, "utf8");
      return JSON.parse(data);
    }
  } catch {
    // Ignore disk read error
  }
  return {};
}

function writeDiskSync(record: CalendarSyncRecord): void {
  try {
    const existing = readDiskSyncs();
    existing[record.id] = record;
    fs.writeFileSync(SYNC_DISK_BACKUP, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Ignore disk write error
  }
}

// Hydrate in-memory cache on startup
(() => {
  const disk = readDiskSyncs();
  for (const [k, v] of Object.entries(disk)) {
    syncsMemoryStore.set(k, v);
  }
})();

let tableEnsured = false;
export async function ensureCalendarSyncTable() {
  if (tableEnsured) return;
  try {
    const sql = await getSql();
    await sql.query(`
      CREATE TABLE IF NOT EXISTS cui_calendar_syncs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        student_id TEXT,
        student_email TEXT,
        batch_name TEXT,
        entries_json TEXT NOT NULL,
        last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        access_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_cui_calendar_syncs_student ON cui_calendar_syncs (student_id);
      CREATE INDEX IF NOT EXISTS idx_cui_calendar_syncs_batch ON cui_calendar_syncs (batch_name);
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn("[calendar-sync.server] DB table init warning (memory fallback active):", err);
  }
}

/**
 * Generate a cryptographically secure, url-safe token for calendar subscription
 */
export function generateSyncToken(): string {
  return "cui_" + crypto.randomBytes(12).toString("hex");
}

/**
 * Save or update a student's personal calendar synchronization feed
 */
export async function saveCalendarSyncRecord(
  options: {
    id?: string;
    title: string;
    studentId?: string | null;
    studentEmail?: string | null;
    batchName?: string | null;
    entries: ClassEntry[];
  },
): Promise<CalendarSyncRecord> {
  await ensureCalendarSyncTable();
  const id = options.id?.trim() || generateSyncToken();
  const now = new Date().toISOString();

  const existing = syncsMemoryStore.get(id);
  const record: CalendarSyncRecord = {
    id,
    title: options.title || "My Schedule",
    studentId: options.studentId ?? existing?.studentId ?? null,
    studentEmail: options.studentEmail ?? existing?.studentEmail ?? null,
    batchName: options.batchName ?? existing?.batchName ?? null,
    entries: options.entries || [],
    lastAccessedAt: existing?.lastAccessedAt || now,
    accessCount: existing?.accessCount || 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  syncsMemoryStore.set(id, record);
  writeDiskSync(record);

  try {
    const sql = await getSql();
    await sql.query(
      `
      INSERT INTO cui_calendar_syncs (id, title, student_id, student_email, batch_name, entries_json, last_accessed_at, access_count, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        student_id = EXCLUDED.student_id,
        student_email = EXCLUDED.student_email,
        batch_name = EXCLUDED.batch_name,
        entries_json = EXCLUDED.entries_json,
        updated_at = EXCLUDED.updated_at
    `,
      [
        record.id,
        record.title,
        record.studentId,
        record.studentEmail,
        record.batchName,
        JSON.stringify(record.entries),
        record.lastAccessedAt,
        record.accessCount,
        record.createdAt,
        record.updatedAt,
      ],
    );
  } catch (err) {
    console.warn("[calendar-sync.server] Failed to upsert sync to SQL, using disk/memory:", err);
  }

  return record;
}

/**
 * Load a calendar sync record by token
 */
export async function getCalendarSyncRecord(id: string): Promise<CalendarSyncRecord | null> {
  if (!id) return null;
  await ensureCalendarSyncTable();

  // Try DB first
  try {
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      title: string;
      student_id: string | null;
      student_email: string | null;
      batch_name: string | null;
      entries_json: string;
      last_accessed_at: string;
      access_count: number;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM cui_calendar_syncs WHERE id = $1 LIMIT 1", [id]);

    if (rows && rows.length > 0) {
      const row = rows[0];
      let entries: ClassEntry[] = [];
      try {
        entries = JSON.parse(row.entries_json);
      } catch {
        // Fallback
      }
      const record: CalendarSyncRecord = {
        id: row.id,
        title: row.title,
        studentId: row.student_id,
        studentEmail: row.student_email,
        batchName: row.batch_name,
        entries,
        lastAccessedAt: row.last_accessed_at,
        accessCount: Number(row.access_count) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      syncsMemoryStore.set(id, record);
      return record;
    }
  } catch {
    // Fall back to memory
  }

  return syncsMemoryStore.get(id) || null;
}

/**
 * Record an access from Google Calendar / Apple Calendar
 */
export async function recordCalendarAccess(id: string): Promise<void> {
  const rec = syncsMemoryStore.get(id);
  const now = new Date().toISOString();
  if (rec) {
    rec.accessCount = (rec.accessCount || 0) + 1;
    rec.lastAccessedAt = now;
    writeDiskSync(rec);
  }

  try {
    const sql = await getSql();
    await sql.query(
      "UPDATE cui_calendar_syncs SET access_count = access_count + 1, last_accessed_at = $1 WHERE id = $2",
      [now, id],
    );
  } catch {
    // Ignore access telemetry errors
  }
}

/**
 * Get all class entries for an entire batch section (e.g. "BCS-4A")
 */
export async function getEntriesForSection(batchNameQuery: string): Promise<{
  batchName: string;
  entries: ClassEntry[];
}> {
  const cleanQuery = batchNameQuery.trim().toLowerCase().replace(/[\s\-_]/g, "");
  let rawBatches = defaultBatches;
  let rawRooms = defaultRooms;
  let rawTeachers = defaultTeachers;
  let rawSubjects = defaultSubjects;
  let rawEntries = defaultBatches.length > 0 ? [] : [];

  try {
    const active = await getActiveTimetableServer();
    if (active?.timetableData) {
      rawBatches = active.timetableData.b;
      rawRooms = active.timetableData.r;
      rawTeachers = active.timetableData.t;
      rawSubjects = active.timetableData.s;
      rawEntries = active.timetableData.e.map(([d, s, b, r, t, sub, rep]) => ({
        day: d,
        slot: s,
        batch: b,
        room: r,
        teacher: t,
        subject: sub,
        repeater: rep === 1,
      }));
    }
  } catch {
    // Fall back to defaults
  }

  let matchedBatchIdx = -1;
  let matchedBatchName = batchNameQuery;

  for (let i = 0; i < rawBatches.length; i++) {
    const norm = rawBatches[i].toLowerCase().replace(/[\s\-_]/g, "");
    if (norm === cleanQuery) {
      matchedBatchIdx = i;
      matchedBatchName = rawBatches[i];
      break;
    }
  }

  // Partial match fallback (e.g. "bcs4a" matches "BCS-4A")
  if (matchedBatchIdx === -1) {
    for (let i = 0; i < rawBatches.length; i++) {
      const norm = rawBatches[i].toLowerCase().replace(/[\s\-_]/g, "");
      if (norm.includes(cleanQuery) || cleanQuery.includes(norm)) {
        matchedBatchIdx = i;
        matchedBatchName = rawBatches[i];
        break;
      }
    }
  }

  if (matchedBatchIdx === -1) {
    return { batchName: batchNameQuery, entries: [] };
  }

  const matched = rawEntries.filter((e) => e.batch === matchedBatchIdx);
  return { batchName: matchedBatchName, entries: matched };
}

/**
 * Format date-time for iCalendar (UTC or local with timezone)
 */
function formatIcsDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Core RFC 5545 iCalendar Generator
 * Builds dynamic weekly recurring schedules with live room/teacher sync,
 * cancellations, and makeup classes.
 */
export async function generateLiveIcsFeed(options: {
  calendarTitle: string;
  entries: ClassEntry[];
  batchName?: string | null;
  syncId?: string;
}): Promise<string> {
  const { calendarTitle, entries, batchName, syncId } = options;

  // 1. Fetch active timetable data to resolve current teacher & room assignments
  let curBatches = defaultBatches;
  let curRooms = defaultRooms;
  let curTeachers = defaultTeachers;
  let curSubjects = defaultSubjects;
  let timetableVersionName = "Active";

  try {
    const active = await getActiveTimetableServer();
    if (active?.timetableData) {
      curBatches = active.timetableData.b;
      curRooms = active.timetableData.r;
      curTeachers = active.timetableData.t;
      curSubjects = active.timetableData.s;
      timetableVersionName = active.versionName || "Active";
    }
  } catch {
    // Use defaults
  }

  // 2. Fetch active cancellations & makeups from database
  let cancellations: ClassCancellationRecord[] = [];
  let makeups: MakeupClassRecord[] = [];

  try {
    cancellations = await serverGetAllActiveCancellations();
  } catch {
    // Ignore cancellation query failure
  }

  try {
    const res = await serverGetActiveMakeupClasses();
    makeups = res.records || [];
  } catch {
    // Ignore makeup query failure
  }

  // 3. Calendar recurrence base setup
  // Academic semester window: 18-week semester starting October 2026 through February 2027
  const baseYear = 2026;
  const baseMonth = 10; // October
  const baseDay = 5; // Monday 5 October 2026
  const semesterEndUtc = "20270228T235959Z";

  const dayCodes = ["MO", "TU", "WE", "TH", "FR"];
  const slotClockTimes = [
    { startH: 8, startM: 30, endH: 10, endM: 0 },
    { startH: 10, startM: 0, endH: 11, endM: 30 },
    { startH: 11, startM: 30, endH: 13, endM: 15 },
    { startH: 13, startM: 35, endH: 15, endM: 0 },
    { startH: 15, startM: 0, endH: 16, endM: 30 },
  ];

  const pad = (n: number) => String(n).padStart(2, "0");
  const nowUtc = formatIcsDateTime(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FORTIS//COMSATS University Islamabad Attock//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarTitle)}`,
    "X-WR-TIMEZONE:Asia/Karachi",
    `X-WR-CALDESC:Live dynamic timetable synced from FORTIS (COMSATS Attock). Version: ${escapeIcsText(timetableVersionName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    // Timezone component for Asia/Karachi (UTC+5, no DST)
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Karachi",
    "LAST-MODIFIED:20261001T000000Z",
    "BEGIN:STANDARD",
    "TZNAME:PKT",
    "TZOFFSETFROM:+0500",
    "TZOFFSETTO:+0500",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  // 4. Generate recurring weekly class events
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const day = entry.day;
    const slot = entry.slot;
    const dayCode = dayCodes[day] || "MO";
    const slotTime = slotClockTimes[slot] || slotClockTimes[0];

    const subName = curSubjects[entry.subject] || defaultSubjects[entry.subject] || "Course";
    const roomName = entry.room >= 0 ? curRooms[entry.room] || defaultRooms[entry.room] || "Room TBA" : "Room TBA";
    const teacherName = entry.teacher >= 0 ? curTeachers[entry.teacher] || defaultTeachers[entry.teacher] || "Faculty TBA" : "Faculty TBA";
    const entryBatch = entry.batch >= 0 ? curBatches[entry.batch] || defaultBatches[entry.batch] || "" : "";

    const eventDayNum = baseDay + day;
    const startStr = `${baseYear}${pad(baseMonth)}${pad(eventDayNum)}T${pad(slotTime.startH)}${pad(slotTime.startM)}00`;
    const endStr = `${baseYear}${pad(baseMonth)}${pad(eventDayNum)}T${pad(slotTime.endH)}${pad(slotTime.endM)}00`;

    const uid = `fortis-${day}-${slot}-${entry.subject}-${entry.batch}-${i}@cuiatk.edu.pk`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowUtc}`);
    lines.push(`DTSTART;TZID=Asia/Karachi:${startStr}`);
    lines.push(`DTEND;TZID=Asia/Karachi:${endStr}`);
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${dayCode};UNTIL=${semesterEndUtc}`);
    lines.push(`SUMMARY:${escapeIcsText(subName)}${entry.repeater ? " (Repeater)" : ""}`);
    lines.push(`LOCATION:${escapeIcsText(roomName)} (COMSATS Attock)`);
    lines.push(
      `DESCRIPTION:${escapeIcsText(
        `Instructor: ${teacherName}\nRoom: ${roomName}\nSection: ${entryBatch}\nTimetable Version: ${timetableVersionName}\nSynced Live via FORTIS LiveSync`,
      )}`,
    );
    lines.push("STATUS:CONFIRMED");

    // 15-Minute Alarm Notification on phone
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:Upcoming class: ${escapeIcsText(subName)} in ${escapeIcsText(roomName)}`);
    lines.push("TRIGGER:-PT15M");
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  }

  // 5. Inject Active Class Cancellations as override cancel events
  if (cancellations.length > 0) {
    for (const cancel of cancellations) {
      if (cancel.status !== "active") continue;
      // Check if cancellation matches this schedule
      const matches = entries.some(
        (e) => e.day === cancel.day && e.slot === cancel.slot && (e.batch === cancel.batch || e.subject === cancel.subject),
      );
      if (!matches) continue;

      const slotTime = slotClockTimes[cancel.slot] || slotClockTimes[0];
      const targetDateParts = cancel.targetDate.split("-"); // YYYY-MM-DD
      if (targetDateParts.length === 3) {
        const [y, m, d] = targetDateParts;
        const cancelStart = `${y}${pad(Number(m))}${pad(Number(d))}T${pad(slotTime.startH)}${pad(slotTime.startM)}00`;
        const cancelEnd = `${y}${pad(Number(m))}${pad(Number(d))}T${pad(slotTime.endH)}${pad(slotTime.endM)}00`;

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:cancel-${cancel.id}@cuiatk.edu.pk`);
        lines.push(`DTSTAMP:${nowUtc}`);
        lines.push(`DTSTART;TZID=Asia/Karachi:${cancelStart}`);
        lines.push(`DTEND;TZID=Asia/Karachi:${cancelEnd}`);
        lines.push(`SUMMARY:❌ [CANCELLED] ${escapeIcsText(cancel.subjectName)}`);
        lines.push(`LOCATION:${escapeIcsText(cancel.roomName)} (COMSATS Attock)`);
        lines.push(
          `DESCRIPTION:${escapeIcsText(
            `CLASS CANCELLED\nReason: ${cancel.reason}\nInstructor: ${cancel.teacherName}\nDate: ${cancel.targetDateLabel}\nNotice: Verified by Department Faculty via FORTIS`,
          )}`,
        );
        lines.push("STATUS:CANCELLED");
        lines.push("END:VEVENT");
      }
    }
  }

  // 6. Inject Active Makeup Classes as special events
  if (makeups.length > 0) {
    for (const makeup of makeups) {
      if (makeup.status !== "active") continue;
      // Check if makeup belongs to this schedule
      const matches = entries.some(
        (e) => e.batch === makeup.batch || e.subject === makeup.subject,
      );
      if (!matches) continue;

      const slotTime = slotClockTimes[makeup.slot] || slotClockTimes[0];
      const targetDateParts = makeup.targetDate.split("-");
      if (targetDateParts.length === 3) {
        const [y, m, d] = targetDateParts;
        const makeupStart = `${y}${pad(Number(m))}${pad(Number(d))}T${pad(slotTime.startH)}${pad(slotTime.startM)}00`;
        const makeupEnd = `${y}${pad(Number(m))}${pad(Number(d))}T${pad(slotTime.endH)}${pad(slotTime.endM)}00`;

        const subName = curSubjects[makeup.subject] || defaultSubjects[makeup.subject] || "Course";
        const roomName = makeup.room >= 0 ? curRooms[makeup.room] || defaultRooms[makeup.room] || "Room TBA" : "Room TBA";
        const teacherName = makeup.teacher >= 0 ? curTeachers[makeup.teacher] || defaultTeachers[makeup.teacher] || "Faculty" : "Faculty";
        const batchNameStr = makeup.batch >= 0 ? curBatches[makeup.batch] || defaultBatches[makeup.batch] || "" : "";

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:makeup-${makeup.id}@cuiatk.edu.pk`);
        lines.push(`DTSTAMP:${nowUtc}`);
        lines.push(`DTSTART;TZID=Asia/Karachi:${makeupStart}`);
        lines.push(`DTEND;TZID=Asia/Karachi:${makeupEnd}`);
        lines.push(`SUMMARY:⚡ [MAKEUP] ${escapeIcsText(subName)} (${batchNameStr})`);
        lines.push(`LOCATION:${escapeIcsText(roomName)} (COMSATS Attock)`);
        lines.push(
          `DESCRIPTION:${escapeIcsText(
            `ARRANGED MAKE-UP LECTURE\nInstructor: ${teacherName}\nSection: ${batchNameStr}\nRoom: ${roomName}\nNote: ${makeup.note || "Arranged via FORTIS Faculty Desk"}\nDate: ${makeup.targetDateLabel}`,
          )}`,
        );
        lines.push("STATUS:CONFIRMED");
        lines.push("BEGIN:VALARM");
        lines.push("ACTION:DISPLAY");
        lines.push(`DESCRIPTION:Upcoming make-up class: ${escapeIcsText(subName)} in ${escapeIcsText(roomName)}`);
        lines.push("TRIGGER:-PT20M");
        lines.push("END:VALARM");
        lines.push("END:VEVENT");
      }
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * HTTP Request Handler for Calendar Sync
 * Accepts:
 *   /api/calendar/sync/:token
 *   /api/calendar/sync/section/:batchName
 */
export async function handleCalendarSyncRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // 1. Handle batch section sync: /api/calendar/sync/section/:batchName
  if (path.startsWith("/api/calendar/sync/section/")) {
    const rawBatch = decodeURIComponent(path.replace("/api/calendar/sync/section/", "").split("/")[0] || "");
    if (!rawBatch) {
      return new Response("Missing batch name parameter", { status: 400 });
    }

    const { batchName, entries } = await getEntriesForSection(rawBatch);
    if (!entries || entries.length === 0) {
      return new Response(`No classes found for batch section "${rawBatch}"`, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const ics = await generateLiveIcsFeed({
      calendarTitle: `FORTIS - ${batchName} Schedule`,
      batchName,
      entries,
    });

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="fortis-${batchName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.ics"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 2. Handle token-based personalized sync: /api/calendar/sync/:token
  const rawToken = path.replace("/api/calendar/sync/", "").split("/")[0]?.trim() || "";
  if (!rawToken) {
    return new Response("Missing calendar sync token", { status: 400 });
  }

  const record = await getCalendarSyncRecord(rawToken);
  if (!record) {
    return new Response("Calendar sync subscription not found or expired", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Record access telemetry
  await recordCalendarAccess(rawToken);

  const ics = await generateLiveIcsFeed({
    calendarTitle: `FORTIS - ${record.title}`,
    batchName: record.batchName,
    entries: record.entries,
    syncId: record.id,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="fortis-schedule-${rawToken.slice(0, 8)}.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
