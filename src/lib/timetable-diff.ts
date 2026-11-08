import type { TimetableRaw, TimetableDiffSummary } from "./timetable-types.ts";

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
