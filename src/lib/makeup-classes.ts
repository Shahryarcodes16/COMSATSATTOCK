/**
 * Arranged Makeup & Extra Classes Module
 * Allows faculty to schedule makeup classes in vacant rooms/labs,
 * automatically updating the status of rooms, faculty, and student batches across the campus timetable.
 */
import {
  batches,
  rooms,
  teachers,
  subjects,
  type ClassEntry,
} from "./schedule";

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
  createdAt: string; // ISO string
  createdByEmail: string;
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
 * Schedules a new makeup class, immediately reserving the room and teacher
 */
export function addMakeupClass(
  params: Omit<MakeupClassRecord, "id" | "createdAt">,
): MakeupClassRecord {
  const current = getArrangedMakeupClasses();
  const id = `makeup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record: MakeupClassRecord = {
    ...params,
    id,
    createdAt: new Date().toISOString(),
  };

  const next = [...current, record];
  saveArrangedMakeupClasses(next);
  return record;
}

/**
 * Cancels an arranged makeup class, freeing the room and teacher
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
 * Checks if a specific room is occupied by an arranged makeup class in a given slot
 */
export function getRoomMakeupClass(
  roomId: number,
  day: number,
  slot: number,
): MakeupClassRecord | null {
  const list = getArrangedMakeupClasses();
  return (
    list.find(
      (m) => m.room === roomId && m.day === day && m.slot === slot,
    ) || null
  );
}

/**
 * Checks if a specific teacher is occupied by an arranged makeup class in a given slot
 */
export function getTeacherMakeupClass(
  teacherId: number,
  day: number,
  slot: number,
): MakeupClassRecord | null {
  const list = getArrangedMakeupClasses();
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
