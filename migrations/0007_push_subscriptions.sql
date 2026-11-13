-- Push notification subscriptions for real-time Web Push alerts even when app is closed
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_type VARCHAR(20) DEFAULT 'student',
  batch_id INT,
  teacher_id INT,
  lead_minutes INT DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_batch ON push_subscriptions(batch_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_teacher ON push_subscriptions(teacher_id);
