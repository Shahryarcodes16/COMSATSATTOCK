/**
 * Type definitions for CUI Attock Timetable Management
 */

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export const SLOTS = [
  { label: "L1", start: "8:30", end: "10:00" },
  { label: "L2", start: "10:00", end: "11:30" },
  { label: "L3", start: "11:30", end: "1:15" },
  { label: "L4", start: "1:35", end: "3:00" },
  { label: "L5", start: "3:00", end: "4:30" },
] as const;

export interface TimetableRaw {
  b: string[]; // Batches list
  r: string[]; // Rooms list
  t: string[]; // Teachers list
  s: string[]; // Subjects / Courses list
  e: number[][]; // [day, slot, batchIdx, roomIdx, teacherIdx, subjectIdx, repeater]
}

export interface TimetableClassRow {
  day: number; // 0..4 (Mon..Fri)
  slot: number; // 0..4 (L1..L5)
  batch: string;
  course: string;
  teacher: string;
  room: string;
  repeater?: boolean;
}

export interface ClashDetail {
  id: string;
  type: "room_clash" | "teacher_clash" | "batch_clash" | "missing_field" | "invalid_time";
  severity: "error" | "warning";
  message: string;
  day: number;
  slot: number;
  dayLabel: string;
  slotLabel: string;
  classA?: { batch: string; course: string; teacher: string; room: string };
  classB?: { batch: string; course: string; teacher: string; room: string };
}

export interface TimetableStats {
  totalLectures: number;
  batchesCount: number;
  roomsCount: number;
  teachersCount: number;
}

export interface TimetableDiffSummary {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  affectedTeachers: string[];
  affectedBatches: string[];
}

export interface TimetableSummary extends TimetableStats {
  changes?: TimetableDiffSummary;
}

export interface TimetableValidationResult {
  isValid: boolean;
  totalErrors: number;
  totalWarnings: number;
  clashes: ClashDetail[];
  stats: TimetableStats;
}

export interface TimetableVersion {
  id: string;
  versionName: string;
  timetableData: TimetableRaw;
  status: "published" | "archived" | "scheduled";
  isActive: boolean;
  publishedAt: string;
  publishedBy: string;
  scheduledFor?: string | null;
  summary?: TimetableSummary;
  createdAt: string;
}

export interface TimetableDraft {
  id: string;
  name: string;
  timetableData: TimetableRaw;
  stats: TimetableStats;
  updatedAt: string;
  createdBy: string;
}
