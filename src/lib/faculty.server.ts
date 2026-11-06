/**
 * Server-only Faculty Authentication & Persistence Layer
 * Integrates PBKDF2/SHA-512 credential security, official timetable teacher linkages,
 * and 6-digit Gmail OTP verification.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSql } from "@/lib/db";
import { sendStudentVerificationEmail } from "./email.server";
import {
  isFacultyEmail,
  matchFacultyByEmail,
  type FacultyProfile,
  type FacultySession,
} from "./faculty-auth";
import { facultyList } from "./faculty";

interface FacultyRecord {
  id: string;
  email: string;
  fullName: string;
  teacherId: number | null;
  timetableName: string | null;
  department: string;
  designation?: string;
  passwordHash: string;
  passwordSalt: string;
  notificationLeadMins: number;
  createdAt: string;
  lastLoginAt: string;
}

// In-memory cache & disk backup
const serverFacultyMemoryStore = new Map<string, FacultyRecord>();
const FACULTY_DISK_BACKUP = path.join(os.tmpdir(), "cui_faculty_db_v1.json");

interface FacultyVerificationChallenge {
  email: string;
  fullName: string;
  teacherId: number | null;
  department: string;
  code: string;
  expiresAt: number;
  attempts: number;
}
const facultyChallenges = new Map<string, FacultyVerificationChallenge>();
const FACULTY_CHALLENGES_DISK = path.join(os.tmpdir(), "cui_faculty_challenges_v1.json");

function readFacultyDisk(): Record<string, FacultyRecord> {
  try {
    if (fs.existsSync(FACULTY_DISK_BACKUP)) {
      return JSON.parse(fs.readFileSync(FACULTY_DISK_BACKUP, "utf8"));
    }
  } catch {
    // Ignore
  }
  return {};
}

function writeFacultyDisk(record: FacultyRecord): void {
  try {
    const existing = readFacultyDisk();
    existing[record.email.toLowerCase()] = record;
    fs.writeFileSync(FACULTY_DISK_BACKUP, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Ignore
  }
}

function readFacultyChallengesDisk(): Record<string, FacultyVerificationChallenge> {
  try {
    if (fs.existsSync(FACULTY_CHALLENGES_DISK)) {
      return JSON.parse(fs.readFileSync(FACULTY_CHALLENGES_DISK, "utf8"));
    }
  } catch {
    // Ignore
  }
  return {};
}

function writeFacultyChallengeDisk(challenge: FacultyVerificationChallenge): void {
  try {
    const existing = readFacultyChallengesDisk();
    existing[challenge.email.toLowerCase()] = challenge;
    fs.writeFileSync(FACULTY_CHALLENGES_DISK, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Ignore
  }
}

function removeFacultyChallengeDisk(email: string): void {
  try {
    const existing = readFacultyChallengesDisk();
    delete existing[email.toLowerCase()];
    fs.writeFileSync(FACULTY_CHALLENGES_DISK, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Ignore
  }
}

/**
 * Ensures cui_faculty table exists in DB
 */
