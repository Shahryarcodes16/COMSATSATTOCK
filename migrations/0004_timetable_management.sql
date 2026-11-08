-- Migration: 0004_timetable_management.sql
-- Stores timetable versions, history, rollback snapshots, and drafts

CREATE TABLE IF NOT EXISTS cui_timetable_versions (
  id TEXT PRIMARY KEY,
  version_name TEXT NOT NULL UNIQUE,
  timetable_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'published', -- 'published', 'archived', 'scheduled'
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by TEXT NOT NULL DEFAULT 'admin',
  scheduled_for TIMESTAMPTZ,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cui_timetable_versions_is_active ON cui_timetable_versions (is_active);
CREATE INDEX IF NOT EXISTS idx_cui_timetable_versions_created_at ON cui_timetable_versions (created_at DESC);

CREATE TABLE IF NOT EXISTS cui_timetable_drafts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timetable_data JSONB NOT NULL,
  stats JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'admin'
);
