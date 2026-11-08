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

// -------------------------------------------------------------
// Advanced Features Types: Resolver, Heatmap, Pulse, Analytics
// -------------------------------------------------------------

export interface ConflictAlternative {
  id: string;
  targetClass: "classA" | "classB";
  day: number;
  slot: number;
  dayLabel: string;
  slotLabel: string;
  roomIdx: number;
  roomName: string;
  score: number; // Higher is better (e.g. same day, minimal disturbance)
  reason: string;
}

export interface DetailedDiffItem {
  type: "added" | "removed" | "modified";
  day: number;
  slot: number;
  dayLabel: string;
  slotLabel: string;
  batch: string;
  course: string;
  oldDetails?: { room: string; teacher: string };
  newDetails?: { room: string; teacher: string };
  changes?: string[];
}

export interface DetailedTimetableDiff {
  added: DetailedDiffItem[];
  removed: DetailedDiffItem[];
  modified: DetailedDiffItem[];
  unchangedCount: number;
  affectedTeachers: string[];
  affectedBatches: string[];
}

export type RoomCategory = "Classrooms" | "Computer Labs" | "Engineering Labs" | "Lecture Theatres" | "Other";

export interface RoomUtilizationStat {
  roomId: number;
  roomName: string;
  category: RoomCategory;
  totalOccupied: number; // occupied slots out of 25 (5 days x 5 slots)
  totalSlots: number; // 25
  utilizationRate: number; // 0..100%
  peakDay: string;
  peakSlot: string;
  occupancyMatrix: boolean[][]; // [day: 0..4][slot: 0..4]
}

export interface ClassCancellationRecord {
  id: string;
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
  targetDate: string; // YYYY-MM-DD
  targetDateLabel: string;
  reason: string;
  cancelledAt: string;
  cancelledByEmail: string;
  settledByMakeupId?: string;
  status: "active" | "settled";
}

export interface CampusPulseTelemetry {
  timestamp: string;
  livePhase: "live" | "break" | "before" | "after" | "weekend";
  currentDayIndex: number | null;
  currentDayLabel: string;
  liveSlotIndex: number | null;
  liveSlotLabel: string;
  nextSlotLabel: string;
  minutesToNextTransition: number;
  classesInSessionCount: number;
  activeTeachersCount: number;
  freeRoomsCount: number;
  occupiedRoomsCount: number;
  totalRoomsCount: number;
  classesInSession: {
    batch: string;
    course: string;
    teacher: string;
    room: string;
    isMakeup?: boolean;
    isCancelled?: boolean;
  }[];
  recentEvents: {
    id: string;
    type: "cancellation" | "makeup_scheduled" | "room_freed";
    title: string;
    timeAgo: string;
    details: string;
  }[];
}

export interface SubjectLectureStat {
  subjectId: number;
  subjectName: string;
  batchNames: string[];
  weeklySlotsCount: number;
  isDoubleLectureL3: boolean; // 11:30 - 1:15 rule (Slot L3) counted as 2 if only 1 lecture/week
  weeklyEffectiveCount: number; // If isDoubleLectureL3 is true, 1 session counts as 2
  semesterProjectedCount: number; // based on 16-week semester
  conductedCountToDate: number;
  labHours: number;
  isLab: boolean;
}

export interface FacultyAnalytics {
  teacherId: number;
  teacherName: string;
  email: string;
  semesterTargetLectures: number; // standard 32 contact lectures per theory course
  regularConductedCount: number;
  doubleLectureBonusCount: number;
  labSessionsCount: number;
  totalEffectiveConducted: number;
  percentageComplete: number;
  makeupsConductedCount: number;
  cancellationsDebtCount: number;
  pendingDebts: ClassCancellationRecord[];
  courses: SubjectLectureStat[];
}

