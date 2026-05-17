-- increment_campaign_stat: safely increment a campaign aggregate counter
CREATE OR REPLACE FUNCTION increment_campaign_stat(p_campaign_id uuid, p_field text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_field = 'emails_opened' THEN
    UPDATE phishing_campaigns SET emails_opened = emails_opened + 1 WHERE id = p_campaign_id;
  ELSIF p_field = 'links_clicked' THEN
    UPDATE phishing_campaigns SET links_clicked = links_clicked + 1 WHERE id = p_campaign_id;
  ELSIF p_field = 'data_submitted' THEN
    UPDATE phishing_campaigns SET data_submitted = data_submitted + 1, credentials_entered = credentials_entered + 1 WHERE id = p_campaign_id;
  ELSIF p_field = 'emails_reported' THEN
    UPDATE phishing_campaigns SET emails_reported = emails_reported + 1 WHERE id = p_campaign_id;
  END IF;
END;$$;

-- enqueue_campaign: creates queue entries for a campaign launch
CREATE OR REPLACE FUNCTION enqueue_campaign(
  p_campaign_id uuid,
  p_emails_per_minute integer DEFAULT 10,
  p_random_delay_enabled boolean DEFAULT false,
  p_random_delay_max_seconds integer DEFAULT 60,
  p_scheduled_at timestamptz DEFAULT now()
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_count integer := 0;
  v_target record;
  v_campaign record;
  v_delay_seconds integer;
  v_send_at timestamptz;
  v_interval_ms numeric;
BEGIN
  SELECT * INTO v_campaign FROM phishing_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;

  v_interval_ms := 60000.0 / GREATEST(p_emails_per_minute, 1);

  FOR v_target IN
    SELECT * FROM phishing_campaign_targets WHERE campaign_id = p_campaign_id ORDER BY created_at
  LOOP
    v_delay_seconds := 0;
    IF p_random_delay_enabled THEN
      v_delay_seconds := floor(random() * p_random_delay_max_seconds);
    END IF;

    v_send_at := p_scheduled_at + (v_count * v_interval_ms * interval '1 millisecond') + (v_delay_seconds * interval '1 second');

    INSERT INTO campaign_email_queue (
      campaign_id, target_id, company_id, smtp_profile_id,
      recipient_email, recipient_id, email_subject, email_html,
      from_address, from_name, scheduled_at
    ) VALUES (
      p_campaign_id, v_target.id, v_campaign.company_id, v_campaign.smtp_profile_id,
      v_target.email, v_target.recipient_id,
      '', -- will be populated by the calling code
      '', -- will be populated by the calling code
      '', '',
      v_send_at
    ) ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  UPDATE phishing_campaigns SET total_queue_size = v_count WHERE id = p_campaign_id;
  RETURN v_count;
END;$$;

-- refund_used_quotes (fix typo: quotes → quotas) — already exists but ensure it works
CREATE OR REPLACE FUNCTION refund_used_quotes(p_company_id uuid, p_quota_year integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE phishing_campaign_quotas
  SET used_campaigns = GREATEST(used_campaigns - 1, 0), updated_at = now()
  WHERE company_id = p_company_id AND quota_year = p_quota_year;
END;$$;
