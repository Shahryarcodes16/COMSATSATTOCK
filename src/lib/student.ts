/**
 * Student Authentication & Profile Module
 * Handles official university email validation, parsing, and client-side session management.
 */

// Official COMSATS University Attock Campus Student Email Pattern
export const UNIVERSITY_EMAIL_REGEX =
  /^(fa|sp)\d{2}-(baf|bai|bba|bbd|bce|bcs|bee|ben|bmd|bse|bsm)-\d{3}@cuiatk\.edu\.pk$/i;

export interface ProgramInfo {
  code: string;
  name: string;
  short: string;
  batchPrefix: string;
  department: string;
}

export const PROGRAM_MAP: Record<string, ProgramInfo> = {
  bcs: {
    code: "bcs",
    name: "Bachelor of Science in Computer Science",
    short: "BS CS",
    batchPrefix: "BS(CS)",
    department: "Department of Computer Science",
  },
  bse: {
    code: "bse",
    name: "Bachelor of Science in Software Engineering",
    short: "BS SE",
    batchPrefix: "BS(SE)",
    department: "Department of Computer Science",
  },
  bai: {
    code: "bai",
    name: "Bachelor of Science in Artificial Intelligence",
    short: "BS AI",
    batchPrefix: "BS(AI)",
    department: "Department of Computer Science",
  },
  bba: {
    code: "bba",
    name: "Bachelor of Business Administration",
    short: "BBA",
    batchPrefix: "BS(BA)",
    department: "Department of Management Sciences",
  },
  baf: {
    code: "baf",
    name: "BS Accounting & Finance",
    short: "BS A&F",
    batchPrefix: "BS(A&F)",
    department: "Department of Management Sciences",
  },
  bbd: {
    code: "bbd",
    name: "BS Business Data Analytics",
    short: "BS BDA",
    batchPrefix: "BS(BDA)",
    department: "Department of Management Sciences",
  },
  bee: {
    code: "bee",
    name: "BS Electrical Engineering",
    short: "BS EE",
    batchPrefix: "BS(EE)",
    department: "Department of Electrical Engineering",
  },
  bce: {
    code: "bce",
    name: "BS Computer Engineering",
    short: "BS CE",
    batchPrefix: "BS(CE)",
    department: "Department of Computer Engineering",
  },
  ben: {
    code: "ben",
    name: "Bachelor of Science in English",
    short: "BS English",
    batchPrefix: "BS(English)",
    department: "Department of Humanities",
  },
  bmd: {
    code: "bmd",
    name: "Bachelor of Science in Media Studies",
    short: "BS Media",
    batchPrefix: "BS(Media)",
    department: "Department of Humanities",
  },
  bsm: {
    code: "bsm",
    name: "BS Mathematics & Data Science",
    short: "BS Maths",
    batchPrefix: "BS(Maths)",
    department: "Department of Mathematics",
  },
};

export interface ParsedStudentEmail {
  session: "FA" | "SP";
  sessionFull: string;
  year: string;
  fullYear: number;
  programCode: string;
  program: ProgramInfo;
  rollNumber: string;
  regNo: string; // e.g. "FA23-BCS-014"
  normalizedEmail: string;
}

export interface StudentProfile {
  id: string;
  email: string;
  fullName: string;
  session: "FA" | "SP";
  year: string;
  programCode: string;
  rollNumber: string;
  regNo: string;
  programTitle: string;
  department: string;
  defaultBatch: string | null;
  createdAt: string;
}

export interface StudentSession {
  profile: StudentProfile;
  token: string;
  signedInAt: string;
}

const STUDENT_SESSION_STORAGE_KEY = "cui_student_active_session_v1";

/**
 * Tests if an email matches the official COMSATS Attock student pattern
 */
export function isValidUniversityEmail(email: string): boolean {
  if (!email) return false;
  return UNIVERSITY_EMAIL_REGEX.test(email.trim());
}

/**
 * Extracts student session, admission year, degree program, and roll number from university email
 */
export function parseUniversityEmail(email: string): ParsedStudentEmail | null {
  if (!isValidUniversityEmail(email)) return null;

  const match = email.trim().match(/^(fa|sp)(\d{2})-([a-z]{3})-(\d{3})@cuiatk\.edu\.pk$/i);
  if (!match) return null;

  const session = match[1].toUpperCase() as "FA" | "SP";
  const year = match[2];
  const fullYear = 2000 + parseInt(year, 10);
  const programCode = match[3].toLowerCase();
  const rollNumber = match[4];

  const program = PROGRAM_MAP[programCode] || {
    code: programCode,
    name: `Bachelor of Science (${programCode.toUpperCase()})`,
    short: `BS ${programCode.toUpperCase()}`,
    batchPrefix: `BS(${programCode.toUpperCase()})`,
    department: "COMSATS University Islamabad, Attock Campus",
  };

  const regNo = `${session}${year}-${programCode.toUpperCase()}-${rollNumber}`;

  return {
    session,
    sessionFull: session === "FA" ? "Fall" : "Spring",
    year,
    fullYear,
    programCode,
    program,
    rollNumber,
    regNo,
    normalizedEmail: email.trim().toLowerCase(),
  };
}

/**
 * Gets the active student session from client storage
 */
export function getActiveStudentSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(STUDENT_SESSION_STORAGE_KEY) ||
      sessionStorage.getItem(STUDENT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StudentSession;
    if (session?.profile?.email && isValidUniversityEmail(session.profile.email)) {
      return session;
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

/**
 * Sets the active student session in client storage
 */
export function setStudentSession(session: StudentSession, rememberMe = true): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(session);
    if (rememberMe) {
      localStorage.setItem(STUDENT_SESSION_STORAGE_KEY, serialized);
    } else {
      sessionStorage.setItem(STUDENT_SESSION_STORAGE_KEY, serialized);
    }
    window.dispatchEvent(new CustomEvent("cui:student-session-update", { detail: session }));
  } catch (err) {
    console.error("Failed to persist student session", err);
  }
}

/**
 * Clears the active student session (Logout)
 */
export function clearStudentSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("cui:student-session-update", { detail: null }));
  } catch (err) {
    console.error("Failed to clear student session", err);
  }
}
