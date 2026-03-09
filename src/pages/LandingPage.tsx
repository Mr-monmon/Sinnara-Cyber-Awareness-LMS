import React, { useState, useEffect } from 'react';
import { RequestDemoModal } from '../components/landing/RequestDemoModal';
import { PartnersCarousel } from '../components/landing/PartnersCarousel';
import { supabase } from '../lib/supabase';
import {
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Twitter,
  Linkedin,
  Youtube,
} from 'lucide-react';

/* ─────────────────────────────────────────
   DESIGN TOKENS (mirrors Figma exactly)
───────────────────────────────────────── */
const T = {
  bg:            '#12140a',
  accent:        '#c8ff00',
  accentAlpha10: 'rgba(200,255,0,0.10)',
  accentAlpha20: 'rgba(200,255,0,0.20)',
  white:         '#ffffff',
  textNav:       '#cbd5e1',
  textBody:      '#94a3b8',
  textMuted:     '#64748b',
  border:        'rgba(255,255,255,0.10)',
  borderFaint:   'rgba(255,255,255,0.05)',
  cardBg:        'rgba(200,255,0,0.03)',
  overlayDark:   'rgba(15,23,42,0.50)',
  headerBg:      'rgba(18,20,10,0.80)',
} as const;

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface LandingPageProps {
  onNavigate: (page: string) => void;
}
interface CTASettings {
  headline: string;
  subheadline: string;
  primary_button: string;
  secondary_button: string;
}
interface FooterSettings {
  tagline: string;
  email: string;
  phone: string;
  copyright: string;
}

/* ─────────────────────────────────────────
   FIGMA ASSETS
───────────────────────────────────────── */
const LOGO    = 'https://www.figma.com/api/mcp/asset/f7badfce-8bdc-4ae5-9ad9-e5af67dfd195';
const DASH    = 'https://www.figma.com/api/mcp/asset/086116a6-2692-4da2-b352-59aa6654cad8';
const PLAY    = 'https://www.figma.com/api/mcp/asset/c85903ba-c0f3-41b9-9f7f-39f7f71d1b1f';

const PARTNERS = [
  'https://www.figma.com/api/mcp/asset/1ac95b85-cf7d-4669-9493-47e2d0247e59',
  'https://www.figma.com/api/mcp/asset/f0da9626-c47d-4117-8580-4151f29f6c5a',
  'https://www.figma.com/api/mcp/asset/548a8b28-b061-4e17-84c3-794121e8f552',
  'https://www.figma.com/api/mcp/asset/5d957886-2178-4bc4-8390-b79404dd1dc6',
  'https://www.figma.com/api/mcp/asset/e8d13236-1989-4e23-b723-30e68121f07a',
  'https://www.figma.com/api/mcp/asset/ff05b177-9d94-4893-943c-ae2a7526f389',
];

const FEATURE_ICONS = [
  'https://www.figma.com/api/mcp/asset/d3e1538c-812f-40a8-af3a-638e384fa36e',
  'https://www.figma.com/api/mcp/asset/6af2aa0c-df1f-4e4e-9e64-0b23e6dd802a',
  'https://www.figma.com/api/mcp/asset/121e663b-7ebc-442c-9646-25615016fe91',
  'https://www.figma.com/api/mcp/asset/df6107f0-f94b-4165-8e2e-3e9335fe2c55',
  'https://www.figma.com/api/mcp/asset/6946c8bc-f3b6-4b39-a501-da6cc3729421',
  'https://www.figma.com/api/mcp/asset/588936eb-8b9c-4a7f-b1f7-e3c252b58eb4',
  'https://www.figma.com/api/mcp/asset/9d9133ea-9f88-4ed9-a220-5cb9caec8878',
  'https://www.figma.com/api/mcp/asset/6b0a5ae6-6e39-4816-9b0f-6a480ce2e153',
];

const FEATURES = [
  { title: 'Hosted in Saudi Arabia',   desc: 'Full data residency and sovereignty within the Kingdom.' },
  { title: 'Regulatory Compliance',     desc: 'Built for ISO 27001, NCA, SAMA, and PDPL frameworks.' },
  { title: 'Local Threat Intel',        desc: 'Stay updated on threats specific to the MENA region.' },
  { title: 'Comprehensive Training',    desc: 'In-depth interactive modules for all employee levels.' },
  { title: 'Pre & Post Assessments',   desc: 'Accurately measure knowledge retention and ROI.' },
  { title: 'Real-Time Analytics',       desc: "Instant visibility into your organization's risk profile." },
  { title: 'Role-Based Access',         desc: 'Granular permissions for diverse administrative teams.' },
  { title: 'Phishing Simulation',       desc: 'Test resilience with realistic regional attack vectors.' },
];

