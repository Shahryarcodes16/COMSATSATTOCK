/**
 * Server-only Student Authentication & Persistence Layer
 * Uses PBKDF2 with SHA-512 and unique salts for secure credential storage.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSql } from "./db.ts";
import { sendStudentVerificationEmail } from "./email.server.ts";
import {
  createAndSetSessionCookie,
  clearSessionCookie,
  setChallengeCookie,
  getChallengeCookie,
  clearChallengeCookie,
} from "./session.server.ts";
import { checkLoginRateLimit, recordFailedLogin, resetLoginRateLimit } from "./rate-limiter.server.ts";
import {
  isValidUniversityEmail,
  parseUniversityEmail,
  type StudentProfile,
  type StudentSession,
} from "./student.ts";

interface StudentRecord {
  id: string;
  email: string;
  fullName: string;
  session: "FA" | "SP";
  year: string;
  programCode: string;
  rollNumber: string;
  passwordHash: string;
  passwordSalt: string;
  defaultBatch: string | null;
  createdAt: string;
  lastLoginAt: string;
}

// In-memory student cache for serverless instances / environments without external DB
const serverStudentMemoryStore = new Map<string, StudentRecord>();

// Disk backup for serverless environments (survives container warm restarts on /tmp)
const DISK_BACKUP_PATH = path.join(os.tmpdir(), "cui_students_db_v1.json");

// In-memory & disk storage for active email verification challenges
interface VerificationChallenge {
  email: string;
  fullName: string;
  code: string;
  defaultBatch?: string;
  expiresAt: number;
  attempts: number;
}
const verificationChallenges = new Map<string, VerificationChallenge>();
const CHALLENGES_DISK_PATH = path.join(os.tmpdir(), "cui_email_challenges_v1.json");

function readChallengesDisk(): Record<string, VerificationChallenge> {
  try {
    if (fs.existsSync(CHALLENGES_DISK_PATH)) {
      const data = fs.readFileSync(CHALLENGES_DISK_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch {
    // Ignore
  }
  return {};
}

function writeChallengeDisk(challenge: VerificationChallenge): void {
  try {
    const existing = readChallengesDisk();
    existing[challenge.email.toLowerCase()] = challenge;
    fs.writeFileSync(CHALLENGES_DISK_PATH, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Ignore
  }
}

function removeChallengeDisk(email: string): void {
  try {
    const existing = readChallengesDisk();
    delete existing[email.toLowerCase()];
    fs.writeFileSync(CHALLENGES_DISK_PATH, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Ignore
  }
}

function readDiskBackup(): Record<string, StudentRecord> {
  try {
    if (fs.existsSync(DISK_BACKUP_PATH)) {
      const data = fs.readFileSync(DISK_BACKUP_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("[student.server] Disk read notice:", err);
  }
  return {};
}

function writeDiskBackup(record: StudentRecord): void {
  try {
    const existing = readDiskBackup();
    existing[record.email.toLowerCase()] = record;
    fs.writeFileSync(DISK_BACKUP_PATH, JSON.stringify(existing, null, 2), "utf8");
  } catch (err) {
    console.warn("[student.server] Disk write notice:", err);
  }
}

/**
 * Ensures the student accounts table exists in PostgreSQL / PGLite
 */
async function ensureStudentTableExists(): Promise<void> {
  try {
    const sql = await getSql();
    await sql.query(`
      CREATE TABLE IF NOT EXISTS cui_students (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        session TEXT NOT NULL,
        year TEXT NOT NULL,
        program_code TEXT NOT NULL,
        roll_number TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        default_batch TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_cui_students_email ON cui_students (email)
    `);
  } catch (err) {
    console.warn("[student.server] DB table init notice (using memory fallback if needed):", err);
  }
}

const PBKDF2_ITERATIONS = 210000;
const LEGACY_PBKDF2_ITERATIONS = 10000;

/**
 * Securely hashes a plain-text password using PBKDF2 with SHA-512 (210,000 iterations)
 */
function hashPassword(
  password: string,
  existingSalt?: string,
  iterations = PBKDF2_ITERATIONS,
): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return { hash, salt };
}

