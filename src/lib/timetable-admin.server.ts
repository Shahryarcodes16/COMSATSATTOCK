/**
 * Server-side Admin Timetable Management Persistence Layer
 * Handles database operations for versions, rollbacks, drafts, and active timetable loading.
 */
import crypto from "node:crypto";
import { getSql } from "./db.ts";
import { requireAdminSession } from "./session.server";
import { saveServerCampusNotice } from "./admin.server";
import { validateTimetable } from "./timetable-validator";
import { computeTimetableDiff } from "./timetable-diff";
import rawDefaultTimetable from "@/data/timetable.json";
import type {
  TimetableRaw,
  TimetableVersion,
  TimetableDraft,
  TimetableSummary,
  TimetableDiffSummary,
} from "./timetable-types";

// In-memory fallback caches
const versionsStore = new Map<string, TimetableVersion>();
const draftsStore = new Map<string, TimetableDraft>();
let activeVersionId: string | null = "v-default";

// Seed default version
const defaultVersion: TimetableVersion = {
  id: "v-default",
  versionName: "Fall-2026-V1 (Default)",
  timetableData: rawDefaultTimetable as TimetableRaw,
  status: "published",
  isActive: true,
  publishedAt: new Date("2026-10-05T08:00:00Z").toISOString(),
  publishedBy: "system",
  summary: {
    totalLectures: rawDefaultTimetable.e.length,
    batchesCount: rawDefaultTimetable.b.length,
    roomsCount: rawDefaultTimetable.r.length,
    teachersCount: rawDefaultTimetable.t.length,
  },
  createdAt: new Date("2026-10-05T08:00:00Z").toISOString(),
};
versionsStore.set("v-default", defaultVersion);

/**
 * Ensures table existence in PostgreSQL or PGLite
 */
