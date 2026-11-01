import facultyData from "@/data/faculty.json";

export interface FacultyMember {
  id: number;
  name: string;
  email: string;
  department: string;
  teacherId: number | null;
  timetableName: string | null;
}

export const facultyList: FacultyMember[] = facultyData as FacultyMember[];

export const DEPARTMENTS = [
  "All",
  "Computer Science",
  "Electrical & Computer Engineering",
  "Mathematics & Sciences",
  "Engineering & Technology",
  "Management Sciences",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

// Fast lookup maps
const byTeacherId = new Map<number, FacultyMember>();
const byTimetableName = new Map<string, FacultyMember>();
const byNormalizedName = new Map<string, FacultyMember>();

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b(prof|dr|mr|ms|engr)\b\.?/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

for (const member of facultyList) {
  if (member.teacherId !== null && member.teacherId !== undefined) {
    byTeacherId.set(member.teacherId, member);
  }
  if (member.timetableName) {
    byTimetableName.set(member.timetableName.toLowerCase(), member);
  }
  byNormalizedName.set(normalize(member.name), member);
}

export function getFacultyByTeacher(teacherId: number, teacherName?: string): FacultyMember | undefined {
  if (byTeacherId.has(teacherId)) {
    return byTeacherId.get(teacherId);
  }
  if (teacherName) {
    const direct = byTimetableName.get(teacherName.toLowerCase());
    if (direct) return direct;
    const norm = byNormalizedName.get(normalize(teacherName));
    if (norm) return norm;
  }
  return undefined;
}

export function getFacultyEmail(teacherId: number, teacherName?: string): string | undefined {
  const member = getFacultyByTeacher(teacherId, teacherName);
  return member?.email;
}

export function filterFaculty(options: {
  query?: string;
  department?: string;
}): FacultyMember[] {
  const needle = (options.query ?? "").trim().toLowerCase();
  const dept = options.department ?? "All";

  return facultyList.filter((f) => {
    if (dept !== "All" && f.department !== dept) {
      return false;
    }
    if (!needle) return true;

    return (
      f.name.toLowerCase().includes(needle) ||
      f.email.toLowerCase().includes(needle) ||
      f.department.toLowerCase().includes(needle) ||
      (f.timetableName && f.timetableName.toLowerCase().includes(needle))
    );
  });
}
