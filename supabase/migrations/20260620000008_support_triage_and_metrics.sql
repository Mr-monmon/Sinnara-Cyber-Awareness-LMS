-- Support phase two: triage fields, and the timestamps needed to measure a
-- response time rather than guess at one.
--
-- Phase one moved the conversation in-platform. What it could not answer is the
-- question a support team actually gets asked: how long are customers waiting,
-- and which tickets are overdue right now. That needs two things this table has
-- never had — a way to say how urgent a ticket is, and a record of when it was
-- first answered.
--
-- MEASURED, NOT DERIVED AT READ TIME. `first_response_at` and `resolved_at` are
-- stamped by triggers when the event happens. Computing them on every dashboard
-- load would mean scanning the whole message history each time, and it would
-- also be wrong after the fact: a ticket reopened and answered again would
-- silently rewrite its own history. The first answer is a fact about a moment,
-- so it is recorded at that moment and never moved.
--
-- WHAT COUNTS AS A RESPONSE. The first non-internal message from someone other
-- than the requester. An internal note is work, but it is not an answer, and a
-- customer chasing their own ticket is not a response either. Getting this wrong
-- in the flattering direction is the easiest way to build a dashboard that
-- reports excellent service while customers wait.

-- ============================================================================
-- 1) Triage columns
-- ============================================================================
ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz;

ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- Lower-case values throughout, matching the status vocabulary this table
-- already uses. Mixing conventions inside one table is how the status column
-- ended up disagreeing with its own migration history.
ALTER TABLE public.support_ticket DROP CONSTRAINT IF EXISTS support_ticket_priority_check;
UPDATE public.support_ticket SET priority = 'normal'
WHERE priority IS NULL OR lower(priority) NOT IN ('low','normal','high','urgent');
UPDATE public.support_ticket SET priority = lower(priority) WHERE priority <> lower(priority);
ALTER TABLE public.support_ticket
  ADD CONSTRAINT support_ticket_priority_check
  CHECK (priority IN ('low','normal','high','urgent'));

ALTER TABLE public.support_ticket DROP CONSTRAINT IF EXISTS support_ticket_category_check;
UPDATE public.support_ticket SET category = 'general'
WHERE category IS NULL
   OR lower(category) NOT IN ('general','technical','billing','phishing','training','account');
UPDATE public.support_ticket SET category = lower(category) WHERE category <> lower(category);
ALTER TABLE public.support_ticket
  ADD CONSTRAINT support_ticket_category_check
  CHECK (category IN ('general','technical','billing','phishing','training','account'));

CREATE INDEX IF NOT EXISTS support_ticket_triage_idx
  ON public.support_ticket (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS support_ticket_assigned_idx
  ON public.support_ticket (assigned_to) WHERE assigned_to IS NOT NULL;

-- ============================================================================
-- 2) Stamp the response and resolution moments
-- ============================================================================
-- Extends the message trigger from phase one rather than adding a second one,
-- so the ordering of the two effects cannot drift apart.
CREATE OR REPLACE FUNCTION public.support_ticket_message_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT t.user_id INTO v_owner FROM public.support_ticket t WHERE t.id = NEW.ticket_id;

  UPDATE public.support_ticket
     SET updated_at = now(),
         -- A staff reply makes the ticket unread for the requester. Their own
         -- message does not, so posting never marks their own thread unread.
         owner_last_read_at = CASE
           WHEN NEW.is_internal THEN owner_last_read_at
           WHEN NEW.author_id IS DISTINCT FROM v_owner THEN NULL
           ELSE now()
         END,
         -- The first real answer, recorded once and never moved. An internal
         -- note is work but not an answer; the requester chasing their own
         -- ticket is not a response.
         first_response_at = CASE
           WHEN first_response_at IS NOT NULL THEN first_response_at
           WHEN NEW.is_internal THEN first_response_at
           WHEN NEW.author_id IS DISTINCT FROM v_owner THEN now()
           ELSE first_response_at
         END
   WHERE id = NEW.ticket_id;

  RETURN NULL;
END;
$$;

-- Resolution is a property of the status change, so it is stamped there.
CREATE OR REPLACE FUNCTION public.support_ticket_stamp_resolution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    NEW.resolved_at := now();
  ELSIF NEW.status <> 'closed' AND OLD.status = 'closed' THEN
    -- Reopened. Clearing this keeps "resolution time" meaning time to the
    -- resolution that stuck, rather than to an early premature close.
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_stamp_resolution ON public.support_ticket;
CREATE TRIGGER trg_support_ticket_stamp_resolution
  BEFORE UPDATE OF status ON public.support_ticket
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_stamp_resolution();

