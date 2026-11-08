import * as XLSX from "xlsx";
import type { TimetableRaw, TimetableClassRow } from "./timetable-types.ts";
import { DAYS, SLOTS } from "./timetable-types.ts";

/**
 * Normalizes day string to 0..4
 */
export function normalizeDay(value: unknown): number {
  if (typeof value === "number") {
    if (value >= 0 && value <= 4) return value;
    if (value >= 1 && value <= 5) return value - 1; // 1-based Monday
  }
  const s = String(value || "").trim().toLowerCase();
  if (s.includes("mon")) return 0;
  if (s.includes("tue")) return 1;
  if (s.includes("wed")) return 2;
  if (s.includes("thu")) return 3;
  if (s.includes("fri")) return 4;
  if (s === "0" || s === "1" || s === "2" || s === "3" || s === "4") return Number(s);
  return -1;
}

/**
 * Normalizes slot/time string to 0..4 (L1..L5)
 */
export function normalizeSlot(value: unknown): number {
  if (typeof value === "number") {
    if (value >= 0 && value <= 4) return value;
    if (value >= 1 && value <= 5) return value - 1; // 1-based L1..L5
  }
  const s = String(value || "").trim().toLowerCase();
  if (s.includes("l1") || s.includes("slot 1") || s.includes("lecture 1") || s.includes("period 1") || s.includes("8:30") || s.includes("08:30")) return 0;
  if (s.includes("l2") || s.includes("slot 2") || s.includes("lecture 2") || s.includes("period 2") || s.includes("10:00")) return 1;
  if (s.includes("l3") || s.includes("slot 3") || s.includes("lecture 3") || s.includes("period 3") || s.includes("11:30")) return 2;
  if (s.includes("l4") || s.includes("slot 4") || s.includes("lecture 4") || s.includes("period 4") || s.includes("1:35") || s.includes("13:35")) return 3;
  if (s.includes("l5") || s.includes("slot 5") || s.includes("lecture 5") || s.includes("period 5") || s.includes("3:00") || s.includes("15:00") || s.includes("03:00")) return 4;

  if (s === "0" || s === "1" || s === "2" || s === "3" || s === "4") return Number(s);
  return -1;
}

/**
 * Converts a list of TimetableClassRows into canonical TimetableRaw shape
 */
export function rowsToRawTimetable(rows: TimetableClassRow[]): TimetableRaw {
  const batchSet = new Set<string>();
  const roomSet = new Set<string>();
  const teacherSet = new Set<string>();
  const subjectSet = new Set<string>();

  for (const row of rows) {
    if (row.batch) batchSet.add(row.batch.trim());
    if (row.room) roomSet.add(row.room.trim());
    if (row.teacher) teacherSet.add(row.teacher.trim());
    if (row.course) subjectSet.add(row.course.trim());
  }

  const b = Array.from(batchSet).sort();
  const r = Array.from(roomSet).sort();
  const t = Array.from(teacherSet).sort();
  const s = Array.from(subjectSet).sort();

  const bMap = new Map(b.map((item, idx) => [item.toLowerCase(), idx]));
  const rMap = new Map(r.map((item, idx) => [item.toLowerCase(), idx]));
  const tMap = new Map(t.map((item, idx) => [item.toLowerCase(), idx]));
  const sMap = new Map(s.map((item, idx) => [item.toLowerCase(), idx]));

  const e: number[][] = [];

  for (const row of rows) {
    const day = row.day;
    const slot = row.slot;
    const batchIdx = bMap.get(row.batch.trim().toLowerCase()) ?? -1;
    const roomIdx = rMap.get(row.room.trim().toLowerCase()) ?? -1;
    const teacherIdx = tMap.get(row.teacher.trim().toLowerCase()) ?? -1;
    const subjectIdx = sMap.get(row.course.trim().toLowerCase()) ?? -1;
    const repeater = row.repeater ? 1 : 0;

    const safeDay = day >= 0 && day <= 4 ? day : 0;
    const safeSlot = slot >= 0 && slot <= 4 ? slot : 0;

    if (batchIdx >= 0 && subjectIdx >= 0) {
      e.push([safeDay, safeSlot, batchIdx, roomIdx, teacherIdx, subjectIdx, repeater]);
    }
  }

  // Sort entries deterministically by day, slot, batch
  e.sort((a, bArr) => {
    if (a[0] !== bArr[0]) return a[0] - bArr[0];
    if (a[1] !== bArr[1]) return a[1] - bArr[1];
    return a[2] - bArr[2];
  });

  return { b, r, t, s, e };
}

/**
 * Converts canonical TimetableRaw shape into human-readable row objects
 */
export function rawToTimetableRows(raw: TimetableRaw): TimetableClassRow[] {
  return raw.e.map(([day, slot, batchIdx, roomIdx, teacherIdx, subjectIdx, repeater]) => ({
    day,
    slot,
    batch: raw.b[batchIdx] || "",
    room: raw.r[roomIdx] || "",
    teacher: raw.t[teacherIdx] || "",
    course: raw.s[subjectIdx] || "",
    repeater: repeater === 1,
  }));
}

/**
 * Parses an Excel or CSV file buffer / binary string into TimetableRaw
 */
