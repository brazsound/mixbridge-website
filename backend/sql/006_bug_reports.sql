-- Bug reports from Mix Bridge app (privacy-first: no project paths, session names, or PII)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  log JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