async function ensureFacultyTableExists(): Promise<void> {
  try {
    const sql = await getSql();
    await sql.query(`
      CREATE TABLE IF NOT EXISTS cui_faculty (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        teacher_id INTEGER,
        department TEXT NOT NULL,
        designation TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        notification_lead_mins INTEGER NOT NULL DEFAULT 10,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_cui_faculty_email ON cui_faculty (email)
    `);
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_cui_faculty_teacher_id ON cui_faculty (teacher_id)
    `);
  } catch (err) {
    console.warn("[faculty.server] DB table init notice:", err);
  }
}

function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const calculated = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function toFacultyProfile(record: FacultyRecord): FacultyProfile {
  return {
    id: record.id,
    email: record.email,
    fullName: record.fullName,
    teacherId: record.teacherId,
    timetableName: record.timetableName,
    department: record.department,
    designation: record.designation,
    notificationLeadMins: record.notificationLeadMins,
    createdAt: record.createdAt,
  };
}

function createFacultySession(record: FacultyRecord): FacultySession {
  const token = `cui-fac-${record.id}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  return {
    profile: toFacultyProfile(record),
    token,
    signedInAt: new Date().toISOString(),
  };
}

/**
 * Finds a faculty record by email
 */
export async function findFacultyByEmail(email: string): Promise<FacultyRecord | null> {
  const normalized = email.trim().toLowerCase();

  // 1. Check memory store
  const cached = serverFacultyMemoryStore.get(normalized);
  if (cached) return cached;

  // 2. Check disk backup
  const disk = readFacultyDisk();
  if (disk && disk[normalized]) {
    const record = disk[normalized];
    serverFacultyMemoryStore.set(normalized, record);
    return record;
  }

  // 3. Check DB
  try {
    await ensureFacultyTableExists();
    const sql = await getSql();
    const rows = await sql.query<any>(
      "SELECT * FROM cui_faculty WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [normalized],
    );

    if (rows && rows.length > 0) {
      const row = rows[0];
      const matched = matchFacultyByEmail(row.email);
      const record: FacultyRecord = {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        teacherId: row.teacher_id !== null ? Number(row.teacher_id) : matched?.teacherId ?? null,
        timetableName: matched?.timetableName || matched?.name || null,
        department: row.department || matched?.department || "COMSATS Attock",
        designation: row.designation || undefined,
        passwordHash: row.password_hash,
        passwordSalt: row.password_salt,
        notificationLeadMins: row.notification_lead_mins || 10,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      };
      serverFacultyMemoryStore.set(normalized, record);
      writeFacultyDisk(record);
      return record;
    }
  } catch (err) {
    console.warn("[faculty.server] DB read fallback:", err);
  }

  return null;
}

export interface FacultyAuthResponse {
  success: boolean;
  session?: FacultySession;
  credentialSync?: {
    email: string;
    fullName: string;
    teacherId: number | null;
    timetableName: string | null;
    department: string;
    passwordHash: string;
    passwordSalt: string;
    notificationLeadMins: number;
  };
  error?: string;
}

/**
 * Requests an official 6-digit email verification code sent to the faculty member's university Gmail
 */
export async function serverRequestFacultyVerificationCode(
  email: string,
  fullName: string,
  teacherId?: number,
  originUrl?: string,
): Promise<{ success: boolean; message?: string; devPreviewCode?: string; error?: string }> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const trimmedName = (fullName || "").trim();

  // 1. Validate email
  if (!isFacultyEmail(normalizedEmail)) {
    return {
      success: false,
      error:
        "Please provide an official CUI Attock faculty/staff email address (e.g. name@cuiatk.edu.pk). Students should use the Student Portal.",
    };
  }

  if (trimmedName.length < 2) {
    return {
      success: false,
      error: "Please enter your full faculty name (at least 2 characters).",
    };
  }

  // 2. Check if already registered
  const existing = await findFacultyByEmail(normalizedEmail);
  if (existing) {
    return {
      success: false,
      error: "A faculty account with this email already exists. Please sign in.",
    };
  }

  // 3. Resolve faculty directory record
  const dirMatch = matchFacultyByEmail(normalizedEmail);
  const resolvedTeacherId = teacherId !== undefined ? teacherId : dirMatch?.teacherId ?? null;
  const resolvedDept = dirMatch?.department || "Department of Computer Science";

  // 4. Generate 6-digit code
  const code = Math.floor(100000 + crypto.randomInt(900000)).toString();

  const challenge: FacultyVerificationChallenge = {
    email: normalizedEmail,
    fullName: trimmedName,
    teacherId: resolvedTeacherId,
    department: resolvedDept,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  };

  facultyChallenges.set(normalizedEmail, challenge);
  writeFacultyChallengeDisk(challenge);

  // 5. Construct magic link
  const magicLink = originUrl
    ? `${originUrl.replace(/\/$/, "")}/?faculty_verify_email=${encodeURIComponent(normalizedEmail)}&code=${code}`
    : undefined;

  // 6. Send verification email via Gmail SMTP
  const emailRes = await sendStudentVerificationEmail({
    toEmail: normalizedEmail,
    studentName: trimmedName,
    verificationCode: code,
    magicLink,
  });

  if (!emailRes.sent && emailRes.error) {
    return {
      success: false,
      error: emailRes.error,
    };
  }

  return {
    success: true,
    message: `A 6-digit verification code has been dispatched to ${normalizedEmail}. Please check your official faculty Gmail.`,
    devPreviewCode: emailRes.devMode ? code : undefined,
  };
}

/**
 * Validates the 6-digit code and creates the faculty account
 */
