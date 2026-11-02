import {
  DAYS,
  SLOTS,
  teachers,
  subjects,
  rooms,
  batches,
  forTeacher,
  type ClassEntry,
  timeLabel,
} from "@/lib/schedule";
import { getFacultyByTeacher } from "@/lib/faculty";

export type OfficeSlotState = "free" | "teaching";

export interface TeacherSlotInfo {
  slotIndex: number;
  label: string;
  start: string;
  end: string;
  state: OfficeSlotState;
  classEntry?: ClassEntry;
  subjectName?: string;
  roomName?: string;
  batchName?: string;
}

export interface TeacherDayOfficeHours {
  dayIndex: number;
  dayName: string;
  slots: TeacherSlotInfo[];
  freeSlotsCount: number;
  teachingSlotsCount: number;
  freeHours: number;
}

export type TeacherLiveStatus =
  | { state: "teaching"; headline: string; detail: string; room: string; subject: string; batch: string }
  | { state: "free_now"; headline: string; detail: string; freeUntil: string; nextClass?: string }
  | { state: "break"; headline: string; detail: string; until: string }
  | { state: "before_hours"; headline: string; detail: string }
  | { state: "after_hours"; headline: string; detail: string }
  | { state: "weekend"; headline: string; detail: string };

export interface TeacherOfficeProfile {
  teacherId: number;
  name: string;
  department: string;
  email?: string;
  days: TeacherDayOfficeHours[];
  totalWeeklyFreeSlots: number;
  totalWeeklyTeachingSlots: number;
  weeklyFreeHours: number;
  liveStatus: TeacherLiveStatus;
}

/**
 * Check if the teacher has any class during day and slot
 */
export function getTeacherClassAt(
  teacherId: number,
  day: number,
  slot: number,
): ClassEntry | undefined {
  const list = forTeacher(teacherId);
  return list.find((e) => e.day === day && e.slot === slot);
}

/**
 * Compute the full weekly office hours and live consultation status for a faculty member
 */
export function getTeacherOfficeProfile(
  teacherId: number,
  campusDayIndex: number | null,
  campusMinutes: number,
): TeacherOfficeProfile {
  const teacherName = teachers[teacherId] ?? "Faculty";
  const faculty = getFacultyByTeacher(teacherId, teacherName);
  const department = faculty?.department ?? "Academic Faculty";
  const email = faculty?.email;

  const days: TeacherDayOfficeHours[] = [];
  let totalWeeklyFreeSlots = 0;
  let totalWeeklyTeachingSlots = 0;

  for (let d = 0; d < 5; d++) {
    const slots: TeacherSlotInfo[] = [];
    let freeCount = 0;
    let teachCount = 0;

    for (let s = 0; s < 5; s++) {
      const cls = getTeacherClassAt(teacherId, d, s);
      const slotDef = SLOTS[s];

      if (cls) {
        teachCount++;
        slots.push({
          slotIndex: s,
          label: slotDef.label,
          start: slotDef.start,
          end: slotDef.end,
          state: "teaching",
          classEntry: cls,
          subjectName: subjects[cls.subject],
          roomName: cls.room >= 0 ? rooms[cls.room] : undefined,
          batchName: batches[cls.batch],
        });
      } else {
        freeCount++;
        slots.push({
          slotIndex: s,
          label: slotDef.label,
          start: slotDef.start,
          end: slotDef.end,
          state: "free",
        });
      }
    }

    totalWeeklyFreeSlots += freeCount;
    totalWeeklyTeachingSlots += teachCount;

    days.push({
      dayIndex: d,
      dayName: DAYS[d],
      slots,
      freeSlotsCount: freeCount,
      teachingSlotsCount: teachCount,
      freeHours: freeCount * 1.5,
    });
  }

  // Calculate live status for campus right now
  const liveStatus = computeTeacherLiveStatus(
    teacherId,
    days,
    campusDayIndex,
    campusMinutes,
  );

  return {
    teacherId,
    name: teacherName,
    department,
    email,
    days,
    totalWeeklyFreeSlots,
    totalWeeklyTeachingSlots,
    weeklyFreeHours: totalWeeklyFreeSlots * 1.5,
    liveStatus,
  };
}

