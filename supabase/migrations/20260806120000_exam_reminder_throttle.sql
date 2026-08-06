/*
  Exam reminder throttle
  ======================

  "Remind" sent an email every time it was pressed. Nothing was recorded, so
  nothing could be limited, and nothing could tell an admin that the person they
  are about to nudge was already nudged twice this morning by a colleague. On a
  40-person pilot that is how a training platform teaches its own users that its
  mail is noise — and how the sending domain earns a spam reputation that no
  amount of SPF/DKIM tuning recovers.

  The policy is: at most one reminder per employee per exam every 7 days, and at
  most 3 for that exam ever.

  Why the ledger and the limit live in the database
  ------------------------------------------------
  A counter kept in the page would reset on reload, would not be shared between
  two admins with the console open, and would be trivially bypassed. The limit
  has to be enforced where the record is, in one place, for every caller.

  The flow is claim → send → (release on failure), not send → log. Logging after
  the fact means a crash between the two leaves a sent email uncounted; claiming
  first means the worst case is a slot burned on an email that never went out,
  and `release_exam_reminder` gives the caller a way to hand even that back.

  Reversal:
      DROP FUNCTION IF EXISTS public.release_exam_reminder(uuid);
      DROP FUNCTION IF EXISTS public.claim_exam_reminder(uuid, uuid);
      DROP FUNCTION IF EXISTS public.get_exam_reminder_state();
      DROP FUNCTION IF EXISTS public.exam_reminder_limits();
      DROP TABLE IF EXISTS public.exam_reminder_log;
*/

CREATE TABLE IF NOT EXISTS public.exam_reminder_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  exam_id       uuid NOT NULL REFERENCES public.exams(id)     ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  -- SET NULL, not CASCADE: deleting the admin who sent a reminder must not erase
  -- the fact that the employee received it. The count is the point of the table.
  sent_by       uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.exam_reminder_log IS
  'One row per exam reminder email. The throttle counts these; deleting rows raises the ceiling, so treat it as an audit record.';

-- Every read is "the reminders for this exam and this person, newest first".
CREATE INDEX IF NOT EXISTS exam_reminder_log_lookup_idx
  ON public.exam_reminder_log (exam_id, recipient_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS exam_reminder_log_company_idx
  ON public.exam_reminder_log (company_id, sent_at DESC);

/*
  Supabase's default privileges hand `anon` and `authenticated` ALL on every new
  table in `public`. That is how the users table ended up writable by the
  publishable key. This table is reached only through the SECURITY DEFINER
  functions below, so the roles get nothing directly — a client cannot insert a
  backdated row to widen its own quota, or delete rows to reset it.
*/
ALTER TABLE public.exam_reminder_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_reminder_log FROM anon, authenticated;

/*
  The two numbers live in one function so the enforcement path and the display
  path can never disagree. A UI that says "1 left" over a server that says "0"
  is worse than no UI at all.
*/
CREATE OR REPLACE FUNCTION public.exam_reminder_limits()
RETURNS TABLE (max_per_recipient integer, min_interval interval)
LANGUAGE sql IMMUTABLE AS $$
  SELECT 3, interval '7 days';
$$;

/*
  Claim one reminder slot.

  Returns a JSON verdict rather than raising, because "you may not send this
  one" is an ordinary outcome the caller has to display, not an exception — and
  a Remind-all over 40 people needs to skip the throttled ones and carry on.

  SECURITY DEFINER with an explicit caller check: the table is unreachable
  otherwise, and the check is the authorisation boundary. It verifies the caller
  is an admin AND that the recipient is inside the caller's own company, so this
  cannot be used to enumerate or nudge another tenant's employees.
*/
CREATE OR REPLACE FUNCTION public.claim_exam_reminder(
  p_exam_id      uuid,
  p_recipient_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_company     uuid;
  v_recipient_c uuid;
  v_max         integer;
  v_interval    interval;
  v_count       integer;
  v_last        timestamptz;
  v_log_id      uuid;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_signed_in');
  END IF;

  SELECT company_id INTO v_company FROM public.users WHERE id = v_caller;

  IF NOT (public.is_platform_admin() OR public.is_company_admin_role()) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_permitted');
  END IF;

  SELECT company_id INTO v_recipient_c FROM public.users WHERE id = p_recipient_id;
  IF v_recipient_c IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unknown_recipient');
  END IF;
  IF NOT public.is_platform_admin() AND v_recipient_c IS DISTINCT FROM v_company THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'other_tenant');
  END IF;

  SELECT max_per_recipient, min_interval INTO v_max, v_interval
  FROM public.exam_reminder_limits();

  /*
    Two admins pressing Remind at the same second would both read a count of 2
    and both insert, putting the employee at 4. The lock serialises the
    read-then-write for this (exam, recipient) pair only, and is released at
    commit — a per-pair lock rather than a table lock, so a Remind-all over 40
    people does not queue behind itself.
  */
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_exam_id::text || ':' || p_recipient_id::text, 0)
  );

  SELECT count(*), max(sent_at) INTO v_count, v_last
  FROM public.exam_reminder_log
  WHERE exam_id = p_exam_id AND recipient_id = p_recipient_id;

  IF v_count >= v_max THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'max_reached',
      'sent_count', v_count, 'max', v_max, 'last_sent_at', v_last
    );
  END IF;

  IF v_last IS NOT NULL AND v_last > now() - v_interval THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'too_soon',
      'sent_count', v_count, 'max', v_max, 'last_sent_at', v_last,
      'next_allowed_at', v_last + v_interval
    );
  END IF;

  INSERT INTO public.exam_reminder_log (company_id, exam_id, recipient_id, sent_by)
  VALUES (v_recipient_c, p_exam_id, p_recipient_id, v_caller)
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'allowed', true, 'log_id', v_log_id,
    'sent_count', v_count + 1, 'max', v_max,
    'next_allowed_at', now() + v_interval
  );
END;
$$;

/*
  Hand back a slot claimed for an email that failed to send.

  Deliberately narrow: only the admin who claimed it, and only within five
  minutes. Without those, this becomes a general "reset my quota" button and the
  throttle it belongs to is decorative.
*/
CREATE OR REPLACE FUNCTION public.release_exam_reminder(p_log_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.exam_reminder_log
  WHERE id = p_log_id
    AND sent_by = auth.uid()
    AND sent_at > now() - interval '5 minutes';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

/*
  Everything the page needs to draw the button state, for the caller's whole
  company in one round trip. Returning it per (exam, recipient) rather than
  per assignment keeps it correct for department-wide assignments, where one
  assignment row fans out to many recipients.
*/
CREATE OR REPLACE FUNCTION public.get_exam_reminder_state()
RETURNS TABLE (
  exam_id         uuid,
  recipient_id    uuid,
  sent_count      integer,
  last_sent_at    timestamptz,
  next_allowed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.exam_id,
    l.recipient_id,
    count(*)::integer,
    max(l.sent_at),
    max(l.sent_at) + (SELECT min_interval FROM public.exam_reminder_limits())
  FROM public.exam_reminder_log l
  WHERE (public.is_platform_admin() OR public.is_company_admin_role())
    AND (public.is_platform_admin() OR l.company_id = public.current_company_id())
  GROUP BY l.exam_id, l.recipient_id;
$$;

REVOKE ALL ON FUNCTION public.exam_reminder_limits()               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_exam_reminder(uuid, uuid)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_exam_reminder(uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exam_reminder_state()            FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.exam_reminder_limits()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_exam_reminder(uuid, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_exam_reminder(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exam_reminder_state()         TO authenticated;
