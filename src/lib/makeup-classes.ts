/**
 * Arranged Makeup & Extra Classes Module
 * Allows faculty to schedule makeup classes in vacant rooms/labs,
 * automatically updating the status of rooms, faculty, and student batches across the campus timetable.
 * 
 * Features:
 * - Automatic Expiration: When a lecture slot ends (e.g. Monday L1 ends at 10:00),
 *   the system automatically changes the status of the room and teacher back to FREE.
 * - On-Demand Release: Teachers can click "Cancel / Release Room" anytime to instantly free the room & teacher.
 */
import {
  SLOTS,
  type ClassEntry,
} from "./schedule";
import { CAMPUS_TIME_ZONE } from "./campus";

export const MAKEUP_CLASSES_STORAGE_KEY = "cui_arranged_makeup_classes_v1";

export interface MakeupClassRecord {
  id: string; // Unique ID (e.g. "makeup_1730876400000_abc")
  day: number; // 0..4 (Monday..Friday)
  slot: number; // 0..4 (L1..L5)
  batch: number;
  room: number;
  teacher: number;
  subject: number;
  note?: string;
  targetDate?: string; // YYYY-MM-DD in PKT (e.g. "2026-11-09")
  targetDateLabel?: string; // "Mon, 9 Nov 2026"
  expiresAt?: string; // ISO string when slot ends in PKT (e.g. "2026-11-09T05:00:00.000Z")
  status?: "active" | "completed" | "cancelled";
  autoReleasedAt?: string;
  createdAt: string; // ISO string
  createdByEmail: string;
}

/**
 * Computes the target date and exact expiration time in Pakistan Standard Time (PKT / Asia/Karachi).
 * For instance, booking Monday L1 (08:30 - 10:00) yields an expiry at exactly 10:00:00 PKT on that Monday.
 */
export function computeMakeupTargetAndExpiry(
  day: number,
  slot: number,
  refDate: Date = new Date(),
) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(refDate);
  const find = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const year = parseInt(find("year"), 10) || refDate.getFullYear();
  const month = parseInt(find("month"), 10) || refDate.getMonth() + 1;
  const dayOfMonth = parseInt(find("day"), 10) || refDate.getDate();
  const weekdayShort = find("weekday");
  const hour = parseInt(find("hour"), 10) || 0;
  const minute = parseInt(find("minute"), 10) || 0;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayShort);
  const currentMinutes = hour * 60 + minute;

  // Day mapping: 0=Mon (target weekday 1), ..., 4=Fri (target weekday 5)
  const targetWeekday = day + 1;
  const diff = targetWeekday - (weekdayIndex >= 0 ? weekdayIndex : 1);
  const slotDef = SLOTS[slot] || { to: 10 * 60, label: "L1", end: "10:00" };
  const slotEndMin = slotDef.to;

  let daysToAdd: number;
  if (diff === 0) {
    // If the lecture slot has already ended today, schedule for next week's occurrence
    if (currentMinutes >= slotEndMin) {
      daysToAdd = 7;
    } else {
      daysToAdd = 0; // Today!
    }
  } else if (diff > 0) {
    daysToAdd = diff;
  } else {
    daysToAdd = diff + 7;
  }

  const targetDateObj = new Date(Date.UTC(year, month - 1, dayOfMonth + daysToAdd));
  const targetYear = targetDateObj.getUTCFullYear();
  const targetMonth = targetDateObj.getUTCMonth() + 1;
  const targetDay = targetDateObj.getUTCDate();
  const targetDateStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;

  const endHour = Math.floor(slotEndMin / 60);
  const endMinute = slotEndMin % 60;
  // Asia/Karachi (PKT) is fixed at UTC+5 with no daylight saving time
  const expiresAtIso = new Date(
    `${targetDateStr}T${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00+05:00`,
  ).toISOString();

  // Friendly human readable label (e.g. "Mon, 9 Nov 2026")
  const labelFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const targetDateLabel = labelFormatter.format(
    new Date(`${targetDateStr}T12:00:00+05:00`),
  );

  return {
    targetDateStr,
    targetDateLabel,
    expiresAtIso,
    endHour,
    endMinute,
    slotEndLabel: slotDef.end,
    daysToAdd,
  };
}

/**
 * Checks whether an arranged makeup class is currently active and occupying the venue.
 * If the slot has already concluded (e.g. after 10:00 for L1), it returns false.
 */
export function isMakeupActive(
  record: MakeupClassRecord,
  now: Date = new Date(),
): boolean {
  if (record.status === "cancelled" || record.status === "completed") {
    return false;
  }

  if (record.expiresAt) {
    return now.getTime() < new Date(record.expiresAt).getTime();
  }

  // Fallback for older records stored without an explicit expiresAt
  const { expiresAtIso } = computeMakeupTargetAndExpiry(
    record.day,
    record.slot,
    new Date(record.createdAt || now),
  );
  return now.getTime() < new Date(expiresAtIso).getTime();
}

