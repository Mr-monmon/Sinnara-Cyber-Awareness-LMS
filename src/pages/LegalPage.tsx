import React, { useState, useEffect } from "react";
import {
  Shield,
  ScrollText,
  CheckSquare,
  Cookie,
  Database,
  FileText,
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Twitter,
  Youtube,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RequestDemoModal } from "../components/landing/RequestDemoModal";
import { supabase } from "../lib/supabase";

/* ─────────────────────────────────────────
   TOKENS
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
  textLabel: "#cbd5e1",
  border: "rgba(255,255,255,0.10)",
  borderFaint: "rgba(255,255,255,0.05)",
  headerBg: "rgba(18,20,10,0.80)",
  bgCard: "#1a1e0e",
} as const;

const LOGO =
  "https://raw.githubusercontent.com/Mr-monmon/Sinnara-Cyber-Awareness-LMS/main/supabase/without%20bg%202.png";

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul>
    {items.map((t, i) => (
      <li key={i}>{t}</li>
    ))}
  </ul>
);

const Sec: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="aw-sec">
    <div className="aw-sec-title">
      <span className="aw-sec-num">{n}</span>
      {title}
    </div>
    <div className="aw-prose">{children}</div>
  </div>
);

/* ─────────────────────────────────────────
   POLICIES
───────────────────────────────────────── */
interface Policy {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  tagline: string;
  content: React.ReactNode;
}

