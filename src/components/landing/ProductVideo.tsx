import { useEffect, useState } from "react";
import { Play } from "lucide-react";

/**
 * ProductVideo — the AwareOne overview film, embedded beneath "How Does AwareOne Work?".
 *
 * Rendered as a *facade* rather than an iframe: the section shows a poster and a
 * play button, and the YouTube player is only mounted once the visitor presses
 * it. Two reasons, both of which matter on a marketing landing page:
 *
 *   • Performance. A YouTube iframe pulls roughly half a megabyte of player
 *     script on every page load, whether or not anyone watches. The landing page
 *     is the first thing a prospect sees and it should not pay that toll for a
 *     video most visitors scroll past.
 *
 *   • Privacy. No YouTube request is made — and so no tracking cookie is set —
 *     until the visitor has actively chosen to watch. The player is then loaded
 *     from youtube-nocookie.com. For a platform selling PDPL-aware services,
 *     silently handing every visitor to a third party would be a poor look.
 */

const VIDEO_ID = "zCTr1wUHZtU";

/* Highest-quality still, with a fallback: maxresdefault does not exist for every
   upload, and a broken poster is worse than a slightly softer one. */
const POSTER = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;
const POSTER_FALLBACK = `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`;

const T = {
  accent: "#c8ff00",
  border: "rgba(255,255,255,0.09)",
  textBody: "#cbd5e1",
  textMuted: "#64748b",
} as const;

export const ProductVideo = () => {
  const [playing, setPlaying] = useState(false);
  const [poster, setPoster] = useState<string | null>(null);

  /* The poster is resolved by preloading rather than rendered as an <img>.
     An <img> that fails — a missing maxresdefault, a blocked third-party
     request, an ad-blocker — paints a broken-image icon over the section. Here a
     failure simply leaves the branded gradient in place, which looks deliberate.
     Only the ~50KB still is fetched; the half-megabyte player still waits for a
     click. */
  useEffect(() => {
    let cancelled = false;
    const attempt = (url: string, onFail: () => void) => {
      const img = new Image();
      img.onload = () => { if (!cancelled) setPoster(url); };
      img.onerror = onFail;
      img.src = url;
    };
    attempt(POSTER, () => attempt(POSTER_FALLBACK, () => { /* gradient only */ }));
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "72px auto 0" }}>
      <style>{`
        .aw-vid-shell {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid ${T.border};
          background: #0e100a;
        }
        .aw-vid-btn {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          padding: 0; margin: 0;
          border: none; background: none;
          cursor: pointer; display: block;
          font-family: inherit;
        }
        .aw-vid-poster {
          position: absolute; inset: 0;
          background-size: cover; background-position: center;
          /* Branded fallback beneath the still — visible on its own if the
             thumbnail never loads, so the frame is never empty or broken. */
          background-color: #12140a;
          background-image: radial-gradient(120% 100% at 70% 12%, rgba(200,255,0,0.16), transparent 62%),
                            linear-gradient(150deg, #161a0c 0%, #12140a 58%, #0d1410 100%);
          transition: transform 0.5s cubic-bezier(0.22,1,0.36,1), filter 0.4s ease;
          filter: saturate(0.92) brightness(0.72);
        }
        .aw-vid-btn:hover .aw-vid-poster,
        .aw-vid-btn:focus-visible .aw-vid-poster {
          transform: scale(1.035);
          filter: saturate(1) brightness(0.82);
        }
        .aw-vid-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(18,20,10,0.20) 0%, rgba(18,20,10,0.55) 62%, rgba(18,20,10,0.88) 100%);
          pointer-events: none;
        }
        .aw-vid-play {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 84px; height: 84px; border-radius: 50%;
          background: ${T.accent};
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 0 rgba(200,255,0,0.42);
          transition: transform 0.28s cubic-bezier(0.22,1,0.36,1), box-shadow 0.28s ease;
          pointer-events: none;
        }
        .aw-vid-btn:hover .aw-vid-play,
        .aw-vid-btn:focus-visible .aw-vid-play {
          transform: translate(-50%, -50%) scale(1.09);
          box-shadow: 0 0 0 16px rgba(200,255,0,0.10);
        }
        .aw-vid-btn:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 3px; }
        .aw-vid-caption {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 26px 28px;
          text-align: left;
          pointer-events: none;
        }
        @media (max-width: 640px) {
          .aw-vid-play { width: 62px; height: 62px; }
          .aw-vid-caption { padding: 18px 18px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aw-vid-poster, .aw-vid-play { transition: none !important; }
          .aw-vid-btn:hover .aw-vid-poster { transform: none; }
        }
      `}</style>

      <div className="aw-vid-shell">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
            title="AwareOne — Turn Human Risk into Measurable Cyber Resilience"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: 0, display: "block" }}
          />
        ) : (
          <button
            type="button"
            className="aw-vid-btn"
            onClick={() => setPlaying(true)}
            aria-label="Play the AwareOne overview video (2 minutes 35 seconds)"
          >
            <span
              className="aw-vid-poster"
              style={poster ? {
                backgroundImage:
                  `url("${poster}"), radial-gradient(120% 100% at 70% 12%, rgba(200,255,0,0.16), transparent 62%), linear-gradient(150deg, #161a0c 0%, #12140a 58%, #0d1410 100%)`,
              } : undefined}
            />
            <span className="aw-vid-scrim" />
            <span className="aw-vid-play">
              {/* Nudged right so the triangle looks optically centred in the circle. */}
              <Play size={32} fill="#12140a" color="#12140a" style={{ marginLeft: 5 }} />
            </span>
            <span className="aw-vid-caption">
              <span style={{ display: "block", fontSize: 12, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: T.accent, marginBottom: 8 }}>
                Watch the overview · 2:35
              </span>
              <span style={{ display: "block", fontSize: 20, fontWeight: 800, color: "#ffffff", lineHeight: 1.35 }}>
                Turn human risk into a measurable human firewall
              </span>
            </span>
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, color: T.textMuted, textAlign: "center", margin: "16px 0 0", lineHeight: 1.7 }}>
        Arabic narration with English on-screen titles · Covers training, simulation,
        risk measurement and compliance evidence
      </p>
    </div>
  );
};

export default ProductVideo;
