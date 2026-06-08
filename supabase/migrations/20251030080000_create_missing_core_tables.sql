/*
  CREATE MISSING CORE TABLES (pre-policy)
  =======================================
  These three tables are referenced by later RLS-policy migrations
  (20260515000004 → support_ticket, 20260519000001 → articles,
  company_course_departments) AND by the frontend, but were never created.
  A fresh `supabase db reset` previously failed at those policy migrations.

  This migration runs EARLY (right after the base schema + seed) so the tables
  exist before any policy references them. It creates the tables, indexes and
  enables RLS only — the comprehensive, role-correct policies are defined in
  20260606000001_production_readiness_phase1_2.sql (the canonical source of
  truth, which runs last and DROP/CREATEs the final policy set).

  Depends on: companies, users, courses, departments (all in 20251027133919).
*/

-- ─────────────────────────────────────────────────────────────
-- support_ticket
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_ticket (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.users(id) ON DELETE CASCADE,
  company_id    uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  subject       text NOT NULL,
  description   text,
  category      text DEFAULT 'GENERAL',
  priority      text DEFAULT 'NORMAL'
                  CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  status        text NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  assigned_to   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  admin_response text,
  resolution_notes text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_company_id ON public.support_ticket(company_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_user_id    ON public.support_ticket(user_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_status     ON public.support_ticket(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_created_at ON public.support_ticket(created_at DESC);

ALTER TABLE public.support_ticket ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- articles  (public marketing/resource content)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.articles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text UNIQUE NOT NULL,
  title              text NOT NULL,
  excerpt            text,
  content            text,
  category           text,
  tags               text[] NOT NULL DEFAULT '{}',
  featured_image_url text,
  author             text,
  read_time          text,
  published          boolean NOT NULL DEFAULT false,
  featured           boolean NOT NULL DEFAULT false,
  view_count         integer NOT NULL DEFAULT 0,
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_published   ON public.articles(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_slug        ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category    ON public.articles(category);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- company_course_departments  (per-company course → department restriction)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_course_departments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id)   ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES public.courses(id)     ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (company_id, course_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_ccd_company ON public.company_course_departments(company_id);
CREATE INDEX IF NOT EXISTS idx_ccd_course  ON public.company_course_departments(course_id);
CREATE INDEX IF NOT EXISTS idx_ccd_dept    ON public.company_course_departments(department_id);

ALTER TABLE public.company_course_departments ENABLE ROW LEVEL SECURITY;
