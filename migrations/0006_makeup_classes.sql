-- Migration: 0006_makeup_classes.sql
-- Persists faculty-arranged make-up classes across all campus devices and updates room/teacher/batch schedules in real time

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
);

CREATE INDEX IF NOT EXISTS idx_makeup_classes_lookup
ON arranged_makeup_classes (status, day, slot, batch, teacher, room);
