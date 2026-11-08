import type {
  TimetableRaw,
  TimetableDiffSummary,
  DetailedTimetableDiff,
  DetailedDiffItem,
} from "./timetable-types.ts";
import { DAYS, SLOTS } from "./timetable-types.ts";

/**
 * Computes difference between two timetable versions.
 */
export function computeTimetableDiff(
  oldTimetable: TimetableRaw | null,
  newTimetable: TimetableRaw,
): TimetableDiffSummary {
  if (!oldTimetable || !oldTimetable.e) {
    return {
      addedCount: newTimetable.e.length,
      removedCount: 0,
      modifiedCount: 0,
      affectedTeachers: Array.from(new Set(newTimetable.t.filter(Boolean))),
      affectedBatches: Array.from(new Set(newTimetable.b.filter(Boolean))),
    };
  }

  // Key: `${day}|${slot}|${batchName}` -> details
  const oldMap = new Map<string, { room: string; teacher: string; course: string }>();
  for (const entry of oldTimetable.e) {
    const day = entry[0];
    const slot = entry[1];
    const batch = oldTimetable.b[entry[2]] || "";
    const room = oldTimetable.r[entry[3]] || "";
    const teacher = oldTimetable.t[entry[4]] || "";
    const course = oldTimetable.s[entry[5]] || "";
    const key = `${day}|${slot}|${batch}|${course}`;
    oldMap.set(key, { room, teacher, course });
  }

  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;
  const affectedTeachers = new Set<string>();
  const affectedBatches = new Set<string>();

  const newKeys = new Set<string>();

  for (const entry of newTimetable.e) {
    const day = entry[0];
    const slot = entry[1];
    const batch = newTimetable.b[entry[2]] || "";
    const room = newTimetable.r[entry[3]] || "";
    const teacher = newTimetable.t[entry[4]] || "";
    const course = newTimetable.s[entry[5]] || "";
    const key = `${day}|${slot}|${batch}|${course}`;
    newKeys.add(key);

    const oldMatch = oldMap.get(key);
    if (!oldMatch) {
      addedCount++;
      if (batch) affectedBatches.add(batch);
      if (teacher) affectedTeachers.add(teacher);
    } else {
      if (oldMatch.room !== room || oldMatch.teacher !== teacher) {
        modifiedCount++;
        if (batch) affectedBatches.add(batch);
        if (teacher) affectedTeachers.add(teacher);
        if (oldMatch.teacher) affectedTeachers.add(oldMatch.teacher);
      }
    }
  }

  for (const [key, oldVal] of oldMap.entries()) {
    if (!newKeys.has(key)) {
      removedCount++;
      const parts = key.split("|");
      const batch = parts[2];
      if (batch) affectedBatches.add(batch);
      if (oldVal.teacher) affectedTeachers.add(oldVal.teacher);
    }
  }

  return {
    addedCount,
    removedCount,
    modifiedCount,
    affectedTeachers: Array.from(affectedTeachers).filter(Boolean).sort(),
    affectedBatches: Array.from(affectedBatches).filter(Boolean).sort(),
  };
}

/**
 * Computes deep visual diff item-by-item for the Timetable Diff Viewer.
 */
