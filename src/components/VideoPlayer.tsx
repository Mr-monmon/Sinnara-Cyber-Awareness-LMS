import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play, PlayCircle, Volume1, Volume2, VolumeX } from 'lucide-react';
import {
  VideoProvider,
  buildCloudflareIframeUrl,
  buildLockedCloudflareIframeUrl,
  buildLockedYouTubeEmbedUrl,
  toYouTubeEmbedUrl,
} from '../lib/video';
import { loadCloudflareStreamSdk, loadYouTubeApi } from '../lib/videoSdk';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * VideoPlayer — renders the correct embed for a course-section video based on
 * its provider. Provider-agnostic so callers don't branch on YouTube vs
 * Cloudflare Stream themselves.
 *
 *   provider = "youtube"           → YouTube iframe (youtubeUrl)
 *   provider = "cloudflare_stream" → Cloudflare Stream iframe
 *                                    (cloudflarePlaybackUrl, else built from uid)
 *
 * ── Locked mode (default) ────────────────────────────────────────────────────
 * Course videos are compliance training, so the learner must not be able to
 * skip ahead, and the player must not advertise a route off the platform. In
 * locked mode the provider's own controls are switched off at the embed level
 * and replaced by the control bar below, which exposes exactly play/pause and
 * volume. On top of that:
 *
 *   - A transparent shield covers the iframe, so no click, hover or right-click
 *     ever reaches the provider's UI. That removes the "Copy video URL" context
 *     menu, the YouTube wordmark, the title/share overlay and the end-cards as
 *     interactive elements — the shield only toggles play/pause.
 *   - Seeking forward is refused. The furthest point actually watched is
 *     tracked, the progress bar only accepts positions at or behind it, and a
 *     watchdog snaps playback back if the position ever jumps ahead by other
 *     means.
 *   - Keyboard seeking is disabled at the embed level (`disablekb`), and the
 *     container swallows the arrow/number keys the browser might still deliver.
 *
 * This is deterrence appropriate to an LMS, not DRM. A determined user can
 * still read the YouTube video id from the page source; making the underlying
 * media itself non-redistributable needs signed playback URLs from a provider
 * such as Cloudflare Stream, which is a content-hosting decision rather than a
 * player one.
 *
 * Pass `locked={false}` for authoring/preview surfaces that legitimately need
 * to scrub through a video.
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
  /** Hide native controls and forbid seeking ahead. Defaults to true. */
  locked?: boolean;
  style?: React.CSSProperties;
  borderColor?: string;
  mutedColor?: string;
  linkColor?: string;
}

/** Playback position may run at most this far past the watched high-water mark. */
const SKIP_TOLERANCE_SECONDS = 1.5;
const POLL_INTERVAL_MS = 250;

const STRINGS = {
  en: { play: 'Play', pause: 'Pause', mute: 'Mute', unmute: 'Unmute', volume: 'Volume', progress: 'Progress' },
  ar: { play: 'تشغيل', pause: 'إيقاف مؤقت', mute: 'كتم الصوت', unmute: 'إلغاء الكتم', volume: 'مستوى الصوت', progress: 'التقدم' },
};

/** Minimal uniform surface over the two provider SDKs. */
interface PlayerEngine {
  play(): void;
  pause(): void;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number): void;
  /** @param volume 0..1 */
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}

