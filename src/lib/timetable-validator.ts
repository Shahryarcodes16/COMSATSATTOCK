import type {
  TimetableRaw,
  TimetableClassRow,
  TimetableValidationResult,
  ClashDetail,
  TimetableStats,
} from "./timetable-types.ts";
import { DAYS, SLOTS } from "./timetable-types.ts";

/**
 * Validates a parsed timetable and detects room, teacher, and batch conflicts.
 */
export function validateTimetable(
  raw: TimetableRaw,
): TimetableValidationResult {
  const clashes: ClashDetail[] = [];
  const entries = raw.e;

  // Track allocations: key -> list of entry indices
  const roomSlotMap = new Map<string, number[]>();
  const teacherSlotMap = new Map<string, number[]>();
  const batchSlotMap = new Map<string, number[]>();

  for (let i = 0; i < entries.length; i++) {
    const [day, slot, batchIdx, roomIdx, teacherIdx, subjectIdx, repeater] = entries[i];
    const isRepeater = repeater === 1;

    // Check invalid time/day bounds
    if (day < 0 || day >= DAYS.length || slot < 0 || slot >= SLOTS.length) {
      clashes.push({
        id: `invalid-time-${i}`,
        type: "invalid_time",
        severity: "error",
        message: `Row #${i + 1} has invalid day (${day}) or lecture slot (${slot}).`,
        day: Math.max(0, Math.min(4, day)),
        slot: Math.max(0, Math.min(4, slot)),
        dayLabel: DAYS[day] || `Day ${day}`,
        slotLabel: SLOTS[slot]?.label || `Slot ${slot}`,
        classA: {
          batch: raw.b[batchIdx] || `Batch #${batchIdx}`,
          course: raw.s[subjectIdx] || `Subject #${subjectIdx}`,
          teacher: raw.t[teacherIdx] || `Teacher #${teacherIdx}`,
          room: raw.r[roomIdx] || `Room #${roomIdx}`,
        },
      });
      continue;
    }

    const dayName = DAYS[day];
    const slotLabel = `${SLOTS[slot].label} (${SLOTS[slot].start} - ${SLOTS[slot].end})`;

    // Check missing fields
    const batchName = raw.b[batchIdx]?.trim();
    const courseName = raw.s[subjectIdx]?.trim();
    const teacherName = raw.t[teacherIdx]?.trim();
    const roomName = raw.r[roomIdx]?.trim();

    if (!batchName || !courseName || !roomName) {
      clashes.push({
        id: `missing-field-${i}`,
        type: "missing_field",
        severity: "error",
        message: `Class at ${dayName} ${slotLabel} is missing required field(s): ${[
          !batchName && "Batch",
          !courseName && "Course",
          !roomName && "Room",
        ]
          .filter(Boolean)
          .join(", ")}.`,
        day,
        slot,
        dayLabel: dayName,
        slotLabel,
        classA: {
          batch: batchName || "Missing",
          course: courseName || "Missing",
          teacher: teacherName || "Unassigned",
          room: roomName || "Missing",
        },
      });
    }

    // 1. Room Clash Check (Same room, same day, same slot)
    if (roomName && roomName.toLowerCase() !== "tba" && roomName.toLowerCase() !== "online") {
      const roomKey = `${day}|${slot}|${roomIdx}`;
      const existing = roomSlotMap.get(roomKey);
      if (existing) {
        existing.push(i);
      } else {
        roomSlotMap.set(roomKey, [i]);
      }
    }

    // 2. Teacher Clash Check (Same teacher, same day, same slot)
    if (
      teacherName &&
      teacherName.toLowerCase() !== "tba" &&
      teacherName.toLowerCase() !== "visiting" &&
      teacherName.toLowerCase() !== "n/a"
    ) {
      const teacherKey = `${day}|${slot}|${teacherIdx}`;
      const existing = teacherSlotMap.get(teacherKey);
      if (existing) {
        existing.push(i);
      } else {
        teacherSlotMap.set(teacherKey, [i]);
      }
    }

    // 3. Batch Overlap Check (Same batch, same day, same slot)
    // Repeaters are allowed to have parallel classes if cross-batch
    if (batchName && !isRepeater) {
      const batchKey = `${day}|${slot}|${batchIdx}`;
      const existing = batchSlotMap.get(batchKey);
      if (existing) {
        existing.push(i);
      } else {
        batchSlotMap.set(batchKey, [i]);
      }
    }
  }

  // Evaluate room clashes
  for (const [key, indices] of roomSlotMap.entries()) {
    if (indices.length > 1) {
      const [dayStr, slotStr, roomIdxStr] = key.split("|");
      const day = Number(dayStr);
      const slot = Number(slotStr);
      const roomName = raw.r[Number(roomIdxStr)];
      const dayName = DAYS[day];
      const slotName = SLOTS[slot].label;

      for (let j = 1; j < indices.length; j++) {
        const idxA = indices[0];
        const idxB = indices[j];
        const entryA = entries[idxA];
        const entryB = entries[idxB];

        clashes.push({
          id: `room-clash-${idxA}-${idxB}`,
          type: "room_clash",
          severity: "error",
          message: `Room Conflict: "${roomName}" is booked for multiple classes on ${dayName} during ${slotName}.`,
          day,
          slot,
          dayLabel: dayName,
          slotLabel: slotName,
          classA: {
            batch: raw.b[entryA[2]] || "Unknown",
            course: raw.s[entryA[5]] || "Unknown",
            teacher: raw.t[entryA[4]] || "Unknown",
            room: roomName,
          },
          classB: {
            batch: raw.b[entryB[2]] || "Unknown",
            course: raw.s[entryB[5]] || "Unknown",
            teacher: raw.t[entryB[4]] || "Unknown",
            room: roomName,
          },
        });
      }
    }
  }

  // Evaluate teacher clashes
  for (const [key, indices] of teacherSlotMap.entries()) {
    if (indices.length > 1) {
      const [dayStr, slotStr, teacherIdxStr] = key.split("|");
      const day = Number(dayStr);
      const slot = Number(slotStr);
      const teacherName = raw.t[Number(teacherIdxStr)];
      const dayName = DAYS[day];
      const slotName = SLOTS[slot].label;

      for (let j = 1; j < indices.length; j++) {
        const idxA = indices[0];
        const idxB = indices[j];
        const entryA = entries[idxA];
        const entryB = entries[idxB];

        clashes.push({
          id: `teacher-clash-${idxA}-${idxB}`,
          type: "teacher_clash",
          severity: "error",
          message: `Teacher Double-Booking: "${teacherName}" is scheduled for 2 lectures simultaneously on ${dayName} during ${slotName}.`,
          day,
          slot,
          dayLabel: dayName,
          slotLabel: slotName,
          classA: {
            batch: raw.b[entryA[2]] || "Unknown",
            course: raw.s[entryA[5]] || "Unknown",
            teacher: teacherName,
            room: raw.r[entryA[3]] || "Unknown",
          },
          classB: {
            batch: raw.b[entryB[2]] || "Unknown",
            course: raw.s[entryB[5]] || "Unknown",
            teacher: teacherName,
            room: raw.r[entryB[3]] || "Unknown",
          },
        });
      }
    }
  }

  // Evaluate batch clashes
  for (const [key, indices] of batchSlotMap.entries()) {
    if (indices.length > 1) {
      const [dayStr, slotStr, batchIdxStr] = key.split("|");
      const day = Number(dayStr);
      const slot = Number(slotStr);
      const batchName = raw.b[Number(batchIdxStr)];
      const dayName = DAYS[day];
      const slotName = SLOTS[slot].label;

      for (let j = 1; j < indices.length; j++) {
        const idxA = indices[0];
        const idxB = indices[j];
        const entryA = entries[idxA];
        const entryB = entries[idxB];

        clashes.push({
          id: `batch-clash-${idxA}-${idxB}`,
          type: "batch_clash",
          severity: "error",
          message: `Batch Overlap: "${batchName}" has overlapping regular classes on ${dayName} at ${slotName}.`,
          day,
          slot,
          dayLabel: dayName,
          slotLabel: slotName,
          classA: {
            batch: batchName,
            course: raw.s[entryA[5]] || "Unknown",
            teacher: raw.t[entryA[4]] || "Unknown",
            room: raw.r[entryA[3]] || "Unknown",
          },
          classB: {
            batch: batchName,
            course: raw.s[entryB[5]] || "Unknown",
            teacher: raw.t[entryB[4]] || "Unknown",
            room: raw.r[entryB[3]] || "Unknown",
          },
        });
      }
    }
  }

  const errorsCount = clashes.filter((c) => c.severity === "error").length;
  const warningsCount = clashes.filter((c) => c.severity === "warning").length;

  const stats: TimetableStats = {
    totalLectures: raw.e.length,
    batchesCount: raw.b.length,
    roomsCount: raw.r.length,
    teachersCount: raw.t.length,
  };

  return {
    isValid: errorsCount === 0,
    totalErrors: errorsCount,
    totalWarnings: warningsCount,
    clashes,
    stats,
  };
}
