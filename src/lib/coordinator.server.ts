/**
 * Server-only Coordinator Authentication & Persistence Layer
 * Integrates PBKDF2/SHA-512 credential security, official email OTP verification,
 * and database storage for Academic & Timetable Coordinators.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSql } from "./db.ts";
import { sendStudentVerificationEmail } from "./email.server.ts";
import { createAndSetSessionCookie, clearSessionCookie } from "./session.server.ts";
import { checkLoginRateLimit, recordFailedLogin, resetLoginRateLimit } from "./rate-limiter.server.ts";
import {
  isCoordinatorEmail,
  type CoordinatorProfile,
  type CoordinatorSession,
  type LocalRegisteredCoordinator,
} from "./coordinator.ts";

export interface CoordinatorRecord {
  id: string;
  email: string;
  fullName: string;
  department: string;
  designation: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  lastLoginAt: string;
}

// In-memory cache & disk backup
const serverCoordinatorMemoryStore = new Map<string, CoordinatorRecord>();
const COORDINATOR_DISK_BACKUP = path.join(os.tmpdir(), "cui_coordinator_db_v1.json");

interface CoordinatorVerificationChallenge {
  email: string;
  fullName: string;
  department: string;
  designation: string;
  code: string;
  expiresAt: number;
  attempts: number;
}
const coordinatorChallenges = new Map<string, CoordinatorVerificationChallenge>();
const COORDINATOR_CHALLENGES_DISK = path.join(os.tmpdir(), "cui_coordinator_challenges_v1.json");

function readCoordinatorDisk(): Record<string, CoordinatorRecord> {
  try {
    if (fs.existsSync(COORDINATOR_DISK_BACKUP)) {
      return JSON.parse(fs.readFileSync(COORDINATOR_DISK_BACKUP, "utf8"));
    }
  } catch {
    // Ignore
  }
  return {};
}

function writeCoordinatorDisk(record: CoordinatorRecord): void {
  try {
    const existing = readCoordinatorDisk();
    existing[record.email.toLowerCase()] = record;
    fs.writeFileSync(COORDINATOR_DISK_BACKUP, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Ignore
  }
}

function readCoordinatorChallengesDisk(): Record<string, CoordinatorVerificationChallenge> {
  try {
    if (fs.existsSync(COORDINATOR_CHALLENGES_DISK)) {
      return JSON.parse(fs.readFileSync(COORDINATOR_CHALLENGES_DISK, "utf8"));
    }
  } catch {
    // Ignore
  }
  return {};
}

function writeCoordinatorChallengeDisk(challenge: CoordinatorVerificationChallenge): void {
  try {
    const existing = readCoordinatorChallengesDisk();
    existing[challenge.email.toLowerCase()] = challenge;
    fs.writeFileSync(COORDINATOR_CHALLENGES_DISK, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Ignore
  }
}

function removeCoordinatorChallengeDisk(email: string): void {
  try {
    const existing = readCoordinatorChallengesDisk();
    delete existing[email.toLowerCase()];
    fs.writeFileSync(COORDINATOR_CHALLENGES_DISK, JSON.stringify(existing, null, 2), "utf8");
  } catch {
    // Ignore
  }
}

/**
 * Ensures cui_coordinator table exists in DB
 */