const POLICIES: Policy[] = [
  {
    id: "privacy",
    label: "Privacy Policy",
    icon: FileText,
    color: "#818cf8",
    tagline: "How we collect, use, and protect your personal data",
    content: (
      <>
        <Sec n={1} title="About AwareOne">
          <p>AwareOne is a cybersecurity awareness SaaS platform helping organizations improve security through training, phishing simulations, assessments, and analytics.</p>
        </Sec>
        <Sec n={2} title="Information We Collect">
          <h3>Account Information</h3>
          <Bullets items={["Name and email address","Organization name","Job title or department","Login credentials"]}/>
          <h3>Usage Data</h3>
          <Bullets items={["IP address and browser type","Device information","Login timestamps","Platform usage activity"]}/>
          <h3>Training & Awareness Data</h3>
          <Bullets items={["Training participation records","Phishing simulation results","Assessment scores","Awareness performance metrics"]}/>
        </Sec>
        <Sec n={3} title="How We Use Information">
          <Bullets items={["Providing and operating the platform","Managing user authentication","Delivering cybersecurity awareness training","Generating analytics and reports","Maintaining platform security"]}/>
        </Sec>
        <Sec n={4} title="Data Storage">
          <p>AwareOne uses secure cloud infrastructure. Some data may be stored through providers whose servers are located outside the Kingdom of Saudi Arabia. Appropriate safeguards are implemented in such cases.</p>
        </Sec>
        <Sec n={5} title="Data Security">
          <Bullets items={["Encrypted connections (HTTPS / TLS)","Access control mechanisms","Activity logging and monitoring","Infrastructure security protections"]}/>
        </Sec>
        <Sec n={6} title="Data Sharing">
          <p>AwareOne does <strong>not sell or rent personal data</strong>. Information is shared only with trusted service providers, when required by law, or to protect rights and safety.</p>
        </Sec>
        <Sec n={7} title="User Rights">
          <Bullets items={["Request access to personal data","Request correction of inaccurate data","Request deletion where applicable","Object to certain types of processing"]}/>
        </Sec>
        <Sec n={8} title="Contact">
          <p>Questions? <strong>support@awareone.net</strong></p>
        </Sec>
      </>
    ),
  },
  {
    id: "terms",
    label: "Terms of Service",
    icon: ScrollText,
    color: "#34d399",
    tagline: "Rules and conditions governing use of the platform",
    content: (
      <>
        <Sec n={1} title="Eligibility">
          <Bullets items={["Must be at least 18 years old","Must have authority to represent your organization","Must comply with all applicable laws"]}/>
        </Sec>
        <Sec n={2} title="Account Registration">
          <Bullets items={["Provide accurate and complete information","Maintain confidentiality of login credentials","Notify AwareOne immediately of unauthorized access"]}/>
        </Sec>
        <Sec n={3} title="Permitted Use">
          <Bullets items={["Employee training programs","Phishing awareness simulations","Security assessments","Security reporting and analysis"]}/>
        </Sec>
        <Sec n={4} title="Phishing Simulation">
          <p>Simulations are for <strong>educational purposes only</strong>, limited to users within the Customer's organization, and must comply with internal policies where required.</p>
        </Sec>
        <Sec n={5} title="Prohibited Use">
          <Bullets items={["Illegal activities of any kind","Malicious phishing outside authorized testing","Reverse engineering or copying the platform","Distributing malware or harmful content"]}/>
        </Sec>
        <Sec n={6} title="Intellectual Property">
          <p>All platform content is the intellectual property of AwareOne. Users receive a <strong>limited, non-exclusive, non-transferable license</strong> for intended use only.</p>
        </Sec>
        <Sec n={7} title="Limitation of Liability">
          <p>AwareOne shall not be liable for indirect or consequential damages, loss of business or data, or damages resulting from user misuse.</p>
        </Sec>
        <Sec n={8} title="Contact">
          <p>Questions? <strong>support@awareone.net</strong></p>
        </Sec>
      </>
    ),
  },
  {
    id: "security",
    label: "Security Policy",
    icon: Shield,
    color: "#f87171",
    tagline: "Our security principles, controls, and infrastructure practices",
    content: (
      <>
        <Sec n={1} title="Security Principles">
          <h3>Confidentiality</h3>
          <p>Protecting sensitive data from unauthorized access.</p>
          <h3>Integrity</h3>
          <p>Ensuring data remains accurate and protected from unauthorized modification.</p>
          <h3>Availability</h3>
          <p>Maintaining reliable platform access and minimizing service disruptions.</p>
        </Sec>
        <Sec n={2} title="Infrastructure Security">
          <Bullets items={["Secure cloud environments","Network protection mechanisms","System monitoring and logging","Traffic filtering and threat detection"]}/>
        </Sec>
        <Sec n={3} title="Application Security">
          <Bullets items={["Encrypted communication (HTTPS / TLS)","Secure authentication processes","Role-based access control","Protection against common web vulnerabilities","Secure API communications"]}/>
        </Sec>
        <Sec n={4} title="Access Control">
          <p>Access is restricted to authorized personnel only, based on the <strong>principle of least privilege</strong>. Administrative access is limited and monitored.</p>
        </Sec>
        <Sec n={5} title="Incident Response">
          <Bullets items={["Investigating security issues","Containing potential threats","Implementing corrective actions","Notifying affected customers where appropriate"]}/>
        </Sec>
        <Sec n={6} title="Reporting Security Issues">
          <p>Discovered a vulnerability? Contact our security team at <strong>support@awareone.net</strong></p>
        </Sec>
      </>
    ),
  },
  {
    id: "aup",
    label: "Acceptable Use Policy",
    icon: CheckSquare,
    color: "#fbbf24",
    tagline: "Responsible and ethical use guidelines for the platform",
    content: (
      <>
        <Sec n={1} title="Authorized Use">
          <Bullets items={["Training employees on cybersecurity awareness","Conducting controlled phishing simulations within the organization","Measuring employee security awareness levels","Improving internal cybersecurity practices"]}/>
        </Sec>
        <Sec n={2} title="Phishing Simulation Rules">
          <p>Simulations must be conducted <strong>only within the user's organization</strong>, used solely for awareness training, and must not cause harm, panic, or disruption.</p>
        </Sec>
        <Sec n={3} title="Prohibited Activities">
          <Bullets items={["Real phishing attacks or cybercrime","Distributing malware, ransomware, or harmful software","Targeting individuals outside authorized testing","Unauthorized access to systems or networks","Interfering with platform operation or security","Reverse engineering or copying the platform"]}/>
        </Sec>
        <Sec n={4} title="Organization Responsibilities">
          <Bullets items={["Managing user access within accounts","Ensuring employees are informed of awareness initiatives","Ensuring compliance with applicable laws and internal policies"]}/>
        </Sec>
        <Sec n={5} title="Consequences of Violations">
          <Bullets items={["Immediate suspension of services","Permanent termination of accounts","Legal action where applicable"]}/>
        </Sec>
        <Sec n={6} title="Contact">
          <p>Questions? <strong>support@awareone.net</strong></p>
        </Sec>
      </>
    ),
  },
  {
    id: "cookies",
    label: "Cookies Policy",
    icon: Cookie,
    color: "#fb923c",
    tagline: "How we use cookies and similar technologies on the platform",
    content: (
      <>
        <Sec n={1} title="What Are Cookies">
          <p>Cookies are small data files stored on your device that help the platform recognize users, maintain sessions, and improve performance.</p>
        </Sec>
        <Sec n={2} title="How AwareOne Uses Cookies">
          <Bullets items={["Maintain secure user sessions","Enable authentication and login functionality","Improve platform performance","Analyze usage patterns","Enhance security and fraud detection"]}/>
        </Sec>
        <Sec n={3} title="Types of Cookies">
          <h3>Essential Cookies</h3>
          <p>Required for authentication, session management, and navigation.</p>
          <h3>Performance & Analytics Cookies</h3>
          <p>Collect anonymous usage information to help improve the platform.</p>
          <h3>Security Cookies</h3>
          <p>Help detect suspicious activity and protect user accounts.</p>
        </Sec>
        <Sec n={4} title="Managing Cookies">
          <p>Users can control or disable cookies through browser settings. Disabling certain cookies may affect platform functionality.</p>
        </Sec>
        <Sec n={5} title="Contact">
          <p>Questions? <strong>support@awareone.net</strong></p>
        </Sec>
      </>
    ),
  },
  {
    id: "dpa",
    label: "Data Processing Agreement",
    icon: Database,
    color: "#38bdf8",
    tagline: "Controller and processor obligations for personal data handling",
    content: (
      <>
        <Sec n={1} title="Roles of the Parties">
          <p>The <strong>Customer acts as the Data Controller</strong>. <strong>AwareOne acts as the Data Processor</strong>, processing personal data only on behalf of the Customer.</p>
        </Sec>
        <Sec n={2} title="Scope of Processing">
          <Bullets items={["Employee names and email addresses","Department or role information","Training participation data","Phishing simulation interaction results","Security awareness performance metrics"]}/>
        </Sec>
        <Sec n={3} title="Confidentiality">
          <p>All personnel involved in processing are bound by confidentiality obligations and have access only where necessary to perform their duties.</p>
        </Sec>
        <Sec n={4} title="Security Measures">
          <Bullets items={["Encryption of data in transit","Access control and authentication","Infrastructure security protections","Monitoring and logging of platform activity"]}/>
        </Sec>
        <Sec n={5} title="Sub-Processors">
          <p>AwareOne may engage trusted third-party providers for infrastructure, storage, and monitoring. Some data may transit through servers outside the Kingdom of Saudi Arabia, with appropriate safeguards implemented.</p>
        </Sec>
        <Sec n={6} title="Data Breach Notification">
          <p>In the event of a confirmed personal data breach, AwareOne will notify the Customer without undue delay and provide reasonable assistance.</p>
        </Sec>
        <Sec n={7} title="Data Retention & Deletion">
          <p>Personal data is retained only as long as necessary. Upon termination, the Customer may request export or deletion of their data within a reasonable timeframe.</p>
        </Sec>
        <Sec n={8} title="Contact">
          <p>Questions? <strong>support@awareone.net</strong></p>
        </Sec>
      </>
    ),
  },
];

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const LegalPage: React.FC = () => {
  const [openId, setOpenId]           = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [scrolled, setScrolled]       = useState(false);

  /* footer settings */
  const [footerEmail, setFooterEmail]     = useState("support@awareone.net");
  const [footerPhone, setFooterPhone]     = useState("+966 11 234 5678");
  const [footerTagline, setFooterTagline] = useState("Empowering organizations to build a resilient security culture through localized, data-driven training and simulation.");
  const [footerCopy, setFooterCopy]       = useState("© 2025 AwareOne. All rights reserved.");

  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("homepage_settings").select("setting_value").eq("setting_key","footer").maybeSingle();
        if (data?.setting_value) {
          const s = data.setting_value as any;
          if (s.email)     setFooterEmail(s.email);
          if (s.phone)     setFooterPhone(s.phone);
          if (s.tagline)   setFooterTagline(s.tagline);
          if (s.copyright) setFooterCopy(s.copyright);
        }
      } catch {}
    })();
  }, []);

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  /* ★ الرابط الصحيح للـ Fraud Alerts */
  const FRAUD_ALERTS_PATH = "/employee/fraud-alerts";

  return (
    <div dir="ltr" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', sans-serif", color: T.white }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }
        a, button { font-family: 'Inter', sans-serif; }

        @keyframes aw-fraud-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
          60%      { box-shadow: 0 0 0 7px rgba(239,68,68,0); }
        }
        @keyframes aw-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── nav responsive ── */
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

        .aw-container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }
        @media (max-width: 600px) { .aw-container { padding: 0 20px; } }

        .aw-footer-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
        @media (max-width: 1024px) { .aw-footer-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .aw-footer-grid { grid-template-columns: 1fr; } }

        .aw-footer-bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        @media (max-width: 600px) { .aw-footer-bottom { flex-direction: column; align-items: flex-start; } }

        /* ── fraud button ── */
        .aw-fraud-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.30); color: #fca5a5; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: background 0.2s, border-color 0.2s; animation: aw-fraud-pulse 2.5s ease-in-out infinite; white-space: nowrap; letter-spacing: 0.1px; }
        .aw-fraud-btn:hover { background: rgba(239,68,68,0.16); border-color: rgba(239,68,68,0.55); color: #fecaca; }
        .aw-fraud-dot { width: 7px; height: 7px; border-radius: 50%; background: #ef4444; flex-shrink: 0; display: inline-block; }

        /* ── accordion ── */
        .aw-accord-card { border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; transition: border-color 0.25s, box-shadow 0.25s; background: rgba(255,255,255,0.02); }
        .aw-accord-card.open { border-color: rgba(200,255,0,0.22); box-shadow: 0 0 28px rgba(200,255,0,0.05); background: rgba(255,255,255,0.03); }

        .aw-accord-trigger { width: 100%; display: flex; align-items: center; gap: 16px; padding: 22px 24px; background: none; border: none; cursor: pointer; text-align: left; font-family: 'Inter', sans-serif; transition: background 0.18s; }
        .aw-accord-trigger:hover { background: rgba(255,255,255,0.03); }
        .aw-accord-card.open .aw-accord-trigger { background: rgba(200,255,0,0.025); }

        .aw-chevron { transition: transform 0.30s ease; flex-shrink: 0; color: #64748b; }
        .aw-accord-card.open .aw-chevron { transform: rotate(180deg); color: #c8ff00; }

        .aw-accord-body { max-height: 0; overflow: hidden; transition: max-height 0.42s ease; }
        .aw-accord-body.open { max-height: 9999px; }

        /* ── prose ── */
        .aw-prose { font-family: 'Inter', sans-serif; }
        .aw-prose h3     { font-size: 13px; font-weight: 700; color: #c8ff00; margin: 18px 0 7px; }
        .aw-prose p      { font-size: 14px; color: #94a3b8; line-height: 24px; margin-bottom: 10px; }
        .aw-prose ul     { list-style: none; padding: 0; margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
        .aw-prose li     { font-size: 14px; color: #94a3b8; line-height: 22px; display: flex; gap: 10px; align-items: flex-start; }
        .aw-prose li::before { content: ''; display: block; width: 5px; height: 5px; border-radius: 50%; background: rgba(200,255,0,0.45); flex-shrink: 0; margin-top: 8px; }
        .aw-prose strong { color: #ffffff; font-weight: 700; }

        .aw-sec       { padding: 16px 18px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); margin-bottom: 10px; }
        .aw-sec-title { font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .aw-sec-num   { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; background: rgba(200,255,0,0.09); border: 1px solid rgba(200,255,0,0.18); font-size: 10px; font-weight: 800; color: #c8ff00; flex-shrink: 0; }

        .aw-fade-up { animation: aw-fade-up 0.5s ease both; }
      `}</style>

      {/* ══════════════ HEADER ══════════════ */}
      <header style={{ position: "fixed", top: 0, left: 0, width: "100%", height: 81, background: T.headerBg, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", borderBottom: `1px solid ${T.border}`, zIndex: 1000, boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.35)" : "none", transition: "box-shadow 0.3s" }}>
        <div className="aw-container" style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          <a href="/" aria-label="AwareOne" style={{ textDecoration: "none", flexShrink: 0 }}>
            <img src={LOGO} alt="AwareOne" style={{ height: 52, width: "auto", display: "block" }}/>
          </a>

          <nav className="aw-desk-nav" style={{ alignItems: "center", gap: 32 }}>
            {[["Platform","/#features"],["How it Works","/#how-it-works"],["Resources","/resources"]].map(([label,href]) => (
              <a key={label} href={href}
                style={{ fontSize: 14, fontWeight: 500, color: T.textNav, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.textNav)}>
                {label}
              </a>
            ))}
          </nav>

          <div className="aw-desk-act" style={{ alignItems: "center", gap: 14 }}>
            {/* ★ رابط Fraud Alerts الصحيح */}
            <button className="aw-fraud-btn" onClick={() => navigate(FRAUD_ALERTS_PATH)}>
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

          <button className="aw-hamburger" aria-label="Toggle menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
            style={{ flexDirection: "column", gap: 5, width: 40, height: 40, alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ display: "block", width: 24, height: 2, background: T.white, borderRadius: 2, transition: "transform 0.3s, opacity 0.3s",
                transform: menuOpen && i===0 ? "translateY(7px) rotate(45deg)" : menuOpen && i===2 ? "translateY(-7px) rotate(-45deg)" : "none",
                opacity: menuOpen && i===1 ? 0 : 1 }}/>
            ))}
          </button>
        </div>

        {/* Mobile menu */}
        <div className="aw-mob-nav" style={{ overflow: "hidden", maxHeight: menuOpen ? 520 : 0, transition: "max-height 0.35s ease", background: T.bg, borderTop: `1px solid rgba(255,255,255,0.05)` }}>
          <div className="aw-container" style={{ paddingTop: menuOpen ? 16 : 0, paddingBottom: menuOpen ? 24 : 0, transition: "padding 0.35s" }}>
            {[["Platform","/#features"],["How it Works","/#how-it-works"],["Resources","/resources"]].map(([label,href]) => (
              <a key={label} href={href} onClick={() => setMenuOpen(false)}
                style={{ display: "block", padding: "12px 0", fontSize: 16, fontWeight: 500, color: T.textNav, textDecoration: "none", borderBottom: `1px solid rgba(255,255,255,0.05)` }}>{label}</a>
            ))}
            <button onClick={() => { navigate(FRAUD_ALERTS_PATH); setMenuOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 0", fontSize: 14, fontWeight: 600, color: "#fca5a5", background: "none", border: "none", borderBottom: `1px solid rgba(255,255,255,0.05)`, cursor: "pointer" }}>
              <span className="aw-fraud-dot"/><AlertTriangle size={12}/>Live Fraud Alerts
            </button>
            <button onClick={() => { navigate("/login"); setMenuOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 0", fontSize: 16, fontWeight: 500, color: T.textNav, background: "none", border: "none", borderBottom: `1px solid rgba(255,255,255,0.05)`, cursor: "pointer" }}>Login</button>
            <button onClick={() => { setShowDemoModal(true); setMenuOpen(false); }}
              style={{ display: "block", width: "100%", marginTop: 12, padding: "14px 24px", background: T.accent, color: T.bg, fontSize: 16, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer" }}>Request Demo</button>
          </div>
        </div>
      </header>

      {/* ══════════════ HERO ══════════════ */}
      <div style={{ position: "relative", paddingTop: 81 + 72, paddingBottom: 52, paddingLeft: 24, paddingRight: 24, textAlign: "center", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: 81, left: "50%", transform: "translateX(-50%)", width: 500, height: 280, background: "radial-gradient(ellipse, rgba(200,255,0,0.07) 0%, transparent 70%)", pointerEvents: "none" }}/>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 9999, marginBottom: 18 }}>
          <FileText size={12} style={{ color: T.accent }}/>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "1px", textTransform: "uppercase" }}>Legal & Policies</span>
        </div>
        <h1 style={{ fontSize: "clamp(28px,5vw,46px)", fontWeight: 900, color: T.white, letterSpacing: "-0.5px", marginBottom: 12 }}>
          Legal Documents
        </h1>
        <p style={{ fontSize: 15, color: T.textBody, lineHeight: "26px", maxWidth: 480, margin: "0 auto" }}>
          Everything you need to know about how AwareOne operates, protects your data, and governs platform use. Click any document below to expand.
        </p>
      </div>

      {/* ══════════════ ACCORDION ══════════════ */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px 80px", display: "flex", flexDirection: "column", gap: 10 }}>
        {POLICIES.map((policy, idx) => {
          const isOpen = openId === policy.id;
          const Icon = policy.icon;
          return (
            <div key={policy.id} className={`aw-accord-card aw-fade-up ${isOpen ? "open" : ""}`} style={{ animationDelay: `${idx * 0.05}s` }}>
              <button className="aw-accord-trigger" onClick={() => toggle(policy.id)} aria-expanded={isOpen}>
                <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: `${policy.color}12`, border: `1px solid ${policy.color}22`, display: "flex", alignItems: "center", justifyContent: "center", transition: "box-shadow 0.25s", boxShadow: isOpen ? `0 0 16px ${policy.color}18` : "none" }}>
                  <Icon size={19} style={{ color: isOpen ? policy.color : `${policy.color}88` }}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: isOpen ? T.white : T.textLabel, display: "block", marginBottom: 3 }}>{policy.label}</span>
                  <span style={{ fontSize: 13, color: T.textMuted }}>{policy.tagline}</span>
                </div>
                <ChevronDown size={17} className="aw-chevron"/>
              </button>

              <div className={`aw-accord-body ${isOpen ? "open" : ""}`}>
                <div style={{ padding: "4px 24px 24px", borderTop: `1px solid rgba(255,255,255,0.05)` }}>
                  <div style={{ margin: "14px 0 18px", padding: "12px 14px", background: `${policy.color}08`, borderLeft: `3px solid ${policy.color}`, borderRadius: "0 8px 8px 0" }}>
                    <p style={{ fontSize: 12, color: T.textBody }}>
                      Last Updated: <strong style={{ color: T.textLabel }}>2026</strong> · Contact: <strong style={{ color: T.accent }}>support@awareone.net</strong>
                    </p>
                  </div>
                  {policy.content}
                </div>
              </div>
            </div>
          );
        })}

        {/* Contact CTA */}
        <div style={{ marginTop: 12, padding: "28px", textAlign: "center", background: "rgba(200,255,0,0.03)", border: "1px solid rgba(200,255,0,0.12)", borderRadius: 14 }}>
          <p style={{ fontSize: 14, color: T.textBody, marginBottom: 14 }}>Have questions about our legal documents or data practices?</p>
          <a href="mailto:support@awareone.net"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 24px", background: T.accent, color: T.bg, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: "none", fontFamily: "inherit", boxShadow: "0 0 18px rgba(200,255,0,0.18)", transition: "opacity 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            <Mail size={14}/> support@awareone.net
          </a>
        </div>
      </div>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer style={{ paddingTop: 80, borderTop: `1px solid rgba(255,255,255,0.05)` }}>
        <div className="aw-container">
          <div className="aw-footer-grid" style={{ paddingBottom: 56 }}>

            {/* Brand */}
            <div>
              <div style={{ marginBottom: 40 }}>
                <img src={LOGO} alt="AwareOne" style={{ height: 52, width: "auto", display: "block" }}/>
              </div>
              <p style={{ fontSize: 14, color: T.textBody, lineHeight: "22.75px", margin: "0 0 40px" }}>{footerTagline}</p>
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
                {[
                  { label: "Free Assessment", path: "/assessment" },
                  { label: "Fraud Alerts",    path: FRAUD_ALERTS_PATH },
                  { label: "Resources",       path: "/resources" },
                  { label: "Login",           path: "/login" },
                ].map(({ label, path }) => (
                  <li key={path}>
                    <button onClick={() => navigate(path)}
                      style={{ fontSize: 14, color: T.textBody, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Legal */}
            <nav aria-label="Legal links">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: "0 0 48px" }}>Legal</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {POLICIES.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setOpenId(p.id); }}
                      style={{ fontSize: 14, color: T.textBody, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Contact */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: "0 0 48px" }}>Contact</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                <li>
                  <a href={`mailto:${footerEmail}`}
                    style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: T.textBody, textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                    <Mail size={14} style={{ color: T.textMuted, flexShrink: 0 }}/>{footerEmail}
                  </a>
                </li>
                <li>
                  <a href={`tel:${footerPhone.replace(/\s/g,"")}`}
                    style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: T.textBody, textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                    <Phone size={14} style={{ color: T.textMuted, flexShrink: 0 }}/>{footerPhone}
                  </a>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: T.textBody }}>
                  <MapPin size={14} style={{ color: T.textMuted, flexShrink: 0 }}/>Riyadh, Saudi Arabia
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="aw-footer-bottom" style={{ padding: "32px 0", borderTop: `1px solid rgba(255,255,255,0.05)` }}>
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>{footerCopy}</p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {POLICIES.slice(0,3).map(p => (
                <button key={p.id}
                  onClick={() => { window.scrollTo({ top: 0 }); setOpenId(p.id); }}
                  style={{ fontSize: 13, color: T.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = T.textNav)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <RequestDemoModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)}/>
    </div>
  );
};
