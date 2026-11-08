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
import type {
  CampusPulseTelemetry,
  ClassCancellationRecord,
  RoomCategory,
  RoomUtilizationStat,
  TimetableRaw,
} from "./timetable-types.ts";
import { CAMPUS_TIME_ZONE } from "./campus.ts";

export const CANCELLATIONS_STORAGE_KEY = "cui_class_cancellations_v1";

let memoryCancellations: ClassCancellationRecord[] = [];

// -------------------------------------------------------------
// 1. Dynamic Class Cancellations Store
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
      new CustomEvent("cui:class-cancellations-updated", { detail: list }),
    );
  } catch (err) {
    console.error("Failed to save class cancellations", err);
  }
}

/**
 * Marks a scheduled class as cancelled by faculty.
 * Immediately frees the room in Room Radar and notifies the campus schedule cascade.
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
  const current = getClassCancellations();
  const now = new Date();

  // Format today's date in PKT
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

  // Friendly date label
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

  const next = [...current, record];
  saveClassCancellations(next);
  return record;
}

/**
 * Removes or undoes a class cancellation
 */
export function removeClassCancellation(id: string): void {
  const current = getClassCancellations();
  const next = current.filter((c) => c.id !== id);
  saveClassCancellations(next);
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
  const match = list.find((c) => {
    if (c.status !== "active") return false;
    if (c.day !== day || c.slot !== slot) return false;
    if (teacherId !== undefined && teacherId >= 0 && c.teacher === teacherId) return true;
    if (batchId !== undefined && batchId >= 0 && c.batch === batchId) return true;
    if (roomId !== undefined && roomId >= 0 && c.room === roomId) return true;
    return false;
  });
  return match || null;
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
