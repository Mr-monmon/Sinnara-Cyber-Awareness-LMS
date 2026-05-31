-- Phase 1 (CRIT-01 / HIGH-07): tenant-isolation guard in user-admin edge function
-- Adds a SECURITY_BLOCKED action_type so blocked cross-tenant attempts can be
-- recorded in audit_logs for security monitoring.

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
    'CHANGE_PASSWORD', 'RESET_PASSWORD', 'UNLOCK_ACCOUNT',
    'SEND_REMINDER', 'UPDATE_SUBSCRIPTION',
    -- Phase 1: security monitoring
    'SECURITY_BLOCKED'
  ));
