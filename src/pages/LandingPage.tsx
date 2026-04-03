import React, { useState, useEffect } from "react";
import { RequestDemoModal } from "../components/landing/RequestDemoModal";
import { PartnersCarousel } from "../components/landing/PartnersCarousel";
import { supabase } from "../lib/supabase";
import {
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Twitter,
  Linkedin,
  Youtube,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ─────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────── */
const T = {
  bg: "#12140a",
  accent: "#c8ff00",
  accentAlpha10: "rgba(200,255,0,0.10)",
  accentAlpha20: "rgba(200,255,0,0.20)",
  white: "#ffffff",
  textNav: "#cbd5e1",
  textBody: "#94a3b8",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.10)",
  borderFaint: "rgba(255,255,255,0.05)",
  overlayDark: "rgba(15,23,42,0.50)",
  headerBg: "rgba(18,20,10,0.80)",
} as const;

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
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
   ASSETS
───────────────────────────────────────── */
const LOGO =
  "https://raw.githubusercontent.com/Mr-monmon/Sinnara-Cyber-Awareness-LMS/main/supabase/without%20bg%202.png";
const DASH =
  "https://raw.githubusercontent.com/Mr-monmon/Sinnara-Cyber-Awareness-LMS/main/src/pages/AwareOne%20cybersecurity%20dashboard.png";

/* ─────────────────────────────────────────
   FEATURE ICONS (inline SVG)
───────────────────────────────────────── */
const FEATURE_ICONS: React.ReactNode[] = [
  <svg key="f1" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M6.5 19C4.01 19 2 16.99 2 14.5C2 12.24 3.66 10.36 5.84 10.05C6.19 7.2 8.6 5 11.5 5C14.08 5 16.26 6.73 16.86 9.09C17.08 9.03 17.29 9 17.5 9C19.43 9 21 10.57 21 12.5C21 14.43 19.43 16 17.5 16H16" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 13V21M12 21L9.5 18.5M12 21L14.5 18.5" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  <svg key="f2" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L4 5V11C4 16.55 7.84 21.74 12 23C16.16 21.74 20 16.55 20 11V5L12 2Z" stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M9 12L11 14L15 10" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  <svg key="f3" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#c8ff00" strokeWidth="1.5"/>
    <path d="M12 3C12 3 8 7 8 12C8 17 12 21 12 21" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 3C12 3 16 7 16 12C16 17 12 21 12 21" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M3 12H21" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M4.5 7.5H19.5M4.5 16.5H19.5" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>,
  <svg key="f4" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M4 4H9C10.06 4 11.08 4.42 11.83 5.17C12.58 5.92 13 6.94 13 8V20C13 19.2 12.68 18.44 12.12 17.88C11.56 17.32 10.8 17 10 17H4V4Z" stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M20 4H15C13.94 4 12.92 4.42 12.17 5.17C11.42 5.92 11 6.94 11 8V20C11 19.2 11.32 18.44 11.88 17.88C12.44 17.32 13.2 17 14 17H20V4Z" stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>,
  <svg key="f5" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="3" width="14" height="18" rx="2" stroke="#c8ff00" strokeWidth="1.5"/>
    <path d="M9 3V5H15V3" stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M8 13L10.5 15.5L16 10" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  <svg key="f6" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M3 17L8 12L12 15L17 9L21 11" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 9H21V13" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 20H21" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>,
  <svg key="f7" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="7" r="3.5" stroke="#c8ff00" strokeWidth="1.5"/>
    <path d="M3 20C3 16.69 5.69 14 9 14" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="14" y="14" width="7" height="6" rx="1.5" stroke="#c8ff00" strokeWidth="1.5"/>
    <path d="M16 14V12.5C16 11.4 16.9 10.5 18 10.5C19.1 10.5 20 11.4 20 12.5V14" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="17.5" cy="17" r="0.75" fill="#c8ff00"/>
  </svg>,
  <svg key="f8" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3.5" stroke="#c8ff00" strokeWidth="1.5"/>
    <path d="M15.5 12C15.5 13.93 15.5 16 17.25 16C19 16 19.5 14.5 19.5 12C19.5 7.86 16.42 5 12 5C7.58 5 4.5 8.13 4.5 12C4.5 15.87 7.58 19 12 19C13.6 19 15.09 18.52 16.32 17.7" stroke="#c8ff00" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>,
];