function computeTeacherLiveStatus(
  teacherId: number,
  days: TeacherDayOfficeHours[],
  campusDayIndex: number | null,
  campusMinutes: number,
): TeacherLiveStatus {
  // 1. Weekend
  if (campusDayIndex === null || campusDayIndex < 0 || campusDayIndex > 4) {
    return {
      state: "weekend",
      headline: "Weekend · Campus Closed",
      detail: "Office hours resume Monday at 08:30 AM",
    };
  }

  // 2. Before campus hours (< 08:30)
  if (campusMinutes < 8 * 60 + 30) {
    return {
      state: "before_hours",
      headline: "Before Campus Hours",
      detail: "Campus lectures & office hours begin at 08:30 AM",
    };
  }

  // 3. After campus hours (> 16:30)
  if (campusMinutes >= 16 * 60 + 30) {
    return {
      state: "after_hours",
      headline: "Campus Hours Ended",
      detail: "Classes and office hours have concluded for today",
    };
  }

  const todayData = days[campusDayIndex];
  if (!todayData) {
    return {
      state: "after_hours",
      headline: "Not Available",
      detail: "No schedule information",
    };
  }

  // Check which slot is currently happening
  for (let s = 0; s < SLOTS.length; s++) {
    const slotDef = SLOTS[s];
    if (campusMinutes >= slotDef.from && campusMinutes < slotDef.to) {
      const currentSlot = todayData.slots[s];

      if (currentSlot.state === "teaching" && currentSlot.classEntry) {
        return {
          state: "teaching",
          headline: `In Class: ${currentSlot.subjectName || "Lecture"}`,
          detail: `Teaching in ${currentSlot.roomName || "Room"} until ${timeLabel(slotDef.to)}`,
          room: currentSlot.roomName || "Classroom",
          subject: currentSlot.subjectName || "Subject",
          batch: currentSlot.batchName || "Batch",
        };
      } else {
        // Find until when they are free
        let freeUntilSlot = s;
        while (freeUntilSlot + 1 < SLOTS.length && todayData.slots[freeUntilSlot + 1].state === "free") {
          freeUntilSlot++;
        }
        const freeUntilTime = timeLabel(SLOTS[freeUntilSlot].to);
        const nextTeachSlot = todayData.slots.slice(s + 1).find((st) => st.state === "teaching");

        return {
          state: "free_now",
          headline: "🟢 Free in Office Right Now!",
          detail: `Available for consultation until ${freeUntilTime}`,
          freeUntil: freeUntilTime,
          nextClass: nextTeachSlot
            ? `Next class: ${nextTeachSlot.subjectName} at ${nextTeachSlot.start}`
            : "No more classes today",
        };
      }
    }
  }

  // Midday break (e.g. between L3 13:15 and L4 13:35)
  if (campusMinutes >= 13 * 60 + 15 && campusMinutes < 13 * 60 + 35) {
    return {
      state: "break",
      headline: "Lunch & Prayer Break",
      detail: "Break time on campus until 01:35 PM",
      until: "01:35 PM",
    };
  }

  return {
    state: "after_hours",
    headline: "Campus Hours Ended",
    detail: "Consultation resumes tomorrow morning",
  };
}

/**
 * Generate a prefilled mailto URL for requesting a faculty meeting / office consultation
 */
export function generateMeetingEmailHref(
  teacherName: string,
  teacherEmail: string,
  freeSlotText?: string,
): string {
  const subject = encodeURIComponent(`[Student Consultation Request] - ${teacherName}`);
  const body = encodeURIComponent(
    `Respected ${teacherName},\n\n` +
      `I am a student at COMSATS University Islamabad, Attock Campus. I would like to request a brief meeting during your available office hours.\n\n` +
      (freeSlotText ? `Proposed Time / Slot: ${freeSlotText}\n` : `Proposed Time: [Please specify Day and Time]\n`) +
      `Topic / Agenda: [e.g. Course clarification, Final Year Project guidance, Quiz/Assignment query]\n\n` +
      `Thank you very much for your time and guidance.\n\n` +
      `Respectfully,\n` +
      `[Your Name]\n` +
      `Registration No: [e.g. FA23-BCS-014]\n` +
      `Department / Batch: [e.g. BCS-5A]`,
  );

  return `mailto:${teacherEmail}?subject=${subject}&body=${body}`;
}
