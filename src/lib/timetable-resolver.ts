/**
 * Smart Conflict Resolver for CUI Attock Timetables
 * Automatically computes conflict-free alternative slots for room clashes,
 * teacher double-bookings, and batch overlaps, with 1-click apply and auto-resolve all.
 */

import type {
  TimetableRaw,
  ClashDetail,
  ConflictAlternative,
} from "./timetable-types.ts";
import { DAYS, SLOTS } from "./timetable-types.ts";

/**
 * Checks if a specific room is free at a given day & slot in the timetable
 */
export function isRoomFreeInRaw(
  raw: TimetableRaw,
  roomIdx: number,
  day: number,
  slot: number,
  excludeEntryIndex: number = -1,
): boolean {
  for (let i = 0; i < raw.e.length; i++) {
    if (i === excludeEntryIndex) continue;
    const [d, s, , r] = raw.e[i];
    if (d === day && s === slot && r === roomIdx) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a specific teacher is free at a given day & slot in the timetable
 */
export function isTeacherFreeInRaw(
  raw: TimetableRaw,
  teacherIdx: number,
  day: number,
  slot: number,
  excludeEntryIndex: number = -1,
): boolean {
  if (teacherIdx < 0) return true;
  const teacherName = raw.t[teacherIdx]?.toLowerCase() || "";
  if (teacherName === "tba" || teacherName === "visiting" || teacherName === "n/a") {
    return true;
  }

  for (let i = 0; i < raw.e.length; i++) {
    if (i === excludeEntryIndex) continue;
    const [d, s, , , t] = raw.e[i];
    if (d === day && s === slot && t === teacherIdx) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a specific batch is free at a given day & slot in the timetable
 */
export function isBatchFreeInRaw(
  raw: TimetableRaw,
  batchIdx: number,
  day: number,
  slot: number,
  excludeEntryIndex: number = -1,
): boolean {
  if (batchIdx < 0) return true;
  for (let i = 0; i < raw.e.length; i++) {
    if (i === excludeEntryIndex) continue;
    const [d, s, b, , , , rep] = raw.e[i];
    // Ignore repeaters
    if (rep === 1) continue;
    if (d === day && s === slot && b === batchIdx) {
      return false;
    }
  }
  return true;
}

/**
 * Categorize room index to find similar room substitutions
 */
function getRoomType(name: string): "lab" | "lt" | "cr" {
  const upper = name.toUpperCase();
  if (upper.includes("LAB") || upper.startsWith("LAB")) return "lab";
  if (upper.startsWith("LT")) return "lt";
  return "cr";
}

/**
 * Finds top 3 conflict-free alternative slots for a detected clash
 */
export function findConflictAlternatives(
  clash: ClashDetail,
  raw: TimetableRaw,
): ConflictAlternative[] {
  const alternatives: ConflictAlternative[] = [];

  // Identify matching entry index for classB (the conflicting class we typically move)
  let entryIndexB = -1;
  let entryIndexA = -1;

  for (let i = 0; i < raw.e.length; i++) {
    const [d, s, b, r, t, sub] = raw.e[i];
    if (d === clash.day && s === clash.slot) {
      const bName = raw.b[b];
      const rName = raw.r[r];
      const tName = raw.t[t];
      const sName = raw.s[sub];

      if (
        clash.classB &&
        bName === clash.classB.batch &&
        sName === clash.classB.course &&
        (tName === clash.classB.teacher || !clash.classB.teacher)
      ) {
        entryIndexB = i;
      } else if (
        clash.classA &&
        bName === clash.classA.batch &&
        sName === clash.classA.course
      ) {
        entryIndexA = i;
      }
    }
  }

  // If entry B is not found, default to finding any entry matching the slot and classB
  const targetEntryIdx = entryIndexB >= 0 ? entryIndexB : entryIndexA;
  if (targetEntryIdx < 0) return [];

  const [, , batchIdx, origRoomIdx, teacherIdx] = raw.e[targetEntryIdx];
  const origRoomName = raw.r[origRoomIdx] || "Room";
  const origRoomType = getRoomType(origRoomName);

  // 1. If it's a room clash, check if another room of similar type is free at the EXACT SAME day and slot!
  if (clash.type === "room_clash") {
    for (let rIdx = 0; rIdx < raw.r.length; rIdx++) {
      if (rIdx === origRoomIdx) continue;
      const roomCandidate = raw.r[rIdx];
      if (getRoomType(roomCandidate) === origRoomType) {
        if (isRoomFreeInRaw(raw, rIdx, clash.day, clash.slot, targetEntryIdx)) {
          alternatives.push({
            id: `alt-same-slot-${rIdx}`,
            targetClass: "classB",
            day: clash.day,
            slot: clash.slot,
            dayLabel: DAYS[clash.day],
            slotLabel: SLOTS[clash.slot]?.label || `Slot ${clash.slot}`,
            roomIdx: rIdx,
            roomName: roomCandidate,
            score: 100, // Maximum score: Keep same day/slot, just reassign room!
            reason: `Keep same time (${DAYS[clash.day]} ${SLOTS[clash.slot]?.label}), move to free venue ${roomCandidate}`,
          });
        }
      }
    }
  }

  // 2. Scan all days (0..4) and all slots (0..4) to find slots where Batch, Teacher, and Room are all free
  for (let d = 0; d < DAYS.length; d++) {
    for (let s = 0; s < SLOTS.length; s++) {
      // Skip the clashing slot itself
      if (d === clash.day && s === clash.slot) continue;

      // Check if batch and teacher are free in this slot
      const batchFree = isBatchFreeInRaw(raw, batchIdx, d, s, targetEntryIdx);
      const teacherFree = isTeacherFreeInRaw(raw, teacherIdx, d, s, targetEntryIdx);

      if (!batchFree || !teacherFree) continue;

      // Check if original room is free
      const origFree = isRoomFreeInRaw(raw, origRoomIdx, d, s, targetEntryIdx);
      if (origFree) {
        let score = 80;
        if (d === clash.day) score += 15; // Same day preferred
        if (s <= 2) score += 5; // Morning slots preferred over late afternoon

        alternatives.push({
          id: `alt-${d}-${s}-${origRoomIdx}`,
          targetClass: "classB",
          day: d,
          slot: s,
          dayLabel: DAYS[d],
          slotLabel: `${SLOTS[s]?.label} (${SLOTS[s]?.start} - ${SLOTS[s]?.end})`,
          roomIdx: origRoomIdx,
          roomName: origRoomName,
          score,
          reason: `Relocate to ${DAYS[d]} ${SLOTS[s]?.label} in original room ${origRoomName}`,
        });
      } else {
        // Find alternative room of same type in this slot
        for (let rIdx = 0; rIdx < raw.r.length; rIdx++) {
          if (rIdx === origRoomIdx) continue;
          const roomCandidate = raw.r[rIdx];
          if (getRoomType(roomCandidate) === origRoomType) {
            if (isRoomFreeInRaw(raw, rIdx, d, s, targetEntryIdx)) {
              let score = 65;
              if (d === clash.day) score += 15;
              alternatives.push({
                id: `alt-${d}-${s}-${rIdx}`,
                targetClass: "classB",
                day: d,
                slot: s,
                dayLabel: DAYS[d],
                slotLabel: `${SLOTS[s]?.label} (${SLOTS[s]?.start} - ${SLOTS[s]?.end})`,
                roomIdx: rIdx,
                roomName: roomCandidate,
                score,
                reason: `Move to ${DAYS[d]} ${SLOTS[s]?.label} in ${roomCandidate}`,
              });
              break; // Take best candidate room per slot
            }
          }
        }
      }
    }
  }

  // Sort by score descending and return top 3
  alternatives.sort((a, b) => b.score - a.score);
  return alternatives.slice(0, 3);
}

/**
 * Applies a chosen conflict resolution alternative to the raw timetable,
 * returning a new cloned TimetableRaw with the conflict resolved.
 */
export function applyConflictResolution(
  raw: TimetableRaw,
  clash: ClashDetail,
  alternative: ConflictAlternative,
): TimetableRaw {
  const nextEntries = raw.e.map((entry) => [...entry]);

  // Find index of entry to move
  let targetEntryIdx = -1;
  for (let i = 0; i < nextEntries.length; i++) {
    const [d, s, b, , , sub] = nextEntries[i];
    if (d === clash.day && s === clash.slot) {
      const bName = raw.b[b];
      const sName = raw.s[sub];
      if (
        clash.classB &&
        bName === clash.classB.batch &&
        sName === clash.classB.course
      ) {
        targetEntryIdx = i;
        break;
      }
    }
  }

  // If not found, try matching by classA
  if (targetEntryIdx < 0 && clash.classA) {
    for (let i = 0; i < nextEntries.length; i++) {
      const [d, s, b, , , sub] = nextEntries[i];
      if (d === clash.day && s === clash.slot) {
        const bName = raw.b[b];
        const sName = raw.s[sub];
        if (bName === clash.classA.batch && sName === clash.classA.course) {
          targetEntryIdx = i;
          break;
        }
      }
    }
  }

  if (targetEntryIdx >= 0) {
    nextEntries[targetEntryIdx][0] = alternative.day;
    nextEntries[targetEntryIdx][1] = alternative.slot;
    nextEntries[targetEntryIdx][3] = alternative.roomIdx;
  }

  return {
    ...raw,
    e: nextEntries,
  };
}

/**
 * Automatically iterates through all detected clashes in a raw timetable
 * and resolves each one with its best available alternative slot.
 */
export function autoResolveAllConflicts(
  raw: TimetableRaw,
  clashes: ClashDetail[],
): {
  resolvedRaw: TimetableRaw;
  resolvedCount: number;
  unresolvedCount: number;
} {
  let currentRaw = {
    ...raw,
    e: raw.e.map((e) => [...e]),
  };

  let resolvedCount = 0;
  let unresolvedCount = 0;

  for (const clash of clashes) {
    const alternatives = findConflictAlternatives(clash, currentRaw);
    if (alternatives.length > 0) {
      currentRaw = applyConflictResolution(currentRaw, clash, alternatives[0]);
      resolvedCount++;
    } else {
      unresolvedCount++;
    }
  }

  return {
    resolvedRaw: currentRaw,
    resolvedCount,
    unresolvedCount,
  };
}