/**
 * Validates a password against its hash using timing-safe comparison.
 * Checks against modern 210,000 iterations first, with backward compatibility for legacy 10,000 hashes.
 */
function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): { valid: boolean; legacy: boolean } {
  try {
    const calculated210k = crypto
      .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, "sha512")
      .toString("hex");
    if (crypto.timingSafeEqual(Buffer.from(calculated210k, "hex"), Buffer.from(hash, "hex"))) {
      return { valid: true, legacy: false };
    }
  } catch {
    // Continue to legacy check
  }

  try {
    const calculated10k = crypto
      .pbkdf2Sync(password, salt, LEGACY_PBKDF2_ITERATIONS, 64, "sha512")
      .toString("hex");
    if (crypto.timingSafeEqual(Buffer.from(calculated10k, "hex"), Buffer.from(hash, "hex"))) {
      return { valid: true, legacy: true };
    }
  } catch {
    // Verification failed
  }

  return { valid: false, legacy: false };
}

/**
 * Generates a student profile from record
 */
function toStudentProfile(record: StudentRecord): StudentProfile {
  const parsed = parseUniversityEmail(record.email);
  return {
    id: record.id,
    email: record.email,
    fullName: record.fullName,
    session: record.session,
    year: record.year,
    programCode: record.programCode,
    rollNumber: record.rollNumber,
    regNo: parsed ? parsed.regNo : `${record.session}${record.year}-${record.programCode.toUpperCase()}-${record.rollNumber}`,
    programTitle: parsed?.program.name || record.programCode.toUpperCase(),
    department: parsed?.program.department || "COMSATS Attock",
    defaultBatch: record.defaultBatch,
    createdAt: record.createdAt,
  };
}

/**
 * Creates a student session token
 */
