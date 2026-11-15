-- Migration: 0008_calendar_sync.sql
-- Live dynamic WebCal calendar synchronization for students, custom schedules, and batch sections

CREATE TABLE IF NOT EXISTS cui_calendar_syncs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  student_id TEXT,
  student_email TEXT,
  batch_name TEXT,
  entries_json TEXT NOT NULL,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cui_calendar_syncs_student ON cui_calendar_syncs (student_id);
CREATE INDEX IF NOT EXISTS idx_cui_calendar_syncs_batch ON cui_calendar_syncs (batch_name);
