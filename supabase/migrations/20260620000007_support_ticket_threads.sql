-- Support tickets become conversations held inside the platform.
--
-- WHAT WAS WRONG. A reply was typed by an admin, emailed straight to the
-- requester, and then discarded: there was nowhere to write it. The live table
-- has six columns — id, user_id, subject, status, created_at, updated_at — and
-- nothing else. `admin_response`, `description`, `company_id`, `priority`,
-- `category`, `assigned_to`, `resolution_notes` and `resolved_at` are all
-- declared in the migration history and none of them exist. The answer lived
-- only in one person's inbox. The requester saw a subject, a status and a Delete button, and
-- never the reply. Replying to that email reached a mailbox the platform does
-- not read — there is no inbound mail handling — so the thread died there. And
-- the requester could delete the ticket at any time, taking the record with it.
--
-- For a security-compliance product that is the wrong shape twice over. Support
-- threads here carry phishing campaign detail, employee data and security
-- configuration; email puts all of it outside the tenant isolation this schema
-- works hard to enforce, with no audit trail and no access control once
-- forwarded. So the conversation moves in-platform and email becomes a
-- notification that carries a link, never the content.
--
-- STATUS VOCABULARY. The live database constrains status to lower-case
-- ('open','pending','closed') and the frontend has always used those, but the
-- migration history declares upper-case ('OPEN','IN_PROGRESS','RESOLVED',
-- 'CLOSED'). The database was altered outside migrations at some point. The
-- lower-case set is what actually runs and what the code expects, so it is
-- adopted here and any stray upper-case rows are normalised — the file and the
-- database stop disagreeing.

-- MISSING COLUMNS. `support_ticket` was created by an early migration using
-- CREATE TABLE IF NOT EXISTS against a table that already existed in a smaller
-- shape. The statement succeeded and the declared columns silently did not
-- arrive, so the live table has six of the fourteen the history describes.
--
-- The consequences ran further than this feature. A policy cannot be created
-- against a column that does not exist, so `rls_support_ticket_company_admin_read`
-- and `..._update` from 20260606000001 were never created — meaning company
-- admins have never been able to see support tickets raised by their own staff.
-- The `support_ticket_set_company` trigger from the same migration could not
-- have been maintaining a column that was absent either.
--
-- This migration adds only the columns it needs, backfills them, and restores
-- those two policies now that they can exist. The remaining declared-but-absent
-- columns (priority, category, assigned_to, resolution_notes, resolved_at) are
-- left for the phase that actually uses them — adding dead columns now would
-- just re-create the same gap between file and database in the other direction.

-- ============================================================================
-- 0) Make the table match what the rest of this file expects
-- ============================================================================
ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Existing tickets predate the column; derive their company from the requester.
UPDATE public.support_ticket t
SET company_id = u.company_id
FROM public.users u
WHERE u.id = t.user_id
  AND t.company_id IS DISTINCT FROM u.company_id
  AND u.company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_ticket_company_id
  ON public.support_ticket (company_id);

-- Keep it populated from here on. Declared in 20260606000001, but that could not
-- have taken effect while the column was absent.
CREATE OR REPLACE FUNCTION public.support_ticket_set_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.users WHERE id = NEW.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_set_company ON public.support_ticket;
CREATE TRIGGER trg_support_ticket_set_company
  BEFORE INSERT OR UPDATE ON public.support_ticket
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_set_company();

-- Company admins can now see their own organisation's tickets, which the
-- missing column has prevented until now. `get_my_role` / `get_my_company_id`
-- are used rather than the `is_company_admin_role` / `current_company_id` pair
-- referenced in 20260606000001, because those two are from a migration whose
-- effects are demonstrably incomplete here, while these are confirmed present.
DROP POLICY IF EXISTS rls_support_ticket_company_admin_read ON public.support_ticket;
CREATE POLICY rls_support_ticket_company_admin_read ON public.support_ticket
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN')
    AND company_id::text = public.get_my_company_id()
  );

DROP POLICY IF EXISTS rls_support_ticket_company_admin_update ON public.support_ticket;
CREATE POLICY rls_support_ticket_company_admin_update ON public.support_ticket
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN')
    AND company_id::text = public.get_my_company_id()
  )
  WITH CHECK (
    public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN')
    AND company_id::text = public.get_my_company_id()
  );

-- ============================================================================
-- 1) Reconcile status with what is actually deployed
-- ============================================================================
ALTER TABLE public.support_ticket DROP CONSTRAINT IF EXISTS support_ticket_status_check;

UPDATE public.support_ticket
SET status = CASE lower(status)
               WHEN 'in_progress' THEN 'pending'
               WHEN 'resolved'    THEN 'closed'
               ELSE lower(status)
             END
WHERE status <> lower(status)
   OR lower(status) NOT IN ('open', 'pending', 'closed');

ALTER TABLE public.support_ticket
  ADD CONSTRAINT support_ticket_status_check
  CHECK (status IN ('open', 'pending', 'closed'));

ALTER TABLE public.support_ticket ALTER COLUMN status SET DEFAULT 'open';

-- Tracks whether the requester has seen the latest staff reply, so the
-- notification email can say "you have a reply" and the list can point at which
-- ticket it means.
ALTER TABLE public.support_ticket
  ADD COLUMN IF NOT EXISTS owner_last_read_at timestamptz;

