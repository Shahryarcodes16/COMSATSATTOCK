-- Migration: 0003_faculty.sql
-- Faculty accounts, official teacher linkages, and credentials

CREATE TABLE IF NOT EXISTS cui_faculty (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  teacher_id INTEGER,
  department TEXT NOT NULL,
  designation TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  notification_lead_mins INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cui_faculty_email ON cui_faculty (email);
CREATE INDEX IF NOT EXISTS idx_cui_faculty_teacher_id ON cui_faculty (teacher_id);
