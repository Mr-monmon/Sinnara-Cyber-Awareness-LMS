import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Partner {
  id: string;
  name: string;
  logo_url: string;
  website?: string | null;
  order_index: number;
}

/* ── Design Tokens ── */
const T = {
  bg:          '#12140a',
  accent:      '#c8ff00',
  border:      'rgba(255,255,255,0.10)',
  borderFaint: 'rgba(255,255,255,0.05)',
  textMuted:   '#64748b',
  textBody:    '#94a3b8',
  cardBg:      'rgba(255,255,255,0.04)',
  cardHover:   'rgba(200,255,0,0.06)',
};

export const PartnersCarousel: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => { loadPartners(); }, []);

  const loadPartners = async () => {
    const { data } = await supabase
      .from('partners')
      .select('*')
      .eq('is_active', true)
      .order('order_index');
    if (data) setPartners(data);
  };

  if (partners.length === 0) return null;

  /* triple-duplicate for seamless infinite loop */
  const looped = [...partners, ...partners, ...partners];
  /* card width (288) + gap (24) = 312px per item */
  const totalShift = 312 * partners.length;

  const LogoCard: React.FC<{ partner: Partner; idx: number }> = ({ partner, idx }) => {
    const inner = (
      <div
        className="aw-partner-card"
        style={{
          width: 288,
          height: 120,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 24px',
          background: T.cardBg,
          border: `1px solid ${T.borderFaint}`,
          borderRadius: 12,
          transition: 'background 0.25s, border-color 0.25s, filter 0.25s, opacity 0.25s',
          filter: 'grayscale(1)',
          opacity: 0.55,
          cursor: partner.website ? 'pointer' : 'default',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background    = T.cardHover;
          el.style.borderColor   = 'rgba(200,255,0,0.25)';
          el.style.filter        = 'grayscale(0)';
          el.style.opacity       = '1';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background    = T.cardBg;
          el.style.borderColor   = T.borderFaint;
          el.style.filter        = 'grayscale(1)';
          el.style.opacity       = '0.55';
        }}
      >
        <img
          src={partner.logo_url}
          alt={partner.name}
          style={{ maxHeight: 72, maxWidth: '100%', objectFit: 'contain', display: 'block' }}
          onError={e => {
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            const fallback = document.createElement('span');
            fallback.textContent = partner.name;
            fallback.style.cssText = `font-size:14px;font-weight:700;color:${T.textBody};text-align:center;`;
            img.parentElement?.appendChild(fallback);
          }}
        />
      </div>
    );

    return partner.website ? (
      <a
        key={`${partner.id}-${idx}`}
        href={partner.website}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', flexShrink: 0 }}
        tabIndex={-1}
      >
        {inner}
      </a>
    ) : (
      <div key={`${partner.id}-${idx}`} style={{ flexShrink: 0 }}>
        {inner}
      </div>
    );
  };

  return (
    <section
      style={{
        padding: '96px 0',
        background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Heading ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', marginBottom: 56 }}>
        <p style={{
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: T.textMuted,
          letterSpacing: '2.8px',
          textTransform: 'uppercase',
          lineHeight: '20px',
          margin: 0,
        }}>
          Trusted by Leading Organizations
        </p>
      </div>

      {/* ── Carousel track ── */}
      <div style={{ position: 'relative' }}>
        {/* Left fade */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
            background: 'linear-gradient(to right, rgba(18,18,12,0.95) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />
        {/* Right fade */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
            background: 'linear-gradient(to left, rgba(18,18,12,0.95) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ overflow: 'hidden', padding: '8px 0' }}>
          <div
            className="aw-carousel-track"
            style={{ display: 'flex', gap: 24, width: 'max-content' }}
          >
            {looped.map((partner, idx) => (
              <LogoCard key={`${partner.id}-${idx}`} partner={partner} idx={idx} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Pause hint ── */}
      <p style={{
        textAlign: 'center',
        fontSize: 12,
        color: T.textMuted,
        marginTop: 32,
        letterSpacing: '0.4px',
        opacity: 0.6,
      }}>
        Hover to pause
      </p>

      {/* ── Animation ── */}
      <style>{`
        @keyframes aw-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-${totalShift}px); }
        }

        .aw-carousel-track {
          animation: aw-scroll ${Math.max(20, partners.length * 6)}s linear infinite;
          will-change: transform;
        }

        .aw-carousel-track:hover {
          animation-play-state: paused;
        }

        @media (max-width: 768px) {
          .aw-carousel-track {
            animation-duration: ${Math.max(15, partners.length * 4)}s;
          }
        }
      `}</style>
    </section>
  );
};
