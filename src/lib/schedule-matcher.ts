/**
 * Smart Schedule Matcher & Extra/Makeup Class Finder
 * Computes teacher-student batch availability overlaps and dynamically discovers
 * free lecture theatres, classrooms, and labs across the entire campus.
 */
import {
  entries,
  rooms,
  teachers,
  batches,
  subjects,
  roomGroup,
  forTeacher,
  getAllEntries,
  type ClassEntry,
  type RoomGroup,
} from "./schedule";
import { isClassCancelled } from "./campus-pulse";

export interface FreeRoomInfo {
  id: number;
  name: string;
  group: RoomGroup;
}

export interface SlotComparisonResult {
  day: number;
  slot: number;
  isTeacherFree: boolean;
  isBatchFree: boolean;
  isBothFree: boolean;
  teacherEntry: {
    subject: string;
    batch: string;
    room: string;
  } | null;
  batchEntry: {
    subject: string;
    teacher: string;
    room: string;
  } | null;
  freeRooms: FreeRoomInfo[];
  freeLabsCount: number;
  freeLTsCount: number;
  freeCRsCount: number;
}

export interface WeekComparisonSummary {
  teacherId: number;
  teacherName: string;
  batchId: number;
  batchName: string;
  totalSlots: number;
  bothFreeSlotsCount: number;
  matrix: SlotComparisonResult[][]; // 5 days x 5 slots
}

/**
 * Computes the complete 5-day x 5-slot comparison matrix between a teacher and a student batch.
 */
export function computeScheduleOverlap(
  teacherId: number,
  batchId: number,
): WeekComparisonSummary {
  const teacherName = teachers[teacherId] || `Teacher #${teacherId}`;
  const batchName = batches[batchId] || `Batch #${batchId}`;

  // Index entries by day and slot for rapid matching (including dynamic makeup classes)
  const entriesByCell = new Map<string, ClassEntry[]>();
  for (const entry of getAllEntries()) {
    // If a class is cancelled, its teacher, batch, and room are freed
    if (isClassCancelled(entry.day, entry.slot, entry.teacher, entry.batch, entry.room)) {
      continue;
    }
    const key = `${entry.day}-${entry.slot}`;
    const list = entriesByCell.get(key) || [];
    list.push(entry);
    entriesByCell.set(key, list);
  }

  const matrix: SlotComparisonResult[][] = [];
  let bothFreeCount = 0;

  for (let day = 0; day < 5; day++) {
    const daySlots: SlotComparisonResult[] = [];

    for (let slot = 0; slot < 5; slot++) {
      const cellEntries = entriesByCell.get(`${day}-${slot}`) || [];

      // Check Teacher status
      const tEntry = cellEntries.find((e) => e.teacher === teacherId);
      const isTeacherFree = !tEntry;

      // Check Batch status
      const bEntry = cellEntries.find((e) => e.batch === batchId);
      const isBatchFree = !bEntry;

      const isBothFree = isTeacherFree && isBatchFree;
      if (isBothFree) {
        bothFreeCount++;
      }

      // Discover which campus rooms & labs are unoccupied in this cell
      const occupiedRooms = new Set<number>();
      for (const e of cellEntries) {
        occupiedRooms.add(e.room);
      }

      const freeRooms: FreeRoomInfo[] = [];
      let freeLabsCount = 0;
      let freeLTsCount = 0;
      let freeCRsCount = 0;

      if (isBothFree) {
        for (let rId = 0; rId < rooms.length; rId++) {
          if (!occupiedRooms.has(rId)) {
            const name = rooms[rId];
            const group = roomGroup(name);
            freeRooms.push({ id: rId, name, group });

            if (group === "Labs") freeLabsCount++;
            else if (group === "Lecture theatres") freeLTsCount++;
            else if (group === "Classrooms" || group === "Lecture halls") freeCRsCount++;
          }
        }
      }

      daySlots.push({
        day,
        slot,
        isTeacherFree,
        isBatchFree,
        isBothFree,
        teacherEntry: tEntry
          ? {
              subject: subjects[tEntry.subject] || "Subject",
              batch: batches[tEntry.batch] || "Batch",
              room: rooms[tEntry.room] || "Room",
            }
          : null,
        batchEntry: bEntry
          ? {
              subject: subjects[bEntry.subject] || "Subject",
              teacher: teachers[bEntry.teacher] || "Teacher",
              room: rooms[bEntry.room] || "Room",
            }
          : null,
        freeRooms,
        freeLabsCount,
        freeLTsCount,
        freeCRsCount,
      });
    }

    matrix.push(daySlots);
  }

  return {
    teacherId,
    teacherName,
    batchId,
    batchName,
    totalSlots: 25,
    bothFreeSlotsCount: bothFreeCount,
    matrix,
  };
}

