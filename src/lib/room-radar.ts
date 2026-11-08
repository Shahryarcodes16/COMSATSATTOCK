import {
  DAYS,
  SLOTS,
  forRoom,
  isFree,
  roomGroup,
  rooms,
  subjects,
  batches,
  teachers,
  type ClassEntry,
  type RoomGroup,
} from "./schedule.ts";
import { getClassCancellations } from "./campus-pulse.ts";

export interface FreeRoomDetail {
  id: number;
  name: string;
  group: RoomGroup;
  freeSlotsCount: number; // how many consecutive slots from startSlot onwards it is free
  freeUntilTime: string; // e.g. "1:15 PM" or "End of day (4:30 PM)"
  isFreedByCancellation?: boolean; // newly freed because scheduled class was cancelled
  nextClass?: {
    subject: string;
    batch: string;
    teacher: string;
    slot: number;
    startTime: string;
  };
}

/**
 * Calculates all free rooms for a given day and slot, with consecutive free duration,
 * factoring in dynamically cancelled classes.
 */
export function getFreeRoomsForSlot(day: number, slot: number): FreeRoomDetail[] {
  const result: FreeRoomDetail[] = [];
  const cancellations = getClassCancellations();

  for (let roomId = 0; roomId < rooms.length; roomId++) {
    // Exclude classes that are currently cancelled by faculty
    const rawRoomClasses = forRoom(roomId);
    const roomClasses = rawRoomClasses.filter(
      (entry) =>
        !cancellations.some(
          (c) =>
            c.status === "active" &&
            c.day === entry.day &&
            c.slot === entry.slot &&
            c.room === roomId,
        ),
    );

    // If not free at the target slot, skip
    if (!isFree(roomClasses, day, slot, 1)) {
      continue;
    }

    const wasCancelledHere = rawRoomClasses.some(
      (entry) =>
        entry.day === day &&
        entry.slot === slot &&
        cancellations.some(
          (c) =>
            c.status === "active" &&
            c.day === day &&
            c.slot === slot &&
            c.room === roomId,
        ),
    );

    // Count how many consecutive slots from target slot onwards it remains free
    let consecutiveFree = 1;
    for (let nextSlot = slot + 1; nextSlot < SLOTS.length; nextSlot++) {
      if (isFree(roomClasses, day, nextSlot, 1)) {
        consecutiveFree++;
      } else {
        break;
      }
    }

    const lastFreeSlotIndex = slot + consecutiveFree - 1;
    const isFreeRestOfDay = lastFreeSlotIndex === SLOTS.length - 1;
    const freeUntilTime = isFreeRestOfDay
      ? "End of day (4:30 PM)"
      : `${SLOTS[lastFreeSlotIndex]?.end || ""} (${consecutiveFree} slot${consecutiveFree > 1 ? "s" : ""})`;

    // Check if there is an upcoming class today in this room
    let nextClass: FreeRoomDetail["nextClass"] = undefined;
    const upcomingClassSlot = slot + consecutiveFree;
    if (upcomingClassSlot < SLOTS.length) {
      const classEntry = roomClasses.find(
        (e) => e.day === day && e.slot === upcomingClassSlot,
      );
      if (classEntry) {
        nextClass = {
          subject: subjects[classEntry.subject] || "Class",
          batch: batches[classEntry.batch] || "",
          teacher: classEntry.teacher >= 0 ? teachers[classEntry.teacher] : "",
          slot: upcomingClassSlot,
          startTime: SLOTS[upcomingClassSlot]?.start || "",
        };
      }
    }

    result.push({
      id: roomId,
      name: rooms[roomId],
      group: roomGroup(rooms[roomId]),
      freeSlotsCount: consecutiveFree,
      freeUntilTime,
      isFreedByCancellation: wasCancelledHere,
      nextClass,
    });
  }

  // Sort: longest free duration first, then alphabetical by name
  return result.sort((a, b) => {
    if (b.freeSlotsCount !== a.freeSlotsCount) {
      return b.freeSlotsCount - a.freeSlotsCount;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

