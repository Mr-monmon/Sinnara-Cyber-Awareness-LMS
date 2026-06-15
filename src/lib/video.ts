/**
 * video — provider-agnostic model for course-section videos.
 *
 * Course-section videos support two providers:
 *   - "youtube"           — the legacy/default; URL stored in course_sections.content
 *                           (English) / content_ar (Arabic).
 *   - "cloudflare_stream" — video hosted on Cloudflare Stream; metadata stored in
 *                           course_sections.content_data.video (JSONB).
 *
 * Why JSONB instead of new columns: course_sections.content_data already carries
 * section-type-specific structured data (quiz questions today), and the
 * get_course_sections RPC streams it to the viewer untouched. Storing the video
 * model there means no RPC/schema migration is required and every existing
 * YouTube record keeps working — sections with no `video` key default to YouTube.
 *
 * SECURITY: the Cloudflare *API token* is never referenced here or anywhere in
 * the browser bundle. Only the customer *subdomain* (which is already public in
 * every embed URL) is read on the frontend, to build iframe/thumbnail URLs.
 */

import { getRuntimeEnv } from './runtimeEnv';

export type VideoProvider = 'youtube' | 'cloudflare_stream';

/** Normalised Cloudflare Stream lifecycle state. */
export type VideoStatus = 'ready' | 'processing' | 'error' | 'pending' | null;

/** The `video` object stored under course_sections.content_data. */
export interface VideoMeta {
  provider: VideoProvider;
  // Cloudflare Stream — per language (Arabic optional, falls back to English).
  cf_uid_en?: string | null;
  cf_uid_ar?: string | null;
  cf_playback_url_en?: string | null;
  cf_playback_url_ar?: string | null;
  cf_thumbnail_url_en?: string | null;
  cf_thumbnail_url_ar?: string | null;
  duration_seconds?: number | null;
  status?: VideoStatus;
}

export interface VideoContentData {
  video?: VideoMeta;
  [key: string]: unknown;
}

/**
 * Customer subdomain used to build Cloudflare Stream iframe/thumbnail URLs.
 * Public value (appears in every embed). Read from VITE_CLOUDFLARE_STREAM_SUBDOMAIN
 * with the account's documented subdomain as a working default.
 */
const DEFAULT_STREAM_SUBDOMAIN = 'customer-e0w228znfk9ohmfy.cloudflarestream.com';

export function getCloudflareStreamSubdomain(): string {
  const fromEnv = getRuntimeEnv('VITE_CLOUDFLARE_STREAM_SUBDOMAIN');
  return (fromEnv && fromEnv.trim()) || DEFAULT_STREAM_SUBDOMAIN;
}

export function buildCloudflareIframeUrl(uid: string, subdomain = getCloudflareStreamSubdomain()): string {
  return `https://${subdomain}/${encodeURIComponent(uid)}/iframe`;
}

export function buildCloudflareThumbnailUrl(uid: string, subdomain = getCloudflareStreamSubdomain()): string {
  return `https://${subdomain}/${encodeURIComponent(uid)}/thumbnails/thumbnail.jpg`;
}

/* ── YouTube helpers ── */

export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

/** Strict-enough validation for the admin form. */
export function isValidYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)[\w-]+|youtu\.be\/[\w-]+)/i.test(url.trim());
}

/** Convert a YouTube watch/short/youtu.be URL into an embeddable URL. */
export function toYouTubeEmbedUrl(url: string): string {
  if (!url) return url;
  const u = url.trim();
  if (u.includes('youtube.com/embed/')) return u;
  if (u.includes('youtube.com/watch?v=')) return `https://www.youtube.com/embed/${u.split('watch?v=')[1].split('&')[0]}`;
  if (u.includes('youtu.be/'))           return `https://www.youtube.com/embed/${u.split('youtu.be/')[1].split(/[?&]/)[0]}`;
  if (u.includes('youtube.com/shorts/')) return `https://www.youtube.com/embed/${u.split('shorts/')[1].split(/[?&]/)[0]}`;
  if (u.includes('youtube.com/live/'))   return `https://www.youtube.com/embed/${u.split('live/')[1].split(/[?&]/)[0]}`;
  return u;
}

/* ── Resolution (language-aware) ── */

/**
 * Pick a per-language value with graceful fallback:
 *   - Arabic viewer: Arabic value if present, else English.
 *   - English viewer: English value if present, else Arabic.
 */
export function pickLang<T extends string | null | undefined>(isArabic: boolean, en: T, ar: T): string | null {
  const e = (en ?? '').toString().trim();
  const a = (ar ?? '').toString().trim();
  if (isArabic) return a || e || null;
  return e || a || null;
}

export function parseVideoMeta(contentData: VideoContentData | null | undefined): VideoMeta {
  const v = contentData?.video;
  if (v && (v.provider === 'youtube' || v.provider === 'cloudflare_stream')) return v;
  // Legacy records (no `video` key) are YouTube by default.
  return { provider: 'youtube' };
}

export interface ResolvedVideo {
  provider: VideoProvider;
  /** Ready-to-embed iframe URL, or null when nothing is configured. */
  embedUrl: string | null;
  thumbnailUrl: string | null;
  /** Cloudflare video UID for the active language (null for YouTube). */
  uid: string | null;
  /** Original source reference (YouTube URL or Cloudflare playback URL). */
  rawUrl: string | null;
  status?: VideoStatus;
}

/**
 * Resolve the effective video for the active language.
 *
 * @param contentData course_sections.content_data (holds the `video` model)
 * @param content     legacy/YouTube English URL (course_sections.content)
 * @param contentAr   legacy/YouTube Arabic URL  (course_sections.content_ar)
 * @param isArabic    whether the viewer is in Arabic
 */
export function resolveVideo(args: {
  contentData: VideoContentData | null | undefined;
  content?: string | null;
  contentAr?: string | null;
  isArabic: boolean;
}): ResolvedVideo {
  const meta = parseVideoMeta(args.contentData);

  if (meta.provider === 'cloudflare_stream') {
    const sub = getCloudflareStreamSubdomain();
    const uid = pickLang(args.isArabic, meta.cf_uid_en, meta.cf_uid_ar);
    const playback =
      pickLang(args.isArabic, meta.cf_playback_url_en, meta.cf_playback_url_ar) ||
      (uid ? buildCloudflareIframeUrl(uid, sub) : null);
    const thumb =
      pickLang(args.isArabic, meta.cf_thumbnail_url_en, meta.cf_thumbnail_url_ar) ||
      (uid ? buildCloudflareThumbnailUrl(uid, sub) : null);
    return {
      provider: 'cloudflare_stream',
      embedUrl: playback,
      thumbnailUrl: thumb,
      uid,
      rawUrl: playback,
      status: meta.status ?? null,
    };
  }

  // YouTube (default / legacy)
  const url = pickLang(args.isArabic, args.content, args.contentAr);
  return {
    provider: 'youtube',
    embedUrl: url ? toYouTubeEmbedUrl(url) : null,
    thumbnailUrl: null,
    uid: null,
    rawUrl: url,
  };
}
