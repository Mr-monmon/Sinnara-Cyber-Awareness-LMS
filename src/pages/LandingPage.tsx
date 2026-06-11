import React, { useState, useEffect, useRef } from "react";
import { RequestDemoModal } from "../components/landing/RequestDemoModal";
import { PartnersCarousel } from "../components/landing/PartnersCarousel";
import { supabase } from "../lib/supabase";
import {
  ArrowRight,
  Mail,
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
  { title: "Compliance Reports Ready", desc: "Audit-ready reports for ISO 27001, NCA, SAMA, and PDPL — generated automatically with one click." },
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
   SCROLL-IN HOOK + COUNT-UP
═══════════════════════════════════════════ */
function useInView<E extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<E | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) { setInView(true); ob.disconnect(); }
      },
      { threshold }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold, inView]);
  return { ref, inView };
}

const CountUp: React.FC<{ end: number; duration?: number; suffix?: string }> = ({ end, duration = 1600, suffix = "" }) => {
  const { ref, inView } = useInView<HTMLSpanElement>(0.5);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(end * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, end, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

/* ═══════════════════════════════════════════
   REGIONAL CYBER-THREAT MAP — accurate geographic SVG
   ViewBox: 0 0 1448 1086  (paths provided by design)
═══════════════════════════════════════════ */
const MAP_CITIES: { name: string; x: number; y: number; primary?: boolean }[] = [
  { name: "Riyadh", x: 601,  y: 520,  primary: true },
  { name: "Jeddah", x: 195,  y: 448               },
  { name: "Amman",  x: 199,  y: 185               },
  { name: "Kuwait", x: 748,  y: 270               },
  { name: "Doha",   x: 898,  y: 440               },
  { name: "Dubai",  x: 1078, y: 498               },
  { name: "Muscat", x: 1174, y: 636               },
];

const MAP_ATTACKS = [
  "M 30,90  Q 200,310 601,520",
  "M 1430,75 Q 1310,290 1078,498",
  "M 700,1060 Q 640,790 601,520",
];

const SA_PATH = "M 151.16 275.65 L 202.60 282.14 L 222.58 269.59 L 233.64 254.91 L 268.91 249.26 L 276.51 235.60 L 291.80 228.68 L 245.73 187.91 L 338.30 167.45 L 347.11 161.30 L 402.78 172.35 L 471.64 200.89 L 601.96 282.90 L 687.89 286.15 L 729.08 290.09 L 740.59 309.51 L 773.27 308.46 L 791.37 343.62 L 814.11 352.93 L 822.03 367.26 L 853.53 384.40 L 856.32 401.22 L 851.72 414.80 L 857.57 428.50 L 870.86 439.93 L 877.01 453.30 L 883.92 463.29 L 897.90 471.38 L 910.71 468.49 L 919.48 484.06 L 921.25 493.49 L 938.95 534.80 L 1077.89 555.36 L 1087.21 546.74 L 1108.39 575.62 L 1077.58 657.17 L 938.92 697.95 L 805.65 713.58 L 762.52 731.93 L 729.39 774.74 L 707.82 781.54 L 696.27 767.95 L 678.55 769.99 L 633.87 765.91 L 625.40 761.83 L 572.06 762.77 L 559.53 766.45 L 540.55 755.85 L 528.30 775.89 L 533.04 793.08 L 512.75 806.09 L 506.75 788.69 L 492.81 776.41 L 489.25 760.14 L 465.38 745.53 L 440.74 711.34 L 427.71 678.11 L 395.74 650.05 L 375.12 643.36 L 344.51 604.49 L 339.17 576.16 L 341.14 551.98 L 314.63 506.77 L 292.95 490.86 L 267.99 482.43 L 252.79 459.06 L 255.32 449.85 L 242.47 428.71 L 228.98 419.60 L 210.93 389.27 L 159.21 328.38 L 136.20 328.58 L 151.16 275.65 Z";

const MENAMap: React.FC = () => {
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top)  / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
  };
  const onLeave = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg)";
  };

  const S = "#c8ff00";          // primary neon green
  const SF = "rgba(200,255,0,0.65)"; // faint for smaller countries

  return (
    <div className="aw-map-wrap" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "10%", background: "rgba(200,255,0,0.11)", filter: "blur(52px)", borderRadius: "50%", pointerEvents: "none" }} />

      <div ref={tiltRef} className="aw-map-tilt">
        <svg viewBox="0 0 1448 1086" width="100%" role="img"
          aria-label="Cyber-threat map of Saudi Arabia and the Gulf region"
          style={{ display: "block", overflow: "visible" }}>
          <defs>
            <filter id="awGlow2" x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="2.5" result="b1"/>
              <feGaussianBlur stdDeviation="6"   result="b2"/>
              <feGaussianBlur stdDeviation="12"  result="b3"/>
              <feMerge>
                <feMergeNode in="b3"/><feMergeNode in="b2"/>
                <feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <pattern id="awDots2" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="2" fill="rgba(200,255,0,0.22)" />
            </pattern>
            <clipPath id="awSaClip"><path d={SA_PATH} /></clipPath>
            <radialGradient id="awFillSa" cx="42%" cy="45%" r="60%">
              <stop offset="0%"   stopColor="rgba(200,255,0,0.12)" />
              <stop offset="100%" stopColor="rgba(200,255,0,0.01)" />
            </radialGradient>
            <radialGradient id="awFillSm" cx="50%" cy="50%" r="70%">
              <stop offset="0%"   stopColor="rgba(200,255,0,0.09)" />
              <stop offset="100%" stopColor="rgba(200,255,0,0.00)" />
            </radialGradient>
          </defs>

          {/* Country fills */}
          <path fill="url(#awFillSa)" d={SA_PATH} />
          <path fill="url(#awFillSm)" d="M 178.41 151.80 L 186.47 138.94 L 237.96 155.10 L 328.47 111.64 L 347.11 161.30 L 338.30 167.45 L 245.73 187.91 L 291.80 228.68 L 276.51 235.60 L 268.91 249.26 L 233.64 254.91 L 222.58 269.59 L 202.60 282.14 L 151.16 275.65 L 149.62 269.75 L 172.65 204.56 L 171.57 188.70 L 178.40 176.73 L 178.41 151.80 Z" />
          <path fill="url(#awFillSm)" d="M 752.86 250.40 L 762.51 268.40 L 758.38 277.70 L 773.27 308.46 L 740.59 309.51 L 729.08 290.09 L 687.89 286.15 L 721.81 247.01 L 752.86 250.40 Z" />
          <path fill="url(#awFillSm)" d="M 919.48 484.06 L 927.71 482.08 L 929.42 493.26 L 965.59 486.83 L 1031.73 489.10 L 1127.07 410.26 L 1135.86 424.15 L 1142.14 456.36 L 1118.54 456.52 L 1114.74 483.08 L 1122.93 488.75 L 1102.01 496.78 L 1101.88 513.44 L 1088.41 530.32 L 1087.21 546.74 L 1077.89 555.36 L 938.95 534.80 L 921.25 493.49 L 919.48 484.06 Z" />
          <path fill="url(#awFillSm)" d="M 1087.21 546.74 L 1088.41 530.32 L 1101.88 513.44 L 1102.01 496.78 L 1122.93 488.75 L 1114.74 483.08 L 1118.54 456.52 L 1142.14 456.36 L 1162.86 484.21 L 1188.66 499.02 L 1222.56 504.35 L 1249.94 511.78 L 1283.26 548.70 L 1299.80 553.86 L 1299.71 562.96 L 1275.50 598.70 L 1256.03 611.75 L 1238.79 639.68 L 1217.82 637.54 L 1208.21 647.26 L 1200.79 667.94 L 1206.47 695.19 L 1202.11 700.20 L 1180.84 700.07 L 1151.97 715.31 L 1147.47 735.17 L 1136.90 743.78 L 1108.15 743.45 L 1090.05 753.72 L 1090.28 770.19 L 1067.92 781.51 L 1042.41 777.67 L 1011.51 791.42 L 990.16 793.73 L 938.92 697.95 L 1077.58 657.17 L 1108.39 575.62 L 1087.21 546.74 Z" />

          {/* Dot matrix on KSA */}
          <g clipPath="url(#awSaClip)">
            <rect x="0" y="0" width="1448" height="1086" fill="url(#awDots2)" />
          </g>

          {/* Borders with glow */}
          <g filter="url(#awGlow2)">
            <path className="aw-map-border" d={SA_PATH} fill="none" stroke={S} strokeWidth="4.2" strokeLinejoin="round" />
            <path className="aw-map-border" fill="none" stroke={SF} strokeWidth="3.4" strokeLinejoin="round" style={{ animationDelay: "0.3s" }}
              d="M 178.41 151.80 L 186.47 138.94 L 237.96 155.10 L 328.47 111.64 L 347.11 161.30 L 338.30 167.45 L 245.73 187.91 L 291.80 228.68 L 276.51 235.60 L 268.91 249.26 L 233.64 254.91 L 222.58 269.59 L 202.60 282.14 L 151.16 275.65 L 149.62 269.75 L 172.65 204.56 L 171.57 188.70 L 178.40 176.73 L 178.41 151.80 Z" />
            <path className="aw-map-border" fill="none" stroke={SF} strokeWidth="3.4" strokeLinejoin="round" style={{ animationDelay: "0.5s" }}
              d="M 752.86 250.40 L 762.51 268.40 L 758.38 277.70 L 773.27 308.46 L 740.59 309.51 L 729.08 290.09 L 687.89 286.15 L 721.81 247.01 L 752.86 250.40 Z" />
            <path className="aw-map-border" fill="none" stroke={SF} strokeWidth="3.4" strokeLinejoin="round" style={{ animationDelay: "0.7s" }}
              d="M 883.92 463.29 L 880.86 433.62 L 893.32 412.23 L 905.94 407.85 L 919.93 420.63 L 920.74 444.50 L 910.71 468.49 L 897.90 471.38 L 883.92 463.29 Z" />
            <path className="aw-map-border" fill="none" stroke={SF} strokeWidth="3.4" strokeLinejoin="round" style={{ animationDelay: "0.9s" }}
              d="M 919.48 484.06 L 927.71 482.08 L 929.42 493.26 L 965.59 486.83 L 1031.73 489.10 L 1127.07 410.26 L 1135.86 424.15 L 1142.14 456.36 L 1118.54 456.52 L 1114.74 483.08 L 1122.93 488.75 L 1102.01 496.78 L 1101.88 513.44 L 1088.41 530.32 L 1087.21 546.74 L 1077.89 555.36 L 938.95 534.80 L 921.25 493.49 L 919.48 484.06 Z" />
            <path className="aw-map-border" fill="none" stroke={SF} strokeWidth="3.4" strokeLinejoin="round" style={{ animationDelay: "1.1s" }}
              d="M 1087.21 546.74 L 1088.41 530.32 L 1101.88 513.44 L 1102.01 496.78 L 1122.93 488.75 L 1114.74 483.08 L 1118.54 456.52 L 1142.14 456.36 L 1162.86 484.21 L 1188.66 499.02 L 1222.56 504.35 L 1249.94 511.78 L 1283.26 548.70 L 1299.80 553.86 L 1299.71 562.96 L 1275.50 598.70 L 1256.03 611.75 L 1238.79 639.68 L 1217.82 637.54 L 1208.21 647.26 L 1200.79 667.94 L 1206.47 695.19 L 1202.11 700.20 L 1180.84 700.07 L 1151.97 715.31 L 1147.47 735.17 L 1136.90 743.78 L 1108.15 743.45 L 1090.05 753.72 L 1090.28 770.19 L 1067.92 781.51 L 1042.41 777.67 L 1011.51 791.42 L 990.16 793.73 L 938.92 697.95 L 1077.58 657.17 L 1108.39 575.62 L 1087.21 546.74 Z" />
            <path className="aw-map-border" fill="none" stroke={SF} strokeWidth="3.4" strokeLinejoin="round" style={{ animationDelay: "1.3s" }}
              d="M 1135.86 424.15 L 1127.07 410.26 L 1140.53 396.37 L 1146.24 399.91 L 1141.89 416.76 L 1135.86 424.15 Z" />
            <path className="aw-map-border" fill="none" stroke={SF} strokeWidth="3" strokeLinejoin="round" style={{ animationDelay: "1.5s" }}
              d="M 876.52 408.44 C 876.52 413.76 874.46 418.23 871.90 418.23 C 869.34 418.23 867.28 413.76 867.28 408.44 C 867.28 403.12 869.34 398.65 871.90 398.65 C 874.46 398.65 876.52 403.12 876.52 408.44 Z" />
          </g>

          {/* Attack arcs */}
          {MAP_ATTACKS.map((d, i) => (
            <path key={i} className="aw-attack" d={d}
              fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"
              style={{ animationDelay: `${i * 1.3}s` }} />
          ))}

          {/* Shield near Riyadh */}
          <g transform="translate(680,390)" style={{ animation: "aw-float-y 4.5s ease-in-out infinite" }}>
            <circle r="22" fill="rgba(200,255,0,0.10)" stroke="rgba(200,255,0,0.28)" strokeWidth="1.5" />
            <path d="M0,-12 L-9,-6 L-9,3 C-9,9 0,14 0,14 C0,14 9,9 9,3 L9,-6 Z"
              fill="none" stroke={S} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M-4,2 L-1,5 L5.5,-2" stroke={S} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* City nodes */}
          {MAP_CITIES.map((c) => (
            <g key={c.name}>
              <circle className="aw-city-ring" cx={c.x} cy={c.y} r={c.primary ? 18 : 12}
                fill="none" stroke={S} strokeWidth="2"
                style={{ animationDelay: `${(c.x % 9) * 0.25}s` }} />
              <circle cx={c.x} cy={c.y} r={c.primary ? 9 : 5} fill={S} />
              <text
                x={c.x > 900 ? c.x - 18 : c.x + 18}
                y={c.primary ? c.y - 28 : c.y - 19}
                fill={c.primary ? S : "rgba(203,213,225,0.85)"}
                fontSize={c.primary ? 30 : 22}
                fontWeight={c.primary ? 800 : 600}
                textAnchor={c.x > 900 ? "end" : "start"}
                style={{ fontFamily: "'Inter', sans-serif" }}>
                {c.name}
              </text>
            </g>
          ))}

          {/* Country abbreviations */}
          <text x="580" y="600" fill="rgba(200,255,0,0.22)" fontSize="90" fontWeight="900"
            textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "8px" }}>SA</text>
          <text x="199" y="228" fill="rgba(200,255,0,0.28)" fontSize="42" fontWeight="800"
            textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: "'Inter', sans-serif" }}>JO</text>
          <text x="1185" y="688" fill="rgba(200,255,0,0.22)" fontSize="42" fontWeight="800"
            textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: "'Inter', sans-serif" }}>OM</text>
        </svg>
      </div>

      {/* Floating chips */}
      <div style={{ position: "absolute", top: "4%", left: "-3%", display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", background: "rgba(18,20,10,0.90)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, backdropFilter: "blur(8px)", animation: "aw-float-y 5s ease-in-out infinite", whiteSpace: "nowrap", zIndex: 2 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>Live attacks blocked</span>
      </div>
      <div style={{ position: "absolute", bottom: "4%", right: "-3%", display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", background: "rgba(18,20,10,0.90)", border: "1px solid rgba(200,255,0,0.30)", borderRadius: 10, backdropFilter: "blur(8px)", animation: "aw-float-y 5.8s ease-in-out infinite", animationDelay: "0.8s", whiteSpace: "nowrap", zIndex: 2 }}>
        <svg width="13" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L4 5V11C4 16.55 7.84 21.74 12 23C16.16 21.74 20 16.55 20 11V5L12 2Z" stroke="#c8ff00" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 12L11 14L15 10" stroke="#c8ff00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#c8ff00" }}>NCA · SAMA · PDPL</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   STATS BAND (count-up)
═══════════════════════════════════════════ */
const STATS: { end: number; suffix: string; label: string }[] = [
  { end: 25, suffix: "+",  label: "Enterprises Protected" },
  { end: 6,  suffix: "",   label: "Compliance Frameworks" },
  { end: 50, suffix: "K+", label: "Phishing Emails Simulated" },
  { end: 98, suffix: "%",  label: "Avg. Detection Uplift" },
];

const StatsBand: React.FC = () => (
  <section aria-label="Key metrics" style={{ borderTop: `1px solid ${T.borderFaint}`, borderBottom: `1px solid ${T.borderFaint}`, background: "rgba(200,255,0,0.015)" }}>
    <div className="aw-container" style={{ paddingTop: 44, paddingBottom: 44 }}>
      <div className="aw-stats-grid">
        {STATS.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 46, fontWeight: 900, color: T.accent, lineHeight: 1, letterSpacing: "-1.5px" }}>
              <CountUp end={s.end} suffix={s.suffix} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textBody, marginTop: 10 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   COMPLIANCE FRAMEWORKS (assembling grid)
═══════════════════════════════════════════ */
const FRAMEWORKS: { abbr: string; title: string; desc: string; scope: "Local" | "Global" }[] = [
  { abbr: "NCA",  title: "NCA Essential Controls", desc: "Saudi National Cybersecurity Authority ECC alignment.", scope: "Local" },
  { abbr: "SAMA", title: "SAMA Cyber Framework",   desc: "Saudi Central Bank framework for financial entities.", scope: "Local" },
  { abbr: "PDPL", title: "PDPL Data Privacy",      desc: "Kingdom's Personal Data Protection Law readiness.",   scope: "Local" },
  { abbr: "ISO",  title: "ISO/IEC 27001",          desc: "International information-security management standard.", scope: "Global" },
  { abbr: "NIST", title: "NIST CSF",               desc: "U.S. NIST Cybersecurity Framework best practices.",   scope: "Global" },
  { abbr: "GDPR", title: "GDPR Readiness",         desc: "EU General Data Protection Regulation controls.",     scope: "Global" },
];

const ComplianceSection: React.FC = () => {
  const { ref, inView } = useInView<HTMLDivElement>(0.18);
  return (
    <section id="compliance" className="aw-section">
      <div className="aw-container">
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 56px" }}>
          <span style={{ display: "inline-block", padding: "5px 14px", background: T.accentAlpha10, border: `1px solid ${T.accentAlpha20}`, borderRadius: 9999, fontSize: 12, fontWeight: 700, color: T.accent, letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 20 }}>Compliance</span>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: T.white, lineHeight: "46px", margin: "0 0 16px" }}>
            Aligned with <span style={{ color: T.accent }}>Local &amp; Global</span> Frameworks
          </h2>
          <p style={{ fontSize: 16, color: T.textBody, lineHeight: "25px", margin: 0 }}>
            From the Kingdom&apos;s NCA, SAMA and PDPL to international standards like ISO 27001 and NIST — AwareOne maps your awareness program to the controls auditors expect.
          </p>
        </div>

        <div ref={ref} className="aw-fw-grid">
          {FRAMEWORKS.map((f, i) => (
            <div key={f.abbr} className={`aw-fw-card${inView ? " in" : ""}`} style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="aw-fw-card-inner">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 56, height: 44, padding: "0 14px", borderRadius: 11, background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.25)", color: T.accent, fontWeight: 900, fontSize: 15, letterSpacing: "0.5px" }}>{f.abbr}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", padding: "4px 11px", borderRadius: 9999, color: f.scope === "Local" ? T.accent : T.textNav, background: f.scope === "Local" ? "rgba(200,255,0,0.10)" : "rgba(255,255,255,0.05)", border: `1px solid ${f.scope === "Local" ? "rgba(200,255,0,0.25)" : T.border}` }}>{f.scope}</span>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: T.white, margin: "0 0 7px", lineHeight: "24px" }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: T.textBody, lineHeight: "21px", margin: 0 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

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

        /* ── Regional threat map + scroll infographics ── */
        @keyframes aw-map-draw    { from { stroke-dashoffset: 8000; } to { stroke-dashoffset: 0; } }
        @keyframes aw-attack-flow { 0% { stroke-dashoffset: 800; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
        @keyframes aw-ring-pulse  { 0% { transform: scale(0.6); opacity: 0.75; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes aw-float-y     { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }

        .aw-map-wrap   { position: relative; width: 100%; max-width: 520px; margin: 0 auto; }
        .aw-map-tilt   { transition: transform 0.2s ease-out; will-change: transform; transform-style: preserve-3d; }
        .aw-map-border { stroke-dasharray: 8000; animation: aw-map-draw 2.6s ease forwards; }
        .aw-attack     { stroke-dasharray: 800; animation: aw-attack-flow 3.4s linear infinite; }
        .aw-city-ring  { transform-box: fill-box; transform-origin: center; animation: aw-ring-pulse 2.8s ease-out infinite; }

        .aw-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        @media (max-width: 900px) { .aw-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 32px 24px; } }

        .aw-fw-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        @media (max-width: 1024px) { .aw-fw-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .aw-fw-grid { grid-template-columns: 1fr; } }
        .aw-fw-card { opacity: 0; transform: translateY(46px) scale(0.92); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1); }
        .aw-fw-card.in { opacity: 1; transform: none; }
        .aw-fw-card-inner { height: 100%; background: rgba(200,255,0,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; transition: border-color 0.2s, background 0.2s, transform 0.2s; }
        .aw-fw-card-inner:hover { border-color: rgba(200,255,0,0.30); background: rgba(200,255,0,0.06); transform: translateY(-4px); }

        @media (prefers-reduced-motion: reduce) {
          .aw-map-border, .aw-attack, .aw-city-ring { animation: none !important; }
          .aw-map-border { stroke-dashoffset: 0; }
          .aw-fw-card { opacity: 1 !important; transform: none !important; }
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
                  <button className="aw-fraud-btn" onClick={() => navigate("/fraud-alerts")}>
                    <span className="aw-fraud-dot"/><AlertTriangle size={12}/>Live Fraud Alerts
                  </button>
                </div>
              </div>

              {/* Regional cyber-threat map */}
              <div className="aw-hero-right" style={{ position: "relative" }}>
                <MENAMap />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ PARTNERS ══════════════ */}
        <PartnersCarousel />

        {/* ══════════════ STATS BAND ══════════════ */}
        <StatsBand />

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

        {/* ══════════════ COMPLIANCE ══════════════ */}
        <ComplianceSection />

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
                  ["X (Twitter)", Twitter, "https://x.com/AwareOne_net"],
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
                {[{label:"Free Assessment",path:"/assessment"},{label:"Fraud Alerts",path:"/fraud-alerts"},{label:"Resources",path:"/resources"},{label:"Login",path:"/login"}].map(({label,path}) => (
                  <li key={path}>
                    <button onClick={() => navigate(path)} style={{ fontSize: 14, color: T.textBody, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = T.white)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>{label}</button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Resources */}
            <nav aria-label="Resources links">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: "0 0 48px" }}>Resources</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {["Legal"].map((label) => (
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