function createStudentSession(record: StudentRecord): StudentSession {
  const token = `cui-stu-${record.id}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  return {
    profile: toStudentProfile(record),
    token,
    signedInAt: new Date().toISOString(),
  };
}

/**
 * Finds a student by university email
 */
async function findStudentByEmail(email: string): Promise<StudentRecord | null> {
  const normalized = email.trim().toLowerCase();

  // 1. Check in-memory store
  const cached = serverStudentMemoryStore.get(normalized);
  if (cached) return cached;

  // 2. Check disk backup (survives warm serverless restarts)
  const disk = readDiskBackup();
  if (disk && disk[normalized]) {
    const record = disk[normalized];
    serverStudentMemoryStore.set(normalized, record);
    return record;
  }

  // 3. Check SQL database if available
  try {
    await ensureStudentTableExists();
    const sql = await getSql();
    const rows = await sql.query<any>(
      "SELECT * FROM cui_students WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [normalized],
    );

    if (rows && rows.length > 0) {
      const row = rows[0];
      const record: StudentRecord = {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        session: row.session,
        year: row.year,
        programCode: row.program_code,
        rollNumber: row.roll_number,
        passwordHash: row.password_hash,
        passwordSalt: row.password_salt,
        defaultBatch: row.default_batch || null,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      };
      serverStudentMemoryStore.set(normalized, record);
      writeDiskBackup(record);
      return record;
    }
  } catch (err) {
    console.warn("[student.server] DB query failed, checking memory fallback:", err);
  }

  return null;
}

export interface StudentAuthResponse {
  success: boolean;
  session?: StudentSession;
  credentialSync?: {
    email: string;
    fullName: string;
    passwordHash: string;
    passwordSalt: string;
    defaultBatch: string | null;
  };
  error?: string;
}

/**
 * Registers a new student account
 */
export async function serverStudentSignUp(
  email: string,
  fullName: string,
  password: string,
  defaultBatch?: string,
): Promise<StudentAuthResponse> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const trimmedName = (fullName || "").trim();

  // 1. Strict regex validation for official university email
  if (!isValidUniversityEmail(normalizedEmail)) {
    return {
      success: false,
      error:
        "Please provide a valid official COMSATS Attock student email (e.g. fa23-bcs-014@cuiatk.edu.pk).",
    };
  }

  // 2. Validate full name
  if (trimmedName.length < 2) {
    return {
      success: false,
      error: "Please enter your full student name (at least 2 characters).",
    };
  }

  // 3. Validate password strength
  if (!password || password.length < 6) {
    return {
      success: false,
      error: "Password must be at least 6 characters long.",
    };
  }

  // 4. Check if student already exists
  const existing = await findStudentByEmail(normalizedEmail);
  if (existing) {
    return {
      success: false,
      error: "An account with this university email already exists. Please sign in.",
    };
  }

  // 5. Parse student metadata from email
  const parsed = parseUniversityEmail(normalizedEmail);
  if (!parsed) {
    return {
      success: false,
      error: "Failed to extract student registration information from email.",
    };
  }

  // 6. Generate cryptographic salt and hash
  const { hash, salt } = hashPassword(password);
  const studentId = `stu-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();

  const record: StudentRecord = {
    id: studentId,
    email: normalizedEmail,
    fullName: trimmedName,
    session: parsed.session,
    year: parsed.year,
    programCode: parsed.programCode,
    rollNumber: parsed.rollNumber,
    passwordHash: hash,
    passwordSalt: salt,
    defaultBatch: defaultBatch || null,
    createdAt: now,
    lastLoginAt: now,
  };

  // Cache in memory and disk backup immediately
  serverStudentMemoryStore.set(normalizedEmail, record);
  writeDiskBackup(record);

  // Persist to database
  try {
    await ensureStudentTableExists();
    const sql = await getSql();
    await sql.query(
      `
      INSERT INTO cui_students (
        id, email, full_name, session, year, program_code, roll_number,
        password_hash, password_salt, default_batch, created_at, last_login_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
      ON CONFLICT (email) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          password_hash = EXCLUDED.password_hash,
          password_salt = EXCLUDED.password_salt,
          default_batch = EXCLUDED.default_batch,
          updated_at = now()
    `,
      [
        record.id,
        record.email,
        record.fullName,
        record.session,
        record.year,
        record.programCode,
        record.rollNumber,
        record.passwordHash,
        record.passwordSalt,
        record.defaultBatch,
      ],
    );
  } catch (err) {
    console.warn("[student.server] DB insert failed, using memory/disk cache:", err);
  }

  // Issue secure signed httpOnly session cookie
  await createAndSetSessionCookie({
    sub: record.email,
    role: "student",
    name: record.fullName,
    batch: record.defaultBatch || undefined,
  });

  return {
    success: true,
    session: createStudentSession(record),
    credentialSync: {
      email: record.email,
      fullName: record.fullName,
      passwordHash: record.passwordHash,
      passwordSalt: record.passwordSalt,
      defaultBatch: record.defaultBatch,
    },
  };
}

/**
 * Authenticates an existing student
 */
