/**
 * Campus Pulse & Room Utilization Engine for CUI Attock
 * Provides real-time telemetry of campus classes, room utilization heatmaps,
 * and dynamic schedule cascading (cancellations and makeups).
 */

import {
  DAYS,
  SLOTS,
  rooms,
  batches,
  teachers,
  subjects,
  entries,
  campusParts,
  timeLabel,
  type ClassEntry,
  type RoomGroup,
} from "./schedule.ts";
import {
  getActiveArrangedMakeupClasses,
  getArrangedMakeupClasses,
  type MakeupClassRecord,
} from "./makeup-classes.ts";
export type { ClassCancellationRecord } from "./timetable-types.ts";
import type {
  CampusPulseTelemetry,
  ClassCancellationRecord,
  RoomCategory,
  RoomUtilizationStat,
  TimetableRaw,
} from "./timetable-types.ts";
import { CAMPUS_TIME_ZONE } from "./campus.ts";
import {
  getAllActiveCancellationsServerFn,
  addClassCancellationServerFn,
  removeClassCancellationServerFn,
  settleClassCancellationServerFn,
} from "./cancellations-server-fn.ts";

export const CANCELLATIONS_STORAGE_KEY = "cui_class_cancellations_v1";
export const CANCELLATIONS_UPDATED_EVENT = "cui:class-cancellations-updated";

let memoryCancellations: ClassCancellationRecord[] = [];
let isSyncing = false;
let lastKnownPersistent: boolean | null = null;
const pendingAdds = new Map<string, ClassCancellationRecord>();
const pendingRemovals = new Set<string>();
const sessionRemovedIds = new Set<string>();

export function isCancellationCloudPersistent(): boolean | null {
  return lastKnownPersistent;
}

export function normalizeBatchLabel(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "").trim();
}

export function batchesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeBatchLabel(a) === normalizeBatchLabel(b);
}

// -------------------------------------------------------------
// 1. Dynamic Class Cancellations Store & Multi-Device Sync
// -------------------------------------------------------------

export function getClassCancellations(): ClassCancellationRecord[] {
  if (typeof window === "undefined") return memoryCancellations;
  try {
    const raw = localStorage.getItem(CANCELLATIONS_STORAGE_KEY);
    if (!raw) return memoryCancellations;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to parse class cancellations", err);
    return memoryCancellations;
  }
}

export function saveClassCancellations(list: ClassCancellationRecord[]): void {
  memoryCancellations = list;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CANCELLATIONS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(
      new CustomEvent(CANCELLATIONS_UPDATED_EVENT, { detail: list }),
    );
  } catch (err) {
    console.error("Failed to save class cancellations", err);
  }
}

/**
 * Synchronizes cancellations from backend database so students on mobile/laptop
 * immediately receive real-time class cancellations broadcast by faculty.
 */
