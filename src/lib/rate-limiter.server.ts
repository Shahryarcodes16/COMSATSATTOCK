/**
 * Server-only Rate Limiting & Brute-Force Protection
 * Tracks failed login attempts per email/identifier and locks out after 5 consecutive failures for 15 minutes.
 */
import { getSql } from "./db.ts";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface MemoryRateRecord {
  failedCount: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

const memoryRateStore = new Map<string, MemoryRateRecord>();

async function ensureRateLimitTable() {
  try {
    const sql = await getSql();
    await sql.query(`
      CREATE TABLE IF NOT EXISTS cui_login_attempts (
        key TEXT PRIMARY KEY,
        failed_count INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_attempt TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  } catch (err) {
    console.warn("[rate-limiter] Table creation notice:", err);
  }
}

/**
 * Checks whether an email or IP address is currently locked out from logging in.
 */
export async function checkLoginRateLimit(
  rawKey: string,
): Promise<{ allowed: boolean; remainingMinutes?: number; error?: string }> {
  const key = (rawKey || "").trim().toLowerCase();
  if (!key) return { allowed: true };

  const now = Date.now();

  // 1. Check in-memory cache first
  const mem = memoryRateStore.get(key);
  if (mem?.lockedUntil && mem.lockedUntil > now) {
    const remainingMinutes = Math.ceil((mem.lockedUntil - now) / 60000);
    return {
      allowed: false,
      remainingMinutes,
      error: `Account temporarily locked due to 5 consecutive failed attempts. Please try again in ${remainingMinutes} minute(s).`,
    };
  }

  // 2. Check Database
  try {
    await ensureRateLimitTable();
    const sql = await getSql();
    const rows = await sql.query<{
      failed_count: number;
      locked_until: string | null;
    }>(
      `SELECT failed_count, locked_until FROM cui_login_attempts WHERE key = $1 LIMIT 1`,
      [key],
    );

    if (rows && rows.length > 0) {
      const row = rows[0];
      if (row.locked_until) {
        const lockedUntilMs = new Date(row.locked_until).getTime();
        if (lockedUntilMs > now) {
          const remainingMinutes = Math.ceil((lockedUntilMs - now) / 60000);
          memoryRateStore.set(key, {
            failedCount: row.failed_count,
            lockedUntil: lockedUntilMs,
            lastAttempt: now,
          });
          return {
            allowed: false,
            remainingMinutes,
            error: `Account temporarily locked due to 5 consecutive failed attempts. Please try again in ${remainingMinutes} minute(s).`,
          };
        }
      }
    }
  } catch {
    // If DB check fails, rely on memory store
  }

  return { allowed: true };
}

/**
 * Records a failed login attempt. If 5 failures are reached, initiates a 15-minute lockout.
 */
export async function recordFailedLogin(
  rawKey: string,
): Promise<{ locked: boolean; remainingAttempts: number; remainingMinutes?: number }> {
  const key = (rawKey || "").trim().toLowerCase();
  const now = Date.now();

  let failedCount = 1;
  let lockedUntil: number | null = null;

  const current = memoryRateStore.get(key);
  if (current) {
    failedCount = current.failedCount + 1;
  }

  if (failedCount >= MAX_ATTEMPTS) {
    lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  // Update memory
  memoryRateStore.set(key, {
    failedCount,
    lockedUntil,
    lastAttempt: now,
  });

  // Update DB
  try {
    await ensureRateLimitTable();
    const sql = await getSql();
    const lockedUntilDate = lockedUntil ? new Date(lockedUntil).toISOString() : null;

    await sql.query(
      `
      INSERT INTO cui_login_attempts (key, failed_count, locked_until, last_attempt)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (key) DO UPDATE
      SET failed_count = EXCLUDED.failed_count,
          locked_until = EXCLUDED.locked_until,
          last_attempt = now()
    `,
      [key, failedCount, lockedUntilDate],
    );
  } catch {
    // Memory store holds state
  }

  if (lockedUntil) {
    return { locked: true, remainingAttempts: 0, remainingMinutes: 15 };
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - failedCount),
  };
}

/**
 * Resets failed attempt counter upon successful authentication.
 */
export async function resetLoginRateLimit(rawKey: string): Promise<void> {
  const key = (rawKey || "").trim().toLowerCase();
  memoryRateStore.delete(key);

  try {
    await ensureRateLimitTable();
    const sql = await getSql();
    await sql.query(`DELETE FROM cui_login_attempts WHERE key = $1`, [key]);
  } catch {
    // Ignore cleanup errors
  }
}
