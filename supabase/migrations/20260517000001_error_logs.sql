-- Internal error logging table. Replaces external Sentry dependency.
-- Errors are captured by the React ErrorBoundary and inserted by the
-- authenticated user (or anonymously when no session is available).
-- Only PLATFORM_ADMIN can read; only PLATFORM_ADMIN can update/delete.

CREATE TABLE IF NOT EXISTS error_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_email      TEXT,
  user_role       TEXT,
  error_name      TEXT NOT NULL,
  error_message   TEXT NOT NULL,
  error_stack     TEXT,
  component_stack TEXT,
  url             TEXT,
  user_agent      TEXT,
  fingerprint     TEXT NOT NULL,  -- hash of name+message+first stack line, for grouping
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at ON error_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON error_logs (fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved    ON error_logs (resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_company_id  ON error_logs (company_id);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user (and even anon, in case the crash happened before login)
-- can insert. We do not allow them to read back what they wrote.
DROP POLICY IF EXISTS error_logs_insert ON error_logs;
CREATE POLICY error_logs_insert ON error_logs
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS error_logs_select_platform ON error_logs;
CREATE POLICY error_logs_select_platform ON error_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  );

DROP POLICY IF EXISTS error_logs_update_platform ON error_logs;
CREATE POLICY error_logs_update_platform ON error_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  );

DROP POLICY IF EXISTS error_logs_delete_platform ON error_logs;
CREATE POLICY error_logs_delete_platform ON error_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'PLATFORM_ADMIN'
    )
  );
