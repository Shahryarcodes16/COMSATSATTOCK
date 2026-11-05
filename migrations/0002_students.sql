-- Migration: 0002_students.sql
-- Student accounts, credentials, and personalized profile preferences

CREATE TABLE IF NOT EXISTS cui_students (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  session TEXT NOT NULL,          -- 'fa' or 'sp'
  year TEXT NOT NULL,             -- '20' through '26'
  program_code TEXT NOT NULL,     -- 'bcs', 'bse', etc.
  roll_number TEXT NOT NULL,      -- '014', etc.
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  default_batch TEXT,             -- e.g. 'BS(CS)-V'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cui_students_email ON cui_students (email);