const STEPS = [
  { title: 'Assess',   desc: "Baseline your team's current security knowledge with intelligent pre-assessments." },
  { title: 'Train',    desc: 'Deliver localized, role-based training modules tailored to your industry.' },
  { title: 'Simulate', desc: 'Run realistic phishing simulations to test real-world readiness and response.' },
  { title: 'Report',   desc: 'Gain actionable insights and compliance-ready reports to measure your ROI.' },
];

const BLOGS = [
  {
    category: 'Phishing',
    title: 'How Regional Banks are Combating Phishing in 2024',
    desc: 'A deep dive into the latest social engineering tactics targeting Middle Eastern financial institutions.',
  },
  {
    category: 'Compliance',
    title: "Navigating Saudi Arabia's PDPL: A Security Guide",
    desc: 'Essential steps for data controllers to ensure awareness training meets new regulatory standards.',
  },
  {
    category: 'AI & ML',
    title: 'The Future of AI in Employee Phishing Simulations',
    desc: 'Discover how machine learning is personalizing cybersecurity training for better outcomes.',
  },
];

/* ─────────────────────────────────────────
   SMALL SHARED HELPERS
───────────────────────────────────────── */
function hoverBtn(
  base: React.CSSProperties,
  hoverProps: React.CSSProperties,
): React.HTMLAttributes<HTMLElement> {
  return {
    onMouseEnter: (e) => Object.assign((e.currentTarget as HTMLElement).style, hoverProps),
    onMouseLeave: (e) => Object.assign((e.currentTarget as HTMLElement).style, base),
  };
}

