/*
  # Fix Security Issues - Part 3: Function Search Paths (Final)
  
  1. Security Improvements
    - Set immutable search_path on all functions
    - Prevents search path manipulation attacks
    - Ensures functions only use pg_catalog and public schemas
  
  2. Implementation Strategy
    - Drop all dependent triggers first
    - Drop and recreate functions with SECURITY DEFINER and fixed search_path
    - Recreate all triggers with correct column names
*/

-- Drop all dependent triggers first
DROP TRIGGER IF EXISTS trigger_initialize_phishing_quota ON companies;
DROP TRIGGER IF EXISTS trigger_deduct_campaign_quota ON phishing_campaigns;
DROP TRIGGER IF EXISTS trigger_update_dept_vulnerability_stats ON phishing_campaign_targets;
DROP TRIGGER IF EXISTS trigger_assign_courses_to_new_employee ON users;
DROP TRIGGER IF EXISTS after_company_insert_quota ON companies;
DROP TRIGGER IF EXISTS after_campaign_insert_deduct_quota ON phishing_campaigns;
DROP TRIGGER IF EXISTS after_target_update_dept_stats ON phishing_campaign_targets;
DROP TRIGGER IF EXISTS after_employee_insert_assign_courses ON users;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.generate_ticket_number() CASCADE;
DROP FUNCTION IF EXISTS public.initialize_phishing_quota() CASCADE;
DROP FUNCTION IF EXISTS public.deduct_campaign_quota() CASCADE;
DROP FUNCTION IF EXISTS public.track_user_login() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_campaign_rates(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_department_vulnerability(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_department_vulnerability_stats() CASCADE;
DROP FUNCTION IF EXISTS public.assign_courses_to_department_employees(uuid, uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.assign_exams_to_department_employees(uuid, uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.assign_courses_to_new_employee() CASCADE;

-- Recreate generate_ticket_number
CREATE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  year_part text;
  sequence_num integer;
  ticket_num text;
BEGIN
  year_part := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 6) AS integer)), 0) + 1
  INTO sequence_num
  FROM demo_requests
  WHERE ticket_number LIKE year_part || '%';
  
  ticket_num := year_part || LPAD(sequence_num::text, 5, '0');
  
  RETURN ticket_num;
END;
$$;

-- Recreate initialize_phishing_quota
CREATE FUNCTION public.initialize_phishing_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO phishing_campaign_quotas (company_id, total_quota, used_quota)
  VALUES (NEW.id, 0, 0);
  RETURN NEW;
END;
$$;

-- Recreate deduct_campaign_quota
CREATE FUNCTION public.deduct_campaign_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE phishing_campaign_quotas
  SET 
    used_quota = used_quota + NEW.target_count,
    updated_at = NOW()
  WHERE company_id = NEW.company_id;
  
  RETURN NEW;
END;
$$;

-- Recreate track_user_login
CREATE FUNCTION public.track_user_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO login_activity (user_id, company_id, login_time, ip_address)
  VALUES (NEW.id, NEW.company_id, NOW(), inet_client_addr());
  RETURN NEW;
END;
$$;

