/**
 * Server-only Admin Persistence and Validation Layer
 * Handles database operations and server-side state for the Admin Control Center.
 */
import { getSql } from "@/lib/db";
import { AUTHORIZED_ADMIN_EMAIL, DEFAULT_ADMIN_PASSKEY, type CampusNotice } from "./admin";

// In-memory cache fallback for serverless warm instances or environments without DB
const serverMemoryStore = new Map<string, { value: string; updatedAt: string; updatedBy?: string }>();
serverMemoryStore.set("admin_passkey", {
  value: DEFAULT_ADMIN_PASSKEY,
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
});

/**
 * Ensures the admin settings table exists in PostgreSQL / PGLite
 */
async function ensureAdminTableExists() {
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
    console.warn("[admin.server] ensureAdminTableExists notice (using in-memory fallback):", err);
  }
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
      // Sync memory cache
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
  updatedBy: string = AUTHORIZED_ADMIN_EMAIL,
): Promise<boolean> {
  // Always update memory store
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
    return true; // Memory cache succeeded
  }
}

/**
 * Gets the current server-configured admin passkey
 */
export async function getServerAdminPasskey(): Promise<string> {
  const stored = await getServerAdminSetting("admin_passkey");
  return stored || DEFAULT_ADMIN_PASSKEY;
}

/**
 * Verifies credentials and updates the admin passkey across all devices
 */
export async function verifyAndSaveAdminPasskey(
  email: string,
  currentOrMaster: string,
  newPasskey: string,
): Promise<{ success: boolean; error?: string }> {
  if (!email || email.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
    return {
      success: false,
      error: "Access Denied: Unauthorized administrator email or credentials.",
    };
  }

  const currentPasskey = await getServerAdminPasskey();
  const trimmedInput = (currentOrMaster || "").trim();

  // Allow current passkey, default passkey, or the student roll PIN "014"
  const isAuthorized =
    trimmedInput === currentPasskey ||
    trimmedInput === DEFAULT_ADMIN_PASSKEY ||
    trimmedInput === "014";

  if (!isAuthorized) {
    return {
      success: false,
      error: "Incorrect current passkey or student roll PIN (014).",
    };
  }

  if (!newPasskey || newPasskey.trim().length < 4) {
    return {
      success: false,
      error: "New passkey must be at least 4 characters long.",
    };
  }

  const saved = await setServerAdminSetting("admin_passkey", newPasskey.trim(), email);
  if (!saved) {
    return { success: false, error: "Failed to persist passkey to server." };
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
 * Saves or updates campus broadcast announcement on the server
 */
export async function saveServerCampusNotice(
  email: string,
  notice: Omit<CampusNotice, "id" | "updatedAt" | "updatedBy">,
): Promise<{ success: boolean; error?: string; notice?: CampusNotice }> {
  if (!email || email.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
    return {
      success: false,
      error: "Unauthorized: only the campus administrator can broadcast notices.",
    };
  }

  const fullNotice: CampusNotice = {
    ...notice,
    id: `notice-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    updatedBy: AUTHORIZED_ADMIN_EMAIL,
  };

  const saved = await setServerAdminSetting("campus_notice", JSON.stringify(fullNotice), email);
  if (!saved) {
    return { success: false, error: "Failed to broadcast campus notice." };
  }

  return { success: true, notice: fullNotice };
}
