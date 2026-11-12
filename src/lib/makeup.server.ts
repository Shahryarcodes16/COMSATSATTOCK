/**
 * Server-side Persistence Layer for Arranged Make-up Classes
 * Persists teacher-scheduled make-up lectures to PostgreSQL/Neon so all students and faculty
 * receive real-time schedule, room-occupancy, and teacher-availability updates across devices.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dbSource, getSql } from "./db.ts";
import type { MakeupClassRecord } from "./makeup-classes.ts";

let tableEnsured = false;
const inMemoryMakeupFallback = new Map<string, MakeupClassRecord>();
const MAKEUP_DISK_BACKUP = path.join(os.tmpdir(), "cui_makeup_classes_v1.json");

function readDiskMakeups(): MakeupClassRecord[] {
  try {
    if (fs.existsSync(MAKEUP_DISK_BACKUP)) {
      const parsed = JSON.parse(fs.readFileSync(MAKEUP_DISK_BACKUP, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // Ignore disk read failure
  }
  return [];
}

function writeDiskMakeups(records: MakeupClassRecord[]) {
  try {
    fs.writeFileSync(MAKEUP_DISK_BACKUP, JSON.stringify(records), "utf8");
  } catch {
    // Ignore disk write failure
  }
}

function hydrateFallbackFromDisk() {
  if (inMemoryMakeupFallback.size > 0) return;
  for (const r of readDiskMakeups()) {
    inMemoryMakeupFallback.set(r.id, r);
  }
}

function isRecordCurrentlyActive(record: MakeupClassRecord, nowMs: number = Date.now()): boolean {
  if (record.status === "cancelled" || record.status === "completed") return false;
  if (record.expiresAt) {
    const exp = new Date(record.expiresAt).getTime();
    if (!Number.isNaN(exp) && nowMs >= exp) return false;
  }
  return true;
}

export async function ensureMakeupTable() {
  if (tableEnsured) return;
  const sql = await getSql();

  try {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS arranged_makeup_classes (
        id TEXT PRIMARY KEY,
        day INTEGER NOT NULL,
        slot INTEGER NOT NULL,
        batch INTEGER NOT NULL,
        room INTEGER NOT NULL,
        teacher INTEGER NOT NULL,
        subject INTEGER NOT NULL,
        note TEXT,
        target_date TEXT NOT NULL,
        target_date_label TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        auto_released_at TEXT,
        created_at TEXT NOT NULL,
        created_by_email TEXT NOT NULL
      )
    `);

    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_makeup_classes_lookup
      ON arranged_makeup_classes (status, day, slot, batch, teacher, room)
    `);

    tableEnsured = true;
  } catch (err) {
    console.warn("[makeup.server] Table creation warning:", err);
  }
}

export async function serverGetActiveMakeupClasses(): Promise<{
  records: MakeupClassRecord[];
  persistent: boolean;
}> {
  const nowMs = Date.now();
  try {
    await ensureMakeupTable();
    const sql = await getSql();
    const rows = await sql.query<any>(
      `SELECT * FROM arranged_makeup_classes WHERE status = 'active' ORDER BY created_at DESC`,
    );

    if (Array.isArray(rows)) {
      const mapped: MakeupClassRecord[] = rows.map((r) => ({
        id: String(r.id),
        day: Number(r.day),
        slot: Number(r.slot),
        batch: Number(r.batch),
        room: Number(r.room),
        teacher: Number(r.teacher),
        subject: Number(r.subject),
        note: r.note ? String(r.note) : undefined,
        targetDate: r.target_date ? String(r.target_date) : undefined,
        targetDateLabel: r.target_date_label ? String(r.target_date_label) : undefined,
        expiresAt: r.expires_at ? String(r.expires_at) : undefined,
        status: (r.status as MakeupClassRecord["status"]) || "active",
        autoReleasedAt: r.auto_released_at ? String(r.auto_released_at) : undefined,
        createdAt: String(r.created_at || new Date().toISOString()),
        createdByEmail: String(r.created_by_email || ""),
      }));

      // Auto-mark expired rows as completed cleanly
      const expiredIds = mapped
        .filter((m) => !isRecordCurrentlyActive(m, nowMs))
        .map((m) => m.id);
      if (expiredIds.length > 0) {
        try {
          await sql.query(
            `UPDATE arranged_makeup_classes SET status = 'completed', auto_released_at = $1 WHERE id = ANY($2::text[])`,
            [new Date(nowMs).toISOString(), expiredIds],
          );
        } catch {
          // Non-fatal cleanup warning
        }
      }

      const active = mapped.filter((m) => isRecordCurrentlyActive(m, nowMs));

      if (dbSource !== "neon" && active.length === 0) {
        hydrateFallbackFromDisk();
        const diskActive = Array.from(inMemoryMakeupFallback.values()).filter((m) =>
          isRecordCurrentlyActive(m, nowMs),
        );
        if (diskActive.length > 0) {
          return { records: diskActive, persistent: false };
        }
      }

      return { records: active, persistent: dbSource === "neon" };
    }
  } catch (err) {
    console.error("[makeup.server] Error fetching makeup classes:", err);
  }

  hydrateFallbackFromDisk();
  return {
    records: Array.from(inMemoryMakeupFallback.values()).filter((m) =>
      isRecordCurrentlyActive(m, nowMs),
    ),
    persistent: false,
  };
}

export async function serverAddMakeupClass(record: MakeupClassRecord): Promise<{
  record: MakeupClassRecord;
  persistent: boolean;
  dbSaved: boolean;
}> {
  hydrateFallbackFromDisk();
  inMemoryMakeupFallback.set(record.id, record);
  writeDiskMakeups(Array.from(inMemoryMakeupFallback.values()));

  let dbSaved = false;
  try {
    await ensureMakeupTable();
    const sql = await getSql();

    await sql.query(
      `
      INSERT INTO arranged_makeup_classes (
        id, day, slot, batch, room, teacher, subject, note,
        target_date, target_date_label, expires_at, status,
        auto_released_at, created_at, created_by_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        note = EXCLUDED.note,
        status = EXCLUDED.status,
        expires_at = EXCLUDED.expires_at,
        auto_released_at = EXCLUDED.auto_released_at
      `,
      [
        record.id,
        record.day,
        record.slot,
        record.batch,
        record.room,
        record.teacher,
        record.subject,
        record.note || null,
        record.targetDate || "",
        record.targetDateLabel || "",
        record.expiresAt || "",
        record.status || "active",
        record.autoReleasedAt || null,
        record.createdAt,
        record.createdByEmail,
      ],
    );
    dbSaved = true;
  } catch (err) {
    console.error("[makeup.server] Error inserting makeup class:", err);
  }

  return {
    record,
    persistent: dbSource === "neon" && dbSaved,
    dbSaved,
  };
}

export async function serverRemoveMakeupClass(id: string): Promise<boolean> {
  hydrateFallbackFromDisk();
  inMemoryMakeupFallback.delete(id);
  writeDiskMakeups(Array.from(inMemoryMakeupFallback.values()));

  try {
    await ensureMakeupTable();
    const sql = await getSql();
    await sql.query(`DELETE FROM arranged_makeup_classes WHERE id = $1`, [id]);
    return true;
  } catch (err) {
    console.error("[makeup.server] Error deleting makeup class:", err);
    return false;
  }
}