let timetableTablesPromise: Promise<void> | null = null;
async function ensureTablesExist() {
  if (timetableTablesPromise) return timetableTablesPromise;
  timetableTablesPromise = (async () => {
    try {
      const sql = await getSql();
      await sql.query(`
        CREATE TABLE IF NOT EXISTS cui_timetable_versions (
          id TEXT PRIMARY KEY,
          version_name TEXT NOT NULL UNIQUE,
          timetable_data JSONB NOT NULL,
          status TEXT NOT NULL DEFAULT 'published',
          is_active BOOLEAN NOT NULL DEFAULT FALSE,
          published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          published_by TEXT NOT NULL DEFAULT 'admin',
          scheduled_for TIMESTAMPTZ,
          summary JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await sql.query(`
        CREATE TABLE IF NOT EXISTS cui_timetable_drafts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          timetable_data JSONB NOT NULL,
          stats JSONB,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          created_by TEXT NOT NULL DEFAULT 'admin'
        )
      `);
    } catch (err) {
      console.warn("[timetable-admin.server] ensureTablesExist notice:", err);
    }
  })();
  return timetableTablesPromise;
}

/**
 * Gets the currently active timetable version for public and admin consumption.
 */
export async function getActiveTimetableServer(): Promise<{
  versionName: string;
  timetableData: TimetableRaw;
  publishedAt: string;
  summary?: TimetableSummary;
}> {
  try {
    await ensureTablesExist();
    const sql = await getSql();
    const rows = await sql.query<{
      version_name: string;
      timetable_data: unknown;
      published_at: string;
      summary: unknown;
    }>(
      `SELECT version_name, timetable_data, published_at, summary 
       FROM cui_timetable_versions 
       WHERE is_active = true 
       ORDER BY published_at DESC 
       LIMIT 1`,
    );

    if (rows && rows.length > 0) {
      const row = rows[0];
      const data =
        typeof row.timetable_data === "string"
          ? JSON.parse(row.timetable_data)
          : row.timetable_data;
      const sum =
        typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary;

      return {
        versionName: row.version_name,
        timetableData: data as TimetableRaw,
        publishedAt: row.published_at,
        summary: sum,
      };
    }
  } catch (err) {
    console.warn("[timetable-admin.server] DB read failed for active timetable:", err);
  }

  // Fallback to in-memory active version or bundled default
  const activeVer = activeVersionId ? versionsStore.get(activeVersionId) : null;
  if (activeVer) {
    return {
      versionName: activeVer.versionName,
      timetableData: activeVer.timetableData,
      publishedAt: activeVer.publishedAt,
      summary: activeVer.summary,
    };
  }

  return {
    versionName: defaultVersion.versionName,
    timetableData: defaultVersion.timetableData,
    publishedAt: defaultVersion.publishedAt,
    summary: defaultVersion.summary,
  };
}

/**
 * Retrieves all published timetable versions for the history & rollback tab.
 */
export async function getAllTimetableVersionsServer(): Promise<TimetableVersion[]> {
  try {
    await ensureTablesExist();
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      version_name: string;
      timetable_data: unknown;
      status: string;
      is_active: boolean;
      published_at: string;
      published_by: string;
      scheduled_for: string | null;
      summary: unknown;
      created_at: string;
    }>(`SELECT * FROM cui_timetable_versions ORDER BY created_at DESC LIMIT 50`);

    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        versionName: r.version_name,
        timetableData:
          typeof r.timetable_data === "string"
            ? JSON.parse(r.timetable_data)
            : (r.timetable_data as TimetableRaw),
        status: (r.status as "published" | "archived" | "scheduled") || "published",
        isActive: Boolean(r.is_active),
        publishedAt: r.published_at,
        publishedBy: r.published_by,
        scheduledFor: r.scheduled_for,
        summary: typeof r.summary === "string" ? JSON.parse(r.summary) : r.summary,
        createdAt: r.created_at,
      }));
    }
  } catch (err) {
    console.warn("[timetable-admin.server] DB read failed for version list:", err);
  }

  // Return in-memory fallback list
  return Array.from(versionsStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Publishes a new timetable version with automated validation, clash rejection,
 * version snapshotting, and campus broadcast notification.
 */
export async function publishTimetableVersionServer(params: {
  versionName: string;
  timetableData: TimetableRaw;
  scheduledFor?: string | null;
}): Promise<{
  success: boolean;
  error?: string;
  version?: TimetableVersion;
  diff?: TimetableDiffSummary;
}> {
  const session = await requireAdminSession();
  const authorEmail = session.sub || "admin@cuiatk.edu.pk";

  const { versionName, timetableData, scheduledFor } = params;
  if (!versionName || !versionName.trim()) {
    return { success: false, error: "A version name (e.g. Fall-2026-V2) is required." };
  }

  // 1. Strict Validation: Check for clashes before allowing publish
  const validation = validateTimetable(timetableData);
  if (!validation.isValid) {
    const errorDetails = validation.clashes
      .filter((c) => c.severity === "error")
      .map((c) => c.message)
      .slice(0, 3)
      .join(" | ");
    return {
      success: false,
      error: `Validation failed with ${validation.totalErrors} conflict(s). Cannot publish until resolved: ${errorDetails}`,
    };
  }

  // 2. Fetch current active timetable to compute change diff summary
  const currentActive = await getActiveTimetableServer();
  const diff = computeTimetableDiff(currentActive.timetableData, timetableData);

  const summary: TimetableSummary = {
    totalLectures: timetableData.e.length,
    batchesCount: timetableData.b.length,
    roomsCount: timetableData.r.length,
    teachersCount: timetableData.t.length,
    changes: diff,
  };

  const id = `ver-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();

  const newVersion: TimetableVersion = {
    id,
    versionName: versionName.trim(),
    timetableData,
    status: scheduledFor ? "scheduled" : "published",
    isActive: !scheduledFor,
    publishedAt: now,
    publishedBy: authorEmail,
    scheduledFor: scheduledFor || null,
    summary,
    createdAt: now,
  };

  // 3. Write to database & in-memory cache
  try {
    await ensureTablesExist();
    const sql = await getSql();

    if (!scheduledFor) {
      // Deactivate older active versions
      await sql.query(
        `UPDATE cui_timetable_versions SET is_active = false, status = 'archived' WHERE is_active = true`,
      );
    }

    await sql.query(
      `INSERT INTO cui_timetable_versions 
       (id, version_name, timetable_data, status, is_active, published_at, published_by, scheduled_for, summary, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        newVersion.id,
        newVersion.versionName,
        JSON.stringify(newVersion.timetableData),
        newVersion.status,
        newVersion.isActive,
        newVersion.publishedAt,
        newVersion.publishedBy,
        newVersion.scheduledFor,
        JSON.stringify(newVersion.summary),
        newVersion.createdAt,
      ],
    );
  } catch (err) {
    console.warn("[timetable-admin.server] DB write failed for new version, stored in memory:", err);
  }

  // Update memory store
  if (!scheduledFor) {
    for (const v of versionsStore.values()) {
      v.isActive = false;
      v.status = "archived";
    }
    activeVersionId = id;
  }
  versionsStore.set(id, newVersion);

  // 4. Automated Campus Broadcast Notification
  if (!scheduledFor) {
    await saveServerCampusNotice({
      enabled: true,
      title: `Timetable Updated (${versionName.trim()})`,
      message: `The official campus timetable has been updated to ${versionName.trim()}. Please review your updated lectures, room radar, and faculty teaching hours.`,
      type: "info",
    });
  }

  return {
    success: true,
    version: newVersion,
    diff,
  };
}

/**
 * Rolls back the active timetable to any selected historical version with one click.
 */
export async function rollbackTimetableVersionServer(versionId: string): Promise<{
  success: boolean;
  error?: string;
  version?: TimetableVersion;
}> {
  await requireAdminSession();

  let targetVersion: TimetableVersion | undefined;

  try {
    await ensureTablesExist();
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      version_name: string;
      timetable_data: unknown;
      status: string;
      is_active: boolean;
      published_at: string;
      published_by: string;
      scheduled_for: string | null;
      summary: unknown;
      created_at: string;
    }>(`SELECT * FROM cui_timetable_versions WHERE id = $1 LIMIT 1`, [versionId]);

    if (rows && rows.length > 0) {
      const r = rows[0];
      targetVersion = {
        id: r.id,
        versionName: r.version_name,
        timetableData:
          typeof r.timetable_data === "string"
            ? JSON.parse(r.timetable_data)
            : (r.timetable_data as TimetableRaw),
        status: "published",
        isActive: true,
        publishedAt: new Date().toISOString(),
        publishedBy: r.published_by,
        scheduledFor: null,
        summary: typeof r.summary === "string" ? JSON.parse(r.summary) : r.summary,
        createdAt: r.created_at,
      };

      // Set target active, all others inactive
      await sql.query(
        `UPDATE cui_timetable_versions SET is_active = false, status = 'archived'`,
      );
      await sql.query(
        `UPDATE cui_timetable_versions SET is_active = true, status = 'published', published_at = now() WHERE id = $1`,
        [versionId],
      );
    }
  } catch (err) {
    console.warn("[timetable-admin.server] DB rollback failed, checking memory:", err);
  }

  if (!targetVersion) {
    targetVersion = versionsStore.get(versionId);
  }

  if (!targetVersion) {
    return { success: false, error: "Target timetable version was not found." };
  }

  // Update memory
  for (const v of versionsStore.values()) {
    v.isActive = false;
    v.status = "archived";
  }
  targetVersion.isActive = true;
  targetVersion.status = "published";
  targetVersion.publishedAt = new Date().toISOString();
  activeVersionId = targetVersion.id;

  // Automated notification for rollback
  await saveServerCampusNotice({
    enabled: true,
    title: `Timetable Restored (${targetVersion.versionName})`,
    message: `The campus timetable has been rolled back to ${targetVersion.versionName}. Please verify your schedule.`,
    type: "warning",
  });

  return { success: true, version: targetVersion };
}

/**
 * Saves a timetable draft for later review / editing.
 */
export async function saveTimetableDraftServer(params: {
  id?: string;
  name: string;
  timetableData: TimetableRaw;
}): Promise<{ success: boolean; error?: string; draft?: TimetableDraft }> {
  const session = await requireAdminSession();
  const authorEmail = session.sub || "admin@cuiatk.edu.pk";

  const { id = `draft-${Date.now()}`, name, timetableData } = params;
  if (!name.trim()) return { success: false, error: "Draft name is required." };

  const validation = validateTimetable(timetableData);

  const draft: TimetableDraft = {
    id,
    name: name.trim(),
    timetableData,
    stats: validation.stats,
    updatedAt: new Date().toISOString(),
    createdBy: authorEmail,
  };

  try {
    await ensureTablesExist();
    const sql = await getSql();
    await sql.query(
      `INSERT INTO cui_timetable_drafts (id, name, timetable_data, stats, updated_at, created_by)
       VALUES ($1, $2, $3, $4, now(), $5)
       ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       timetable_data = EXCLUDED.timetable_data,
       stats = EXCLUDED.stats,
       updated_at = now()`,
      [draft.id, draft.name, JSON.stringify(draft.timetableData), JSON.stringify(draft.stats), draft.createdBy],
    );
  } catch (err) {
    console.warn("[timetable-admin.server] DB save draft failed, saving to memory:", err);
  }

  draftsStore.set(draft.id, draft);
  return { success: true, draft };
}

/**
 * Lists all saved timetable drafts.
 */
export async function getAllTimetableDraftsServer(): Promise<TimetableDraft[]> {
  try {
    await requireAdminSession();
  } catch {
    return [];
  }

  try {
    await ensureTablesExist();
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      name: string;
      timetable_data: unknown;
      stats: unknown;
      updated_at: string;
      created_by: string;
    }>(`SELECT * FROM cui_timetable_drafts ORDER BY updated_at DESC LIMIT 50`);

    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        timetableData:
          typeof r.timetable_data === "string"
            ? JSON.parse(r.timetable_data)
            : (r.timetable_data as TimetableRaw),
        stats: typeof r.stats === "string" ? JSON.parse(r.stats) : r.stats,
        updatedAt: r.updated_at,
        createdBy: r.created_by,
      }));
    }
  } catch (err) {
    console.warn("[timetable-admin.server] DB list drafts failed, returning memory:", err);
  }

  return Array.from(draftsStore.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * Deletes a draft by ID.
 */
export async function deleteTimetableDraftServer(id: string): Promise<{ success: boolean }> {
  await requireAdminSession();

  try {
    await ensureTablesExist();
    const sql = await getSql();
    await sql.query(`DELETE FROM cui_timetable_drafts WHERE id = $1`, [id]);
  } catch (err) {
    console.warn("[timetable-admin.server] DB delete draft failed:", err);
  }

  draftsStore.delete(id);
  return { success: true };
}
