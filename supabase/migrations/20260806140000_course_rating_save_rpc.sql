/*
  Saving a course rating goes through one function
  ================================================

  Reported: an employee finished a course, received the certificate, and the
  rating form still answered "You can only rate a course after you have
  completed it."

  That message was a lie told by the client. The save is a PostgREST upsert, and
  PostgREST compiles an upsert to

      INSERT INTO course_ratings (course_id, employee_id, company_id, stars, comment)
      VALUES (...)
      ON CONFLICT (course_id, employee_id) DO UPDATE SET
        course_id = EXCLUDED.course_id, employee_id = EXCLUDED.employee_id,
        company_id = EXCLUDED.company_id, stars = EXCLUDED.stars,
        comment = EXCLUDED.comment;

  Every column in that SET list needs UPDATE privilege — Postgres checks
  privileges while planning, so it refuses even on the very first insert, when
  no conflict can occur and the UPDATE branch is never reached. The previous
  migration granted `UPDATE (stars, comment)` only, deliberately, so that a
  client could not re-point an existing rating at a colleague. Both intentions
  were right; they were incompatible.

  Postgres reports that refusal as 42501, and the client mapped 42501 to the
  completion message — which is the other thing 42501 means here. So a privilege
  failure was reported as a workflow failure, and pointed at the one explanation
  that could not be checked from the UI.

  The fix is a single writer. `save_course_rating` runs as the definer, so
  column privileges stop being part of the design, and it returns a named reason
  instead of an error code so the two cases can never be confused again. The
  table's INSERT/UPDATE grants are withdrawn: SELECT stays, because the author
  still reads their own row back to pre-fill the form.

  Completion is checked here, once, against three sources in order — the
  `employee_courses` summary, the section progress rows it is derived from, and
  an issued certificate. The summary is maintained by a trigger and the
  certificate is the platform's own written statement that this person finished;
  disagreeing with either of those to an employee holding the certificate is
  indefensible.

  Reversal:
      DROP FUNCTION IF EXISTS public.save_course_rating(uuid, smallint, text);
      GRANT INSERT ON public.course_ratings TO authenticated;
      GRANT UPDATE (stars, comment) ON public.course_ratings TO authenticated;
*/

CREATE OR REPLACE FUNCTION public.save_course_rating(
  p_course_id uuid,
  p_stars     smallint,
  p_comment   text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_company   uuid;
  v_completed boolean := false;
  v_total     integer;
  v_done      integer;
  v_comment   text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  IF p_stars IS NULL OR p_stars < 1 OR p_stars > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_stars');
  END IF;

  SELECT company_id INTO v_company FROM public.users WHERE id = v_caller;

  -- 1. The summary the progress trigger maintains.
  SELECT true INTO v_completed
  FROM public.employee_courses ec
  WHERE ec.employee_id = v_caller
    AND ec.course_id = p_course_id
    AND (ec.status = 'COMPLETED' OR ec.completed_at IS NOT NULL OR ec.progress_percentage >= 100)
  LIMIT 1;

  -- 2. The rows that summary is derived from, in case the trigger did not fire.
  IF NOT COALESCE(v_completed, false) THEN
    SELECT count(*) INTO v_total FROM public.course_sections WHERE course_id = p_course_id;
    IF v_total > 0 THEN
      SELECT count(*) INTO v_done
      FROM public.course_section_progress
      WHERE employee_id = v_caller AND course_id = p_course_id AND completed;
      v_completed := v_done >= v_total;
    END IF;
  END IF;

  -- 3. A certificate this platform issued for this course, to this person.
  IF NOT COALESCE(v_completed, false) THEN
    SELECT true INTO v_completed
    FROM public.issued_certificates
    WHERE employee_id = v_caller AND course_id = p_course_id
    LIMIT 1;
  END IF;

  IF NOT COALESCE(v_completed, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_completed');
  END IF;

  -- An all-whitespace comment is not a comment; storing it would inflate the
  -- "written feedback" count on the admin screen with nothing to read.
  v_comment := nullif(btrim(coalesce(p_comment, '')), '');

  INSERT INTO public.course_ratings (course_id, employee_id, company_id, stars, comment)
  VALUES (p_course_id, v_caller, v_company, p_stars, v_comment)
  ON CONFLICT (course_id, employee_id) DO UPDATE
    SET stars = EXCLUDED.stars, comment = EXCLUDED.comment;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.save_course_rating(uuid, smallint, text) IS
  'The only write path for course_ratings. Runs as definer so column-level grants are not part of the design, and returns a named reason so a privilege failure can never again be reported to a learner as "you have not completed the course".';

/*
  One writer means exactly one writer. The policies are left in place — they
  cost nothing and document the intent — but without the table privilege they
  are unreachable from the browser, which is the point.
*/
REVOKE INSERT ON public.course_ratings FROM authenticated;
REVOKE UPDATE ON public.course_ratings FROM authenticated;

REVOKE ALL ON FUNCTION public.save_course_rating(uuid, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_course_rating(uuid, smallint, text) TO authenticated;
