/*
  Employee lifecycle fixes
  ========================

  Four defects found while onboarding a real 40-person pilot. Each one blocked a
  routine administrative action outright, and all four are idempotent here.

  1. `users.is_active` never existed.
     The interface has referenced it in ~50 places since the deactivate feature
     shipped — including the sign-out check in AuthContext — but no migration
     ever created the column. "Deactivate employee" failed with
     `column is_active does not exist`, and because `profile?.is_active === false`
     compared `undefined` to `false`, a deactivated user would not have been
     signed out even if the write had succeeded. The feature was inert at both
     ends.

  2. `phishing_alerts` blocked employee deletion.
     `target_id` and `event_id` were declared without an ON DELETE rule while
     `campaign_id` and `company_id` in the same table both CASCADE. NO ACTION is
     the default, so deleting an employee cascaded to
     `phishing_campaign_targets` and was then refused by an alert pointing at it.
     Any employee who had ever triggered a simulation alert could never be
     removed. CASCADE matches the table's other two keys, and the alert's own
     `title`/`message` carry the person's name — leaving the row behind with a
     dangling reference would keep personal data while making the alert
     unactionable, which is the worst of both under PDPL.

  3. `sync_employee_course_progress` blocked it again, one level deeper.
     The trigger fires AFTER DELETE on `course_section_progress`. Deleting a
     user cascades to those rows, the trigger fires, and it re-inserts a summary
     into `employee_courses` for an employee that no longer exists — failing on
     `employee_courses_employee_id_fkey` and aborting the delete. So any employee
     who had merely opened a course was undeletable. The guard below makes the
     trigger a no-op once its employee is gone; there is nothing to summarise.

  4. Three "who did this" columns pinned users in place.
     `issued_certificates.issued_by`, `phishing_campaign_requests.approved_by`
     and `subscriptions.created_by` were NO ACTION, so an administrator who had
     ever issued a certificate, approved a campaign or created a subscription
     could not be deleted. These are attribution fields on records that must
     outlive the actor — the certificate was still issued — so SET NULL is
     correct, not CASCADE. All three columns are nullable.
*/

-- ── 1. users.is_active ──────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.is_active IS
  'Deactivated accounts cannot sign in; AuthContext signs out an active session on next restore. Preferred over deletion when someone leaves, because it preserves their training history for audit.';

-- ── 2. phishing_alerts → cascade with its parents ───────────────────────────
ALTER TABLE public.phishing_alerts
  DROP CONSTRAINT IF EXISTS phishing_alerts_target_id_fkey;
ALTER TABLE public.phishing_alerts
  ADD CONSTRAINT phishing_alerts_target_id_fkey
  FOREIGN KEY (target_id) REFERENCES public.phishing_campaign_targets(id) ON DELETE CASCADE;

ALTER TABLE public.phishing_alerts
  DROP CONSTRAINT IF EXISTS phishing_alerts_event_id_fkey;
ALTER TABLE public.phishing_alerts
  ADD CONSTRAINT phishing_alerts_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.phishing_events(id) ON DELETE CASCADE;

-- ── 3. Progress trigger must not resurrect a deleted employee ───────────────
CREATE OR REPLACE FUNCTION public.sync_employee_course_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
  v_course_id   uuid;
  v_completed   integer;
  v_total       integer;
  v_pct         integer;
  v_status      text;
  v_now         timestamptz := now();
BEGIN
  -- Pick the right record depending on operation
  IF TG_OP = 'DELETE' THEN
    v_employee_id := OLD.employee_id;
    v_course_id   := OLD.course_id;
  ELSE
    v_employee_id := NEW.employee_id;
    v_course_id   := NEW.course_id;
  END IF;

  /*
   * Deleting a user cascades their progress rows into this trigger. Writing a
   * summary row for an employee who no longer exists violates
   * employee_courses_employee_id_fkey and aborts the whole delete — so an
   * employee who had opened a single course could not be removed at all.
   * There is nothing to summarise once the employee is gone.
   */
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_employee_id) THEN
    RETURN NULL;
  END IF;

  -- Count completed sections for this employee+course
  SELECT COUNT(*) INTO v_completed
  FROM course_section_progress
  WHERE employee_id = v_employee_id
    AND course_id   = v_course_id
    AND completed   = true;

  -- Total sections in the course
  SELECT COUNT(*) INTO v_total
  FROM course_sections
  WHERE course_id = v_course_id;

  v_pct := CASE WHEN v_total > 0 THEN ROUND((v_completed::numeric / v_total) * 100)::integer ELSE 0 END;
  v_status := CASE
    WHEN v_pct >= 100 THEN 'COMPLETED'
    WHEN v_pct > 0    THEN 'IN_PROGRESS'
    ELSE 'ASSIGNED'
  END;

  -- Upsert summary. If the employee_courses row already exists, update it;
  -- otherwise create one (covers the case where the employee opened a course
  -- without an explicit assignment).
  INSERT INTO employee_courses (
    employee_id, course_id, status,
    completed_sections, total_sections, progress_percentage,
    started_at, completed_at, last_accessed_at, assigned_at
  ) VALUES (
    v_employee_id, v_course_id, v_status,
    v_completed, v_total, v_pct,
    CASE WHEN v_pct > 0   THEN v_now ELSE NULL END,
    CASE WHEN v_pct >= 100 THEN v_now ELSE NULL END,
    v_now, v_now
  )
  ON CONFLICT (employee_id, course_id) DO UPDATE SET
    completed_sections   = EXCLUDED.completed_sections,
    total_sections       = EXCLUDED.total_sections,
    progress_percentage  = EXCLUDED.progress_percentage,
    status               = EXCLUDED.status,
    last_accessed_at     = v_now,
    -- only set started_at the first time progress becomes > 0
    started_at  = COALESCE(employee_courses.started_at,
                           CASE WHEN EXCLUDED.progress_percentage > 0 THEN v_now ELSE NULL END),
    -- set completed_at when reaching 100%, clear if it drops below
    completed_at = CASE
      WHEN EXCLUDED.progress_percentage >= 100 THEN COALESCE(employee_courses.completed_at, v_now)
      ELSE NULL
    END;

  RETURN NULL; -- AFTER trigger
END;
$$;

-- ── 4. Attribution columns release the user on delete ───────────────────────
ALTER TABLE public.issued_certificates
  DROP CONSTRAINT IF EXISTS issued_certificates_issued_by_fkey;
ALTER TABLE public.issued_certificates
  ADD CONSTRAINT issued_certificates_issued_by_fkey
  FOREIGN KEY (issued_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.phishing_campaign_requests
  DROP CONSTRAINT IF EXISTS phishing_campaign_requests_approved_by_fkey;
ALTER TABLE public.phishing_campaign_requests
  ADD CONSTRAINT phishing_campaign_requests_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_created_by_fkey;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