function resolveEmbedUrl(props: VideoPlayerProps, locked: boolean): string | null {
  if (props.provider === 'cloudflare_stream') {
    const source =
      (props.cloudflarePlaybackUrl && props.cloudflarePlaybackUrl.trim()) ||
      (props.cloudflareVideoUid && props.cloudflareVideoUid.trim()) ||
      null;
    if (!source) return null;
    if (!locked) {
      return /^https?:\/\//i.test(source) ? source : buildCloudflareIframeUrl(source);
    }
    return buildLockedCloudflareIframeUrl(source);
  }

  // youtube
  const url = props.youtubeUrl && props.youtubeUrl.trim();
  if (!url) return null;
  if (!locked) return toYouTubeEmbedUrl(url);
  // A URL we can't parse an id out of can't be locked down, so it isn't embedded
  // at all — the caller's fallback link is shown instead of an unlocked player.
  return buildLockedYouTubeEmbedUrl(url);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = (props) => {
  const {
    provider, title, language, locked = true,
    poster = null, fallbackLabel = 'Open video',
    style, borderColor = 'rgba(255,255,255,0.09)',
    mutedColor = '#64748b', linkColor = '#60a5fa',
  } = props;

  const isAr = language === 'ar';
  const L = isAr ? STRINGS.ar : STRINGS.en;
  const embedUrl = useMemo(() => resolveEmbedUrl(props, locked), [props, locked]);

  const frameStyle: React.CSSProperties = {
    position: 'relative', paddingTop: '56.25%', background: '#000',
    borderRadius: 10, overflow: 'hidden', border: `1px solid ${borderColor}`,
    ...style,
  };

  if (!embedUrl) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} style={frameStyle}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {poster && (
            <img src={poster} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
          )}
          <PlayCircle size={48} style={{ color: mutedColor, opacity: 0.5, zIndex: 1 }} />
          {props.youtubeUrl && !locked && (
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
      </div>
    );
  }

  if (!locked) {
    const allow =
      provider === 'cloudflare_stream'
        ? 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;'
        : 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} style={frameStyle}>
        <iframe
          src={embedUrl}
          title={title || 'Course video'}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          allow={allow}
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <LockedPlayer
      key={embedUrl}
      embedUrl={embedUrl}
      provider={provider}
      title={title}
      isAr={isAr}
      labels={L}
      frameStyle={frameStyle}
    />
  );
};

interface LockedPlayerProps {
  embedUrl: string;
  provider: VideoProvider;
  title?: string;
  isAr: boolean;
  labels: typeof STRINGS.en;
  frameStyle: React.CSSProperties;
}