export function computeDetailedTimetableDiff(
  oldTimetable: TimetableRaw | null,
  newTimetable: TimetableRaw,
): DetailedTimetableDiff {
  const added: DetailedDiffItem[] = [];
  const removed: DetailedDiffItem[] = [];
  const modified: DetailedDiffItem[] = [];
  const affectedTeachers = new Set<string>();
  const affectedBatches = new Set<string>();
  let unchangedCount = 0;

  if (!oldTimetable || !oldTimetable.e) {
    for (const entry of newTimetable.e) {
      const day = entry[0];
      const slot = entry[1];
      const batch = newTimetable.b[entry[2]] || "";
      const room = newTimetable.r[entry[3]] || "";
      const teacher = newTimetable.t[entry[4]] || "";
      const course = newTimetable.s[entry[5]] || "";

      if (batch) affectedBatches.add(batch);
      if (teacher) affectedTeachers.add(teacher);

      added.push({
        type: "added",
        day,
        slot,
        dayLabel: DAYS[day] || `Day ${day}`,
        slotLabel: SLOTS[slot]?.label || `Slot ${slot}`,
        batch,
        course,
        newDetails: { room, teacher },
      });
    }

    return {
      added,
      removed,
      modified,
      unchangedCount: 0,
      affectedTeachers: Array.from(affectedTeachers).sort(),
      affectedBatches: Array.from(affectedBatches).sort(),
    };
  }

  // Map old entries: key = `${day}|${slot}|${batch}|${course}`
  const oldMap = new Map<
    string,
    { day: number; slot: number; batch: string; course: string; room: string; teacher: string }
  >();

  for (const entry of oldTimetable.e) {
    const day = entry[0];
    const slot = entry[1];
    const batch = oldTimetable.b[entry[2]] || "";
    const room = oldTimetable.r[entry[3]] || "";
    const teacher = oldTimetable.t[entry[4]] || "";
    const course = oldTimetable.s[entry[5]] || "";
    const key = `${day}|${slot}|${batch}|${course}`;
    oldMap.set(key, { day, slot, batch, course, room, teacher });
  }

  const matchedOldKeys = new Set<string>();

  for (const entry of newTimetable.e) {
    const day = entry[0];
    const slot = entry[1];
    const batch = newTimetable.b[entry[2]] || "";
    const room = newTimetable.r[entry[3]] || "";
    const teacher = newTimetable.t[entry[4]] || "";
    const course = newTimetable.s[entry[5]] || "";
    const key = `${day}|${slot}|${batch}|${course}`;

    const oldMatch = oldMap.get(key);
    if (!oldMatch) {
      // Could this be a modified slot/day for the same batch & course?
      added.push({
        type: "added",
        day,
        slot,
        dayLabel: DAYS[day] || `Day ${day}`,
        slotLabel: SLOTS[slot]?.label || `Slot ${slot}`,
        batch,
        course,
        newDetails: { room, teacher },
      });
      if (batch) affectedBatches.add(batch);
      if (teacher) affectedTeachers.add(teacher);
    } else {
      matchedOldKeys.add(key);
      const changes: string[] = [];
      if (oldMatch.room !== room) {
        changes.push(`Room moved: ${oldMatch.room || "TBA"} → ${room || "TBA"}`);
      }
      if (oldMatch.teacher !== teacher) {
        changes.push(`Teacher changed: ${oldMatch.teacher || "TBA"} → ${teacher || "TBA"}`);
      }

      if (changes.length > 0) {
        modified.push({
          type: "modified",
          day,
          slot,
          dayLabel: DAYS[day] || `Day ${day}`,
          slotLabel: SLOTS[slot]?.label || `Slot ${slot}`,
          batch,
          course,
          oldDetails: { room: oldMatch.room, teacher: oldMatch.teacher },
          newDetails: { room, teacher },
          changes,
        });
        if (batch) affectedBatches.add(batch);
        if (teacher) affectedTeachers.add(teacher);
        if (oldMatch.teacher) affectedTeachers.add(oldMatch.teacher);
      } else {
        unchangedCount++;
      }
    }
  }

  // Find removed entries
  for (const [key, oldVal] of oldMap.entries()) {
    if (!matchedOldKeys.has(key)) {
      removed.push({
        type: "removed",
        day: oldVal.day,
        slot: oldVal.slot,
        dayLabel: DAYS[oldVal.day] || `Day ${oldVal.day}`,
        slotLabel: SLOTS[oldVal.slot]?.label || `Slot ${oldVal.slot}`,
        batch: oldVal.batch,
        course: oldVal.course,
        oldDetails: { room: oldVal.room, teacher: oldVal.teacher },
      });
      if (oldVal.batch) affectedBatches.add(oldVal.batch);
      if (oldVal.teacher) affectedTeachers.add(oldVal.teacher);
    }
  }

  return {
    added,
    removed,
    modified,
    unchangedCount,
    affectedTeachers: Array.from(affectedTeachers).sort(),
    affectedBatches: Array.from(affectedBatches).sort(),
  };
}