export async function syncCancellationsFromServer(): Promise<ClassCancellationRecord[]> {
  if (typeof window === "undefined") return getClassCancellations();
  if (isSyncing) return getClassCancellations();

  isSyncing = true;
  try {
    // Retry any pending local additions that have not yet finished syncing
    for (const [id, rec] of pendingAdds.entries()) {
      try {
        const addRes = await addClassCancellationServerFn({ data: rec });
        if (addRes && typeof addRes.persistent === "boolean") {
          lastKnownPersistent = addRes.persistent;
        }
        pendingAdds.delete(id);
      } catch {
        // Leave in pendingAdds for next sync cycle
      }
    }

    const syncRes = await getAllActiveCancellationsServerFn();
    const serverList = Array.isArray(syncRes) ? syncRes : syncRes?.records;
    const persistent = Array.isArray(syncRes) ? false : Boolean(syncRes?.persistent);
    if (!Array.isArray(syncRes) && typeof syncRes?.persistent === "boolean") {
      lastKnownPersistent = syncRes.persistent;
    }

    if (Array.isArray(serverList)) {
      const mergedMap = new Map<string, ClassCancellationRecord>();

      // If server is running ephemeral storage (no DATABASE_URL), preserve existing local records
      // so a stateless serverless cold/different instance never erases cancellations on this device.
      if (!persistent) {
        for (const localItem of getClassCancellations()) {
          if (
            localItem.status === "active" &&
            !pendingRemovals.has(localItem.id) &&
            !sessionRemovedIds.has(localItem.id)
          ) {
            mergedMap.set(localItem.id, localItem);
          }
        }
      }

      for (const item of serverList) {
        if (!pendingRemovals.has(item.id) && !sessionRemovedIds.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      }
      for (const [id, pending] of pendingAdds.entries()) {
        if (!pendingRemovals.has(id) && !sessionRemovedIds.has(id)) {
          mergedMap.set(id, pending);
        }
      }

      const merged = Array.from(mergedMap.values());
      saveClassCancellations(merged);
      return merged;
    }
  } catch (err) {
    console.warn("[campus-pulse] Could not sync cancellations from server:", err);
  } finally {
    isSyncing = false;
  }
  return getClassCancellations();
}

// Client-side auto synchronization on boot, interval, focus, and visibility change
if (typeof window !== "undefined") {
  setTimeout(() => {
    syncCancellationsFromServer();
  }, 150);

  // Poll every 10 seconds for newly announced cancellations across devices
  setInterval(() => {
    syncCancellationsFromServer();
  }, 10000);

  window.addEventListener("focus", () => {
    syncCancellationsFromServer();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncCancellationsFromServer();
    }
  });
}

