-- Sprint 2: Audit Log improvements for Company Admin
-- 1. Add company_id column for tenant-scoped filtering
-- 2. Extend allowed action_type values
-- 3. RLS policy so company admins see only their tenant's logs

-- Add company_id column
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs (company_id, created_at DESC);

-- Extend the action_type CHECK constraint to include company-admin events
-- Postgres requires dropping and recreating the constraint
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_type_check
  CHECK (action_type IN (
    'CREATE', 'UPDATE', 'DELETE',
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'ROLE_CHANGE', 'ASSIGN_COURSE', 'ASSIGN_EXAM',
    'COMPLETE_COURSE', 'COMPLETE_EXAM',
    'CREATE_COMPANY', 'UPDATE_COMPANY', 'DELETE_COMPANY',
    'CREATE_USER', 'UPDATE_USER', 'DELETE_USER',
    'UPLOAD_EMPLOYEES', 'EXPORT_DATA',
    -- new
    'CHANGE_PASSWORD', 'RESET_PASSWORD', 'UNLOCK_ACCOUNT',
    'SEND_REMINDER', 'UPDATE_SUBSCRIPTION'
  ));

-- Extend entity_type CHECK
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_entity_type_check
  CHECK (entity_type IN (
    'USER', 'COMPANY', 'COURSE', 'EXAM',
    'SUBSCRIPTION', 'INVOICE', 'EMPLOYEE',
    -- new
    'DEPARTMENT', 'CERTIFICATE'
  ));

-- RLS: ensure it's enabled (idempotent)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins see everything (may already exist)
DROP POLICY IF EXISTS "platform_admin_audit_logs" ON audit_logs;
CREATE POLICY "platform_admin_audit_logs" ON audit_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

-- Company admins see logs scoped to their company
DROP POLICY IF EXISTS "company_admin_audit_logs" ON audit_logs;
CREATE POLICY "company_admin_audit_logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role = 'COMPANY_ADMIN'
        AND company_id = audit_logs.company_id
    )
  );

-- Authenticated users may insert (company_id populated by the app)
DROP POLICY IF EXISTS "authenticated_insert_audit_logs" ON audit_logs;
CREATE POLICY "authenticated_insert_audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
