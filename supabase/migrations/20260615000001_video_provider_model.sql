/*
  Migration: course-section video provider model (additive, idempotent)

  Course-section videos now support multiple providers (YouTube, Cloudflare
  Stream). The provider + Cloudflare metadata live in
  course_sections.content_data -> 'video' (JSONB), which the get_course_sections
  RPC already streams to the viewer untouched — so NO new columns and NO RPC
  signature change are required, and every existing YouTube record keeps working.

  Shape of the stored model:
    content_data = {
      "video": {
        "provider": "youtube" | "cloudflare_stream",
        "cf_uid_en": "...", "cf_uid_ar": "...",
        "cf_playback_url_en": "...", "cf_playback_url_ar": "...",
        "cf_thumbnail_url_en": "...", "cf_thumbnail_url_ar": "...",
        "duration_seconds": 123, "status": "ready"
      }
    }

  Backfill: tag every existing VIDEO section that has no explicit `video` model
  as { "provider": "youtube" }, so old records are explicit. Read-time code
  already defaults a missing model to YouTube, so this is belt-and-suspenders and
  safe to re-run (the WHERE clause excludes rows already tagged).
*/

-- content_data
UPDATE public.course_sections
SET content_data = COALESCE(content_data, '{}'::jsonb)
                   || jsonb_build_object('video', jsonb_build_object('provider', 'youtube'))
WHERE section_type = 'VIDEO'
  AND (COALESCE(content_data, '{}'::jsonb) -> 'video') IS NULL;

-- content_data_ar (mirror, only when present and not yet tagged)
UPDATE public.course_sections
SET content_data_ar = content_data_ar
                      || jsonb_build_object('video', jsonb_build_object('provider', 'youtube'))
WHERE section_type = 'VIDEO'
  AND content_data_ar IS NOT NULL
  AND (content_data_ar -> 'video') IS NULL;