function createCancellationRecord(params: {
  day: number;
  slot: number;
  batch: number;
  batchName: string;
  room: number;
  roomName: string;
  teacher: number;
  teacherName: string;
  subject: number;
  subjectName: string;
  targetDate?: string;
  reason?: string;
  cancelledByEmail?: string;
}): ClassCancellationRecord {
  const current = getClassCancellations();
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const find = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const defaultDate = `${find("year")}-${find("month")}-${find("day")}`;

  const targetDate = params.targetDate || defaultDate;

  const labelFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const targetDateLabel = labelFormatter.format(now);

  const record: ClassCancellationRecord = {
    id: `cancel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    day: params.day,
    slot: params.slot,
    batch: params.batch,
    batchName: params.batchName,
    room: params.room,
    roomName: params.roomName,
    teacher: params.teacher,
    teacherName: params.teacherName,
    subject: params.subject,
    subjectName: params.subjectName,
    targetDate,
    targetDateLabel,
    reason: params.reason || "Faculty unavailable / official commitment",
    cancelledAt: now.toISOString(),
    cancelledByEmail: params.cancelledByEmail || "",
    status: "active",
  };

  // Replace any duplicate active cancellation for the same teacher+batch+day+slot
  const filtered = current.filter(
    (c) =>
      !(
        c.status === "active" &&
        c.day === record.day &&
        c.slot === record.slot &&
        c.teacher === record.teacher &&
        c.batch === record.batch
      ),
  );
  const next = [...filtered, record];
  pendingAdds.set(record.id, record);
  saveClassCancellations(next);

  return record;
}

/**
 * Marks a scheduled class as cancelled by faculty (synchronous local write + background sync).
 */
export function addClassCancellation(params: {
  day: number;
  slot: number;
  batch: number;
  batchName: string;
  room: number;
  roomName: string;
  teacher: number;
  teacherName: string;
  subject: number;
  subjectName: string;
  targetDate?: string;
  reason?: string;
  cancelledByEmail?: string;
}): ClassCancellationRecord {
  const record = createCancellationRecord(params);

  if (typeof window !== "undefined") {
    addClassCancellationServerFn({ data: record })
      .then((res) => {
        if (res && typeof res.persistent === "boolean") {
          lastKnownPersistent = res.persistent;
        }
        pendingAdds.delete(record.id);
      })
      .catch((err) => {
        console.error("[campus-pulse] Failed to sync cancellation to server:", err);
      });
  }

  return record;
}

/**
 * Marks a scheduled class as cancelled and awaits server persistence status.
 */
export async function addClassCancellationAsync(params: {
  day: number;
  slot: number;
  batch: number;
  batchName: string;
  room: number;
  roomName: string;
  teacher: number;
  teacherName: string;
  subject: number;
  subjectName: string;
  targetDate?: string;
  reason?: string;
  cancelledByEmail?: string;
}): Promise<{ record: ClassCancellationRecord; persistent: boolean; dbSaved: boolean }> {
  const record = createCancellationRecord(params);

  if (typeof window === "undefined") {
    return { record, persistent: false, dbSaved: false };
  }

  try {
    const res = await addClassCancellationServerFn({ data: record });
    lastKnownPersistent = res.persistent;
    pendingAdds.delete(record.id);
    window.dispatchEvent(new CustomEvent(CANCELLATIONS_UPDATED_EVENT, { detail: getClassCancellations() }));
    return res;
  } catch (err) {
    console.error("[campus-pulse] Failed to sync cancellation to server:", err);
    return { record, persistent: false, dbSaved: false };
  }
}

/**
 * Removes or undoes a class cancellation
 */
export function removeClassCancellation(id: string): void {
  pendingAdds.delete(id);
  pendingRemovals.add(id);
  sessionRemovedIds.add(id);
  const current = getClassCancellations();
  const next = current.filter((c) => c.id !== id);
  saveClassCancellations(next);

  if (typeof window !== "undefined") {
    removeClassCancellationServerFn({ data: { id } })
      .then(() => {
        pendingRemovals.delete(id);
      })
      .catch((err) => {
        pendingRemovals.delete(id);
        console.error("[campus-pulse] Failed to remove cancellation from server:", err);
      });
  }
}

/**
 * Marks a cancellation debt as settled by an arranged makeup class
 */
export function settleClassCancellation(cancellationId: string, makeupId: string): void {
  const current = getClassCancellations();
  const next = current.map((c) =>
    c.id === cancellationId
      ? { ...c, status: "settled" as const, settledByMakeupId: makeupId }
      : c,
  );
  saveClassCancellations(next);

  if (typeof window !== "undefined") {
    settleClassCancellationServerFn({ data: { cancellationId, makeupId } }).catch((err) =>
      console.error("[campus-pulse] Failed to settle cancellation on server:", err),
    );
  }
}

/**
 * Checks if a class at a given day and slot is currently cancelled
 */
export function isClassCancelled(
  day: number,
  slot: number,
  teacherId?: number,
  batchId?: number,
  roomId?: number,
): ClassCancellationRecord | null {
  const list = getClassCancellations();
  const tName = teacherId !== undefined && teacherId >= 0 ? (teachers[teacherId] || "").toLowerCase().trim() : "";
  const bName = batchId !== undefined && batchId >= 0 ? (batches[batchId] || "").toLowerCase().trim() : "";
  const rName = roomId !== undefined && roomId >= 0 ? (rooms[roomId] || "").toLowerCase().trim() : "";

  const match = list.find((c) => {
    if (c.status !== "active") return false;
    if (c.day !== day || c.slot !== slot) return false;

    const hasTeacherFilter = teacherId !== undefined && teacherId >= 0;
    const hasBatchFilter = batchId !== undefined && batchId >= 0;
    const hasRoomFilter = roomId !== undefined && roomId >= 0;

    const teacherMatches =
      hasTeacherFilter &&
      (c.teacher === teacherId || (tName !== "" && c.teacherName.toLowerCase().trim() === tName));
    const batchMatches =
      hasBatchFilter &&
      (c.batch === batchId || (bName !== "" && normalizeBatchLabel(c.batchName) === normalizeBatchLabel(bName)));
    const roomMatches =
      hasRoomFilter &&
      (c.room === roomId || (rName !== "" && c.roomName.toLowerCase().trim() === rName));

    // When both teacher and batch of a specific lecture entry are supplied, require both to match
    // (prevents cancelling one parallel section from falsely cancelling another instructor's lecture)
    if (hasTeacherFilter && hasBatchFilter) {
      return teacherMatches && batchMatches;
    }
    if (hasTeacherFilter && hasRoomFilter) {
      return teacherMatches && roomMatches;
    }
    if (hasBatchFilter && hasRoomFilter) {
      return batchMatches && roomMatches;
    }
    if (hasTeacherFilter) return teacherMatches;
    if (hasBatchFilter) return batchMatches;
    if (hasRoomFilter) return roomMatches;
    return false;
  });
  return match || null;
}

/**
 * Returns all active cancellations that affect a specific student batch or course
 */
export function getStudentCancellations(
  batchNameOrId?: string | number,
): ClassCancellationRecord[] {
  const all = getClassCancellations().filter((c) => c.status === "active");
  if (batchNameOrId === undefined || batchNameOrId === null) return all;

  if (typeof batchNameOrId === "number") {
    const bName = batches[batchNameOrId] || "";
    return all.filter((c) => c.batch === batchNameOrId || (bName && batchesMatch(c.batchName, bName)));
  }

  const needle = String(batchNameOrId).trim();
  if (!needle) return all;

  return all.filter((c) => batchesMatch(c.batchName, needle));
}

export function getTodayPktDateString(refDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(refDate);
  const find = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${find("year")}-${find("month")}-${find("day")}`;
}

export function getTodayPktDayIndex(refDate: Date = new Date()): number | null {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: "short",
  }).format(refDate);
  const idx = ["Mon", "Tue", "Wed", "Thu", "Fri"].indexOf(short);
  return idx >= 0 ? idx : null;
}