-- ============================================================================
-- 3) Requesters may not triage their own tickets
-- ============================================================================
-- The owner's UPDATE policy is row-level, and RLS cannot restrict columns. So a
-- requester could otherwise assign a ticket to a staff member, mark it closed,
-- or backdate its response times. This resets the fields they have no business
-- setting back to what they were, rather than rejecting the update — the
-- legitimate part of their edit still goes through.
--
-- Priority is deliberately left to them: the person waiting is well placed to
-- say how urgent it is, and support can override.
CREATE OR REPLACE FUNCTION public.support_ticket_guard_owner_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.user_id THEN
    NEW.assigned_to       := OLD.assigned_to;
    NEW.status            := OLD.status;
    NEW.first_response_at := OLD.first_response_at;
    NEW.resolved_at       := OLD.resolved_at;
    NEW.user_id           := OLD.user_id;
    NEW.company_id        := OLD.company_id;
    NEW.created_at        := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_guard_owner_update ON public.support_ticket;
CREATE TRIGGER trg_support_ticket_guard_owner_update
  BEFORE UPDATE ON public.support_ticket
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_guard_owner_update();

-- ============================================================================
-- 4) Response targets — one place to change them
-- ============================================================================
-- Hours allowed for a first response, by priority. These are the numbers the
-- dashboard calls a ticket "overdue" against, so they belong in a named
-- function rather than scattered through queries and UI code.
CREATE OR REPLACE FUNCTION public.support_first_response_target_hours(p_priority text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(COALESCE(p_priority, 'normal'))
           WHEN 'urgent' THEN 4
           WHEN 'high'   THEN 8
           WHEN 'low'    THEN 72
           ELSE 24
         END;
$$;

REVOKE ALL ON FUNCTION public.support_first_response_target_hours(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_first_response_target_hours(text) TO authenticated;

-- ============================================================================
-- 5) The dashboard
-- ============================================================================
-- Returns one row per priority plus an 'all' row. Medians rather than means:
-- one ticket left over a weekend drags an average far enough to hide how the
-- other ninety-nine were handled.
CREATE OR REPLACE FUNCTION public.get_support_response_metrics(p_days integer DEFAULT 30)
RETURNS TABLE (
  priority                 text,
  tickets                  integer,
  open_tickets             integer,
  awaiting_first_reply     integer,
  overdue_first_reply      integer,
  median_first_response_h  numeric,
  median_resolution_h      numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  -- Support volume across all tenants is platform-operator information, so this
  -- is the one place in this feature that is not company-scoped — and therefore
  -- the one that must check the role itself.
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  v_since := now() - (GREATEST(LEAST(COALESCE(p_days, 30), 365), 1) || ' days')::interval;

  RETURN QUERY
  WITH t AS (
    SELECT
      s.priority,
      s.status,
      s.created_at,
      s.first_response_at,
      s.resolved_at,
      EXTRACT(EPOCH FROM (s.first_response_at - s.created_at)) / 3600.0 AS first_h,
      EXTRACT(EPOCH FROM (s.resolved_at      - s.created_at)) / 3600.0 AS res_h,
      EXTRACT(EPOCH FROM (now() - s.created_at)) / 3600.0              AS age_h,
      public.support_first_response_target_hours(s.priority)           AS target_h
    FROM public.support_ticket s
    WHERE s.created_at >= v_since
  )
  SELECT
    COALESCE(g.priority, 'all')::text,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE g.status <> 'closed')::integer,
    COUNT(*) FILTER (WHERE g.first_response_at IS NULL AND g.status <> 'closed')::integer,
    -- Overdue means still unanswered and already past target. A ticket answered
    -- late is late, but it is no longer something to act on today.
    COUNT(*) FILTER (
      WHERE g.first_response_at IS NULL
        AND g.status <> 'closed'
        AND g.age_h > g.target_h
    )::integer,
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY g.first_h)::numeric, 1),
    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY g.res_h)::numeric, 1)
  FROM t g
  GROUP BY GROUPING SETS ((g.priority), ())
  ORDER BY
    CASE COALESCE(g.priority, 'all')
      WHEN 'all' THEN 0 WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
      WHEN 'normal' THEN 3 ELSE 4
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_response_metrics(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_support_response_metrics(integer) TO authenticated;
