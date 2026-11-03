import datesheetData from "@/data/midterm-datesheet.json";
import { getCampusMinutes } from "@/lib/schedule";

export interface ExamEntry {
  id: number;
  section: string;
  originalDate: string;
  date: string;
  isRescheduled: boolean;
  rawTime: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseTitle: string;
  className: string;
  strength: number;
  instructor: string;
  room: string;
  invigilators: string;
}

export interface DatesheetPayload {
  title: string;
  notice: string;
  expirationIso: string;
  totalExams: number;
  dates: string[];
  classes: string[];
  exams: ExamEntry[];
}

export const DATESHEET: DatesheetPayload = datesheetData as DatesheetPayload;

const REPEATER_STORAGE_KEY = "cui_datesheet_repeater_exams_v1";

/**
 * Returns whether the midterm datesheet is currently active
 * Automatically returns false after 2026-11-12 at 19:30 (Pakistan Time)
 */
export function isDatesheetActive(now?: Date | null): boolean {
  try {
    const current = now ?? new Date();
    const expireTime = new Date(DATESHEET.expirationIso).getTime();
    return current.getTime() < expireTime;
  } catch {
    return true;
  }
}

export type ExamStatus = "completed" | "in_progress" | "today" | "upcoming";

export interface ExamTimeInfo {
  status: ExamStatus;
  badgeLabel: string;
  timeRemaining: string;
  isToday: boolean;
}

/**
 * Computes live countdown, completion status, and time remaining for an exam
 */
export function getExamTimeInfo(exam: ExamEntry, now?: Date | null): ExamTimeInfo {
  const currentTime = now ?? new Date();
  // Exam date string: "2026-11-12"
  const [yearStr, monthStr, dayStr] = exam.date.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  // Parse start and end time from rawTime (e.g., "1010-1140" or "0830-1000")
  const [sRaw, eRaw] = exam.rawTime.split("-");
  const sHour = parseInt(sRaw.slice(0, 2), 10);
  const sMin = parseInt(sRaw.slice(2, 4), 10);
  const eHour = parseInt(eRaw.slice(0, 2), 10);
  const eMin = parseInt(eRaw.slice(2, 4), 10);

  // Create Date objects in Pakistan local time (UTC+5)
  // Build ISO string: "2026-11-12T10:10:00+05:00"
  const startIso = `${exam.date}T${String(sHour).padStart(2, "0")}:${String(sMin).padStart(2, "0")}:00+05:00`;
  const endIso = `${exam.date}T${String(eHour).padStart(2, "0")}:${String(eMin).padStart(2, "0")}:00+05:00`;

  const examStart = new Date(startIso).getTime();
  const examEnd = new Date(endIso).getTime();
  const current = currentTime.getTime();

  // Check if today
  const campus = getCampusMinutes(currentTime);
  const todayIso = currentTime.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  const isToday = todayIso === exam.date;

  if (current >= examEnd) {
    return {
      status: "completed",
      badgeLabel: "Completed ✔️",
      timeRemaining: "Paper concluded",
      isToday,
    };
  }

  if (current >= examStart && current < examEnd) {
    const minsLeft = Math.round((examEnd - current) / 60000);
    return {
      status: "in_progress",
      badgeLabel: "In Progress 📝",
      timeRemaining: `${minsLeft} min${minsLeft === 1 ? "" : "s"} left`,
      isToday: true,
    };
  }

  // Exam is upcoming
  const msDiff = examStart - current;
  const daysDiff = Math.floor(msDiff / (1000 * 60 * 60 * 24));
  const hoursDiff = Math.floor((msDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minsDiff = Math.floor((msDiff % (1000 * 60 * 60)) / (1000 * 60));

  let timeRemaining = "";
  if (daysDiff > 0) {
    timeRemaining = `in ${daysDiff}d ${hoursDiff}h`;
  } else if (hoursDiff > 0) {
    timeRemaining = `in ${hoursDiff}h ${minsDiff}m`;
  } else {
    timeRemaining = `in ${minsDiff} mins`;
  }

  return {
    status: isToday ? "today" : "upcoming",
    badgeLabel: isToday ? "Today!" : `In ${daysDiff} day${daysDiff === 1 ? "" : "s"}`,
    timeRemaining,
    isToday,
  };
}

export interface ExamClash {
  exam1: ExamEntry;
  exam2: ExamEntry;
  date: string;
  time: string;
}

/**
 * Detects clashes when repeaters select courses across multiple batches
 */
export function detectExamClashes(list: ExamEntry[]): ExamClash[] {
  const clashes: ExamClash[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      // If same date and raw time slot
      if (a.date === b.date && a.rawTime === b.rawTime) {
        clashes.push({
          exam1: a,
          exam2: b,
          date: a.date,
          time: a.startTime,
        });
      }
    }
  }
  return clashes;
}

/**
 * Load saved repeater courses from localStorage
 */
export function loadSavedRepeaterCourseIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REPEATER_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save repeater course IDs to localStorage
 */
export function saveSavedRepeaterCourseIds(ids: number[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REPEATER_STORAGE_KEY, JSON.stringify(ids));
  } catch (err) {
    console.error("Failed to save repeater exams", err);
  }
}

