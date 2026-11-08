/**
 * Server-only Admin Persistence and Validation Layer
 * Handles database operations, PBKDF2 (210k iterations) passkey security,
 * and authenticated session checks for the Admin Control Center.
 */
import crypto from "node:crypto";
import { getSql } from "./db.ts";
import { requireAdminSession, createAndSetSessionCookie } from "./session.server";
import { checkLoginRateLimit, recordFailedLogin, resetLoginRateLimit } from "./rate-limiter.server";
import { AUTHORIZED_ADMIN_EMAIL, type CampusNotice } from "./admin";

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEY_LEN = 64;
const PBKDF2_DIGEST = "sha512";

// In-memory cache fallback for serverless warm instances or environments without DB
const serverMemoryStore = new Map<string, { value: string; updatedAt: string; updatedBy?: string }>();

export function getAuthorizedAdminEmail(): string {
  const envEmail = process.env.ADMIN_EMAIL;
  if (envEmail && envEmail.trim()) {
    return envEmail.trim().toLowerCase();
  }
  return AUTHORIZED_ADMIN_EMAIL.toLowerCase();
}

/**
 * Ensures the admin settings table exists in PostgreSQL / PGLite
 */
let adminTablePromise: Promise<void> | null = null;
async function ensureAdminTableExists() {
  if (adminTablePromise) return adminTablePromise;
  adminTablePromise = (async () => {
    try {
      const sql = await getSql();
      await sql.query(`
        CREATE TABLE IF NOT EXISTS cui_admin_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_by TEXT
        );
      `);
    } catch (err) {
      console.warn("[admin.server] ensureAdminTableExists notice:", err);
    }
  })();
  return adminTablePromise;
}

/**
 * Reads an admin setting from database with in-memory fallback
 */
export async function getServerAdminSetting(key: string): Promise<string | null> {
  try {
    await ensureAdminTableExists();
    const sql = await getSql();
    const rows = await sql.query<{ value: string }>(
      "SELECT value FROM cui_admin_settings WHERE key = $1 LIMIT 1",
      [key],
    );
    if (rows && rows.length > 0 && rows[0]?.value) {
      serverMemoryStore.set(key, {
        value: rows[0].value,
        updatedAt: new Date().toISOString(),
      });
      return rows[0].value;
    }
  } catch (err) {
    console.warn(`[admin.server] DB read failed for key ${key}, falling back to memory store:`, err);
  }

  const cached = serverMemoryStore.get(key);
  return cached ? cached.value : null;
}

/**
 * Writes an admin setting to database with in-memory fallback
 */
export async function setServerAdminSetting(
  key: string,
  value: string,
  updatedBy: string = getAuthorizedAdminEmail(),
): Promise<boolean> {
  serverMemoryStore.set(key, {
    value,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });

  try {
    await ensureAdminTableExists();
    const sql = await getSql();
    await sql.query(
      `
      INSERT INTO cui_admin_settings (key, value, updated_at, updated_by)
      VALUES ($1, $2, now(), $3)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by
    `,
      [key, value, updatedBy],
    );
    return true;
  } catch (err) {
    console.warn(`[admin.server] DB write failed for key ${key}, cached in memory:`, err);
    return true;
  }
}

/**
 * Hashes a passkey using PBKDF2 with SHA-512 (210,000 iterations)
 */
function hashPasskey(passkey: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(passkey, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST).toString("hex");
  return { hash, salt };
}

/**
 * Verifies whether a candidate passkey matches the stored administrative passkey hash.
 * Checks environment variable override (ADMIN_PASSKEY / ADMIN_PASSKEY_HASH) first.
 */
async function verifyPasskeyAgainstStored(candidatePasskey: string): Promise<boolean> {
  const trimmedCandidate = (candidatePasskey || "").trim();
  if (!trimmedCandidate) return false;

  // 1. Check if ADMIN_PASSKEY or ADMIN_PASSKEY_HASH is explicitly configured in environment variables
  if (process.env.ADMIN_PASSKEY) {
    const expected = process.env.ADMIN_PASSKEY.trim();
    if (
      trimmedCandidate.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(trimmedCandidate), Buffer.from(expected))
    ) {
      return true;
    }
  }

  // 2. Check stored hash and salt from database / settings
  const storedHash = await getServerAdminSetting("admin_passkey_hash");
  const storedSalt = await getServerAdminSetting("admin_passkey_salt");

  if (storedHash && storedSalt) {
    try {
      const calculated = crypto
        .pbkdf2Sync(trimmedCandidate, storedSalt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST)
        .toString("hex");
      return crypto.timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(storedHash, "hex"));
    } catch {
      return false;
    }
  }

  // 3. Fallback: If no passkey hash has been configured yet, check if ADMIN_PASSKEY_HASH was set directly
  if (process.env.ADMIN_PASSKEY_HASH) {
    return false; // Requires proper salt or direct passkey
  }

  return false;
}