const FEATURES = [
  { title: "Hosted in Saudi Arabia",  desc: "Full data residency and sovereignty within the Kingdom." },
  { title: "Regulatory Compliance",   desc: "Built for ISO 27001, NCA, SAMA, and PDPL frameworks." },
  { title: "Local Threat Intel",      desc: "Stay updated on threats specific to the MENA region." },
  { title: "Comprehensive Training",  desc: "In-depth interactive modules for all employee levels." },
  { title: "Pre & Post Assessments",  desc: "Accurately measure knowledge retention and ROI." },
  { title: "Real-Time Analytics",     desc: "Instant visibility into your organization's risk profile." },
  { title: "Role-Based Access",       desc: "Granular permissions for diverse administrative teams." },
  { title: "Phishing Simulation",     desc: "Test resilience with realistic regional attack vectors." },
];

const STEPS = [
  { title: "Assess",   desc: "Baseline your team's current security knowledge with intelligent pre-assessments." },
  { title: "Train",    desc: "Deliver localized, role-based training modules tailored to your industry." },
  { title: "Simulate", desc: "Run realistic phishing simulations to test real-world readiness and response." },
  { title: "Report",   desc: "Gain actionable insights and compliance-ready reports to measure your ROI." },
];

const BLOGS = [
  {
    category: "Phishing",
    title: "How Regional Banks are Combating Phishing in 2024",
    desc: "A deep dive into the latest social engineering tactics targeting Middle Eastern financial institutions.",
  },
  {
    category: "Compliance",
    title: "Navigating Saudi Arabia's PDPL: A Security Guide",
    desc: "Essential steps for data controllers to ensure awareness training meets new regulatory standards.",
  },
  {
    category: "AI & ML",
    title: "The Future of AI in Employee Phishing Simulations",
    desc: "Discover how machine learning is personalizing cybersecurity training for better outcomes.",
  },
];

