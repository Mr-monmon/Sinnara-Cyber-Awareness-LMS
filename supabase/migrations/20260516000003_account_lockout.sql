-- Account Lockout: protect against brute-force login attempts
-- 5 failed attempts within 15 minutes → account locked for 15 minutes
-- Successful login resets the counter

CREATE TABLE IF NOT EXISTS auth_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text        NOT NULL,
  success      boolean     NOT NULL,
  ip_address   text,
  user_agent   text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_email_time_idx
  ON auth_attempts (lower(email), attempted_at DESC);

CREATE INDEX IF NOT EXISTS auth_attempts_attempted_at_idx
  ON auth_attempts (attempted_at);

-- Locked accounts (one row per locked email)
CREATE TABLE IF NOT EXISTS account_lockouts (
  email             text PRIMARY KEY,
  locked_until      timestamptz NOT NULL,
  failed_count      int         NOT NULL DEFAULT 0,
  last_attempt_at   timestamptz NOT NULL DEFAULT now(),
  unlocked_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  unlocked_at       timestamptz
);

-- Tuning knobs (constants embedded — change here if policy changes)
-- max_failures = 5, window = 15 min, lock_duration = 15 min

-- Check whether an account is currently locked.
-- Returns (locked boolean, locked_until timestamptz, minutes_remaining int)
CREATE OR REPLACE FUNCTION check_account_lockout(p_email text)
RETURNS TABLE(locked boolean, locked_until timestamptz, minutes_remaining int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_row   account_lockouts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM account_lockouts WHERE email = v_email;
  IF NOT FOUND OR v_row.locked_until < now() THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 0;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, v_row.locked_until,
                      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_row.locked_until - now())) / 60.0)::int);
END $$;

GRANT EXECUTE ON FUNCTION check_account_lockout(text) TO anon, authenticated;

-- Record an attempt and lock the account if threshold exceeded.
-- Returns (locked boolean, failed_count int, locked_until timestamptz)
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email      text,
  p_success    boolean,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE(locked boolean, failed_count int, locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email     text := lower(trim(p_email));
  v_window    interval := interval '15 minutes';
  v_max_fail  int := 5;
  v_lock_dur  interval := interval '15 minutes';
  v_recent    int;
  v_lock_until timestamptz;
BEGIN
  -- Log the attempt
  INSERT INTO auth_attempts (email, success, user_agent)
  VALUES (v_email, p_success, p_user_agent);

  IF p_success THEN
    -- Clear any existing lockout on successful login
    DELETE FROM account_lockouts WHERE email = v_email;
    RETURN QUERY SELECT false, 0, NULL::timestamptz;
    RETURN;
  END IF;

  -- Count failures within the window
  SELECT COUNT(*) INTO v_recent
  FROM auth_attempts
  WHERE lower(email) = v_email
    AND success = false
    AND attempted_at > now() - v_window;

  IF v_recent >= v_max_fail THEN
    v_lock_until := now() + v_lock_dur;
    INSERT INTO account_lockouts (email, locked_until, failed_count, last_attempt_at)
    VALUES (v_email, v_lock_until, v_recent, now())
    ON CONFLICT (email) DO UPDATE
      SET locked_until    = EXCLUDED.locked_until,
          failed_count    = EXCLUDED.failed_count,
          last_attempt_at = EXCLUDED.last_attempt_at,
          unlocked_by     = NULL,
          unlocked_at     = NULL;
    RETURN QUERY SELECT true, v_recent, v_lock_until;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, v_recent, NULL::timestamptz;
END $$;

GRANT EXECUTE ON FUNCTION record_login_attempt(text, boolean, text) TO anon, authenticated;

-- Admin unlock function: only platform admins and company admins (for their own employees) may call
CREATE OR REPLACE FUNCTION admin_unlock_account(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_caller_company uuid;
  v_target_company uuid;
BEGIN
  -- Read caller's role and company from the users table
  SELECT role, company_id INTO v_caller_role, v_caller_company
  FROM users WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Platform admins may unlock anyone
  IF v_caller_role = 'PLATFORM_ADMIN' THEN
    UPDATE account_lockouts
       SET locked_until = now(), unlocked_by = auth.uid(), unlocked_at = now()
     WHERE lower(email) = lower(trim(p_email));
    RETURN true;
  END IF;

  -- Company admins may unlock accounts in their own company
  IF v_caller_role = 'COMPANY_ADMIN' THEN
    SELECT company_id INTO v_target_company
    FROM users WHERE lower(email) = lower(trim(p_email));
    IF v_target_company IS NULL OR v_target_company <> v_caller_company THEN
      RAISE EXCEPTION 'Cannot unlock account outside your company';
    END IF;
    UPDATE account_lockouts
       SET locked_until = now(), unlocked_by = auth.uid(), unlocked_at = now()
     WHERE lower(email) = lower(trim(p_email));
    RETURN true;
  END IF;

  RAISE EXCEPTION 'Insufficient permissions';
END $$;

GRANT EXECUTE ON FUNCTION admin_unlock_account(text) TO authenticated;

-- RLS: lock down the raw tables; clients must go through the RPCs
ALTER TABLE auth_attempts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts  ENABLE ROW LEVEL SECURITY;

-- Platform admins can read auth_attempts and account_lockouts for monitoring
CREATE POLICY "platform_admin_read_attempts" ON auth_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

CREATE POLICY "platform_admin_read_lockouts" ON account_lockouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

-- Company admins can read lockouts for their company's employees
CREATE POLICY "company_admin_read_lockouts" ON account_lockouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users caller, users target
      WHERE caller.id = auth.uid()
        AND caller.role = 'COMPANY_ADMIN'
        AND lower(target.email) = lower(account_lockouts.email)
        AND target.company_id = caller.company_id
    )
  );
