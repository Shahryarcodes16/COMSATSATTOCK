import {
  DAYS,
  SLOTS,
  batches,
  rooms,
  subjects,
  teachers,
  type ClassEntry,
} from "@/lib/schedule";

export const MY_SCHEDULE_KEY = "cui-attock-my-schedule-v1";

export function getEntryKey(entry: ClassEntry): string {
  return `${entry.day}-${entry.slot}-${entry.batch}-${entry.subject}-${entry.room}-${entry.teacher}`;
}

export function loadCustomSchedule(): ClassEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MY_SCHEDULE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load custom schedule", e);
  }
  return [];
}

export function saveCustomSchedule(list: ClassEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MY_SCHEDULE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("cui:custom-schedule-update", { detail: list }));
  } catch (e) {
    console.error("Failed to save custom schedule", e);
  }
}

export type ScheduleClash = {
  day: number;
  slot: number;
  entries: ClassEntry[];
};

export function findScheduleClashes(list: ClassEntry[]): ScheduleClash[] {
  const map = new Map<string, ClassEntry[]>();
  for (const entry of list) {
    const key = `${entry.day}-${entry.slot}`;
    const group = map.get(key) ?? [];
    group.push(entry);
    map.set(key, group);
  }

  const clashes: ScheduleClash[] = [];
  for (const [key, items] of map.entries()) {
    if (items.length > 1) {
      const [d, s] = key.split("-").map(Number);
      clashes.push({
        day: d,
        slot: s,
        entries: items,
      });
    }
  }
  return clashes;
}

/**
 * Generates an iCalendar (.ics) file string with recurring weekly events.
 * Compatible with Google Calendar, Apple Calendar, Outlook, and Samsung Calendar.
 */
export function generateIcsCalendar(list: ClassEntry[], calendarTitle = "My COMSATS Attock Timetable"): string {
  const dayCodes = ["MO", "TU", "WE", "TH", "FR"];
  // Base reference date: Monday 5 October 2026
  const baseYear = 2026;
  const baseMonth = 10; // October
  const baseDay = 5; // Monday

  const slotTimes = [
    { startH: 8, startM: 30, endH: 10, endM: 0 },
    { startH: 10, startM: 0, endH: 11, endM: 30 },
    { startH: 11, startM: 30, endH: 13, endM: 0 },
    { startH: 13, startM: 30, endH: 15, endM: 0 },
    { startH: 15, startM: 0, endH: 16, endM: 30 },
  ];

  const pad = (n: number) => String(n).padStart(2, "0");

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//COMSATS University Islamabad Attock//My Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendarTitle}`,
    "X-WR-TIMEZONE:Asia/Karachi",
  ];

  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const time = slotTimes[entry.slot] || slotTimes[0];
    const dayOffset = entry.day; // 0=Mon, 1=Tue...
    const eventDay = baseDay + dayOffset;

    const startStr = `${baseYear}${pad(baseMonth)}${pad(eventDay)}T${pad(time.startH)}${pad(time.startM)}00`;
    const endStr = `${baseYear}${pad(baseMonth)}${pad(eventDay)}T${pad(time.endH)}${pad(time.endM)}00`;

    const subName = subjects[entry.subject] || "Course";
    const roomName = entry.room >= 0 ? rooms[entry.room] : "Room TBA";
    const teacherName = entry.teacher >= 0 ? teachers[entry.teacher] : "Faculty TBA";
    const batchName = entry.batch >= 0 ? batches[entry.batch] : "";
    const dayCode = dayCodes[entry.day] || "MO";

    ics.push("BEGIN:VEVENT");
    ics.push(`UID:cui-attock-${entry.day}-${entry.slot}-${entry.subject}-${i}@cuiatk.edu.pk`);
    ics.push(`DTSTAMP:20261005T000000Z`);
    ics.push(`DTSTART;TZID=Asia/Karachi:${startStr}`);
    ics.push(`DTEND;TZID=Asia/Karachi:${endStr}`);
    ics.push(`RRULE:FREQ=WEEKLY;BYDAY=${dayCode};UNTIL=20270201T000000Z`);
    ics.push(`SUMMARY:${subName}${entry.repeater ? " (Repeater)" : ""}`);
    ics.push(`LOCATION:${roomName}`);
    ics.push(
      `DESCRIPTION:Faculty: ${teacherName}\\nSection: ${batchName}\\nRoom: ${roomName}\\nCOMSATS Attock Campus Timetable`,
    );
    // 15-minute popup reminder
    ics.push("BEGIN:VALARM");
    ics.push("ACTION:DISPLAY");
    ics.push(`DESCRIPTION:Upcoming class: ${subName} in ${roomName}`);
    ics.push("TRIGGER:-PT15M");
    ics.push("END:VALARM");
    ics.push("END:VEVENT");
  }

  ics.push("END:VCALENDAR");
  return ics.join("\r\n");
}

export function downloadIcsFile(list: ClassEntry[], filename = "cui-attock-my-schedule.ics"): void {
  const content = generateIcsCalendar(list);
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