/* ─────────────────────────────────────────
   STEP ICONS
───────────────────────────────────────── */
const StepIcons: React.ReactNode[] = [
  <svg key="s1" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 1L2 4V9C2 13.418 5.17 17.564 9 18C12.83 17.564 16 13.418 16 9V4L9 1Z" stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>,
  <svg key="s2" width="22" height="18" viewBox="0 0 22 18" fill="none">
    <path d="M1 1H7C8.06 1 9.08 1.42 9.83 2.17C10.58 2.92 11 3.94 11 5V17C11 16.2 10.68 15.44 10.12 14.88C9.56 14.32 8.8 14 8 14H1V1Z" stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M21 1H15C13.94 1 12.92 1.42 12.17 2.17C11.42 2.92 11 3.94 11 5V17C11 16.2 11.32 15.44 11.88 14.88C12.44 14.32 13.2 14 14 14H21V1Z" stroke="#c8ff00" strokeWidth="1.5" strokeLinejoin="round"/>
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
export const LandingPage = () => {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [scrolled, setScrolled]           = useState(false);
  const navigate = useNavigate();

  const [ctaSettings, setCTASettings] = useState<CTASettings>({
    headline: "Ready to Build a Security-Aware Culture?",
    subheadline: "Join 25+ enterprises across the region who trust AwareOne to protect their people and meet compliance requirements with confidence.",
    primary_button: "Request a Demo",
    secondary_button: "Free Assessment",
  });
  const [footerSettings, setFooterSettings] = useState<FooterSettings>({
    tagline: "Empowering organizations to build a resilient security culture through localized, data-driven training and simulation.",
    email: "support@awareone.net",
    phone: "+966 11 234 5678",
    copyright: "© 2025 AwareOne. All rights reserved.",
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data: ctaData } = await supabase.from("homepage_settings").select("setting_value").eq("setting_key","cta_section").maybeSingle();
      if (ctaData?.setting_value) setCTASettings(ctaData.setting_value as CTASettings);
      const { data: footerData } = await supabase.from("homepage_settings").select("setting_value").eq("setting_key","footer").maybeSingle();
      if (footerData?.setting_value) setFooterSettings(footerData.setting_value as FooterSettings);
    } catch (err) { console.error("Failed to load homepage settings", err); }
  };

  const highlightHeadline = (text: string) => {
    const keywords = ["Security-Aware","AwareOne","Cybersecurity"];
    for (const kw of keywords) {
      if (text.includes(kw)) {
        const [before, after] = text.split(kw);
        return <>{before}<span style={{ color: T.accent }}>{kw}</span>{after}</>;
      }
    }
    return text;
  };

  return (
    <div dir="ltr" style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: T.white }}>
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
        @keyframes aw-fraud-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
          60%      { box-shadow: 0 0 0 7px rgba(239,68,68,0); }
        }

        .aw-desk-nav  { display: flex; }
        .aw-desk-act  { display: flex; }
        .aw-hamburger { display: none; }
        .aw-mob-nav   { display: none; }
        @media (max-width: 1024px) {
          .aw-desk-nav  { display: none !important; }
          .aw-desk-act  { display: none !important; }
          .aw-hamburger { display: flex !important; }
          .aw-mob-nav   { display: block !important; }
        }

        .aw-hero-h { font-size: 72px; line-height: 72px; letter-spacing: -1.8px; font-weight: 900; }
        @media (max-width: 900px) { .aw-hero-h { font-size: 52px !important; line-height: 56px !important; } }
        @media (max-width: 600px) { .aw-hero-h { font-size: 38px !important; line-height: 44px !important; letter-spacing: -1px !important; } }

        .aw-hero-inner { display: flex; align-items: center; gap: 48px; }
        .aw-hero-left  { flex: 1; min-width: 280px; }
        .aw-hero-right { flex: 1; min-width: 280px; }
        @media (max-width: 900px) {
          .aw-hero-inner { flex-direction: column; }
          .aw-hero-left, .aw-hero-right { width: 100%; }
        }

        .aw-cta-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
        @media (max-width: 600px) { .aw-cta-row { flex-direction: column; align-items: stretch; } .aw-cta-row button { width: 100%; } }

        .aw-features-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        @media (max-width: 1024px) { .aw-features-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .aw-features-grid { grid-template-columns: 1fr; } }

        .aw-steps-grid    { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; position: relative; }
        .aw-steps-divider { position: absolute; top: 41px; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.08); }
        @media (max-width: 1024px) { .aw-steps-grid { grid-template-columns: repeat(2, 1fr); } .aw-steps-divider { display: none; } }
        @media (max-width: 600px)  { .aw-steps-grid { grid-template-columns: 1fr; } }

        .aw-blog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        @media (max-width: 1024px) { .aw-blog-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .aw-blog-grid { grid-template-columns: 1fr; } }

        .aw-footer-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
        @media (max-width: 1024px) { .aw-footer-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .aw-footer-grid { grid-template-columns: 1fr; } }

        .aw-footer-bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        @media (max-width: 600px) { .aw-footer-bottom { flex-direction: column; align-items: flex-start; } }

        .aw-cta-btn-row { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; }
        @media (max-width: 600px) { .aw-cta-btn-row { flex-direction: column; align-items: stretch; } .aw-cta-btn-row button { width: 100%; } }

        .aw-section   { padding: 96px 0; }
        @media (max-width: 600px) { .aw-section { padding: 64px 0; } }

        .aw-container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }
        @media (max-width: 600px) { .aw-container { padding: 0 20px; } }

        .aw-feat-card { background: rgba(200,255,0,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 25px; backdrop-filter: blur(5px); transition: background 0.2s, border-color 0.2s; cursor: default; }
        .aw-feat-card:hover { background: rgba(200,255,0,0.06); border-color: rgba(200,255,0,0.20); }

        .aw-blog-card { cursor: pointer; display: flex; flex-direction: column; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; padding: 28px; transition: border-color 0.2s, background 0.2s; }
        .aw-blog-card:hover { border-color: rgba(200,255,0,0.25); background: rgba(200,255,0,0.03); }
        .aw-blog-card:hover h3 { color: #c8ff00; }

        .aw-fraud-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.30); color: #fca5a5; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: background 0.2s, border-color 0.2s; animation: aw-fraud-pulse 2.5s ease-in-out infinite; white-space: nowrap; letter-spacing: 0.1px; }
        .aw-fraud-btn:hover { background: rgba(239,68,68,0.16); border-color: rgba(239,68,68,0.55); color: #fecaca; }
        .aw-fraud-dot { width: 7px; height: 7px; border-radius: 50%; background: #ef4444; flex-shrink: 0; }
      `}</style>

      {/* ══════════════ HEADER ══════════════ */}
      <header style={{ position: "fixed", top: 0, left: 0, width: "100%", height: 81, background: T.headerBg, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", borderBottom: `1px solid ${T.border}`, zIndex: 1000, boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.35)" : "none", transition: "box-shadow 0.3s" }}>
        <div className="aw-container" style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          <a href="#" aria-label="AwareOne" style={{ textDecoration: "none", flexShrink: 0 }}>
            <img src={LOGO} alt="AwareOne" style={{ height: 130, width: "auto", display: "block" }}/>
          </a>

          <nav className="aw-desk-nav" style={{ alignItems: "center", gap: 32 }}>
            {[["Platform","#features"],["How it Works","#how-it-works"],["Resources","#blog"]].map(([label,href]) => (
              <a key={label} href={href} style={{ fontSize: 14, fontWeight: 500, color: T.textNav, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.textNav)}>{label}</a>
            ))}
          </nav>

          <div className="aw-desk-act" style={{ alignItems: "center", gap: 14 }}>
            <button className="aw-fraud-btn" onClick={() => navigate("/fraud-alerts")}>
              <span className="aw-fraud-dot"/><AlertTriangle size={12}/>Live Fraud Alerts
            </button>
            <button onClick={() => navigate("/login")} style={{ fontSize: 14, fontWeight: 700, color: T.white, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Login</button>
            <button onClick={() => setShowDemoModal(true)}
              style={{ padding: "10px 24px", background: T.accent, color: T.bg, fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", boxShadow: "0 0 20px rgba(200,255,0,0.30)", transition: "opacity 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              Request Demo
            </button>
          </div>

          <button className="aw-hamburger" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}
            style={{ flexDirection: "column", gap: 5, width: 40, height: 40, alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ display: "block", width: 24, height: 2, background: T.white, borderRadius: 2, transition: "transform 0.3s, opacity 0.3s",
                transform: menuOpen && i===0 ? "translateY(7px) rotate(45deg)" : menuOpen && i===2 ? "translateY(-7px) rotate(-45deg)" : "none",
                opacity: menuOpen && i===1 ? 0 : 1 }}/>
            ))}
          </button>
        </div>

        {/* Mobile menu */}
        <div className="aw-mob-nav" style={{ overflow: "hidden", maxHeight: menuOpen ? 520 : 0, transition: "max-height 0.35s ease", background: T.bg, borderTop: `1px solid ${T.borderFaint}` }}>
          <div className="aw-container" style={{ paddingTop: menuOpen ? 16 : 0, paddingBottom: menuOpen ? 24 : 0, transition: "padding 0.35s" }}>
            {[["Platform","#features"],["How it Works","#how-it-works"],["Resources","#blog"]].map(([label,href]) => (
              <a key={label} href={href} onClick={() => setMenuOpen(false)}
                style={{ display: "block", padding: "12px 0", fontSize: 16, fontWeight: 500, color: T.textNav, textDecoration: "none", borderBottom: `1px solid ${T.borderFaint}` }}>{label}</a>
            ))}
            <button onClick={() => { navigate("/fraud-alerts"); setMenuOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 0", fontSize: 14, fontWeight: 600, color: "#fca5a5", background: "none", border: "none", borderBottom: `1px solid ${T.borderFaint}`, cursor: "pointer" }}>
              <span className="aw-fraud-dot"/><AlertTriangle size={12}/>Live Fraud Alerts
            </button>
            <button onClick={() => { navigate("/login"); setMenuOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 0", fontSize: 16, fontWeight: 500, color: T.textNav, background: "none", border: "none", borderBottom: `1px solid ${T.borderFaint}`, cursor: "pointer" }}>Login</button>
            <button onClick={() => { setShowDemoModal(true); setMenuOpen(false); }}
              style={{ display: "block", width: "100%", marginTop: 12, padding: "14px 24px", background: T.accent, color: T.bg, fontSize: 16, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer" }}>Request Demo</button>
          </div>
        </div>
      </header>

      <main>
        {/* ══════════════ HERO ══════════════ */}
        <section id="hero" style={{ position: "relative", paddingTop: 81+128, paddingBottom: 160, overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 50%, rgba(200,255,0,0.15) 0%, rgba(200,255,0,0) 70%)" }}/>
          <div className="aw-container">
            <div className="aw-hero-inner">
              <div className="aw-hero-left" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                {/* Badge */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 13px", background: T.accentAlpha10, border: `1px solid ${T.accentAlpha20}`, borderRadius: 9999, width: "fit-content" }}>
                  <span style={{ position: "relative", width: 8, height: 8, flexShrink: 0, display: "inline-block" }}>
                    <span style={{ position: "absolute", inset: 0, background: T.accent, borderRadius: "50%", opacity: 0.75, animation: "aw-pulse 2s ease-in-out infinite" }}/>
                    <span style={{ position: "absolute", inset: 0, background: T.accent, borderRadius: "50%" }}/>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, letterSpacing: "0.6px", textTransform: "uppercase" }}>Trusted by 25+ Enterprises</span>
                </div>

                <div>
                  {["Protect Your","Company by","Empowering","Your People."].map((line,i) => (
                    <p key={i} className="aw-hero-h" style={{ color: i===2 ? T.accent : T.white, margin: 0 }}>{line}</p>
                  ))}
                </div>

                <p style={{ fontSize: 18, fontWeight: 400, lineHeight: "29.25px", color: T.textBody, maxWidth: 552, margin: 0 }}>
                  AwareOne is a comprehensive cybersecurity awareness platform designed to train, assess, and strengthen your organization's security culture.
                </p>

                <div className="aw-cta-row" style={{ paddingTop: 16 }}>
                  <button onClick={() => setShowDemoModal(true)}
                    style={{ padding: "17px 32px", background: T.accent, color: T.bg, fontSize: 16, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer", transition: "opacity 0.2s, transform 0.15s", whiteSpace: "nowrap" }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity="0.9"; e.currentTarget.style.transform="translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="none"; }}>
                    Request Demo
                  </button>
                  <button onClick={() => navigate("/assessment")}
                    style={{ padding: "17px 33px", background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, color: T.white, fontSize: 16, fontWeight: 700, borderRadius: 12, cursor: "pointer", transition: "background 0.2s, transform 0.15s", whiteSpace: "nowrap" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.10)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.transform="none"; }}>
                    Free Assessment
                  </button>
                </div>

                <div style={{ display: "flex", gap: 16, paddingTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => navigate("/login")}
                    style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, textDecoration: "underline", textDecorationColor: "rgba(200,255,0,0.30)", background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.textNav)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}>
                    Login to Dashboard
                  </button>
                  <button className="aw-fraud-btn" onClick={() => navigate("/fraud-alerts")}>
                    <span className="aw-fraud-dot"/><AlertTriangle size={12}/>Live Fraud Alerts
                  </button>
                </div>
              </div>

              {/* Dashboard card */}
              <div className="aw-hero-right" style={{ position: "relative" }}>
                <div aria-hidden="true" style={{ position: "absolute", inset: -16, background: "rgba(200,255,0,0.20)", borderRadius: 9999, filter: "blur(32px)", opacity: 0.3, pointerEvents: "none" }}/>
                <div style={{ position: "relative", background: T.overlayDark, border: `1px solid ${T.border}`, borderRadius: 16, padding: 17, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", overflow: "hidden" }}>
                  <div style={{ position: "relative", background: T.bg, border: `1px solid ${T.borderFaint}`, borderRadius: 8, overflow: "hidden" }}>
                    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(29.29deg, rgba(200,255,0,0.10) 0%, rgba(200,255,0,0) 50%)", zIndex: 1, pointerEvents: "none" }}/>
                    <img src={DASH} alt="AwareOne cybersecurity dashboard" style={{ width: "100%", display: "block", mixBlendMode: "luminosity", opacity: 0.6 }}/>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                      <button aria-label="Watch demo video"
                        style={{ width: 64, height: 64, borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.10)", transition: "transform 0.2s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
                        <svg width="18" height="22" viewBox="0 0 18 22" fill="none" aria-hidden="true">
                          <path d="M2 2L16 11L2 20V2Z" fill="#12140a" stroke="#12140a" strokeWidth="1" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ PARTNERS ══════════════ */}
        <PartnersCarousel />

        {/* ══════════════ FEATURES ══════════════ */}
        <section id="features" className="aw-section">
          <div className="aw-container">
            <div style={{ marginBottom: 64 }}>
              <h2 style={{ fontSize: 48, fontWeight: 900, lineHeight: "48px", color: T.white, margin: "0 0 16px" }}>
                Everything You Need for<br/><span style={{ color: T.accent }}>Cybersecurity Awareness</span>
              </h2>
              <div style={{ width: 96, height: 6, background: T.accent, borderRadius: 9999 }}/>
            </div>
            <div className="aw-features-grid">
              {FEATURES.map(({ title, desc }, i) => (
                <article key={title} className="aw-feat-card">
                  <div style={{ width: 48, height: 48, background: T.accentAlpha10, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 48 }}>
                    {FEATURE_ICONS[i]}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: T.white, lineHeight: "28px", margin: "0 0 9px" }}>{title}</h3>
                  <p style={{ fontSize: 14, color: T.textBody, lineHeight: "22.75px", margin: 0 }}>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ HOW IT WORKS ══════════════ */}
        <section id="how-it-works" className="aw-section">
          <div className="aw-container">
            <div style={{ textAlign: "center", marginBottom: 80 }}>
              <h2 style={{ fontSize: 40, fontWeight: 900, color: T.white, lineHeight: "40px", margin: "0 0 16px" }}>
                How Does <span style={{ color: T.accent }}>AwareOne</span> Work?
              </h2>
              <p style={{ fontSize: 16, color: T.textBody, lineHeight: "24px", margin: 0 }}>A structured, end-to-end approach to building a security-aware workforce.</p>
            </div>
            <div className="aw-steps-grid">
              <div className="aw-steps-divider" aria-hidden="true"/>
              {STEPS.map(({ title, desc }, i) => (
                <article key={title} style={{ textAlign: "center" }}>
                  <div style={{ width: 64, height: 64, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", position: "relative", zIndex: 1, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.10)" }}>
                    {StepIcons[i]}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: T.white, lineHeight: "28px", margin: "0 0 16px" }}>{title}</h3>
                  <p style={{ fontSize: 14, color: T.textBody, lineHeight: "22.75px", margin: 0 }}>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ BLOG ══════════════ */}
        <section id="blog" className="aw-section">
          <div className="aw-container">
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 40, fontWeight: 900, color: T.white, lineHeight: "40px", margin: "0 0 16px" }}>Latest Insights</h2>
                <p style={{ fontSize: 16, color: T.textBody, lineHeight: "24px", margin: 0 }}>Stay ahead of threats with expert-led cybersecurity research.</p>
              </div>
              <button onClick={() => navigate("/resources")}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: T.textBody, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s", flexShrink: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                View All Posts <ArrowRight size={16}/>
              </button>
            </div>

            {/* ★ Blog cards — no images */}
            <div className="aw-blog-grid">
              {BLOGS.map(({ category, title, desc }) => (
                <article key={title} className="aw-blog-card" onClick={() => navigate("/resources")}>
                  <span style={{ display: "inline-block", padding: "3px 10px", background: T.accentAlpha10, border: `1px solid ${T.accentAlpha20}`, borderRadius: 9999, fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 18, width: "fit-content" }}>
                    {category}
                  </span>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: T.white, lineHeight: "26px", margin: "0 0 12px", transition: "color 0.2s" }}>{title}</h3>
                  <p style={{ fontSize: 14, color: T.textBody, lineHeight: "22px", margin: "0 0 24px", flex: 1 }}>{desc}</p>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: T.textMuted }}>
                    Read more <ArrowRight size={13}/>
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ CTA ══════════════ */}
        <section id="cta" className="aw-section" style={{ position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgba(200,255,0,0.02)", pointerEvents: "none" }}/>
          <div className="aw-container" style={{ position: "relative" }}>
            <div style={{ maxWidth: 832, margin: "0 auto", background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, borderRadius: 16, padding: "49px", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.40)" }}>
              <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, color: T.white, lineHeight: "1.2", letterSpacing: "-0.5px", margin: "0 0 24px" }}>
                {highlightHeadline(ctaSettings.headline)}
              </h2>
              <p style={{ fontSize: 18, color: T.textBody, lineHeight: "28px", maxWidth: 672, margin: "0 auto 48px" }}>{ctaSettings.subheadline}</p>
              <div className="aw-cta-btn-row">
                <button onClick={() => setShowDemoModal(true)}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "20px 40px", background: T.accent, color: T.bg, fontSize: 20, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer", boxShadow: "0 0 30px rgba(200,255,0,0.30)", transition: "opacity 0.2s, transform 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity="0.9"; e.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="none"; }}>
                  {ctaSettings.primary_button} <ArrowRight size={20}/>
                </button>
                <button onClick={() => navigate("/assessment")}
                  style={{ padding: "20px 41px", background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, color: T.white, fontSize: 20, fontWeight: 700, borderRadius: 12, cursor: "pointer", transition: "background 0.2s, transform 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.10)"; e.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.transform="none"; }}>
                  {ctaSettings.secondary_button}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer style={{ paddingTop: 80, borderTop: `1px solid ${T.borderFaint}` }}>
        <div className="aw-container">
          <div className="aw-footer-grid" style={{ paddingBottom: 56 }}>
            {/* Brand */}
            <div>
              <div style={{ marginBottom: 40 }}>
                <img src={LOGO} alt="AwareOne" style={{ height: 130, width: "auto", display: "block" }}/>
              </div>
              <p style={{ fontSize: 14, color: T.textBody, lineHeight: "22.75px", margin: "0 0 40px" }}>{footerSettings.tagline}</p>
              {/* ★ Social links */}
              <div style={{ display: "flex", gap: 12 }}>
                {([
                  ["LinkedIn", Linkedin, "https://www.linkedin.com/company/awareone/"],
                  ["X (Twitter)", Twitter, "https://twitter.com/awareone"],
                  ["YouTube", Youtube, "https://www.youtube.com/@awareone-net"],
                ] as const).map(([label, Icon, href]) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                    style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.border}`, borderRadius: 8, color: T.textMuted, textDecoration: "none", transition: "color 0.2s, border-color 0.2s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.accent; (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,255,0,0.30)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.textMuted; (e.currentTarget as HTMLElement).style.borderColor = T.border; }}>
                    <Icon size={18}/>
                  </a>
                ))}
              </div>
            </div>

            {/* Company */}
            <nav aria-label="Company links">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: "0 0 48px" }}>Company</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {[{label:"Free Assessment",page:"public-assessment"},{label:"Fraud Alerts",page:"fraud-alerts"},{label:"Resources",page:"resources"},{label:"Login",page:"login"}].map(({label,page}) => (
                  <li key={page}>
                    <button onClick={() => navigate(page)} style={{ fontSize: 14, color: T.textBody, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = T.white)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>{label}</button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Resources */}
            <nav aria-label="Resources links">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: "0 0 48px" }}>Resources</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {["Security Blog","Case Studies","Compliance Guide","Support Center","Legal"].map((label) => (
                  <li key={label}>
                    <button onClick={() => navigate(label==="Legal" ? "/legal" : "/resources")} style={{ fontSize: 14, color: T.textBody, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = T.white)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>{label}</button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Contact */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: "0 0 48px" }}>Contact</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                <li>
                  <a href={`mailto:${footerSettings.email}`} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: T.textBody, textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.white)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                    <Mail size={14} style={{ color: T.textMuted, flexShrink: 0 }}/>{footerSettings.email}
                  </a>
                </li>
                <li>
                  <a href={`tel:${footerSettings.phone.replace(/\s/g,"")}`} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: T.textBody, textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.white)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                    <Phone size={14} style={{ color: T.textMuted, flexShrink: 0 }}/>{footerSettings.phone}
                  </a>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: T.textBody }}>
                  <MapPin size={14} style={{ color: T.textMuted, flexShrink: 0 }}/>Riyadh, Saudi Arabia
                </li>
              </ul>
            </div>
          </div>

          <div className="aw-footer-bottom" style={{ padding: "32px 0", borderTop: `1px solid ${T.borderFaint}` }}>
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>{footerSettings.copyright}</p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {["Privacy Policy","Terms of Service","Cookies"].map(label => (
                <a key={label} href="#" onClick={() => navigate("/legal")} style={{ fontSize: 13, color: T.textMuted, textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = T.textNav)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}>{label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <RequestDemoModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)}/>
    </div>
  );
};