export async function serverVerifyFacultyCodeAndSignUp(
  email: string,
  code: string,
  password: string,
  teacherId?: number,
): Promise<FacultyAuthResponse> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const trimmedCode = (code || "").trim();

  if (!isFacultyEmail(normalizedEmail)) {
    return { success: false, error: "Invalid faculty email address." };
  }
  if (!trimmedCode || trimmedCode.length !== 6) {
    return { success: false, error: "Please enter the complete 6-digit verification code." };
  }
  if (!password || password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  // Fetch challenge
  let challenge = facultyChallenges.get(normalizedEmail);
  if (!challenge) {
    const disk = readFacultyChallengesDisk();
    if (disk && disk[normalizedEmail]) {
      challenge = disk[normalizedEmail];
      facultyChallenges.set(normalizedEmail, challenge);
    }
  }

  if (!challenge) {
    return {
      success: false,
      error: "No active verification code found for this faculty email. Please request a new code.",
    };
  }

  if (Date.now() > challenge.expiresAt) {
    facultyChallenges.delete(normalizedEmail);
    removeFacultyChallengeDisk(normalizedEmail);
    return {
      success: false,
      error: "Verification code has expired. Please request a new code.",
    };
  }

  if (challenge.attempts >= 5) {
    facultyChallenges.delete(normalizedEmail);
    removeFacultyChallengeDisk(normalizedEmail);
    return {
      success: false,
      error: "Too many incorrect verification attempts. Please request a new code.",
    };
  }

  if (challenge.code !== trimmedCode) {
    challenge.attempts += 1;
    writeFacultyChallengeDisk(challenge);
    return {
      success: false,
      error: "Incorrect 6-digit verification code. Please check your Gmail and try again.",
    };
  }

  // 6. Generate cryptographic salt and hash
  const { hash, salt } = hashPassword(password);
  const facultyId = `fac-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();

  const finalTeacherId = teacherId !== undefined ? teacherId : challenge.teacherId;
  const dirMatch = matchFacultyByEmail(normalizedEmail);

  const record: FacultyRecord = {
    id: facultyId,
    email: normalizedEmail,
    fullName: challenge.fullName,
    teacherId: finalTeacherId,
    timetableName: dirMatch?.timetableName || dirMatch?.name || challenge.fullName,
    department: challenge.department || dirMatch?.department || "Department of Computer Science",
    designation: dirMatch?.name.startsWith("Dr.") ? "Assistant Professor" : "Lecturer",
    passwordHash: hash,
    passwordSalt: salt,
    notificationLeadMins: 10,
    createdAt: now,
    lastLoginAt: now,
  };

  serverFacultyMemoryStore.set(normalizedEmail, record);
  writeFacultyDisk(record);
  facultyChallenges.delete(normalizedEmail);
  removeFacultyChallengeDisk(normalizedEmail);

  // Persist to DB
  try {
    await ensureFacultyTableExists();
    const sql = await getSql();
    await sql.query(
      `
      INSERT INTO cui_faculty (
        id, email, full_name, teacher_id, department, designation,
        password_hash, password_salt, notification_lead_mins, created_at, last_login_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
      ON CONFLICT (email) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          teacher_id = EXCLUDED.teacher_id,
          password_hash = EXCLUDED.password_hash,
          password_salt = EXCLUDED.password_salt,
          updated_at = now()
    `,
      [
        record.id,
        record.email,
        record.fullName,
        record.teacherId,
        record.department,
        record.designation || null,
        record.passwordHash,
        record.passwordSalt,
        record.notificationLeadMins,
      ],
    );
  } catch (err) {
    console.warn("[faculty.server] DB insert notice (using memory/disk):", err);
  }

  return {
    success: true,
    session: createFacultySession(record),
    credentialSync: {
      email: record.email,
      fullName: record.fullName,
      teacherId: record.teacherId,
      timetableName: record.timetableName,
      department: record.department,
      passwordHash: record.passwordHash,
      passwordSalt: record.passwordSalt,
      notificationLeadMins: record.notificationLeadMins,
    },
  };
}

/**
 * Authenticates an existing faculty member
 */
export async function serverFacultySignIn(
  email: string,
  password: string,
): Promise<FacultyAuthResponse> {
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!isFacultyEmail(normalizedEmail)) {
    return {
      success: false,
      error: "Please enter an official faculty email address.",
    };
  }

  if (!password) {
    return { success: false, error: "Please enter your password." };
  }

  const faculty = await findFacultyByEmail(normalizedEmail);
  if (!faculty) {
    return {
      success: false,
      error: "No faculty account found for this email. Please create your faculty account first.",
    };
  }

  const isMatch = verifyPassword(password, faculty.passwordHash, faculty.passwordSalt);
  if (!isMatch) {
    return {
      success: false,
      error: "Incorrect password. Please verify and try again.",
    };
  }

  faculty.lastLoginAt = new Date().toISOString();
  serverFacultyMemoryStore.set(normalizedEmail, faculty);
  writeFacultyDisk(faculty);

  try {
    const sql = await getSql();
    await sql.query(
      "UPDATE cui_faculty SET last_login_at = now() WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail],
    );
  } catch {
    // Non-blocking
  }

  return {
    success: true,
    session: createFacultySession(faculty),
    credentialSync: {
      email: faculty.email,
      fullName: faculty.fullName,
      teacherId: faculty.teacherId,
      timetableName: faculty.timetableName,
      department: faculty.department,
      passwordHash: faculty.passwordHash,
      passwordSalt: faculty.passwordSalt,
      notificationLeadMins: faculty.notificationLeadMins,
    },
  };
}

/**
 * Updates notification lead time (5 or 10 mins)
 */
export async function serverFacultyUpdateLeadTime(
  email: string,
  leadMins: number,
): Promise<{ success: boolean; session?: FacultySession; error?: string }> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const faculty = await findFacultyByEmail(normalizedEmail);
  if (!faculty) {
    return { success: false, error: "Faculty member not found." };
  }

  faculty.notificationLeadMins = leadMins;
  serverFacultyMemoryStore.set(normalizedEmail, faculty);
  writeFacultyDisk(faculty);

  try {
    const sql = await getSql();
    await sql.query(
      "UPDATE cui_faculty SET notification_lead_mins = $1, updated_at = now() WHERE LOWER(email) = LOWER($2)",
      [leadMins, normalizedEmail],
    );
  } catch {
    // Non-blocking
  }

  return {
    success: true,
    session: createFacultySession(faculty),
  };
}