-- ============================================================================
-- 2) The thread
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_ticket(id) ON DELETE CASCADE,
  -- Kept when the author's account is removed: a support record that loses its
  -- content because someone left the company is not a record.
  author_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Denormalised so a message can still say who wrote it after that.
  author_name  text,
  author_email text,
  -- True for staff-only notes: visible to platform admins, never to the
  -- requester or their company admins.
  is_internal boolean NOT NULL DEFAULT false,
  body        text NOT NULL CHECK (btrim(body) <> ''),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_messages_body_len CHECK (char_length(body) <= 20000)
);

CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx
  ON public.support_ticket_messages (ticket_id, created_at);

COMMENT ON TABLE public.support_ticket_messages IS
  'Conversation on a support ticket. Replies live here, not in email.';
COMMENT ON COLUMN public.support_ticket_messages.is_internal IS
  'Staff-only note. Never returned to the requester or their company admins.';

-- Stamp the author identity at write time and keep the ticket''s updated_at
-- moving, so "last updated" in the list means what it says.
CREATE OR REPLACE FUNCTION public.support_ticket_message_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.author_id IS NULL THEN
    NEW.author_id := auth.uid();
  END IF;

  SELECT u.full_name, u.email
    INTO NEW.author_name, NEW.author_email
  FROM public.users u
  WHERE u.id = NEW.author_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_message_before_insert ON public.support_ticket_messages;
CREATE TRIGGER trg_support_ticket_message_before_insert
  BEFORE INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_message_before_insert();

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
         END
   WHERE id = NEW.ticket_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_message_after_insert ON public.support_ticket_messages;
CREATE TRIGGER trg_support_ticket_message_after_insert
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_message_after_insert();

-- ============================================================================
-- 3) RLS on the thread
-- ============================================================================
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Platform admins see and write everything, internal notes included.
DROP POLICY IF EXISTS rls_stm_platform_admin ON public.support_ticket_messages;
CREATE POLICY rls_stm_platform_admin ON public.support_ticket_messages
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- The requester reads their own thread, minus internal notes.
DROP POLICY IF EXISTS rls_stm_owner_select ON public.support_ticket_messages;
CREATE POLICY rls_stm_owner_select ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_ticket t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- The requester may add to their own thread, and may not forge an internal note
-- or another author.
DROP POLICY IF EXISTS rls_stm_owner_insert ON public.support_ticket_messages;
CREATE POLICY rls_stm_owner_insert ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    is_internal = false
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_ticket t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Company admins already read their company's tickets; they read the visible
-- side of those conversations too.
DROP POLICY IF EXISTS rls_stm_company_admin_select ON public.support_ticket_messages;
CREATE POLICY rls_stm_company_admin_select ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND public.get_my_role() IN ('COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN')
    AND EXISTS (
      SELECT 1 FROM public.support_ticket t
      WHERE t.id = ticket_id
        AND t.company_id::text = public.get_my_company_id()
    )
  );

-- Nobody edits or deletes a message. A support thread is an audit record, and
-- an editable one is worth less than none.
DROP POLICY IF EXISTS rls_stm_no_update ON public.support_ticket_messages;
DROP POLICY IF EXISTS rls_stm_no_delete ON public.support_ticket_messages;

-- ============================================================================
-- 4) A ticket cannot be deleted once support has answered
-- ============================================================================
-- The requester may withdraw a request nobody has worked on yet. Once anyone
-- else has written on it, the thread is a record of work done and support given,
-- and one party deleting it unilaterally destroys the other party's evidence.
DROP POLICY IF EXISTS rls_support_ticket_owner_delete ON public.support_ticket;
CREATE POLICY rls_support_ticket_owner_delete ON public.support_ticket
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.support_ticket_messages m
      WHERE m.ticket_id = support_ticket.id
        AND m.author_id IS DISTINCT FROM auth.uid()
    )
  );

-- RLS alone would let the row vanish silently from the UI's point of view; this
-- turns a blocked delete into an explanation.
CREATE OR REPLACE FUNCTION public.support_ticket_block_answered_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.support_ticket_messages m
    WHERE m.ticket_id = OLD.id
      AND m.author_id IS DISTINCT FROM OLD.user_id
  ) THEN
    RAISE EXCEPTION
      'This request has replies and cannot be deleted. Close it instead.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_block_answered_delete ON public.support_ticket;
CREATE TRIGGER trg_support_ticket_block_answered_delete
  BEFORE DELETE ON public.support_ticket
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_block_answered_delete();

-- ============================================================================
-- 5) Mark a thread as read
-- ============================================================================
-- SECURITY DEFINER because support_ticket has no owner UPDATE policy: only
-- platform admins and company admins may update a ticket, so an employee who
-- filed one could never mark it read under their own rights. The `user_id =
-- auth.uid()` guard is what makes that safe — the function can only ever touch
-- the caller's own ticket, and only this one column.
CREATE OR REPLACE FUNCTION public.mark_support_ticket_read(p_ticket_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.support_ticket
     SET owner_last_read_at = now()
   WHERE id = p_ticket_id AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.mark_support_ticket_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_support_ticket_read(uuid) TO authenticated;