/**
 * Generates an iCalendar (.ics) file string for midterm exams.
 * Compatible with Google Calendar, Apple Calendar, Samsung Calendar, and Outlook.
 */
export function generateDatesheetIcs(
  exams: ExamEntry[],
  calendarTitle = "COMSATS Attock Midterm Datesheet FA26",
): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//COMSATS University Islamabad Attock//Midterm Datesheet//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendarTitle}`,
    "X-WR-TIMEZONE:Asia/Karachi",
  ];

  for (let i = 0; i < exams.length; i++) {
    const exam = exams[i];
    const [y, m, d] = exam.date.split("-").map(Number);
    const [sRaw, eRaw] = exam.rawTime.split("-");
    const sH = parseInt(sRaw.slice(0, 2), 10);
    const sM = parseInt(sRaw.slice(2, 4), 10);
    const eH = parseInt(eRaw.slice(0, 2), 10);
    const eM = parseInt(eRaw.slice(2, 4), 10);

    const startStr = `${y}${pad(m)}${pad(d)}T${pad(sH)}${pad(sM)}00`;
    const endStr = `${y}${pad(m)}${pad(d)}T${pad(eH)}${pad(eM)}00`;

    ics.push("BEGIN:VEVENT");
    ics.push(`UID:cui-exam-${exam.id}-${i}@cuiatk.edu.pk`);
    ics.push(`DTSTAMP:20261101T000000Z`);
    ics.push(`DTSTART;TZID=Asia/Karachi:${startStr}`);
    ics.push(`DTEND;TZID=Asia/Karachi:${endStr}`);
    ics.push(`SUMMARY:EXAM: ${exam.courseCode} - ${exam.courseTitle}`);
    ics.push(`LOCATION:${exam.room}`);
    ics.push(
      `DESCRIPTION:Class: ${exam.className}\\nInstructor: ${exam.instructor}\\nInvigilators: ${exam.invigilators || "TBA"}\\nRoom: ${exam.room}${exam.isRescheduled ? "\\nNote: Shifted from 4 Nov to 12 Nov" : ""}\\nCOMSATS Attock Campus Midterm Exams FA26`,
    );
    // 60-minute popup reminder
    ics.push("BEGIN:VALARM");
    ics.push("ACTION:DISPLAY");
    ics.push(`DESCRIPTION:Upcoming Exam: ${exam.courseTitle} in ${exam.room}`);
    ics.push("TRIGGER:-PT60M");
    ics.push("END:VALARM");
    ics.push("END:VEVENT");
  }

  ics.push("END:VCALENDAR");
  return ics.join("\r\n");
}

/**
 * Downloads .ics calendar file for students
 */
export function downloadDatesheetIcsFile(
  exams: ExamEntry[],
  filename = "cui-midterm-datesheet.ics",
): void {
  const content = generateDatesheetIcs(exams);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