export function isCancellationForToday(
  c: ClassCancellationRecord,
  refDate: Date = new Date(),
): boolean {
  const todayDate = getTodayPktDateString(refDate);
  if (c.targetDate && c.targetDate === todayDate) return true;
  const todayDayIdx = getTodayPktDayIndex(refDate);
  if (todayDayIdx !== null && c.day === todayDayIdx) return true;
  return false;
}

export interface StudentCancellationMatchContext {
  studentBatch?: string | null;
  pinnedBatch?: number | null;
  customSchedule?: ClassEntry[];
  activeBatchId?: number | null;
  allowFallbackActiveBatch?: boolean;
}

/**
 * Determines whether a cancellation record belongs to the student's batch,
 * pinned batch, custom enrolled courses, or fallback active batch view.
 */
export function matchesStudentCancellationContext(
  c: ClassCancellationRecord,
  ctx: StudentCancellationMatchContext,
): boolean {
  const studentBatch = (ctx.studentBatch || "").trim();
  const pinnedBatch = ctx.pinnedBatch ?? null;
  const pinnedBatchName = pinnedBatch !== null ? (batches[pinnedBatch] || "").trim() : "";
  const customSchedule = ctx.customSchedule || [];

  if (studentBatch && batchesMatch(c.batchName, studentBatch)) {
    return true;
  }

  if (
    pinnedBatch !== null &&
    (c.batch === pinnedBatch || batchesMatch(c.batchName, pinnedBatchName))
  ) {
    return true;
  }

  if (customSchedule.length > 0) {
    const matchesCustomCourse = customSchedule.some((entry) => {
      const entryBatch = batches[entry.batch] || "";
      const entrySubject = subjects[entry.subject] || "";
      const entryTeacher = entry.teacher >= 0 ? teachers[entry.teacher] || "" : "";

      const sameBatch = entry.batch === c.batch || batchesMatch(entryBatch, c.batchName);
      const sameSubject =
        entry.subject === c.subject ||
        entrySubject.toLowerCase().trim() === c.subjectName.toLowerCase().trim();
      const sameTeacher =
        entry.teacher === c.teacher ||
        (entryTeacher !== "" &&
          entryTeacher.toLowerCase().trim() === c.teacherName.toLowerCase().trim());

      return (sameBatch && sameSubject) || (sameTeacher && sameSubject);
    });
    if (matchesCustomCourse) {
      return true;
    }
  }

  if (ctx.allowFallbackActiveBatch && ctx.activeBatchId !== undefined && ctx.activeBatchId !== null) {
    const activeBatchName = (batches[ctx.activeBatchId] || "").trim();
    if (c.batch === ctx.activeBatchId || batchesMatch(c.batchName, activeBatchName)) {
      return true;
    }
  }

  return false;
}