let coordinatorTablePromise: Promise<void> | null = null;
async function ensureCoordinatorTableExists(): Promise<void> {
  if (coordinatorTablePromise) return coordinatorTablePromise;
  coordinatorTablePromise = (async () => {
    try {
      const sql = await getSql();
      await sql.query(`
        CREATE TABLE IF NOT EXISTS cui_coordinator (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL,
          department TEXT NOT NULL,
          designation TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await sql.query(`
        CREATE INDEX IF NOT EXISTS idx_cui_coordinator_email ON cui_coordinator (email)
      `);
    } catch (err) {
      console.warn("[coordinator.server] DB table init notice:", err);
    }
  })();
  return coordinatorTablePromise;
}

const PBKDF2_ITERATIONS = 210000;
const LEGACY_PBKDF2_ITERATIONS = 10000;

function hashPassword(
  password: string,
  existingSalt?: string,
  iterations = PBKDF2_ITERATIONS,
): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return { hash, salt };
}

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

    const calculated10k = crypto
      .pbkdf2Sync(password, salt, LEGACY_PBKDF2_ITERATIONS, 64, "sha512")
      .toString("hex");
    if (crypto.timingSafeEqual(Buffer.from(calculated10k, "hex"), Buffer.from(hash, "hex"))) {
      return { valid: true, legacy: true };
    }
  } catch {
    // Ignore
  }
  return { valid: false, legacy: false };
}

function toCoordinatorProfile(record: CoordinatorRecord): CoordinatorProfile {
  return {
    id: record.id,
    email: record.email,
    fullName: record.fullName,
    department: record.department,
    designation: record.designation,
    createdAt: record.createdAt,
  };
}

function createCoordinatorSession(record: CoordinatorRecord): CoordinatorSession {
  const token = `cui-coord-${record.id}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  return {
    role: "coordinator",
    profile: toCoordinatorProfile(record),
    token,
    signedInAt: new Date().toISOString(),
  };
}

export async function findCoordinatorByEmail(email: string): Promise<CoordinatorRecord | null> {
  const normalized = email.trim().toLowerCase();

  // 1. Memory store
  const cached = serverCoordinatorMemoryStore.get(normalized);
  if (cached) return cached;

  // 2. Disk store
  const disk = readCoordinatorDisk();
  if (disk && disk[normalized]) {
    const record = disk[normalized];
    serverCoordinatorMemoryStore.set(normalized, record);
    return record;
  }

  // 3. Database
  try {
    await ensureCoordinatorTableExists();
    const sql = await getSql();
    const rows = await sql.query<any>(
      "SELECT * FROM cui_coordinator WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [normalized],
    );

    if (rows && rows.length > 0) {
      const row = rows[0];
      const record: CoordinatorRecord = {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        department: row.department || "Academic & Timetable Coordination Office",
        designation: row.designation || "Academic Timetable Coordinator",
        passwordHash: row.password_hash,
        passwordSalt: row.password_salt,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      };
      serverCoordinatorMemoryStore.set(normalized, record);
      writeCoordinatorDisk(record);
      return record;
    }
  } catch (err) {
    console.warn("[coordinator.server] DB read fallback:", err);
  }

  return null;
}

export interface CoordinatorAuthResponse {
  success: boolean;
  session?: CoordinatorSession;
  credentialSync?: {
    email: string;
    fullName: string;
    department: string;
    designation: string;
    passwordHash: string;
    passwordSalt: string;
  };
  error?: string;
}

/**
 * Step 1: Request 6-digit OTP verification code for official coordinator email
 */
export async function serverRequestCoordinatorVerificationCode(
  email: string,
  fullName: string,
  department = "Academic & Timetable Coordination Office",
  designation = "Academic Timetable Coordinator",
  originUrl?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const normalized = email.trim().toLowerCase();

  if (!isCoordinatorEmail(normalized)) {
    return {
      success: false,
      error: "Please enter an official faculty or staff university email (@cuiatk.edu.pk, @ciit-attock.edu.pk). Student emails cannot register as coordinator.",
    };
  }

  if (!fullName || fullName.trim().length < 2) {
    return {
      success: false,
      error: "Please enter your official full name.",
    };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const challenge: CoordinatorVerificationChallenge = {
    email: normalized,
    fullName: fullName.trim(),
    department: department.trim(),
    designation: designation.trim(),
    code,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins
    attempts: 0,
  };

  coordinatorChallenges.set(normalized, challenge);
  writeCoordinatorChallengeDisk(challenge);

  let magicLink: string | undefined;
  if (originUrl) {
    try {
      const url = new URL(originUrl);
      url.searchParams.set("verify_coordinator_email", normalized);
      url.searchParams.set("code", code);
      magicLink = url.toString();
    } catch {
      // Ignore URL errors
    }
  }

  const emailResult = await sendStudentVerificationEmail({
    toEmail: normalized,
    studentName: fullName.trim(),
    verificationCode: code,
    magicLink,
  });

  if (!emailResult.sent && !emailResult.devMode) {
    return {
      success: false,
      error: "Unable to dispatch verification email. Please contact the campus administrator.",
    };
  }

  return {
    success: true,
    message: `A 6-digit verification code has been dispatched to ${normalized}. Please check your official university inbox.`,
  };
}

/**
 * Step 2: Verify OTP code and register official coordinator account
 */
export async function serverVerifyCoordinatorCodeAndSignUp(
  email: string,
  code: string,
  password: string,
  department = "Academic & Timetable Coordination Office",
  designation = "Academic Timetable Coordinator",
): Promise<CoordinatorAuthResponse> {
  const normalized = email.trim().toLowerCase();

  if (!isCoordinatorEmail(normalized)) {
    return {
      success: false,
      error: "Invalid coordinator email domain. Must be @cuiatk.edu.pk or @ciit-attock.edu.pk.",
    };
  }

  if (!password || password.length < 6) {
    return {
      success: false,
      error: "Password must be at least 6 characters long.",
    };
  }

  let challenge = coordinatorChallenges.get(normalized);
  if (!challenge) {
    const disk = readCoordinatorChallengesDisk();
    if (disk && disk[normalized]) {
      challenge = disk[normalized];
      coordinatorChallenges.set(normalized, challenge);
    }
  }

  if (!challenge) {
    return {
      success: false,
      error: "No active verification challenge found. Please request a new verification code.",
    };
  }

  if (Date.now() > challenge.expiresAt) {
    coordinatorChallenges.delete(normalized);
    removeCoordinatorChallengeDisk(normalized);
    return {
      success: false,
      error: "Verification code has expired. Please request a fresh code.",
    };
  }

  challenge.attempts += 1;
  if (challenge.attempts > 5) {
    coordinatorChallenges.delete(normalized);
    removeCoordinatorChallengeDisk(normalized);
    return {
      success: false,
      error: "Too many incorrect verification attempts. Please request a new code.",
    };
  }

  if (challenge.code.trim() !== code.trim()) {
    return {
      success: false,
      error: "Invalid 6-digit verification code. Please check your official email.",
    };
  }

  // Verification succeeded - clear challenge
  coordinatorChallenges.delete(normalized);
  removeCoordinatorChallengeDisk(normalized);

  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();
  const id = `coord_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const record: CoordinatorRecord = {
    id,
    email: normalized,
    fullName: challenge.fullName || "Academic Coordinator",
    department: challenge.department || department,
    designation: challenge.designation || designation,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: now,
    lastLoginAt: now,
  };

  serverCoordinatorMemoryStore.set(normalized, record);
  writeCoordinatorDisk(record);

  try {
    await ensureCoordinatorTableExists();
    const sql = await getSql();
    await sql.query(
      `INSERT INTO cui_coordinator (id, email, full_name, department, designation, password_hash, password_salt, created_at, last_login_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         department = EXCLUDED.department,
         designation = EXCLUDED.designation,
         password_hash = EXCLUDED.password_hash,
         password_salt = EXCLUDED.password_salt,
         last_login_at = EXCLUDED.last_login_at,
         updated_at = now()`,
      [
        record.id,
        record.email,
        record.fullName,
        record.department,
        record.designation,
        record.passwordHash,
        record.passwordSalt,
        record.createdAt,
        record.lastLoginAt,
        now,
      ],
    );
  } catch (err) {
    console.warn("[coordinator.server] DB write fallback notice:", err);
  }

  const session = createCoordinatorSession(record);
  try {
    await createAndSetSessionCookie({
      id: record.id,
      email: record.email,
      fullName: record.fullName,
      role: "coordinator",
    });
  } catch {
    // Ignore cookie errors
  }

  return {
    success: true,
    session,
    credentialSync: {
      email: record.email,
      fullName: record.fullName,
      department: record.department,
      designation: record.designation,
      passwordHash: record.passwordHash,
      passwordSalt: record.passwordSalt,
    },
  };
}

/**
 * Sign In: Authenticates an official coordinator with email and password
 */
export async function serverCoordinatorSignIn(
  email: string,
  password: string,
  clientVaultAccount?: LocalRegisteredCoordinator,
): Promise<CoordinatorAuthResponse> {
  const normalized = email.trim().toLowerCase();

  if (!isCoordinatorEmail(normalized)) {
    return {
      success: false,
      error: "Please enter a valid official university email (@cuiatk.edu.pk, @ciit-attock.edu.pk).",
    };
  }

  const rateCheck = checkLoginRateLimit(normalized);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed login attempts. Please wait ${rateCheck.retryAfterSeconds}s before trying again.`,
    };
  }

  let record = await findCoordinatorByEmail(normalized);

  // If not found in server DB, check if client has registered account in local vault
  if (!record && clientVaultAccount && clientVaultAccount.email.toLowerCase() === normalized) {
    const verifiedVault = verifyPassword(
      password,
      clientVaultAccount.passwordHash,
      clientVaultAccount.passwordSalt,
    );

    if (verifiedVault.valid) {
      const now = new Date().toISOString();
      record = {
        id: clientVaultAccount.id || `coord_${Date.now()}`,
        email: normalized,
        fullName: clientVaultAccount.fullName || "Academic Coordinator",
        department: clientVaultAccount.department || "Academic & Timetable Coordination Office",
        designation: clientVaultAccount.designation || "Academic Timetable Coordinator",
        passwordHash: clientVaultAccount.passwordHash,
        passwordSalt: clientVaultAccount.passwordSalt,
        createdAt: clientVaultAccount.registeredAt || now,
        lastLoginAt: now,
      };

      serverCoordinatorMemoryStore.set(normalized, record);
      writeCoordinatorDisk(record);

      try {
        await ensureCoordinatorTableExists();
        const sql = await getSql();
        await sql.query(
          `INSERT INTO cui_coordinator (id, email, full_name, department, designation, password_hash, password_salt, created_at, last_login_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (email) DO UPDATE SET last_login_at = now()`,
          [
            record.id,
            record.email,
            record.fullName,
            record.department,
            record.designation,
            record.passwordHash,
            record.passwordSalt,
            record.createdAt,
            now,
            now,
          ],
        );
      } catch {
        // Ignore DB save errors
      }
    }
  }

  if (!record) {
    recordFailedLogin(normalized);
    return {
      success: false,
      error: "No coordinator account found for this email. Please register your official account first.",
    };
  }

  const { valid, legacy } = verifyPassword(password, record.passwordHash, record.passwordSalt);
  if (!valid) {
    recordFailedLogin(normalized);
    return {
      success: false,
      error: "Incorrect password. Please verify your credentials.",
    };
  }

  resetLoginRateLimit(normalized);

  // Upgrade legacy iterations if needed
  if (legacy) {
    const upgraded = hashPassword(password);
    record.passwordHash = upgraded.hash;
    record.passwordSalt = upgraded.salt;
    writeCoordinatorDisk(record);
  }

  const now = new Date().toISOString();
  record.lastLoginAt = now;
  writeCoordinatorDisk(record);

  const session = createCoordinatorSession(record);
  try {
    await createAndSetSessionCookie({
      id: record.id,
      email: record.email,
      fullName: record.fullName,
      role: "coordinator",
    });
  } catch {
    // Ignore cookie errors
  }

  return {
    success: true,
    session,
    credentialSync: {
      email: record.email,
      fullName: record.fullName,
      department: record.department,
      designation: record.designation,
      passwordHash: record.passwordHash,
      passwordSalt: record.passwordSalt,
    },
  };
}