-- Recreate calculate_campaign_rates (updated to use correct column names)
CREATE FUNCTION public.calculate_campaign_rates(campaign_id_param uuid)
RETURNS TABLE(
  clicked_rate numeric,
  submitted_rate numeric,
  reported_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  total_targets integer;
  clicked_count integer;
  submitted_count integer;
  reported_count integer;
BEGIN
  SELECT COUNT(*) INTO total_targets
  FROM phishing_campaign_targets
  WHERE campaign_id = campaign_id_param;
  
  IF total_targets = 0 THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;
  
  SELECT COUNT(*) INTO clicked_count
  FROM phishing_campaign_targets
  WHERE campaign_id = campaign_id_param AND clicked_at IS NOT NULL;
  
  SELECT COUNT(*) INTO submitted_count
  FROM phishing_campaign_targets
  WHERE campaign_id = campaign_id_param AND (submitted_at IS NOT NULL OR credentials_entered = true);
  
  SELECT COUNT(*) INTO reported_count
  FROM phishing_campaign_targets
  WHERE campaign_id = campaign_id_param AND reported_at IS NOT NULL;
  
  RETURN QUERY SELECT 
    ROUND((clicked_count::numeric / total_targets * 100), 2),
    ROUND((submitted_count::numeric / total_targets * 100), 2),
    ROUND((reported_count::numeric / total_targets * 100), 2);
END;
$$;

-- Recreate calculate_department_vulnerability (updated to use correct column names)
CREATE FUNCTION public.calculate_department_vulnerability(dept_id uuid, camp_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  total_targets integer;
  vulnerable_count integer;
BEGIN
  SELECT COUNT(*) INTO total_targets
  FROM phishing_campaign_targets
  WHERE department_id = dept_id AND campaign_id = camp_id;
  
  IF total_targets = 0 THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(*) INTO vulnerable_count
  FROM phishing_campaign_targets
  WHERE department_id = dept_id 
    AND campaign_id = camp_id 
    AND (clicked_at IS NOT NULL OR credentials_entered = true);
  
  RETURN ROUND((vulnerable_count::numeric / total_targets * 100), 2);
END;
$$;

-- Recreate update_department_vulnerability_stats (updated to use correct column names)
CREATE FUNCTION public.update_department_vulnerability_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  vuln_score numeric;
  camp_company_id uuid;
BEGIN
  SELECT company_id INTO camp_company_id
  FROM phishing_campaigns
  WHERE id = NEW.campaign_id;
  
  IF NEW.department_id IS NOT NULL THEN
    vuln_score := calculate_department_vulnerability(NEW.department_id, NEW.campaign_id);
    
    INSERT INTO department_vulnerability_stats (
      department_id,
      company_id,
      campaign_id,
      vulnerability_score,
      updated_at
    )
    VALUES (
      NEW.department_id,
      camp_company_id,
      NEW.campaign_id,
      vuln_score,
      NOW()
    )
    ON CONFLICT (department_id, campaign_id) 
    DO UPDATE SET
      vulnerability_score = vuln_score,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate assign_courses_to_department_employees
CREATE FUNCTION public.assign_courses_to_department_employees(
  p_company_id uuid,
  p_department_id uuid,
  p_course_id uuid,
  p_assigned_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO employee_courses (employee_id, course_id, company_id, assigned_by, assigned_at)
  SELECT 
    u.id,
    p_course_id,
    p_company_id,
    p_assigned_by,
    NOW()
  FROM users u
  INNER JOIN employee_departments ed ON ed.employee_id = u.id
  WHERE ed.department_id = p_department_id
    AND u.role = 'employee'
    AND u.company_id = p_company_id
  ON CONFLICT (employee_id, course_id) DO NOTHING;
END;
$$;

-- Recreate assign_exams_to_department_employees
CREATE FUNCTION public.assign_exams_to_department_employees(
  p_company_id uuid,
  p_department_id uuid,
  p_exam_id uuid,
  p_assigned_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO assigned_exams (
    exam_id,
    company_id,
    assigned_to_department,
    assigned_by,
    assigned_at
  )
  VALUES (
    p_exam_id,
    p_company_id,
    p_department_id,
    p_assigned_by,
    NOW()
  )
  ON CONFLICT (exam_id, company_id, assigned_to_department) 
  WHERE assigned_to_department IS NOT NULL
  DO NOTHING;
END;
$$;

-- Recreate assign_courses_to_new_employee
CREATE FUNCTION public.assign_courses_to_new_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.role = 'employee' AND NEW.department_id IS NOT NULL THEN
    INSERT INTO employee_courses (employee_id, course_id, company_id, assigned_at)
    SELECT 
      NEW.id,
      ec.course_id,
      NEW.company_id,
      NOW()
    FROM employee_courses ec
    INNER JOIN employee_departments ed ON ed.employee_id = ec.employee_id
    WHERE ed.department_id = NEW.department_id
      AND ec.company_id = NEW.company_id
    GROUP BY ec.course_id
    ON CONFLICT (employee_id, course_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate all triggers
CREATE TRIGGER trigger_initialize_phishing_quota
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION initialize_phishing_quota();

CREATE TRIGGER trigger_deduct_campaign_quota
  AFTER INSERT ON phishing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION deduct_campaign_quota();

CREATE TRIGGER trigger_update_dept_vulnerability_stats
  AFTER UPDATE ON phishing_campaign_targets
  FOR EACH ROW
  WHEN (OLD.clicked_at IS DISTINCT FROM NEW.clicked_at 
    OR OLD.credentials_entered IS DISTINCT FROM NEW.credentials_entered
    OR OLD.reported_at IS DISTINCT FROM NEW.reported_at)
  EXECUTE FUNCTION update_department_vulnerability_stats();

CREATE TRIGGER trigger_assign_courses_to_new_employee
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION assign_courses_to_new_employee();