// -------------------------------------------------------------
// 2. Room Categorization and Utilization Stats
// -------------------------------------------------------------

export function categorizeRoom(name: string): RoomCategory {
  const upper = name.toUpperCase();
  if (upper.startsWith("LT")) return "Lecture Theatres";
  if (
    upper.includes("CS LAB") ||
    upper.includes("COMP") ||
    upper.includes("SOFTWARE") ||
    upper.includes("LAB-") ||
    upper.includes("LAB ") ||
    upper === "LAB"
  ) {
    return "Computer Labs";
  }
  if (
    upper.includes("EE") ||
    upper.includes("PHYSICS") ||
    upper.includes("DLD") ||
    upper.includes("CIRCUIT") ||
    upper.includes("WORKSHOP") ||
    upper.includes("POWER")
  ) {
    return "Engineering Labs";
  }
  if (upper.startsWith("CR") || upper.startsWith("ROOM") || upper.startsWith("LH")) {
    return "Classrooms";
  }
  return "Other";
}

/**
 * Computes full utilization stats and weekly occupancy matrices for all rooms
 */
export function getRoomUtilizationStats(
  rawList?: TimetableRaw,
): RoomUtilizationStat[] {
  const roomNames = rawList ? rawList.r : rooms;
  const rawEntries = rawList ? rawList.e : entries.map((e) => [e.day, e.slot, e.batch, e.room, e.teacher, e.subject, e.repeater ? 1 : 0]);

  const stats: RoomUtilizationStat[] = [];

  for (let rIdx = 0; rIdx < roomNames.length; rIdx++) {
    const roomName = roomNames[rIdx];
    if (!roomName || roomName.toLowerCase() === "tba" || roomName.toLowerCase() === "online") {
      continue;
    }

    const category = categorizeRoom(roomName);

    // Build 5x5 occupancy matrix: [day: 0..4][slot: 0..4]
    const occupancyMatrix: boolean[][] = Array.from({ length: 5 }, () =>
      Array(5).fill(false),
    );

    let totalOccupied = 0;
    const dayCounts = [0, 0, 0, 0, 0];
    const slotCounts = [0, 0, 0, 0, 0];

    for (const [day, slot, , room] of rawEntries) {
      if (room === rIdx && day >= 0 && day < 5 && slot >= 0 && slot < 5) {
        if (!occupancyMatrix[day][slot]) {
          occupancyMatrix[day][slot] = true;
          totalOccupied++;
          dayCounts[day]++;
          slotCounts[slot]++;
        }
      }
    }

    // Determine peak day and peak slot
    let maxDayIdx = 0;
    let maxDayVal = dayCounts[0];
    for (let d = 1; d < 5; d++) {
      if (dayCounts[d] > maxDayVal) {
        maxDayVal = dayCounts[d];
        maxDayIdx = d;
      }
    }

    let maxSlotIdx = 0;
    let maxSlotVal = slotCounts[0];
    for (let s = 1; s < 5; s++) {
      if (slotCounts[s] > maxSlotVal) {
        maxSlotVal = slotCounts[s];
        maxSlotIdx = s;
      }
    }

    const utilizationRate = Math.round((totalOccupied / 25) * 100);

    stats.push({
      roomId: rIdx,
      roomName,
      category,
      totalOccupied,
      totalSlots: 25,
      utilizationRate,
      peakDay: DAYS[maxDayIdx],
      peakSlot: SLOTS[maxSlotIdx]?.label || `L${maxSlotIdx + 1}`,
      occupancyMatrix,
    });
  }

  // Sort: highest utilization first
  return stats.sort((a, b) => b.utilizationRate - a.utilizationRate);
}

