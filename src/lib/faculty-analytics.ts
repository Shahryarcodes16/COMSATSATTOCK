/**
 * Faculty Analytics, Live Lecture Counter & Make-up Debt Ledger
 * Implements calendar-aware class counting, semester quota tracking (32 lectures),
 * the 11:30-1:15 double lecture counting rule, and make-up debt management.
 */

import {
  DAYS,
  SLOTS,
  forTeacher,
  subjects,
  batches,
  rooms,
  campusParts,
  type ClassEntry,
} from "./schedule.ts";
import {
  getTeacherArrangedMakeupClasses,
  type MakeupClassRecord,
} from "./makeup-classes.ts";
import { getClassCancellations } from "./campus-pulse.ts";
import type {
  ClassCancellationRecord,
  FacultyAnalytics,
  SubjectLectureStat,
  TimetableRaw,
} from "./timetable-types.ts";
import { CAMPUS_TIME_ZONE } from "./campus.ts";

// Fall 2026 Semester Start Date at CUI Attock
export const SEMESTER_START_DATE = new Date("2026-10-05T00:00:00+05:00");
export const SEMESTER_TOTAL_WEEKS = 16;
export const STANDARD_THEORY_QUOTA = 32; // 32 lectures per 3-credit theory course

/**
 * Calculates how many semester weeks have elapsed since semester start.
 */
export function getElapsedSemesterWeeks(
  now: Date = new Date(),
  startDate: Date = SEMESTER_START_DATE,
): {
  weeksElapsed: number;
  isBeforeSemester: boolean;
  isAfterSemester: boolean;
} {
  const diffMs = now.getTime() - startDate.getTime();
  if (diffMs < 0) {
    return { weeksElapsed: 0, isBeforeSemester: true, isAfterSemester: false };
  }
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeksElapsed = Math.min(
    SEMESTER_TOTAL_WEEKS,
    Math.max(1, Math.floor(diffDays / 7) + 1),
  );
  return {
    weeksElapsed,
    isBeforeSemester: false,
    isAfterSemester: diffDays >= SEMESTER_TOTAL_WEEKS * 7,
  };
}

/**
 * Computes deep faculty analytics, counting lectures/labs with real-time calendar date,
 * strictly applying the 11:30 to 1:15 double lecture rule, and computing make-up debts.
 */
