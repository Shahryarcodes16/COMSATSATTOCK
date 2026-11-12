-- Migration: 0005_class_cancellations.sql
-- Persists faculty class cancellations across all campus devices and frees venues in real time

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
);

CREATE INDEX IF NOT EXISTS idx_cancellations_lookup
ON class_cancellations (batch, day, slot, status);
