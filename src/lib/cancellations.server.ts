/**
 * Server-side Persistence Layer for Class Cancellations
 * Automatically synchronizes faculty class cancellations to PostgreSQL/PGLite
 * so that students on all devices (mobile, laptop, desktop) immediately see cancellation alerts,
 * and room statuses are automatically freed across campus.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dbSource, getSql } from "./db.ts";
import type { ClassCancellationRecord } from "./timetable-types.ts";

let tableEnsured = false;
const inMemoryFallback = new Map<string, ClassCancellationRecord>();
const CANCELLATIONS_DISK_BACKUP = path.join(os.tmpdir(), "cui_class_cancellations_v1.json");

function readDiskCancellations(): ClassCancellationRecord[] {
  try {
    if (fs.existsSync(CANCELLATIONS_DISK_BACKUP)) {
      const parsed = JSON.parse(fs.readFileSync(CANCELLATIONS_DISK_BACKUP, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // Ignore disk read error
  }
  return [];
}

function writeDiskCancellations(records: ClassCancellationRecord[]) {
  try {
    fs.writeFileSync(CANCELLATIONS_DISK_BACKUP, JSON.stringify(records), "utf8");
  } catch {
    // Ignore disk write error
  }
}

function hydrateFallbackFromDisk() {
  if (inMemoryFallback.size > 0) return;
  for (const r of readDiskCancellations()) {
    inMemoryFallback.set(r.id, r);
  }
}

export async function ensureCancellationsTable() {
  if (tableEnsured) return;
  const sql = await getSql();

  try {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS class_cancellations (
        id TEXT PRIMARY KEY,
        day INTEGER NOT NULL,
        slot INTEGER NOT NULL,
        batch INTEGER NOT NULL,
        batch_name TEXT NOT NULL,
        room INTEGER NOT NULL,
        room_name TEXT NOT NULL,
        teacher INTEGER NOT NULL,
        teacher_name TEXT NOT NULL,
        subject INTEGER NOT NULL,
        subject_name TEXT NOT NULL,
        target_date TEXT NOT NULL,
        target_date_label TEXT NOT NULL,
        reason TEXT NOT NULL,
        cancelled_at TEXT NOT NULL,
        cancelled_by_email TEXT NOT NULL,
        settled_by_makeup_id TEXT,
        status TEXT NOT NULL DEFAULT 'active'
      )
    `);

    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_cancellations_lookup 
      ON class_cancellations (batch, day, slot, status)
    `);

    tableEnsured = true;
  } catch (err) {
    console.warn("[cancellations.server] Table creation warning (using fallback):", err);
  }
}

export async function serverGetAllActiveCancellations(): Promise<ClassCancellationRecord[]> {
  try {
    await ensureCancellationsTable();
    const sql = await getSql();
    const rows = await sql.query<any>(
      `SELECT * FROM class_cancellations WHERE status = 'active' ORDER BY cancelled_at DESC`,
    );

    if (Array.isArray(rows)) {
      const mapped = rows.map((r) => ({
        id: String(r.id),
        day: Number(r.day),
        slot: Number(r.slot),
        batch: Number(r.batch),
        batchName: String(r.batch_name || ""),
        room: Number(r.room),
        roomName: String(r.room_name || ""),
        teacher: Number(r.teacher),
        teacherName: String(r.teacher_name || ""),
        subject: Number(r.subject),
        subjectName: String(r.subject_name || ""),
        targetDate: String(r.target_date || ""),
        targetDateLabel: String(r.target_date_label || ""),
        reason: String(r.reason || ""),
        cancelledAt: String(r.cancelled_at || ""),
        cancelledByEmail: String(r.cancelled_by_email || ""),
        settledByMakeupId: r.settled_by_makeup_id ? String(r.settled_by_makeup_id) : undefined,
        status: (r.status as "active" | "settled") || "active",
      }));

      // If running on PGLite without persistent Postgres, merge with tmp disk backup in case PGLite reset
      if (dbSource !== "neon" && mapped.length === 0) {
        hydrateFallbackFromDisk();
        const diskActive = Array.from(inMemoryFallback.values()).filter((c) => c.status === "active");
        if (diskActive.length > 0) return diskActive;
      }

      return mapped;
    }
  } catch (err) {
    console.error("[cancellations.server] Error fetching cancellations:", err);
  }

  hydrateFallbackFromDisk();
  return Array.from(inMemoryFallback.values()).filter((c) => c.status === "active");
}

export async function serverGetCancellationsWithStatus(): Promise<{
  records: ClassCancellationRecord[];
  persistent: boolean;
}> {
  const records = await serverGetAllActiveCancellations();
  return {
    records,
    persistent: dbSource === "neon",
  };
}

export async function serverAddClassCancellation(
  record: ClassCancellationRecord,
): Promise<ClassCancellationRecord> {
  const res = await serverAddClassCancellationWithStatus(record);
  return res.record;
}

export async function serverAddClassCancellationWithStatus(
  record: ClassCancellationRecord,
): Promise<{
  record: ClassCancellationRecord;
  persistent: boolean;
  dbSaved: boolean;
}> {
  hydrateFallbackFromDisk();
  inMemoryFallback.set(record.id, record);
  writeDiskCancellations(Array.from(inMemoryFallback.values()));

  let dbSaved = false;
  try {
    await ensureCancellationsTable();
    const sql = await getSql();

    await sql.query(
      `
      INSERT INTO class_cancellations (
        id, day, slot, batch, batch_name, room, room_name, teacher, teacher_name,
        subject, subject_name, target_date, target_date_label, reason, cancelled_at,
        cancelled_by_email, settled_by_makeup_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        reason = EXCLUDED.reason,
        status = EXCLUDED.status,
        settled_by_makeup_id = EXCLUDED.settled_by_makeup_id
      `,
      [
        record.id,
        record.day,
        record.slot,
        record.batch,
        record.batchName,
        record.room,
        record.roomName,
        record.teacher,
        record.teacherName,
        record.subject,
        record.subjectName,
        record.targetDate,
        record.targetDateLabel,
        record.reason,
        record.cancelledAt,
        record.cancelledByEmail,
        record.settledByMakeupId || null,
        record.status,
      ],
    );
    dbSaved = true;
  } catch (err) {
    console.error("[cancellations.server] Error inserting cancellation:", err);
  }

  return {
    record,
    persistent: dbSource === "neon" && dbSaved,
    dbSaved,
  };
}

export async function serverRemoveClassCancellation(id: string): Promise<boolean> {
  hydrateFallbackFromDisk();
  inMemoryFallback.delete(id);
  writeDiskCancellations(Array.from(inMemoryFallback.values()));

  try {
    await ensureCancellationsTable();
    const sql = await getSql();
    await sql.query(`DELETE FROM class_cancellations WHERE id = $1`, [id]);
    return true;
  } catch (err) {
    console.error("[cancellations.server] Error deleting cancellation:", err);
    return false;
  }
}

export async function serverSettleClassCancellation(
  cancellationId: string,
  makeupId: string,
): Promise<boolean> {
  hydrateFallbackFromDisk();
  const existing = inMemoryFallback.get(cancellationId);
  if (existing) {
    existing.status = "settled";
    existing.settledByMakeupId = makeupId;
    writeDiskCancellations(Array.from(inMemoryFallback.values()));
  }

  try {
    await ensureCancellationsTable();
    const sql = await getSql();
    await sql.query(
      `UPDATE class_cancellations SET status = 'settled', settled_by_makeup_id = $1 WHERE id = $2`,
      [makeupId, cancellationId],
    );
    return true;
  } catch (err) {
    console.error("[cancellations.server] Error settling cancellation:", err);
    return false;
  }
}
