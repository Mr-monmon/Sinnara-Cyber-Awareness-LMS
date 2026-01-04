/*
  # Fix Certificate Generation Without Template

  1. Changes
    - Allow certificates to be generated even without a template
    - Auto-generate certificates when employees complete courses
    - Use default certificate values when no template exists

  2. Features
    - Generate certificates for all course completions
    - Create certificate with auto-generated number
    - Set reasonable expiry dates
*/

-- Update function to auto-issue certificate without requiring a template
CREATE OR REPLACE FUNCTION issue_certificate_on_course_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_cert_number text;
  v_expiry_date timestamptz;
BEGIN
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    SELECT id INTO v_template_id
    FROM certificate_templates
    WHERE course_id = NEW.course_id
    AND is_active = true
    LIMIT 1;

    v_cert_number := 'CERT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0');
    v_expiry_date := NOW() + INTERVAL '1 year';

    INSERT INTO issued_certificates (
      employee_id,
      course_id,
      template_id,
      certificate_number,
      issue_date,
      expiry_date,
      issued_by
    ) VALUES (
      NEW.employee_id,
      NEW.course_id,
      v_template_id,
      v_cert_number,
      NOW(),
      v_expiry_date,
      NEW.employee_id
    )
    ON CONFLICT (employee_id, course_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
