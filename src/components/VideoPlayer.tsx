import React from 'react';
import { PlayCircle } from 'lucide-react';
import {
  VideoProvider,
  buildCloudflareIframeUrl,
  toYouTubeEmbedUrl,
} from '../lib/video';

/**
 * VideoPlayer — renders the correct embed for a course-section video based on
 * its provider. Provider-agnostic so callers don't branch on YouTube vs
 * Cloudflare Stream themselves.
 *
 *   provider = "youtube"           → YouTube iframe (youtubeUrl)
 *   provider = "cloudflare_stream" → Cloudflare Stream iframe
 *                                    (cloudflarePlaybackUrl, else built from uid)
 *
 * Future analytics seam: to track started / progress / completed / watch-time,
 * swap the raw <iframe> for the provider SDK (YouTube IFrame Player API or the
 * Cloudflare Stream Player SDK) inside this component and surface events via new
 * optional callbacks. Consumers won't need to change. The current platform
 * completion model (an explicit "Mark complete" action) keeps working today.
 */
export interface VideoPlayerProps {
  provider: VideoProvider;
  youtubeUrl?: string | null;
  cloudflareVideoUid?: string | null;
  cloudflarePlaybackUrl?: string | null;
  title?: string;
  language?: 'en' | 'ar';
  /** Poster/thumbnail shown by the placeholder when nothing is embeddable. */
  poster?: string | null;
  /** Fallback link label when no embed can be rendered. */
  fallbackLabel?: string;
  style?: React.CSSProperties;
  borderColor?: string;
  mutedColor?: string;
  linkColor?: string;
}

function resolveEmbedUrl(props: VideoPlayerProps): string | null {
  if (props.provider === 'cloudflare_stream') {
    if (props.cloudflarePlaybackUrl && props.cloudflarePlaybackUrl.trim()) return props.cloudflarePlaybackUrl.trim();
    if (props.cloudflareVideoUid && props.cloudflareVideoUid.trim()) return buildCloudflareIframeUrl(props.cloudflareVideoUid.trim());
    return null;
  }
  // youtube
  if (props.youtubeUrl && props.youtubeUrl.trim()) return toYouTubeEmbedUrl(props.youtubeUrl.trim());
  return null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = (props) => {
  const {
    provider, title, language,
    poster = null, fallbackLabel = 'Open video',
    style, borderColor = 'rgba(255,255,255,0.09)',
    mutedColor = '#64748b', linkColor = '#60a5fa',
  } = props;

  const embedUrl = resolveEmbedUrl(props);
  const isAr = language === 'ar';

  const allow =
    provider === 'cloudflare_stream'
      ? 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;'
      : 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        position: 'relative', paddingTop: '56.25%', background: '#000',
        borderRadius: 10, overflow: 'hidden', border: `1px solid ${borderColor}`,
        ...style,
      }}
    >
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title={title || 'Course video'}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          allow={allow}
          allowFullScreen
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {poster && (
            <img src={poster} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
          )}
          <PlayCircle size={48} style={{ color: mutedColor, opacity: 0.5, zIndex: 1 }} />
          {props.youtubeUrl && (
            <a
              href={props.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: linkColor, textDecoration: 'none', zIndex: 1 }}
            >
              {fallbackLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