const LockedPlayer: React.FC<LockedPlayerProps> = ({ embedUrl, provider, title, isAr, labels, frameStyle }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const engineRef = useRef<PlayerEngine | null>(null);
  /** Furthest point actually watched; the ceiling for any seek. */
  const maxWatchedRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [maxWatched, setMaxWatched] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const [muted, setMutedState] = useState(false);

  /* ── Engine setup ── */
  useEffect(() => {
    let cancelled = false;
    let engine: PlayerEngine | null = null;

    const attachYouTube = async () => {
      const YT = await loadYouTubeApi();
      if (cancelled || !iframeRef.current) return;

      const player = await new Promise<any>((resolve) => {
        // Resolve with `event.target` rather than the constructor's return value:
        // onReady can fire before the assignment completes.
        new YT.Player(iframeRef.current, {
          events: {
            onReady: (e: any) => resolve(e.target),
            onStateChange: (e: any) => {
              if (cancelled) return;
              setPlaying(e.data === YT.PlayerState.PLAYING);
              setBuffering(e.data === YT.PlayerState.BUFFERING);
            },
          },
        });
      });
      if (cancelled) return;

      engine = {
        play: () => player.playVideo(),
        pause: () => player.pauseVideo(),
        getCurrentTime: () => player.getCurrentTime?.() ?? 0,
        getDuration: () => player.getDuration?.() ?? 0,
        seekTo: (s) => player.seekTo(s, true),
        setVolume: (v) => player.setVolume(Math.round(v * 100)),
        setMuted: (m) => (m ? player.mute() : player.unMute()),
        destroy: () => player.destroy?.(),
      };
    };

    const attachCloudflare = async () => {
      const Stream = await loadCloudflareStreamSdk();
      if (cancelled || !iframeRef.current) return;
      const player = Stream(iframeRef.current);

      player.addEventListener('play', () => !cancelled && setPlaying(true));
      player.addEventListener('pause', () => !cancelled && setPlaying(false));
      player.addEventListener('waiting', () => !cancelled && setBuffering(true));
      player.addEventListener('playing', () => !cancelled && setBuffering(false));

      engine = {
        play: () => player.play(),
        pause: () => player.pause(),
        getCurrentTime: () => player.currentTime ?? 0,
        getDuration: () => player.duration ?? 0,
        seekTo: (s) => { player.currentTime = s; },
        setVolume: (v) => { player.volume = v; },
        setMuted: (m) => { player.muted = m; },
        destroy: () => { /* the SDK has no teardown; dropping the iframe suffices */ },
      };
    };

    const attach = provider === 'cloudflare_stream' ? attachCloudflare : attachYouTube;
    attach()
      .then(() => {
        if (cancelled || !engine) return;
        engineRef.current = engine;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      try { engineRef.current?.destroy(); } catch { /* teardown is best-effort */ }
      engineRef.current = null;
    };
  }, [embedUrl, provider]);

  /* ── Position polling + forward-seek watchdog ── */
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;

      const total = engine.getDuration();
      if (Number.isFinite(total) && total > 0) setDuration(total);

      const t = engine.getCurrentTime();
      if (!Number.isFinite(t)) return;

      if (t > maxWatchedRef.current + SKIP_TOLERANCE_SECONDS) {
        // A jump ahead we didn't authorise — pull playback back to the
        // high-water mark rather than letting the learner skip content.
        engine.seekTo(maxWatchedRef.current);
        setCurrentTime(maxWatchedRef.current);
        return;
      }
      if (t > maxWatchedRef.current) {
        maxWatchedRef.current = t;
        setMaxWatched(t);
      }
      setCurrentTime(t);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [ready]);

  const togglePlay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (playing) engine.pause();
    else engine.play();
  }, [playing]);

  const applyVolume = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(100, next));
    setVolumeState(clamped);
    const engine = engineRef.current;
    if (!engine) return;
    engine.setVolume(clamped / 100);
    // Moving the slider off zero implies the learner wants to hear it again.
    if (clamped > 0 && muted) {
      engine.setMuted(false);
      setMutedState(false);
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !muted;
    engine.setMuted(next);
    setMutedState(next);
  }, [muted]);

  /** Seeking is allowed only at or behind the furthest point already watched. */
  const seekWithin = useCallback((seconds: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const target = Math.max(0, Math.min(seconds, maxWatchedRef.current));
    engine.seekTo(target);
    setCurrentTime(target);
  }, []);

  const onProgressPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = (e.clientX - rect.left) / rect.width;
    const fraction = isAr ? 1 - raw : raw;
    seekWithin(fraction * duration);
  }, [duration, isAr, seekWithin]);

  /* Swallow the seek shortcuts the browser may still deliver to our container. */
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const blocked = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'End', 'Home', 'PageUp', 'PageDown'];
    if (blocked.includes(e.key) || /^\d$/.test(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      togglePlay();
    }
  }, [togglePlay]);

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const watchedPct = duration > 0 ? Math.min(100, (maxWatched / duration) * 100) : 0;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{ ...frameStyle, userSelect: 'none', outline: 'none' }}
    >
      <style>{`@keyframes aw-vp-spin { to { transform: rotate(360deg); } }`}</style>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title || 'Course video'}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
        allow="autoplay; encrypted-media"
        // No allowFullScreen: native fullscreen would re-expose the provider's chrome.
      />

      {/*
        Transparent shield. `pointer-events` is already off on the iframe, but the
        shield is what turns a click into play/pause and guarantees no gesture is
        ever routed to the provider even if the iframe style is tampered with.
      */}
      <div
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{ position: 'absolute', inset: 0, zIndex: 2, cursor: ready ? 'pointer' : 'default', background: 'transparent' }}
      />

      {(!ready || buffering) && !failed && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Loader2 size={34} style={{ color: 'rgba(255,255,255,0.85)', animation: 'aw-vp-spin 1s linear infinite' }} />
        </div>
      )}

      {failed && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
          {isAr ? 'تعذّر تحميل الفيديو. يرجى تحديث الصفحة.' : 'The video could not be loaded. Please refresh the page.'}
        </div>
      )}

      {ready && !playing && !buffering && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={labels.play}
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 3, width: 66, height: 66, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Play size={28} style={{ marginInlineStart: 4 }} fill="currentColor" />
        </button>
      )}

      {/* ── Custom control bar: play/pause + volume only ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px 10px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))',
          opacity: ready ? 1 : 0, transition: 'opacity 200ms ease',
          pointerEvents: ready ? 'auto' : 'none',
        }}
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? labels.pause : labels.play}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#fff', display: 'flex' }}
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>

        {/*
          Progress is a read-mostly indicator: the lighter band shows how far the
          video has been watched, and only that band accepts a click. Anything
          past it is not reachable, so the learner can review but not skip.
        */}
        <div
          role="slider"
          aria-label={labels.progress}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          onPointerDown={onProgressPointer}
          style={{ position: 'relative', flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}
        >
          <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${watchedPct}%`, borderRadius: 3, background: 'rgba(255,255,255,0.4)' }} />
          <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 3, background: '#fff' }} />
        </div>

        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? labels.unmute : labels.mute}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#fff', display: 'flex' }}
          >
            <VolumeIcon size={18} />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : volume}
            onChange={(e) => applyVolume(Number(e.target.value))}
            aria-label={labels.volume}
            style={{ width: 78, accentColor: '#fff', cursor: 'pointer' }}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
