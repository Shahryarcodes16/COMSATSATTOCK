-- Migration: 0001_admin_settings.sql
-- Global Admin configuration, passkeys, and broadcast notices

CREATE TABLE IF NOT EXISTS cui_admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

-- Seed initial default passkey if not present
INSERT INTO cui_admin_settings (key, value, updated_at, updated_by)
VALUES ('admin_passkey', 'cuiatk@2026', now(), 'system')
ON CONFLICT (key) DO NOTHING;
