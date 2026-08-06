/*
  Course ratings
  ==============

  Five stars and an optional comment, left by an employee once they finish a
  course, visible only to the platform admin.

  Who can see it, and why it matters
  ----------------------------------
  The rating answers "is this course any good", which is a question about the
  content the platform publishes — not about the employee, and not a metric for
  their own management to read. If a company admin could see "2 stars: the
  video was 40 minutes of nothing", the honest answers stop within a week and
  the signal is gone. So SELECT is restricted to PLATFORM_ADMIN, plus the author
  reading their own row back in order to edit it.

  One rating per person per course, updated in place rather than appended: the
  question is "what do you think of this course", which has one current answer.

  Only after finishing
  --------------------
  Enforced in the WITH CHECK, not in the page. A rating from someone who never
  opened the course is noise, and "the button is only shown when complete" is
  not a rule, it is a hope.

  Reversal:
      DROP FUNCTION IF EXISTS public.get_course_rating_comments(uuid);
      DROP FUNCTION IF EXISTS public.get_course_rating_summary();
      DROP TABLE IF EXISTS public.course_ratings;
*/

CREATE TABLE IF NOT EXISTS public.course_ratings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    uuid NOT NULL REFERENCES public.courses(id)   ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  -- Denormalised so the platform admin can break ratings down by customer
  -- without joining back to a users row that may since have been deleted.
  company_id   uuid          REFERENCES public.companies(id) ON DELETE SET NULL,
  stars        smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_ratings_one_per_employee UNIQUE (course_id, employee_id)
);

COMMENT ON TABLE public.course_ratings IS
  'Employee feedback on a completed course. Readable by PLATFORM_ADMIN only — a course rating is feedback on the content, not a performance signal about the employee, and it stops being honest the moment their own management can read it.';

CREATE INDEX IF NOT EXISTS course_ratings_course_idx ON public.course_ratings (course_id);

CREATE OR REPLACE FUNCTION public.touch_course_rating()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  -- Pinned server-side. Both are the author's own facts; letting the client
  -- supply them would let a rating be filed against someone else's account.
  NEW.employee_id := OLD.employee_id;
  NEW.created_at  := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_ratings_touch ON public.course_ratings;
CREATE TRIGGER trg_course_ratings_touch
  BEFORE UPDATE ON public.course_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_course_rating();

ALTER TABLE public.course_ratings ENABLE ROW LEVEL SECURITY;

/*
  Supabase's default privileges would hand `anon` and `authenticated` ALL on this
  table — that is how public.users ended up writable by the publishable key. Take
  it all back, then grant exactly what the two flows need. `company_id` is
  writable because the insert carries it; `employee_id` is not, so a client
  cannot re-point an existing rating at a colleague.
*/
REVOKE ALL ON public.course_ratings FROM anon, authenticated;
GRANT SELECT, INSERT ON public.course_ratings TO authenticated;
GRANT UPDATE (stars, comment) ON public.course_ratings TO authenticated;

DROP POLICY IF EXISTS rls_course_ratings_insert_own ON public.course_ratings;
CREATE POLICY rls_course_ratings_insert_own ON public.course_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.employee_courses ec
      WHERE ec.employee_id = auth.uid()
        AND ec.course_id = course_ratings.course_id
        AND ec.status = 'COMPLETED'
    )
  );

DROP POLICY IF EXISTS rls_course_ratings_update_own ON public.course_ratings;
CREATE POLICY rls_course_ratings_update_own ON public.course_ratings
  FOR UPDATE TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- The author reads their own row back so the form can be pre-filled; nobody
-- else in the tenant can, including their own company admin.
DROP POLICY IF EXISTS rls_course_ratings_read_own ON public.course_ratings;
CREATE POLICY rls_course_ratings_read_own ON public.course_ratings
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

DROP POLICY IF EXISTS rls_course_ratings_read_platform ON public.course_ratings;
CREATE POLICY rls_course_ratings_read_platform ON public.course_ratings
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

/*
  Per-course aggregate for the platform admin's course list.

  Returned as one row per course including the star histogram, because an
  average alone hides the shape that matters: 3.0 from everyone shrugging and
  3.0 from half loving it and half hating it are different problems.
*/
CREATE OR REPLACE FUNCTION public.get_course_rating_summary()
RETURNS TABLE (
  course_id     uuid,
  rating_count  integer,
  average_stars numeric,
  stars_1       integer,
  stars_2       integer,
  stars_3       integer,
  stars_4       integer,
  stars_5       integer,
  comment_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    r.course_id,
    count(*)::integer,
    round(avg(r.stars)::numeric, 2),
    count(*) FILTER (WHERE r.stars = 1)::integer,
    count(*) FILTER (WHERE r.stars = 2)::integer,
    count(*) FILTER (WHERE r.stars = 3)::integer,
    count(*) FILTER (WHERE r.stars = 4)::integer,
    count(*) FILTER (WHERE r.stars = 5)::integer,
    count(*) FILTER (WHERE nullif(btrim(coalesce(r.comment, '')), '') IS NOT NULL)::integer
  FROM public.course_ratings r
  WHERE public.is_platform_admin()
  GROUP BY r.course_id;
$$;

/*
  The written feedback for one course.

  Deliberately returns the company and the date but NOT the employee's name.
  The platform admin can already look the author up if a rating ever needs to be
  acted on; what this screen is for is reading the feedback, and putting a name
  beside every complaint turns a quality report into a list of individuals.
*/
CREATE OR REPLACE FUNCTION public.get_course_rating_comments(p_course_id uuid)
RETURNS TABLE (
  stars        smallint,
  comment      text,
  company_name text,
  rated_at     timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.stars, r.comment, c.name, r.updated_at
  FROM public.course_ratings r
  LEFT JOIN public.companies c ON c.id = r.company_id
  WHERE public.is_platform_admin()
    AND r.course_id = p_course_id
    AND nullif(btrim(coalesce(r.comment, '')), '') IS NOT NULL
  ORDER BY r.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_course_rating_summary()        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_course_rating_comments(uuid)   FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_rating_summary()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_rating_comments(uuid) TO authenticated;