export async function serverStudentSignIn(
  email: string,
  password: string,
  clientVaultAccount?: {
    email: string;
    fullName: string;
    passwordHash: string;
    passwordSalt: string;
    defaultBatch?: string | null;
  },
): Promise<StudentAuthResponse> {
  const normalizedEmail = (email || "").trim().toLowerCase();

  // 1. Strict regex validation for official university email
  if (!isValidUniversityEmail(normalizedEmail)) {
    return {
      success: false,
      error:
        "Please provide a valid official COMSATS Attock student email (e.g. fa23-bcs-014@cuiatk.edu.pk).",
    };
  }

  if (!password) {
    return {
      success: false,
      error: "Please enter your account password.",
    };
  }

  // 2. Check rate limit
  const rateLimit = await checkLoginRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: rateLimit.error || "Account temporarily locked due to too many failed attempts. Please try again later.",
    };
  }

  // 3. Lookup student in memory, disk, or DB
  let student = await findStudentByEmail(normalizedEmail);

  // 3b. Resilient Serverless Cold-Start Re-hydration:
  // If the serverless container restarted and database has no record,
  // securely verify the client's local vault account with full PBKDF2/SHA-512 (210k iterations).
  if (!student) {
    if (
      clientVaultAccount &&
      clientVaultAccount.email.trim().toLowerCase() === normalizedEmail &&
      clientVaultAccount.passwordHash &&
      clientVaultAccount.passwordSalt
    ) {
      const vaultCheck = verifyPassword(
        password,
        clientVaultAccount.passwordHash,
        clientVaultAccount.passwordSalt,
      );
      if (vaultCheck.valid) {
        const parsed = parseUniversityEmail(normalizedEmail);
        const studentId = `stu-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const now = new Date().toISOString();
        student = {
          id: studentId,
          email: normalizedEmail,
          fullName: clientVaultAccount.fullName || (parsed ? `${parsed.session}${parsed.year}-${parsed.rollNumber}` : "Student"),
          session: parsed?.session || "FA",
          year: parsed?.year || "23",
          programCode: parsed?.programCode || "bcs",
          rollNumber: parsed?.rollNumber || "001",
          passwordHash: clientVaultAccount.passwordHash,
          passwordSalt: clientVaultAccount.passwordSalt,
          defaultBatch: clientVaultAccount.defaultBatch || null,
          createdAt: now,
          lastLoginAt: now,
        };

        serverStudentMemoryStore.set(normalizedEmail, student);
        writeDiskBackup(student);

        try {
          await ensureStudentTableExists();
          const sql = await getSql();
          await sql.query(
            `
            INSERT INTO cui_students (
              id, email, full_name, session, year, program_code, roll_number,
              password_hash, password_salt, default_batch, created_at, last_login_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
            ON CONFLICT (email) DO UPDATE
            SET full_name = EXCLUDED.full_name,
                password_hash = EXCLUDED.password_hash,
                password_salt = EXCLUDED.password_salt,
                default_batch = EXCLUDED.default_batch,
                last_login_at = now(),
                updated_at = now()
          `,
            [
              student.id,
              student.email,
              student.fullName,
              student.session,
              student.year,
              student.programCode,
              student.rollNumber,
              student.passwordHash,
              student.passwordSalt,
              student.defaultBatch,
            ],
          );
        } catch (err) {
          console.warn("[student.server] DB re-hydrate insert notice:", err);
        }
      }
    }
  }

  if (!student) {
    await recordFailedLogin(normalizedEmail);
    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  // 4. Verify password hash using 210,000 iterations (with 10k legacy check)
  const check = verifyPassword(password, student.passwordHash, student.passwordSalt);
  if (!check.valid) {
    await recordFailedLogin(normalizedEmail);
    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  // 5. Successful login: reset rate limit counter
  await resetLoginRateLimit(normalizedEmail);

  // 6. Transparent re-hash if legacy 10,000 iterations
  if (check.legacy) {
    const upgraded = hashPassword(password);
    student.passwordHash = upgraded.hash;
    student.passwordSalt = upgraded.salt;
    serverStudentMemoryStore.set(normalizedEmail, student);
    writeDiskBackup(student);
    try {
      const sql = await getSql();
      await sql.query(
        "UPDATE cui_students SET password_hash = $1, password_salt = $2, updated_at = now() WHERE LOWER(email) = LOWER($3)",
        [student.passwordHash, student.passwordSalt, normalizedEmail],
      );
    } catch {
      // Non-blocking
    }
  }

  // 7. Update last login time
  student.lastLoginAt = new Date().toISOString();
  serverStudentMemoryStore.set(normalizedEmail, student);
  writeDiskBackup(student);

  try {
    const sql = await getSql();
    await sql.query(
      "UPDATE cui_students SET last_login_at = now() WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail],
    );
  } catch {
    // Non-blocking
  }

  // 8. Issue signed httpOnly session cookie
  await createAndSetSessionCookie({
    sub: student.email,
    role: "student",
    name: student.fullName,
    batch: student.defaultBatch || undefined,
  });

  return {
    success: true,
    session: createStudentSession(student),
    credentialSync: {
      email: student.email,
      fullName: student.fullName,
      passwordHash: student.passwordHash,
      passwordSalt: student.passwordSalt,
      defaultBatch: student.defaultBatch,
    },
  };
}

/**
 * Updates student preferences (e.g. default batch/section)
 */
export async function serverStudentUpdateBatch(
  email: string,
  defaultBatch: string,
): Promise<{ success: boolean; session?: StudentSession; error?: string }> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const student = await findStudentByEmail(normalizedEmail);
  if (!student) {
    return { success: false, error: "Student not found." };
  }

  student.defaultBatch = defaultBatch;
  serverStudentMemoryStore.set(normalizedEmail, student);
  writeDiskBackup(student);

  try {
    const sql = await getSql();
    await sql.query(
      "UPDATE cui_students SET default_batch = $1, updated_at = now() WHERE LOWER(email) = LOWER($2)",
      [defaultBatch, normalizedEmail],
    );
  } catch (err) {
    console.warn("Failed to persist updated batch:", err);
  }

  // Update session cookie with new defaultBatch
  await createAndSetSessionCookie({
    sub: student.email,
    role: "student",
    name: student.fullName,
    batch: defaultBatch,
  });

  return {
    success: true,
    session: createStudentSession(student),
  };
}

/**
 * Requests an official 6-digit email verification code sent to the student's @cuiatk.edu.pk Gmail
 */
export async function serverRequestStudentVerificationCode(
  email: string,
  fullName: string,
  defaultBatch?: string,
  originUrl?: string,
): Promise<{ success: boolean; message?: string; devPreviewCode?: string; error?: string }> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const trimmedName = (fullName || "").trim();

  // 1. Strict regex validation for official university email
  if (!isValidUniversityEmail(normalizedEmail)) {
    return {
      success: false,
      error:
        "Please provide a valid official COMSATS Attock student email (e.g. fa23-bcs-014@cuiatk.edu.pk).",
    };
  }

  // 2. Validate student name
  if (trimmedName.length < 2) {
    return {
      success: false,
      error: "Please enter your full student name (at least 2 characters).",
    };
  }

  // 3. Check if student already exists (for messaging context)
  const existing = await findStudentByEmail(normalizedEmail);

  // 4. Generate a cryptographically secure 6-digit numeric verification code
  const code = Math.floor(100000 + crypto.randomInt(900000)).toString();
  const codeHash = crypto.createHash("sha256").update(code + normalizedEmail).digest("hex");

  // 5. Store challenge in httpOnly signed cookie (stateless & resilient across all serverless containers)
  try {
    await setChallengeCookie({
      email: normalizedEmail,
      fullName: trimmedName,
      codeHash,
      defaultBatch: defaultBatch || undefined,
    });
  } catch (err) {
    console.warn("[student.server] Failed to set challenge cookie:", err);
  }

  // Also cache in memory & disk for local dev
  const challenge: VerificationChallenge = {
    email: normalizedEmail,
    fullName: trimmedName,
    code,
    defaultBatch: defaultBatch || undefined,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  };

  verificationChallenges.set(normalizedEmail, challenge);
  writeChallengeDisk(challenge);

  // 6. Build magic link if origin provided
  const magicLink = originUrl
    ? `${originUrl.replace(/\/$/, "")}/?verify_email=${encodeURIComponent(normalizedEmail)}&code=${code}`
    : undefined;

  // 7. Dispatch email
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

  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  return {
    success: true,
    message: `A 6-digit verification code has been dispatched to ${normalizedEmail}. Please check your official university Gmail inbox.`,
    devPreviewCode: !isProduction && emailRes.devMode ? code : undefined,
  };
}

/**
 * Validates the 6-digit code sent to the student's Gmail and creates their verified account
 */
export async function serverVerifyCodeAndSignUp(
  email: string,
  code: string,
  password: string,
): Promise<StudentAuthResponse> {
  try {
    const normalizedEmail = (email || "").trim().toLowerCase();
    const trimmedCode = (code || "").trim();

    // 1. Validate inputs
    if (!isValidUniversityEmail(normalizedEmail)) {
      return {
        success: false,
        error: "Invalid official university email address.",
      };
    }

    if (!trimmedCode || trimmedCode.length !== 6) {
      return {
        success: false,
        error: "Please enter the complete 6-digit verification code.",
      };
    }

    if (!password || password.length < 6) {
      return {
        success: false,
        error: "Password must be at least 6 characters long.",
      };
    }

    const computedHash = crypto
      .createHash("sha256")
      .update(trimmedCode + normalizedEmail)
      .digest("hex");

    let challengeFullName = "";
    let challengeDefaultBatch: string | undefined = undefined;
    let codeMatched = false;

    // 2. First check stateless signed cookie (works across any Vercel serverless container)
    try {
      const cookieChallenge = await getChallengeCookie();
      if (cookieChallenge && cookieChallenge.email === normalizedEmail) {
        if (Date.now() <= cookieChallenge.exp && cookieChallenge.codeHash === computedHash) {
          codeMatched = true;
          challengeFullName = cookieChallenge.fullName;
          challengeDefaultBatch = cookieChallenge.defaultBatch;
        }
      }
    } catch {
      // Continue to memory check
    }

    // 3. Fallback to memory / disk store
    if (!codeMatched) {
      let challenge = verificationChallenges.get(normalizedEmail);
      if (!challenge) {
        const disk = readChallengesDisk();
        if (disk && disk[normalizedEmail]) {
          challenge = disk[normalizedEmail];
          verificationChallenges.set(normalizedEmail, challenge);
        }
      }

      if (challenge && challenge.attempts < 5 && Date.now() <= challenge.expiresAt) {
        if (challenge.code === trimmedCode) {
          codeMatched = true;
          challengeFullName = challenge.fullName;
          challengeDefaultBatch = challenge.defaultBatch;
        } else {
          challenge.attempts += 1;
          writeChallengeDisk(challenge);
          return {
            success: false,
            error: "Incorrect 6-digit verification code. Please check your Gmail and try again.",
          };
        }
      }
    }

    if (!codeMatched) {
      return {
        success: false,
        error: "Invalid or expired verification code. Please request a new code.",
      };
    }

    // 4. Code verified successfully! Clean up challenge
    await clearChallengeCookie();
    verificationChallenges.delete(normalizedEmail);
    removeChallengeDisk(normalizedEmail);

    // 5. Check if student already exists -> if so, update password and sign in directly
    const existing = await findStudentByEmail(normalizedEmail);
    if (existing) {
      const { hash, salt } = hashPassword(password);
      existing.passwordHash = hash;
      existing.passwordSalt = salt;
      existing.lastLoginAt = new Date().toISOString();
      if (challengeDefaultBatch) {
        existing.defaultBatch = challengeDefaultBatch;
      }
      if (challengeFullName && challengeFullName.length >= 2) {
        existing.fullName = challengeFullName;
      }

      serverStudentMemoryStore.set(normalizedEmail, existing);
      writeDiskBackup(existing);

      try {
        await ensureStudentTableExists();
        const sql = await getSql();
        await sql.query(
          `UPDATE cui_students
           SET full_name = $1, password_hash = $2, password_salt = $3, default_batch = COALESCE($4, default_batch), last_login_at = now(), updated_at = now()
           WHERE LOWER(email) = LOWER($5)`,
          [existing.fullName, hash, salt, challengeDefaultBatch || null, normalizedEmail],
        );
      } catch (err) {
        console.warn("[student.server] DB student password update notice:", err);
      }

      await createAndSetSessionCookie({
        sub: existing.email,
        role: "student",
        name: existing.fullName,
        batch: existing.defaultBatch || undefined,
      });

      return {
        success: true,
        session: createStudentSession(existing),
        credentialSync: {
          email: existing.email,
          fullName: existing.fullName,
          passwordHash: existing.passwordHash,
          passwordSalt: existing.passwordSalt,
          defaultBatch: existing.defaultBatch,
        },
      };
    }

    // 6. Otherwise register new student account
    return await serverStudentSignUp(
      normalizedEmail,
      challengeFullName,
      password,
      challengeDefaultBatch,
    );
  } catch (err: any) {
    console.error("[serverVerifyCodeAndSignUp] Critical error:", err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred during account verification.",
    };
  }
}