// -------------------------------------------------------------
// 3. Campus Pulse Real-Time Telemetry Engine
// -------------------------------------------------------------

export function getCampusPulseTelemetry(
  now: Date = new Date(),
  rawList?: TimetableRaw,
): CampusPulseTelemetry {
  const { weekday, hour, minute } = campusParts(now);
  const minutes = hour * 60 + minute;
  const currentDayIndex = weekday >= 1 && weekday <= 5 ? weekday - 1 : null;
  const currentDayLabel = currentDayIndex !== null ? DAYS[currentDayIndex] : "Weekend";

  let livePhase: CampusPulseTelemetry["livePhase"] = "weekend";
  let liveSlotIndex: number | null = null;
  let nextSlotLabel = "";
  let minutesToNextTransition = 0;

  if (currentDayIndex === null) {
    livePhase = "weekend";
    nextSlotLabel = "Monday L1 (8:30 AM)";
  } else if (minutes < SLOTS[0].from) {
    livePhase = "before";
    nextSlotLabel = `L1 (${SLOTS[0].start} AM)`;
    minutesToNextTransition = SLOTS[0].from - minutes;
  } else if (minutes >= SLOTS[SLOTS.length - 1].to) {
    livePhase = "after";
    nextSlotLabel = "Tomorrow L1 (8:30 AM)";
    minutesToNextTransition = 0;
  } else {
    // Check if during a live lecture
    const liveIdx = SLOTS.findIndex((s) => minutes >= s.from && minutes < s.to);
    if (liveIdx >= 0) {
      livePhase = "live";
      liveSlotIndex = liveIdx;
      minutesToNextTransition = SLOTS[liveIdx].to - minutes;
      nextSlotLabel =
        liveIdx + 1 < SLOTS.length
          ? `${SLOTS[liveIdx + 1].label} (${SLOTS[liveIdx + 1].start})`
          : "End of Day";
    } else {
      // Break between lectures
      livePhase = "break";
      const nextIdx = SLOTS.findIndex((s) => minutes < s.from);
      if (nextIdx >= 0) {
        minutesToNextTransition = SLOTS[nextIdx].from - minutes;
        nextSlotLabel = `${SLOTS[nextIdx].label} (${SLOTS[nextIdx].start})`;
      }
    }
  }

  const liveSlotLabel =
    liveSlotIndex !== null
      ? `${SLOTS[liveSlotIndex].label} (${SLOTS[liveSlotIndex].start} - ${SLOTS[liveSlotIndex].end})`
      : "";

  // Classes currently in session
  const classesInSession: CampusPulseTelemetry["classesInSession"] = [];
  const activeTeachers = new Set<string>();
  const occupiedRooms = new Set<number>();

  if (liveSlotIndex !== null && currentDayIndex !== null) {
    // Regular classes
    const activeEntries = rawList
      ? rawList.e.filter((e) => e[0] === currentDayIndex && e[1] === liveSlotIndex)
      : entries.filter((e) => e.day === currentDayIndex && e.slot === liveSlotIndex);

    for (const item of activeEntries) {
      let bIdx: number, rIdx: number, tIdx: number, sIdx: number;
      if (Array.isArray(item)) {
        [, , bIdx, rIdx, tIdx, sIdx] = item;
      } else {
        bIdx = item.batch;
        rIdx = item.room;
        tIdx = item.teacher;
        sIdx = item.subject;
      }

      const bName = rawList ? rawList.b[bIdx] : batches[bIdx] || "";
      const rName = rawList ? rawList.r[rIdx] : rooms[rIdx] || "";
      const tName = rawList ? rawList.t[tIdx] : teachers[tIdx] || "";
      const sName = rawList ? rawList.s[sIdx] : subjects[sIdx] || "";

      // Check if this class is cancelled
      const cancellation = isClassCancelled(
        currentDayIndex,
        liveSlotIndex,
        tIdx,
        bIdx,
        rIdx,
      );

      if (cancellation) {
        classesInSession.push({
          batch: bName,
          course: sName,
          teacher: tName,
          room: rName,
          isCancelled: true,
        });
      } else {
        classesInSession.push({
          batch: bName,
          course: sName,
          teacher: tName,
          room: rName,
        });
        if (tName) activeTeachers.add(tName);
        if (rIdx >= 0) occupiedRooms.add(rIdx);
      }
    }

    // Active Arranged Makeups
    const makeups = getActiveArrangedMakeupClasses(now).filter(
      (m) => m.day === currentDayIndex && m.slot === liveSlotIndex,
    );
    for (const m of makeups) {
      const bName = batches[m.batch] || `Batch #${m.batch}`;
      const rName = rooms[m.room] || `Room #${m.room}`;
      const tName = teachers[m.teacher] || `Teacher #${m.teacher}`;
      const sName = subjects[m.subject] || "Makeup Class";

      classesInSession.push({
        batch: bName,
        course: sName,
        teacher: tName,
        room: rName,
        isMakeup: true,
      });
      if (tName) activeTeachers.add(tName);
      if (m.room >= 0) occupiedRooms.add(m.room);
    }
  }

  const roomList = rawList ? rawList.r : rooms;
  const totalRoomsCount = roomList.filter(
    (r) => r && r.toLowerCase() !== "tba" && r.toLowerCase() !== "online",
  ).length;

  const freeRoomsCount = Math.max(0, totalRoomsCount - occupiedRooms.size);

  // Recent events (cancellations and makeups)
  const cancellations = getClassCancellations();
  const makeups = getArrangedMakeupClasses();
  const recentEvents: CampusPulseTelemetry["recentEvents"] = [];

  for (const c of cancellations.slice(-3).reverse()) {
    recentEvents.push({
      id: c.id,
      type: "cancellation",
      title: `Cancelled: ${c.subjectName} (${c.batchName})`,
      timeAgo: `${c.targetDateLabel} · ${SLOTS[c.slot]?.label || ""}`,
      details: `Teacher ${c.teacherName} marked class unavailable. Venue ${c.roomName} is released back to free.`,
    });
  }

  for (const m of makeups.slice(-3).reverse()) {
    recentEvents.push({
      id: m.id,
      type: "makeup_scheduled",
      title: `Makeup: ${subjects[m.subject] || "Class"} (${batches[m.batch] || ""})`,
      timeAgo: `${m.targetDateLabel || "Scheduled"} · ${SLOTS[m.slot]?.label || ""}`,
      details: `Arranged in ${rooms[m.room] || "Room"} by ${teachers[m.teacher] || "Faculty"}.`,
    });
  }

  return {
    timestamp: now.toISOString(),
    livePhase,
    currentDayIndex,
    currentDayLabel,
    liveSlotIndex,
    liveSlotLabel,
    nextSlotLabel,
    minutesToNextTransition,
    classesInSessionCount: classesInSession.filter((c) => !c.isCancelled).length,
    activeTeachersCount: activeTeachers.size,
    freeRoomsCount,
    occupiedRoomsCount: occupiedRooms.size,
    totalRoomsCount,
    classesInSession,
    recentEvents: recentEvents.slice(0, 5),
  };
}