/**
 * Loads all arranged makeup classes from client storage
 */
export function getArrangedMakeupClasses(): MakeupClassRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MAKEUP_CLASSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (m) =>
          typeof m.day === "number" &&
          m.day >= 0 &&
          m.day < 5 &&
          typeof m.slot === "number" &&
          m.slot >= 0 &&
          m.slot < 5 &&
          typeof m.room === "number" &&
          typeof m.teacher === "number" &&
          typeof m.batch === "number",
      );
    }
  } catch (err) {
    console.error("Failed to parse arranged makeup classes", err);
  }
  return [];
}

/**
 * Returns only actively ongoing/scheduled makeup classes (which still occupy rooms and teachers).
 * Any class that has ended (e.g. past 10:00 on Monday for L1) is automatically excluded.
 */
export function getActiveArrangedMakeupClasses(
  now: Date = new Date(),
): MakeupClassRecord[] {
  const list = getArrangedMakeupClasses();
  return list.filter((m) => isMakeupActive(m, now));
}

/**
 * Scans all makeup classes, automatically transitions any that ended into 'completed',
 * and dispatches update events so all room & teacher statuses revert to FREE immediately.
 */
export function pruneAndSyncMakeupClasses(
  now: Date = new Date(),
): MakeupClassRecord[] {
  if (typeof window === "undefined") return [];
  const list = getArrangedMakeupClasses();
  let changed = false;

  const updated = list.map((record) => {
    if (record.status !== "completed" && record.status !== "cancelled") {
      if (!isMakeupActive(record, now)) {
        changed = true;
        return {
          ...record,
          status: "completed" as const,
          autoReleasedAt: now.toISOString(),
        };
      }
    }
    return record;
  });

  if (changed) {
    saveArrangedMakeupClasses(updated);
  }

  return updated;
}

/**
 * Persists makeup classes to storage and notifies subscribers
 */
export function saveArrangedMakeupClasses(list: MakeupClassRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAKEUP_CLASSES_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(
      new CustomEvent("cui:makeup-classes-updated", { detail: list }),
    );
  } catch (err) {
    console.error("Failed to save arranged makeup classes", err);
  }
}

/**
 * Schedules a new makeup class, immediately reserving the room and teacher until slot end time.
 */
export function addMakeupClass(
  params: Omit<
    MakeupClassRecord,
    "id" | "createdAt" | "targetDate" | "targetDateLabel" | "expiresAt" | "status" | "autoReleasedAt"
  >,
): MakeupClassRecord {
  const current = getArrangedMakeupClasses();
  const id = `makeup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const { targetDateStr, targetDateLabel, expiresAtIso } = computeMakeupTargetAndExpiry(
    params.day,
    params.slot,
    now,
  );

  const record: MakeupClassRecord = {
    ...params,
    id,
    targetDate: targetDateStr,
    targetDateLabel,
    expiresAt: expiresAtIso,
    status: "active",
    createdAt: now.toISOString(),
  };

  const next = [...current, record];
  saveArrangedMakeupClasses(next);
  return record;
}

/**
 * Cancels an arranged makeup class early, immediately releasing the room & teacher back to FREE.
 */
export function removeMakeupClass(id: string): void {
  const current = getArrangedMakeupClasses();
  const next = current.filter((m) => m.id !== id);
  saveArrangedMakeupClasses(next);
}

/**
 * Converts a MakeupClassRecord into a ClassEntry compatible with timetables
 */
export function toClassEntry(record: MakeupClassRecord): ClassEntry {
  return {
    day: record.day,
    slot: record.slot,
    batch: record.batch,
    room: record.room,
    teacher: record.teacher,
    subject: record.subject,
    repeater: false,
    isMakeup: true,
    makeupId: record.id,
    makeupNote: record.note,
  };
}

/**
 * Checks if a specific room is currently occupied by an active arranged makeup class in a given slot
 */
export function getRoomMakeupClass(
  roomId: number,
  day: number,
  slot: number,
  now: Date = new Date(),
): MakeupClassRecord | null {
  const list = getActiveArrangedMakeupClasses(now);
  return (
    list.find(
      (m) => m.room === roomId && m.day === day && m.slot === slot,
    ) || null
  );
}

/**
 * Checks if a specific teacher is currently occupied by an active arranged makeup class in a given slot
 */
export function getTeacherMakeupClass(
  teacherId: number,
  day: number,
  slot: number,
  now: Date = new Date(),
): MakeupClassRecord | null {
  const list = getActiveArrangedMakeupClasses(now);
  return (
    list.find(
      (m) => m.teacher === teacherId && m.day === day && m.slot === slot,
    ) || null
  );
}

/**
 * Returns all makeup classes created by or assigned to a specific teacher
 */
export function getTeacherArrangedMakeupClasses(
  teacherId: number,
): MakeupClassRecord[] {
  const list = getArrangedMakeupClasses();
  return list.filter((m) => m.teacher === teacherId);
}