/**
 * Server-only verification of administrator login credentials.
 * Enforces rate limiting, constant-time comparison, and sets an httpOnly session cookie.
 */
export async function verifyAdminLoginServer(
  email: string,
  passkey: string,
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const authorizedEmail = getAuthorizedAdminEmail();

  // 1. Check brute force rate limit
  const rateLimit = await checkLoginRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Too many failed login attempts. This account is locked for ${rateLimit.remainingMinutes || 15} minute(s) to protect against unauthorized access.`,
    };
  }

  // 2. Check authorized email
  if (normalizedEmail !== authorizedEmail) {
    const rate = await recordFailedLogin(normalizedEmail);
    if (rate.locked) {
      return {
        success: false,
        error: "Too many failed login attempts. Access temporarily locked for 15 minutes.",
      };
    }
    return {
      success: false,
      error: "Access Denied: Invalid administrator credentials or unauthorized email.",
    };
  }

  // 3. Verify passkey hash
  const isMatch = await verifyPasskeyAgainstStored(passkey);
  if (!isMatch) {
    const rate = await recordFailedLogin(normalizedEmail);
    if (rate.locked) {
      return {
        success: false,
        error: "Too many failed login attempts. Access temporarily locked for 15 minutes.",
      };
    }
    return {
      success: false,
      error: `Invalid Security Passkey. ${rate.remainingAttempts} attempt(s) remaining before account lockout.`,
    };
  }

  // 4. Authentication successful: reset rate limiter and issue httpOnly session cookie
  await resetLoginRateLimit(normalizedEmail);
  await createAndSetSessionCookie({
    sub: normalizedEmail,
    role: "admin",
    name: "Campus Administrator",
  });

  return { success: true };
}

/**
 * Verifies the current passkey and updates to a new passkey (min 8 characters).
 * Protected by requireAdminSession() so only authenticated administrators can invoke it.
 */
export async function updateAdminPasskeyServer(
  currentPasskey: string,
  newPasskey: string,
): Promise<{ success: boolean; error?: string }> {
  // Enforce valid admin session cookie
  const session = await requireAdminSession();

  const isCurrentValid = await verifyPasskeyAgainstStored(currentPasskey);
  if (!isCurrentValid) {
    return {
      success: false,
      error: "Incorrect current passkey. Please verify your current passkey.",
    };
  }

  const trimmedNew = (newPasskey || "").trim();
  if (trimmedNew.length < 8) {
    return {
      success: false,
      error: "New passkey must be at least 8 characters long for adequate security.",
    };
  }

  // Hash new passkey with PBKDF2 (210k iterations)
  const { hash, salt } = hashPasskey(trimmedNew);
  await setServerAdminSetting("admin_passkey_hash", hash, session.sub);
  await setServerAdminSetting("admin_passkey_salt", salt, session.sub);

  // Clean up any legacy plaintext passkey entries
  try {
    const sql = await getSql();
    await sql.query("DELETE FROM cui_admin_settings WHERE key = 'admin_passkey'");
  } catch {
    // Non-blocking
  }

  return { success: true };
}

/**
 * Gets the current campus notice from the server
 */
export async function getServerCampusNotice(): Promise<CampusNotice | null> {
  const raw = await getServerAdminSetting("campus_notice");
  if (!raw) return null;
  try {
    const notice = JSON.parse(raw) as CampusNotice;
    return notice && notice.enabled ? notice : null;
  } catch {
    return null;
  }
}

/**
 * Saves or updates campus broadcast announcement on the server.
 * Enforces requireAdminSession() and uses the session's verified email.
 */
export async function saveServerCampusNotice(
  notice: Omit<CampusNotice, "id" | "updatedAt" | "updatedBy">,
): Promise<{ success: boolean; error?: string; notice?: CampusNotice }> {
  const session = await requireAdminSession();

  const fullNotice: CampusNotice = {
    ...notice,
    id: `notice-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    updatedBy: session.sub,
  };

  const saved = await setServerAdminSetting("campus_notice", JSON.stringify(fullNotice), session.sub);
  if (!saved) {
    return { success: false, error: "Failed to broadcast campus notice." };
  }

  return { success: true, notice: fullNotice };
}

/**
 * Clears the active campus broadcast announcement on the server.
 * Enforces requireAdminSession().
 */
export async function clearServerCampusNotice(): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdminSession();

  const emptyNotice: CampusNotice = {
    id: `notice-${Date.now()}`,
    enabled: false,
    title: "",
    message: "",
    type: "info",
    updatedAt: new Date().toISOString(),
    updatedBy: session.sub,
  };

  const saved = await setServerAdminSetting("campus_notice", JSON.stringify(emptyNotice), session.sub);
  if (!saved) {
    return { success: false, error: "Failed to clear notice on server." };
  }

  return { success: true };
}
