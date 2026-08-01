-- MFA device trust: re-challenge for 2FA every 15 days per device.
--
-- Two-factor is now mandatory for employees, but prompting for a TOTP code on
-- every single login makes daily training use painful enough that people stop
-- logging in. The agreed compromise is to remember a device for 15 days: the
-- first login from a browser (and every login after the window lapses) requires
-- the code, and logins in between do not.
--
-- The device identifier is a random opaque value minted by the browser and kept
-- in localStorage. It is not a fingerprint and carries no device information —
-- it only lets the server recognise "this is the same browser that passed a TOTP
-- challenge recently". Because a client could otherwise claim any device id for
-- any user, both entry points are SECURITY DEFINER functions keyed on auth.uid()
-- rather than direct table access: a caller can only ever trust, or test the
-- trust of, a device belonging to their own session.
--
-- Trust is deliberately fragile in the right direction: it is dropped whenever
-- the password changes or a factor is re-enrolled, so a stolen password cannot
-- ride an old device record past 2FA.

-- ============================================================================
-- 1) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mfa_trusted_devices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Opaque random value from the browser; never a fingerprint.
  device_id        text NOT NULL,
  user_agent       text,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mfa_trusted_devices_device_id_len CHECK (char_length(device_id) BETWEEN 16 AND 128),
  CONSTRAINT mfa_trusted_devices_unique UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS mfa_trusted_devices_user_expires_idx
  ON public.mfa_trusted_devices (user_id, expires_at DESC);

COMMENT ON TABLE public.mfa_trusted_devices IS
  'Browsers that passed a TOTP challenge recently and may skip it until expires_at.';

-- ============================================================================
-- 2) RLS — no direct client access; everything goes through the functions below
-- ============================================================================
ALTER TABLE public.mfa_trusted_devices ENABLE ROW LEVEL SECURITY;

-- Read-only visibility of one's own devices, so an account settings screen can
-- list and revoke them. Writes are function-only.
DROP POLICY IF EXISTS mfa_trusted_devices_select_own ON public.mfa_trusted_devices;
CREATE POLICY mfa_trusted_devices_select_own
  ON public.mfa_trusted_devices
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mfa_trusted_devices_delete_own ON public.mfa_trusted_devices;
CREATE POLICY mfa_trusted_devices_delete_own
  ON public.mfa_trusted_devices
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 3) Window length — single source of truth
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mfa_device_trust_window()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$ SELECT interval '15 days' $$;

COMMENT ON FUNCTION public.mfa_device_trust_window() IS
  'How long a device may skip the TOTP challenge after passing one.';

-- ============================================================================
-- 4) Is this device still trusted for the calling user?
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_mfa_device_trusted(p_device_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR p_device_id IS NULL OR char_length(p_device_id) < 16 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.mfa_trusted_devices d
    WHERE d.user_id   = v_user
      AND d.device_id = p_device_id
      AND d.expires_at > now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_mfa_device_trusted(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_mfa_device_trusted(text) TO authenticated;

-- ============================================================================
-- 5) Record a passed challenge for this device
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trust_mfa_device(p_device_id text, p_user_agent text DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_device_id IS NULL OR char_length(p_device_id) NOT BETWEEN 16 AND 128 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;

  v_expires := now() + public.mfa_device_trust_window();

  INSERT INTO public.mfa_trusted_devices (user_id, device_id, user_agent, last_verified_at, expires_at)
  VALUES (v_user, p_device_id, left(COALESCE(p_user_agent, ''), 400), now(), v_expires)
  ON CONFLICT (user_id, device_id) DO UPDATE
    SET last_verified_at = now(),
        expires_at       = v_expires,
        user_agent       = left(COALESCE(EXCLUDED.user_agent, ''), 400);

  -- Opportunistic cleanup so the table can't grow without bound.
  DELETE FROM public.mfa_trusted_devices
  WHERE user_id = v_user AND expires_at < now() - interval '30 days';

  RETURN v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.trust_mfa_device(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trust_mfa_device(text, text) TO authenticated;

-- ============================================================================
-- 6) Drop all trust for the calling user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_mfa_trusted_devices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_deleted integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.mfa_trusted_devices WHERE user_id = v_user;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_mfa_trusted_devices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_mfa_trusted_devices() TO authenticated;

-- ============================================================================
-- 7) A password change invalidates every remembered device
-- ============================================================================
-- If a password is reset or rotated, the previous "this browser is fine" grants
-- must not survive: otherwise an attacker who obtained the old password and had
-- once passed 2FA would keep a 2FA-free path in.
CREATE OR REPLACE FUNCTION public.drop_mfa_trust_on_password_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at THEN
    DELETE FROM public.mfa_trusted_devices WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_changed_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_drop_mfa_trust_on_password_change ON public.users;
    CREATE TRIGGER trg_drop_mfa_trust_on_password_change
      AFTER UPDATE OF password_changed_at ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.drop_mfa_trust_on_password_change();
  END IF;
END $$;