export function computeFacultyAnalytics(
  teacherId: number,
  teacherName: string,
  teacherEmail: string = "",
  now: Date = new Date(),
  rawTimetable?: TimetableRaw,
): FacultyAnalytics {
  // Retrieve scheduled classes for this teacher
  let teacherEntries: ClassEntry[] = [];
  if (rawTimetable) {
    for (const [day, slot, batch, room, teacher, subject, rep] of rawTimetable.e) {
      if (teacher === teacherId) {
        teacherEntries.push({
          day,
          slot,
          batch,
          room,
          teacher,
          subject,
          repeater: rep === 1,
        });
      }
    }
  } else {
    teacherEntries = forTeacher(teacherId);
  }

  // Filter out makeup classes so we analyze base schedule first
  const baseEntries = teacherEntries.filter((e) => !e.isMakeup);

  // Group by subject to analyze theory vs lab and slot frequency
  const subjectMap = new Map<number, ClassEntry[]>();
  for (const entry of baseEntries) {
    const list = subjectMap.get(entry.subject);
    if (list) list.push(entry);
    else subjectMap.set(entry.subject, [entry]);
  }

  const courseStats: SubjectLectureStat[] = [];
  let totalWeeklyScheduledSlots = 0;
  let totalWeeklyEffectiveContactCount = 0;
  let totalDoubleLectureBonusWeekly = 0;
  let totalLabSessionsCount = 0;

  for (const [subjId, list] of subjectMap.entries()) {
    const subjName = subjects[subjId] || (rawTimetable?.s[subjId] ?? `Course #${subjId}`);
    const isLab =
      subjName.toLowerCase().includes("lab") ||
      list.some((e) => {
        const rName = rooms[e.room] || (rawTimetable?.r[e.room] ?? "");
        return rName.toLowerCase().includes("lab");
      });

    const batchNames = Array.from(
      new Set(
        list.map((e) => batches[e.batch] || (rawTimetable?.b[e.batch] ?? `Batch #${e.batch}`)),
      ),
    );

    const weeklySlotsCount = list.length;
    totalWeeklyScheduledSlots += weeklySlotsCount;

    if (isLab) {
      totalLabSessionsCount += weeklySlotsCount;
      courseStats.push({
        subjectId: subjId,
        subjectName: subjName,
        batchNames,
        weeklySlotsCount,
        isDoubleLectureL3: false,
        weeklyEffectiveCount: weeklySlotsCount,
        semesterProjectedCount: weeklySlotsCount * SEMESTER_TOTAL_WEEKS,
        conductedCountToDate: 0, // Will be computed below
        labHours: weeklySlotsCount * 3, // Each lab slot typically 3 hours
        isLab: true,
      });
      continue;
    }

    // -------------------------------------------------------------
    // CRUCIAL RULE: 11:30 to 1:15 class (Slot L3 / index 2)
    // counted as TWO classes if same subject of theory class has not a 2nd class in that week!
    // -------------------------------------------------------------
    const hasSlotL3 = list.some((e) => e.slot === 2);
    const isDoubleLectureL3 = weeklySlotsCount === 1 && hasSlotL3;

    let weeklyEffectiveCount = weeklySlotsCount;
    if (isDoubleLectureL3) {
      weeklyEffectiveCount = 2; // Counted as 2 classes in that week!
      totalDoubleLectureBonusWeekly += 1;
    }

    totalWeeklyEffectiveContactCount += weeklyEffectiveCount;

    courseStats.push({
      subjectId: subjId,
      subjectName: subjName,
      batchNames,
      weeklySlotsCount,
      isDoubleLectureL3,
      weeklyEffectiveCount,
      semesterProjectedCount: isDoubleLectureL3
        ? SEMESTER_TOTAL_WEEKS * 2
        : Math.max(STANDARD_THEORY_QUOTA, weeklySlotsCount * SEMESTER_TOTAL_WEEKS),
      conductedCountToDate: 0,
      labHours: 0,
      isLab: false,
    });
  }

  // Calculate calendar-aware conducted classes to date
  const { weeksElapsed, isBeforeSemester } = getElapsedSemesterWeeks(now);
  const { weekday, hour, minute } = campusParts(now);
  const currentMinutes = hour * 60 + minute;
  const currentDayIndex = weekday >= 1 && weekday <= 5 ? weekday - 1 : null;

  let totalRegularConducted = 0;
  let totalBonusConducted = 0;

  if (!isBeforeSemester) {
    const fullWeeksCompleted = Math.max(0, weeksElapsed - 1);

    for (const c of courseStats) {
      // Prior full weeks: each week contributed weeklyEffectiveCount
      let conducted = fullWeeksCompleted * c.weeklyEffectiveCount;

      // Current week: check sessions that have already occurred up to current day/time
      const entriesForCourse = subjectMap.get(c.subjectId) || [];
      for (const e of entriesForCourse) {
        if (currentDayIndex === null) {
          // Weekend: entire week has passed
          conducted += c.isDoubleLectureL3 ? 2 : 1;
        } else if (e.day < currentDayIndex) {
          // Past days in current week
          conducted += c.isDoubleLectureL3 ? 2 : 1;
        } else if (e.day === currentDayIndex) {
          // Today: check if slot end time has passed
          const slotDef = SLOTS[e.slot];
          if (slotDef && currentMinutes >= slotDef.to) {
            conducted += c.isDoubleLectureL3 ? 2 : 1;
          }
        }
      }

      c.conductedCountToDate = conducted;
      totalRegularConducted += conducted;
      if (c.isDoubleLectureL3) {
        totalBonusConducted += Math.floor(conducted / 2);
      }
    }
  }

  // Count active Arranged Makeups conducted by this teacher
  const makeups = getTeacherArrangedMakeupClasses(teacherId);
  const makeupsConductedCount = makeups.filter(
    (m) => m.status === "completed" || m.status === "active",
  ).length;

  // Track Make-up Debt Ledger: Cancellations by this teacher
  const allCancellations = getClassCancellations();
  const pendingDebts = allCancellations.filter(
    (c) => c.teacher === teacherId && c.status === "active",
  );
  const cancellationsDebtCount = pendingDebts.length;

  // Target semester lectures quota
  const theoryCoursesCount = courseStats.filter((c) => !c.isLab).length;
  const semesterTargetLectures =
    theoryCoursesCount > 0 ? theoryCoursesCount * STANDARD_THEORY_QUOTA : 32;

  const totalEffectiveConducted = Math.max(
    0,
    totalRegularConducted + makeupsConductedCount - cancellationsDebtCount,
  );

  const percentageComplete = Math.min(
    100,
    Math.round((totalEffectiveConducted / semesterTargetLectures) * 100),
  );

  return {
    teacherId,
    teacherName,
    email: teacherEmail,
    semesterTargetLectures,
    regularConductedCount: totalRegularConducted,
    doubleLectureBonusCount: totalBonusConducted,
    labSessionsCount: totalLabSessionsCount,
    totalEffectiveConducted,
    percentageComplete,
    makeupsConductedCount,
    cancellationsDebtCount,
    pendingDebts,
    courses: courseStats,
  };
}