export async function parseUploadedTimetableFile(
  fileData: ArrayBuffer | Uint8Array | string,
  fileName: string,
): Promise<{ raw: TimetableRaw; rows: TimetableClassRow[]; fileName: string }> {
  // If user uploaded a raw JSON export
  if (fileName.toLowerCase().endsWith(".json")) {
    const text =
      typeof fileData === "string"
        ? fileData
        : new TextDecoder().decode(fileData as ArrayBuffer);
    const parsed = JSON.parse(text);
    if (parsed.b && parsed.r && parsed.t && parsed.s && parsed.e) {
      return {
        raw: parsed as TimetableRaw,
        rows: rawToTimetableRows(parsed),
        fileName,
      };
    }
  }

  // Use SheetJS / XLSX for .xlsx, .xls, .csv
  const workbook = XLSX.read(fileData, { type: typeof fileData === "string" ? "string" : "array" });
  const rows: TimetableClassRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert sheet to array of rows
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    if (!rawData || rawData.length === 0) continue;

    // Find headers by inspecting keys of first non-empty object
    for (const record of rawData) {
      let dayVal: unknown = "";
      let slotVal: unknown = "";
      let batchVal: unknown = "";
      let courseVal: unknown = "";
      let teacherVal: unknown = "";
      let roomVal: unknown = "";
      let repeaterVal: unknown = "";

      for (const [key, val] of Object.entries(record)) {
        const k = key.trim().toLowerCase();
        if (k.includes("day") || k.includes("weekday")) dayVal = val;
        else if (k.includes("slot") || k.includes("time") || k.includes("lecture") || k.includes("period")) slotVal = val;
        else if (k.includes("batch") || k.includes("class") || k.includes("section")) batchVal = val;
        else if (k.includes("course") || k.includes("subject") || k.includes("title")) courseVal = val;
        else if (k.includes("teacher") || k.includes("instructor") || k.includes("faculty")) teacherVal = val;
        else if (k.includes("room") || k.includes("hall") || k.includes("venue") || k.includes("lab")) roomVal = val;
        else if (k.includes("repeater")) repeaterVal = val;
      }

      // If headers weren't named nicely, check if sheet has header 1 array format
      const day = normalizeDay(dayVal);
      const slot = normalizeSlot(slotVal);
      const batch = String(batchVal || "").trim();
      const course = String(courseVal || "").trim();
      const teacher = String(teacherVal || "").trim();
      const room = String(roomVal || "").trim();
      const repeater = String(repeaterVal).toLowerCase() === "true" || String(repeaterVal) === "1";

      if (course || batch || room) {
        rows.push({
          day,
          slot,
          batch,
          course,
          teacher,
          room,
          repeater,
        });
      }
    }
  }

  const raw = rowsToRawTimetable(rows);
  return { raw, rows, fileName };
}

/**
 * Generates CSV content from TimetableRaw
 */
export function exportTimetableToCsv(raw: TimetableRaw): string {
  const headers = ["Day", "Slot", "Time", "Batch", "Course", "Teacher", "Room", "IsRepeater"];
  const lines: string[] = [headers.join(",")];

  for (const [day, slot, batchIdx, roomIdx, teacherIdx, subjectIdx, repeater] of raw.e) {
    const dayName = DAYS[day] || `Day ${day}`;
    const slotLabel = SLOTS[slot]?.label || `L${slot + 1}`;
    const timeRange = SLOTS[slot] ? `${SLOTS[slot].start}-${SLOTS[slot].end}` : "";
    const batch = `"${(raw.b[batchIdx] || "").replace(/"/g, '""')}"`;
    const course = `"${(raw.s[subjectIdx] || "").replace(/"/g, '""')}"`;
    const teacher = `"${(raw.t[teacherIdx] || "").replace(/"/g, '""')}"`;
    const room = `"${(raw.r[roomIdx] || "").replace(/"/g, '""')}"`;
    const isRep = repeater === 1 ? "1" : "0";

    lines.push([dayName, slotLabel, timeRange, batch, course, teacher, room, isRep].join(","));
  }

  return lines.join("\n");
}

/**
 * Generates an empty sample CSV template for admins
 */
export function generateSampleCsvTemplate(): string {
  const headers = ["Day", "Slot", "Time", "Batch", "Course", "Teacher", "Room", "IsRepeater"];
  const samples = [
    ["Monday", "L1", "8:30-10:00", "BS(CS)-I", "Introduction to ICT", "Dr. Sohail Ahmad", "LH1", "0"],
    ["Monday", "L2", "10:00-11:30", "BS(CS)-I", "Applied Physics", "Dr. Muhammad Numan", "LH1", "0"],
    ["Monday", "L3", "11:30-1:15", "BS(CS)-III", "Data Structures and Algorithms", "Sania Irum", "CR4", "0"],
    ["Tuesday", "L1", "8:30-10:00", "BS(SE)-V", "Software Engineering Economics", "Dr. Adeel Saqib", "CR2", "0"],
    ["Tuesday", "L4", "1:35-3:00", "BS(AI)-III", "Artificial Intelligence Lab", "Dr. Khalid Mahmood Awan", "Lab 2", "0"],
  ];

  return [headers.join(","), ...samples.map((r) => r.join(","))].join("\n");
}