/* ─────────────────────────────────────────
   STEP SVG ICONS
───────────────────────────────────────── */
const StepIcons: React.ReactNode[] = [
  <svg key="s1" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 1L2 4V9C2 13.418 5.17 17.564 9 18C12.83 17.564 16 13.418 16 9V4L9 1Z"
      stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>,
  <svg key="s2" width="22" height="18" viewBox="0 0 22 18" fill="none">
    <path d="M1 1H7C8.06 1 9.08 1.42 9.83 2.17C10.58 2.92 11 3.94 11 5V17C11 16.2 10.68 15.44 10.12 14.88C9.56 14.32 8.8 14 8 14H1V1Z"
      stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M21 1H15C13.94 1 12.92 1.42 12.17 2.17C11.42 2.92 11 3.94 11 5V17C11 16.2 11.32 15.44 11.88 14.88C12.44 14.32 13.2 14 14 14H21V1Z"
      stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>,
  <svg key="s3" width="20" height="16" viewBox="0 0 20 16" fill="none">
    <rect x="1" y="1" width="18" height="14" rx="2" stroke="#c8ff00" strokeWidth="1.5"/>
    <path d="M5 6H9M5 10H13" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="14" cy="6" r="1.5" stroke="#c8ff00" strokeWidth="1"/>
  </svg>,
  <svg key="s4" width="22" height="17" viewBox="0 0 22 17" fill="none">
    <path d="M1 16L7 10L11 13L16 7L21 1" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1 1V16H21" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>,
];

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [scrolled, setScrolled]           = useState(false);

  const [ctaSettings, setCTASettings] = useState<CTASettings>({
    headline:         'Ready to Build a Security-Aware Culture?',
    subheadline:      'Join 25+ enterprises across the region who trust AwareOne to protect their people and meet compliance requirements with confidence.',
    primary_button:   'Request a Demo',
    secondary_button: 'Free Assessment',
  });
  const [footerSettings, setFooterSettings] = useState<FooterSettings>({
    tagline:   'Empowering organizations to build a resilient security culture through localized, data-driven training and simulation.',
    email:     'hello@awareone.sa',
    phone:     '+966 11 234 5678',
    copyright: '© 2025 AwareOne. All rights reserved.',
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data: ctaData } = await supabase
        .from('homepage_settings').select('setting_value')
        .eq('setting_key', 'cta_section').maybeSingle();
      if (ctaData?.setting_value) setCTASettings(ctaData.setting_value as CTASettings);

      const { data: footerData } = await supabase
        .from('homepage_settings').select('setting_value')
        .eq('setting_key', 'footer').maybeSingle();
      if (footerData?.setting_value) setFooterSettings(footerData.setting_value as FooterSettings);
    } catch (err) {
      console.error('Failed to load homepage settings', err);
    }
  };

  /* highlight CTA headline keyword */
  const highlightHeadline = (text: string) => {
    const keywords = ['Security-Aware', 'AwareOne', 'Cybersecurity'];
    for (const kw of keywords) {
      if (text.includes(kw)) {
        const [before, after] = text.split(kw);
        return <>{before}<span style={{ color: T.accent }}>{kw}</span>{after}</>;
      }
    }
    return text;
  };

  /* ─── render ─── */
  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: T.white }}>

      {/* ═══════════════════════════════════
          GLOBAL STYLES
      ═══════════════════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }
        a, button { font-family: 'Inter', sans-serif; }

        @keyframes aw-pulse {
          0%,100% { transform: scale(1); opacity: 0.75; }
          50%      { transform: scale(1.8); opacity: 0; }
        }

        /* ── responsive nav ── */
        .aw-desk-nav   { display: flex; }
        .aw-desk-act   { display: flex; }
        .aw-hamburger  { display: none; }
        .aw-mob-nav    { display: none; }

        @media (max-width: 1024px) {
          .aw-desk-nav  { display: none !important; }
          .aw-desk-act  { display: none !important; }
          .aw-hamburger { display: flex !important; }
          .aw-mob-nav   { display: block !important; }
        }

        /* ── hero heading responsive ── */
        .aw-hero-h { font-size: 72px; line-height: 72px; letter-spacing: -1.8px; font-weight: 900; }
        @media (max-width: 900px)  { .aw-hero-h { font-size: 52px !important; line-height: 56px !important; } }
        @media (max-width: 600px)  { .aw-hero-h { font-size: 38px !important; line-height: 44px !important; letter-spacing: -1px !important; } }

        /* ── hero layout ── */
        .aw-hero-inner  { display: flex; align-items: center; gap: 48px; }
        .aw-hero-left   { flex: 1; min-width: 280px; }
        .aw-hero-right  { flex: 1; min-width: 280px; }
        @media (max-width: 900px) {
          .aw-hero-inner { flex-direction: column; }
          .aw-hero-left, .aw-hero-right { width: 100%; }
        }

        /* ── hero cta row ── */
        .aw-cta-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
        @media (max-width: 600px) {
          .aw-cta-row { flex-direction: column; align-items: stretch; }
          .aw-cta-row button { width: 100%; }
        }

        /* ── partners grid ── */
        .aw-partners-grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
        .aw-partner-item  { flex: 1 1 120px; max-width: 200px; }

        /* ── features grid ── */
        .aw-features-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        @media (max-width: 1024px) { .aw-features-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .aw-features-grid { grid-template-columns: 1fr; } }

        /* ── steps grid ── */
        .aw-steps-grid    { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; position: relative; }
        .aw-steps-divider { position: absolute; top: 41px; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.08); }
        @media (max-width: 1024px) {
          .aw-steps-grid    { grid-template-columns: repeat(2, 1fr); }
          .aw-steps-divider { display: none; }
        }
        @media (max-width: 600px)  {
          .aw-steps-grid { grid-template-columns: 1fr; }
        }

        /* ── blog grid ── */
        .aw-blog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
        @media (max-width: 1024px) { .aw-blog-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .aw-blog-grid { grid-template-columns: 1fr; } }

        /* ── footer grid ── */
        .aw-footer-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
        @media (max-width: 1024px) { .aw-footer-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .aw-footer-grid { grid-template-columns: 1fr; } }

        /* ── footer bottom ── */
        .aw-footer-bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        @media (max-width: 600px)  { .aw-footer-bottom { flex-direction: column; align-items: flex-start; } }

        /* ── CTA buttons ── */
        .aw-cta-btn-row { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; }
        @media (max-width: 600px) {
          .aw-cta-btn-row { flex-direction: column; align-items: stretch; }
          .aw-cta-btn-row button { width: 100%; }
        }

        /* ── section padding ── */
        .aw-section { padding: 96px 0; }
        @media (max-width: 600px) { .aw-section { padding: 64px 0; } }

        .aw-container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }
        @media (max-width: 600px) { .aw-container { padding: 0 20px; } }

        /* ── feature card hover ── */
        .aw-feat-card {
          background: rgba(200,255,0,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 25px;
          backdrop-filter: blur(5px);
          transition: background 0.2s, border-color 0.2s;
          cursor: default;
        }
        .aw-feat-card:hover {
          background: rgba(200,255,0,0.06);
          border-color: rgba(200,255,0,0.20);
        }

        /* ── blog card hover ── */
        .aw-blog-card { cursor: pointer; }
        .aw-blog-card:hover h3 { color: #c8ff00; }
      `}</style>

      {/* ═══════════════════════════════════
          HEADER
      ═══════════════════════════════════ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: 81,
        background: T.headerBg,
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        borderBottom: `1px solid ${T.border}`,
        zIndex: 1000,
        boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.35)' : 'none',
        transition: 'box-shadow 0.3s',
      }}>
        <div className="aw-container" style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <a href="#" aria-label="AwareOne – Home" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <img src={LOGO} alt="AwareOne" style={{ height: 33, width: 'auto', display: 'block' }} />
          </a>

          {/* Desktop Nav */}
          <nav className="aw-desk-nav" style={{ alignItems: 'center', gap: 32 }}>
            {[['Platform','#features'], ['How it Works','#how-it-works'], ['Resources','#blog']].map(([label, href]) => (
              <a key={label} href={href}
                style={{ fontSize: 14, fontWeight: 500, color: T.textNav, textDecoration: 'none', lineHeight: '20px', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = T.white)}
                onMouseLeave={e => (e.currentTarget.style.color = T.textNav)}
              >{label}</a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="aw-desk-act" style={{ alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => onNavigate('login')}
              style={{ fontSize: 14, fontWeight: 700, color: T.white, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >Login</button>
            <button
              onClick={() => setShowDemoModal(true)}
              style={{ padding: '10px 24px', background: T.accent, color: T.bg, fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(200,255,0,0.30)', transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >Request Demo</button>
          </div>

          {/* Hamburger */}
          <button
            className="aw-hamburger"
            aria-label="Toggle menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
            style={{ flexDirection: 'column', gap: 5, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {[0,1,2].map(i => (
              <span key={i} style={{
                display: 'block', width: 24, height: 2, background: T.white, borderRadius: 2,
                transition: 'transform 0.3s, opacity 0.3s',
                transform: menuOpen && i === 0 ? 'translateY(7px) rotate(45deg)' : menuOpen && i === 2 ? 'translateY(-7px) rotate(-45deg)' : 'none',
                opacity: menuOpen && i === 1 ? 0 : 1,
              }} />
            ))}
          </button>
        </div>

        {/* Mobile drawer */}
        <div className="aw-mob-nav" style={{
          overflow: 'hidden', maxHeight: menuOpen ? 500 : 0,
          transition: 'max-height 0.35s ease',
          background: T.bg, borderTop: `1px solid ${T.borderFaint}`,
        }}>
          <div className="aw-container" style={{ paddingTop: menuOpen ? 16 : 0, paddingBottom: menuOpen ? 24 : 0, transition: 'padding 0.35s' }}>
            {[['Platform','#features'], ['How it Works','#how-it-works'], ['Resources','#blog']].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '12px 0', fontSize: 16, fontWeight: 500, color: T.textNav, textDecoration: 'none', borderBottom: `1px solid ${T.borderFaint}` }}
              >{label}</a>
            ))}
            <button onClick={() => { onNavigate('login'); setMenuOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 0', fontSize: 16, fontWeight: 500, color: T.textNav, background: 'none', border: 'none', borderBottom: `1px solid ${T.borderFaint}`, cursor: 'pointer' }}
            >Login</button>
            <button onClick={() => { setShowDemoModal(true); setMenuOpen(false); }}
              style={{ display: 'block', width: '100%', marginTop: 12, padding: '14px 24px', background: T.accent, color: T.bg, fontSize: 16, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer' }}
            >Request Demo</button>
          </div>
        </div>
      </header>

      <main>

        {/* ═══════════════════════════════════
            HERO
        ═══════════════════════════════════ */}
        <section id="hero" style={{ position: 'relative', paddingTop: 81 + 128, paddingBottom: 160, overflow: 'hidden' }}>
          {/* bg glow */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 50% 50%, rgba(200,255,0,0.15) 0%, rgba(200,255,0,0) 70%)' }} />

          <div className="aw-container">
            <div className="aw-hero-inner">

              {/* Left */}
              <div className="aw-hero-left" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {/* Badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 13px', background: T.accentAlpha10, border: `1px solid ${T.accentAlpha20}`, borderRadius: 9999, width: 'fit-content' }}>
                  <span style={{ position: 'relative', width: 8, height: 8, flexShrink: 0, display: 'inline-block' }}>
                    <span style={{ position: 'absolute', inset: 0, background: T.accent, borderRadius: '50%', opacity: 0.75, animation: 'aw-pulse 2s ease-in-out infinite' }} />
                    <span style={{ position: 'absolute', inset: 0, background: T.accent, borderRadius: '50%' }} />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, letterSpacing: '0.6px', textTransform: 'uppercase', lineHeight: '16px' }}>
                    Trusted by 25+ Enterprises
                  </span>
                </div>

                {/* Heading */}
                <div>
                  {['Protect Your', 'Company by', 'Empowering', 'Your People.'].map((line, i) => (
                    <p key={i} className="aw-hero-h" style={{ color: i === 2 ? T.accent : T.white, margin: 0 }}>{line}</p>
                  ))}
                </div>

                {/* Body */}
                <p style={{ fontSize: 18, fontWeight: 400, lineHeight: '29.25px', color: T.textBody, maxWidth: 552, margin: 0 }}>
                  AwareOne is a comprehensive cybersecurity awareness platform designed to train, assess, and strengthen your organization's security culture.
                </p>

                {/* Primary CTAs */}
                <div className="aw-cta-row" style={{ paddingTop: 16 }}>
                  <button
                    onClick={() => setShowDemoModal(true)}
                    style={{ padding: '17px 32px', background: T.accent, color: T.bg, fontSize: 16, fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer', lineHeight: '24px', transition: 'opacity 0.2s, transform 0.15s', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                  >Request Demo</button>
                  <button
                    onClick={() => onNavigate('public-assessment')}
                    style={{ padding: '17px 33px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, color: T.white, fontSize: 16, fontWeight: 700, borderRadius: 12, cursor: 'pointer', lineHeight: '24px', transition: 'background 0.2s, transform 0.15s', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'none'; }}
                  >Free Assessment</button>
                </div>

                {/* Secondary links */}
                <div style={{ display: 'flex', gap: 24, paddingTop: 24, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Login to Dashboard', page: 'login' },
                    { label: 'Live Fraud Alerts',  page: 'fraud-alerts' },
                  ].map(({ label, page }) => (
                    <button key={page} onClick={() => onNavigate(page)}
                      style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, textDecoration: 'underline', textDecorationColor: 'rgba(200,255,0,0.30)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: '20px', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = T.textNav)}
                      onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Right – dashboard card */}
              <div className="aw-hero-right" style={{ position: 'relative' }}>
                <div aria-hidden="true" style={{ position: 'absolute', inset: -16, background: 'rgba(200,255,0,0.20)', borderRadius: 9999, filter: 'blur(32px)', opacity: 0.30, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', background: T.overlayDark, border: `1px solid ${T.border}`, borderRadius: 16, padding: 17, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                  <div style={{ position: 'relative', background: T.bg, border: `1px solid ${T.borderFaint}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(29.29deg, rgba(200,255,0,0.10) 0%, rgba(200,255,0,0) 50%)', zIndex: 1, pointerEvents: 'none' }} />
                    <img src={DASH} alt="AwareOne cybersecurity dashboard" style={{ width: '100%', display: 'block', mixBlendMode: 'luminosity', opacity: 0.60 }} />
                    {/* Play */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      <button aria-label="Watch demo video"
                        style={{ width: 64, height: 64, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.10)', transition: 'transform 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        <img src={PLAY} alt="" style={{ width: 16.5, height: 21, objectFit: 'contain' }} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════
            PARTNERS
        ═══════════════════════════════════ */}
 <PartnersCarousel />
        {/* ═══════════════════════════════════
            FEATURES
        ═══════════════════════════════════ */}
        <section id="features" className="aw-section">
          <div className="aw-container">
            {/* Heading */}
            <div style={{ marginBottom: 64 }}>
              <h2 style={{ fontSize: 48, fontWeight: 900, lineHeight: '48px', color: T.white, margin: '0 0 16px' }}>
                Everything You Need for<br />
                <span style={{ color: T.accent }}>Cybersecurity Awareness</span>
              </h2>
              <div style={{ width: 96, height: 6, background: T.accent, borderRadius: 9999 }} />
            </div>
            {/* Grid */}
            <div className="aw-features-grid">
              {FEATURES.map(({ title, desc }, i) => (
                <article key={title} className="aw-feat-card">
                  <div style={{ width: 48, height: 48, background: T.accentAlpha10, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 48 }}>
                    <img src={FEATURE_ICONS[i]} alt="" style={{ width: 28, height: 24, objectFit: 'contain' }} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: T.white, lineHeight: '28px', margin: '0 0 9px' }}>{title}</h3>
                  <p  style={{ fontSize: 14, color: T.textBody, lineHeight: '22.75px', margin: 0 }}>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════
            HOW IT WORKS
        ═══════════════════════════════════ */}
        <section id="how-it-works" className="aw-section">
          <div className="aw-container">
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 80 }}>
              <h2 style={{ fontSize: 40, fontWeight: 900, color: T.white, lineHeight: '40px', margin: '0 0 16px' }}>
                How Does <span style={{ color: T.accent }}>AwareOne</span> Work?
              </h2>
              <p style={{ fontSize: 16, color: T.textBody, lineHeight: '24px', margin: 0 }}>
                A structured, end-to-end approach to building a security-aware workforce.
              </p>
            </div>
            {/* Steps */}
            <div className="aw-steps-grid">
              <div className="aw-steps-divider" aria-hidden="true" />
              {STEPS.map(({ title, desc }, i) => (
                <article key={title} style={{ textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', position: 'relative', zIndex: 1, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.10)' }}>
                    {StepIcons[i]}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: T.white, lineHeight: '28px', margin: '0 0 16px' }}>{title}</h3>
                  <p  style={{ fontSize: 14, color: T.textBody, lineHeight: '22.75px', margin: 0 }}>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════
            BLOG
        ═══════════════════════════════════ */}
        <section id="blog" className="aw-section">
          <div className="aw-container">
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 40, fontWeight: 900, color: T.white, lineHeight: '40px', margin: '0 0 16px' }}>Latest Insights</h2>
                <p  style={{ fontSize: 16, color: T.textBody, lineHeight: '24px', margin: 0 }}>Stay ahead of threats with expert-led cybersecurity research.</p>
              </div>
              <button
                onClick={() => onNavigate('resources')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: T.textBody, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: '24px', transition: 'color 0.2s', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = T.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = T.textBody)}
              >
                View All Posts <ArrowRight size={16} />
              </button>
            </div>

            {/* Cards */}
            <div className="aw-blog-grid">
              {BLOGS.map(({ category, title, desc }) => (
                <article key={title} className="aw-blog-card" onClick={() => onNavigate('resources')} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 24, aspectRatio: '384/216', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.2s' }}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ color: 'rgba(200,255,0,0.20)' }}>
                      <rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2"/>
                      <path d="M14 20H34M14 28H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p  style={{ fontSize: 14, fontWeight: 500, color: T.textMuted, margin: '0 0 12px' }}>{category}</p>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, lineHeight: '28px', margin: '0 0 16px', transition: 'color 0.2s' }}>{title}</h3>
                  <p  style={{ fontSize: 14, color: T.textBody, lineHeight: '20px', margin: 0 }}>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════
            CTA SECTION
        ═══════════════════════════════════ */}
        <section id="cta" className="aw-section" style={{ position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(200,255,0,0.02)', pointerEvents: 'none' }} />
          <div className="aw-container" style={{ position: 'relative' }}>
            <div style={{ maxWidth: 832, margin: '0 auto', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 16, padding: '49px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.40)' }}>
              <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, color: T.white, lineHeight: '1.2', letterSpacing: '-0.5px', margin: '0 0 24px' }}>
                {highlightHeadline(ctaSettings.headline)}
              </h2>
              <p style={{ fontSize: 18, color: T.textBody, lineHeight: '28px', maxWidth: 672, margin: '0 auto 48px' }}>
                {ctaSettings.subheadline}
              </p>
              <div className="aw-cta-btn-row">
                <button
                  onClick={() => setShowDemoModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 40px', background: T.accent, color: T.bg, fontSize: 20, fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer', lineHeight: '28px', boxShadow: '0 0 30px rgba(200,255,0,0.30)', transition: 'opacity 0.2s, transform 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  {ctaSettings.primary_button} <ArrowRight size={20} />
                </button>
                <button
                  onClick={() => onNavigate('public-assessment')}
                  style={{ padding: '20px 41px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, color: T.white, fontSize: 20, fontWeight: 700, borderRadius: 12, cursor: 'pointer', lineHeight: '28px', transition: 'background 0.2s, transform 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'none'; }}
                >
                  {ctaSettings.secondary_button}
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ═══════════════════════════════════
          FOOTER
      ═══════════════════════════════════ */}
      <footer style={{ paddingTop: 80, borderTop: `1px solid ${T.borderFaint}` }}>
        <div className="aw-container">
          {/* Grid */}
          <div className="aw-footer-grid" style={{ paddingBottom: 56 }}>

            {/* Brand */}
            <div>
              <div style={{ marginBottom: 56 }}>
                <img src={LOGO} alt="AwareOne" style={{ height: 33, width: 'auto', display: 'block' }} />
              </div>
              <p style={{ fontSize: 14, color: T.textBody, lineHeight: '22.75px', margin: '0 0 40px' }}>
                {footerSettings.tagline}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {([['LinkedIn', Linkedin], ['X (Twitter)', Twitter], ['YouTube', Youtube]] as const).map(([label, Icon]) => (
                  <a key={label} href="#" aria-label={label}
                    style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.border}`, borderRadius: 8, color: T.textMuted, textDecoration: 'none', transition: 'color 0.2s, border-color 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.accent; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,255,0,0.30)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textMuted; (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>

            {/* Company */}
            <nav aria-label="Company links">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: '0 0 48px' }}>Company</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Free Assessment', page: 'public-assessment' },
                  { label: 'Fraud Alerts',    page: 'fraud-alerts'      },
                  { label: 'Resources',       page: 'resources'         },
                  { label: 'Login',           page: 'login'             },
                ].map(({ label, page }) => (
                  <li key={page}>
                    <button onClick={() => onNavigate(page)}
                      style={{ fontSize: 14, color: T.textBody, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: '20px', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = T.white)}
                      onMouseLeave={e => (e.currentTarget.style.color = T.textBody)}
                    >{label}</button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Resources */}
            <nav aria-label="Resources links">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: '0 0 48px' }}>Resources</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {['Security Blog','Case Studies','Compliance Guide','Support Center'].map(label => (
                  <li key={label}>
                    <button onClick={() => onNavigate('resources')}
                      style={{ fontSize: 14, color: T.textBody, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: '20px', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = T.white)}
                      onMouseLeave={e => (e.currentTarget.style.color = T.textBody)}
                    >{label}</button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Contact */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: '0 0 48px' }}>Contact</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <li>
                  <a href={`mailto:${footerSettings.email}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: T.textBody, textDecoration: 'none', lineHeight: '20px', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = T.white)}
                    onMouseLeave={e => (e.currentTarget.style.color = T.textBody)}
                  >
                    <Mail size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
                    {footerSettings.email}
                  </a>
                </li>
                <li>
                  <a href={`tel:${footerSettings.phone.replace(/\s/g, '')}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: T.textBody, textDecoration: 'none', lineHeight: '20px', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = T.white)}
                    onMouseLeave={e => (e.currentTarget.style.color = T.textBody)}
                  >
                    <Phone size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
                    {footerSettings.phone}
                  </a>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: T.textBody, lineHeight: '20px' }}>
                  <MapPin size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
                  Riyadh, Saudi Arabia
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="aw-footer-bottom" style={{ padding: '32px 0', borderTop: `1px solid ${T.borderFaint}` }}>
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>{footerSettings.copyright}</p>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {['Privacy Policy','Terms of Service','Cookies'].map(label => (
                <a key={label} href="#"
                  style={{ fontSize: 13, color: T.textMuted, textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.textNav)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
                >{label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <RequestDemoModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
      />
    </div>
  );
};