/**
 * Computes the complete 5-day x 5-slot comparison matrix between two teachers.
 * Discovers mutual free consultation slots and unoccupied campus rooms/labs/theatres.
 */
export function computeTwoTeachersScheduleOverlap(
  teacher1Id: number,
  teacher2Id: number,
): WeekComparisonSummary {
  const teacher1Name = teachers[teacher1Id] || `Teacher #${teacher1Id}`;
  const teacher2Name = teachers[teacher2Id] || `Teacher #${teacher2Id}`;

  const entriesByCell = new Map<string, ClassEntry[]>();
  for (const entry of getAllEntries()) {
    if (isClassCancelled(entry.day, entry.slot, entry.teacher, entry.batch, entry.room)) {
      continue;
    }
    const key = `${entry.day}-${entry.slot}`;
    const list = entriesByCell.get(key) || [];
    list.push(entry);
    entriesByCell.set(key, list);
  }

  const matrix: SlotComparisonResult[][] = [];
  let bothFreeCount = 0;

  for (let day = 0; day < 5; day++) {
    const daySlots: SlotComparisonResult[] = [];

    for (let slot = 0; slot < 5; slot++) {
      const cellEntries = entriesByCell.get(`${day}-${slot}`) || [];

      const t1Entry = cellEntries.find((e) => e.teacher === teacher1Id);
      const isTeacher1Free = !t1Entry;

      const t2Entry = cellEntries.find((e) => e.teacher === teacher2Id);
      const isTeacher2Free = !t2Entry;

      const isBothFree = isTeacher1Free && isTeacher2Free;
      if (isBothFree) {
        bothFreeCount++;
      }

      const occupiedRooms = new Set<number>();
      for (const e of cellEntries) {
        occupiedRooms.add(e.room);
      }

      const freeRooms: FreeRoomInfo[] = [];
      let freeLabsCount = 0;
      let freeLTsCount = 0;
      let freeCRsCount = 0;

      if (isBothFree) {
        for (let rId = 0; rId < rooms.length; rId++) {
          if (!occupiedRooms.has(rId)) {
            const name = rooms[rId];
            const group = roomGroup(name);
            freeRooms.push({ id: rId, name, group });

            if (group === "Labs") freeLabsCount++;
            else if (group === "Lecture theatres") freeLTsCount++;
            else if (group === "Classrooms" || group === "Lecture halls") freeCRsCount++;
          }
        }
      }

      daySlots.push({
        day,
        slot,
        isTeacherFree: isTeacher1Free,
        isBatchFree: isTeacher2Free,
        isBothFree,
        teacherEntry: t1Entry
          ? {
              subject: subjects[t1Entry.subject] || "Subject",
              batch: batches[t1Entry.batch] || "Batch",
              room: rooms[t1Entry.room] || "Room",
            }
          : null,
        batchEntry: t2Entry
          ? {
              subject: subjects[t2Entry.subject] || "Subject",
              teacher: teachers[t2Entry.teacher] || "Teacher",
              room: rooms[t2Entry.room] || "Room",
            }
          : null,
        freeRooms,
        freeLabsCount,
        freeLTsCount,
        freeCRsCount,
      });
    }

    matrix.push(daySlots);
  }

  return {
    teacherId: teacher1Id,
    teacherName: teacher1Name,
    batchId: teacher2Id,
    batchName: teacher2Name,
    totalSlots: 25,
    bothFreeSlotsCount: bothFreeCount,
    matrix,
  };
}

/**
 * Finds all classes taught by a specific teacher (including active makeup classes)
 */
export function getTeacherClasses(teacherId: number): ClassEntry[] {
  return forTeacher(teacherId);
}

/**
 * Gets unique batches taught by a specific teacher
 */
export function getBatchesForTeacher(teacherId: number): number[] {
  const set = new Set<number>();
  for (const entry of forTeacher(teacherId)) {
    set.add(entry.batch);
  }
  return Array.from(set).sort((a, b) => a - b);
}
