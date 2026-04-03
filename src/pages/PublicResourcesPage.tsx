import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Clock,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Search,
  X,
  Share2,
  Filter,
  Tag,
  Mail,
  Phone,
  MapPin,
  Twitter,
  Linkedin,
  Youtube,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { RequestDemoModal } from "../components/landing/RequestDemoModal";
import { PartnersCarousel } from "../components/landing/PartnersCarousel";

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
  headerBg: "rgba(18,20,10,0.80)",
  cardBg: "rgba(255,255,255,0.03)",
} as const;

/* ─────────────────────────────────────────
   ASSETS
───────────────────────────────────────── */
const LOGO =
  "https://raw.githubusercontent.com/Mr-monmon/Sinnara-Cyber-Awareness-LMS/main/supabase/without%20bg%202.png";

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  featured_image_url: string | null;
  view_count: number;
  published_at: string;
  tags: string[];
  cta_text: string;
  cta_link: string;
  meta_description: string;
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const readingTime = (content: string) => {
  const mins = Math.ceil(content.split(" ").length / 200);
  return `${mins} min read`;
};

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export const PublicResourcesPage = () => {
  /* ── shared header state ── */
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [scrolled, setScrolled]           = useState(false);

  /* ── resources state ── */
  const [articles, setArticles]           = useState<Article[]>([]);
  const [filtered, setFiltered]           = useState<Article[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState("");
  const [selectedCategory, setCategory]   = useState("all");
  const [selectedArticle, setSelected]    = useState<Article | null>(null);
  const [categories, setCategories]       = useState<string[]>([]);
  const [copied, setCopied]               = useState(false);

  /* ── footer settings ── */
  const [footerEmail, setFooterEmail]     = useState("support@awareone.net");
  const [footerPhone, setFooterPhone]     = useState("+966 11 234 5678");
  const [footerTagline, setFooterTagline] = useState(
    "Empowering organizations to build a resilient security culture through localized, data-driven training and simulation."
  );
  const [footerCopy, setFooterCopy]       = useState("© 2025 AwareOne. All rights reserved.");

  const navigate = useNavigate();

  /* ── scroll listener ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── load data ── */
  useEffect(() => {
    loadArticles();
    loadFooterSettings();
    const hash = window.location.hash.substring(1);
    if (hash) loadArticleBySlug(hash);
  }, []);

  /* ── filter ── */
  useEffect(() => {
    let f = articles;
    if (selectedCategory !== "all")
      f = f.filter((a) => a.category === selectedCategory);
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      f = f.filter(
        (a) =>
          a.title.toLowerCase().includes(t) ||
          a.excerpt.toLowerCase().includes(t) ||
          a.tags.some((tag) => tag.toLowerCase().includes(t))
      );
    }
    setFiltered(f);
  }, [articles, searchTerm, selectedCategory]);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      setArticles(data || []);
      setCategories([...new Set((data || []).map((a) => a.category))]);
    } catch (err) {
      console.error("Error loading articles:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadFooterSettings = async () => {
    try {
      const { data } = await supabase
        .from("homepage_settings")
        .select("setting_value")
        .eq("setting_key", "footer")
        .maybeSingle();
      if (data?.setting_value) {
        const s = data.setting_value as any;
        if (s.email)     setFooterEmail(s.email);
        if (s.phone)     setFooterPhone(s.phone);
        if (s.tagline)   setFooterTagline(s.tagline);
        if (s.copyright) setFooterCopy(s.copyright);
      }
    } catch {}
  };

  const loadArticleBySlug = async (slug: string) => {
    try {
      const { data } = await supabase
        .from("articles")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (data) {
        setSelected(data);
        incrementViews(data.id);
      }
    } catch {}
  };

  const incrementViews = async (id: string) => {
    try {
      await supabase.rpc("increment_article_view_count", { article_id: id });
    } catch {}
  };

  const openArticle = (article: Article) => {
    setSelected(article);
    window.history.pushState({}, "", `#${article.slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    incrementViews(article.id);
  };

  const closeArticle = () => {
    setSelected(null);
    window.history.pushState({}, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleShare = async (article: Article) => {
    const url = `${window.location.origin}/resources#${article.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: article.title, text: article.excerpt, url }); return; } catch {}
    }
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ══════════════════════════════════════════
     SHARED HEADER
  ══════════════════════════════════════════ */
  const Header = () => (
    <header
      style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: 81,
        background: T.headerBg, backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)", borderBottom: `1px solid ${T.border}`,
        zIndex: 1000,
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.35)" : "none",
        transition: "box-shadow 0.3s",
      }}
    >
      <div className="aw-container" style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" aria-label="AwareOne" style={{ textDecoration: "none", flexShrink: 0 }}>
          <img src={LOGO} alt="AwareOne" style={{ height: 130, width: "auto", display: "block" }}/>
        </a>

        <nav className="aw-desk-nav" style={{ alignItems: "center", gap: 32 }}>
          {[["Platform","/#features"],["How it Works","/#how-it-works"],["Resources","/resources"]].map(([label,href]) => (
            <a key={label} href={href}
              style={{ fontSize: 14, fontWeight: 500, color: label === "Resources" ? T.white : T.textNav, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
              onMouseLeave={(e) => (e.currentTarget.style.color = label === "Resources" ? T.white : T.textNav)}>
              {label}
            </a>
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

      <div className="aw-mob-nav" style={{ overflow: "hidden", maxHeight: menuOpen ? 520 : 0, transition: "max-height 0.35s ease", background: T.bg, borderTop: `1px solid ${T.borderFaint}` }}>
        <div className="aw-container" style={{ paddingTop: menuOpen ? 16 : 0, paddingBottom: menuOpen ? 24 : 0, transition: "padding 0.35s" }}>
          {[["Platform","/#features"],["How it Works","/#how-it-works"],["Resources","/resources"]].map(([label,href]) => (
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
  );

  /* ══════════════════════════════════════════
     SHARED FOOTER
  ══════════════════════════════════════════ */
  const Footer = () => (
    <footer style={{ paddingTop: 80, borderTop: `1px solid ${T.borderFaint}` }}>
      <div className="aw-container">
        <div className="aw-footer-grid" style={{ paddingBottom: 56 }}>
          <div>
            <div style={{ marginBottom: 40 }}>
              <img src={LOGO} alt="AwareOne" style={{ height: 130, width: "auto", display: "block" }}/>
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

          <nav aria-label="Company links">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: "0 0 48px" }}>Company</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              {[{label:"Free Assessment",page:"/assessment"},{label:"Fraud Alerts",page:"/fraud-alerts"},{label:"Resources",page:"/resources"},{label:"Login",page:"/login"}].map(({label,page}) => (
                <li key={page}>
                  <button onClick={() => navigate(page)} style={{ fontSize: 14, color: T.textBody, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.white)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>{label}</button>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Resources links">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: "0 0 48px" }}>Resources</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              {["Security Blog","Case Studies","Compliance Guide","Support Center","Legal"].map((label) => (
                <li key={label}>
                  <button onClick={() => navigate(label === "Legal" ? "/legal" : "/resources")}
                    style={{ fontSize: 14, color: T.textBody, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = T.white)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>{label}</button>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: "0 0 48px" }}>Contact</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              <li>
                <a href={`mailto:${footerEmail}`} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: T.textBody, textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = T.white)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                  <Mail size={14} style={{ color: T.textMuted, flexShrink: 0 }}/>{footerEmail}
                </a>
              </li>
              <li>
                <a href={`tel:${footerPhone.replace(/\s/g,"")}`} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: T.textBody, textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = T.white)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                  <Phone size={14} style={{ color: T.textMuted, flexShrink: 0 }}/>{footerPhone}
                </a>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: T.textBody }}>
                <MapPin size={14} style={{ color: T.textMuted, flexShrink: 0 }}/>Riyadh, Saudi Arabia
              </li>
            </ul>
          </div>
        </div>

        <div className="aw-footer-bottom" style={{ padding: "32px 0", borderTop: `1px solid ${T.borderFaint}` }}>
          <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>{footerCopy}</p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {["Privacy Policy","Terms of Service","Cookies"].map(label => (
              <a key={label} href="#" onClick={(e) => { e.preventDefault(); navigate("/legal"); }}
                style={{ fontSize: 13, color: T.textMuted, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.textNav)} onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}>{label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <div dir="ltr" style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: T.white }}>

      {/* ─── GLOBAL STYLES ─── */}
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
        @keyframes aw-spin { to { transform: rotate(360deg); } }
        @keyframes aw-fraud-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
          60%      { box-shadow: 0 0 0 7px rgba(239,68,68,0); }
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

        /* ── layout ── */
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

        /* ── search input ── */
        .aw-search-input { width: 100%; padding: 12px 44px 12px 42px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; font-size: 14px; color: #ffffff; outline: none; transition: background 0.2s, border-color 0.2s, box-shadow 0.2s; font-family: 'Inter', sans-serif; }
        .aw-search-input:focus { background: rgba(255,255,255,0.08); border-color: rgba(200,255,0,0.50); box-shadow: 0 0 0 3px rgba(200,255,0,0.08); }
        .aw-search-input::placeholder { color: rgba(148,163,184,0.40); }

        /* ── select ── */
        .aw-select { padding: 12px 36px 12px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; font-size: 14px; color: #cbd5e1; outline: none; cursor: pointer; font-family: 'Inter', sans-serif; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; transition: border-color 0.2s; min-width: 160px; }
        .aw-select:focus { border-color: rgba(200,255,0,0.50); }
        .aw-select option { background: #1a1e0e; color: #cbd5e1; }

        /* ── article card ── */
        .aw-article-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; cursor: pointer; transition: background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; }
        .aw-article-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(200,255,0,0.22); transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,0.30); }
        .aw-article-card:hover .aw-card-title { color: #c8ff00; }
        .aw-article-card:hover .aw-read-arrow { transform: translateX(4px); }

        .aw-card-title { font-size: 17px; font-weight: 700; color: #ffffff; line-height: 26px; transition: color 0.2s; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .aw-read-arrow { transition: transform 0.25s ease; }

        /* ── grid ── */
        .aw-articles-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 1024px) { .aw-articles-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px)  { .aw-articles-grid { grid-template-columns: 1fr; } }

        /* ── article body ── */
        .aw-prose { font-family: 'Inter', sans-serif; }
        .aw-prose p      { font-size: 16px; color: #94a3b8; line-height: 28px; margin-bottom: 20px; }
        .aw-prose h1     { font-size: 28px; font-weight: 900; color: #ffffff; margin: 36px 0 16px; }
        .aw-prose h2     { font-size: 22px; font-weight: 800; color: #ffffff; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .aw-prose h3     { font-size: 18px; font-weight: 700; color: #ffffff; margin: 20px 0 10px; }
        .aw-prose li     { font-size: 15px; color: #94a3b8; line-height: 26px; margin-bottom: 6px; margin-left: 20px; list-style: disc; }
        .aw-prose strong { color: #ffffff; font-weight: 700; }

        /* ── category pill ── */
        .aw-cat-pill { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; background: rgba(200,255,0,0.10); color: #c8ff00; border: 1px solid rgba(200,255,0,0.20); white-space: nowrap; }

        /* ── article sticky nav ── */
        .aw-sticky-nav { position: sticky; top: 81px; z-index: 50; background: rgba(18,20,10,0.92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.07); padding: 12px 0; }
      `}</style>

      {/* ─── HEADER ─── */}
      <Header />

      {/* ─── ARTICLE DETAIL VIEW ─── */}
      {selectedArticle ? (
        <div style={{ paddingTop: 81 }}>
          {/* Sub-nav */}
          <div className="aw-sticky-nav">
            <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={closeArticle}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: T.textBody, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.2s", fontFamily: "inherit" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}>
                <ArrowLeft size={16}/> Back to Resources
              </button>
              <button onClick={() => handleShare(selectedArticle)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: copied ? T.accent : T.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "color 0.2s" }}>
                <Share2 size={14}/>{copied ? "Copied!" : "Share"}
              </button>
            </div>
          </div>

          {/* Article body */}
          <article style={{ maxWidth: 860, margin: "0 auto", padding: "52px 24px 80px" }}>
            {/* Meta */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <span className="aw-cat-pill">{selectedArticle.category}</span>
              <span style={{ fontSize: 13, color: T.textMuted }}>{formatDate(selectedArticle.published_at)}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: T.textMuted }}>
                <Clock size={13}/>{readingTime(selectedArticle.content)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: T.textMuted }}>
                <TrendingUp size={13}/>{selectedArticle.view_count} views
              </span>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, color: T.white, lineHeight: 1.2, letterSpacing: "-0.5px", marginBottom: 20 }}>
              {selectedArticle.title}
            </h1>

            {/* Lead */}
            <p style={{ fontSize: 18, color: T.textBody, lineHeight: "30px", marginBottom: 40, borderLeft: `3px solid ${T.accent}`, paddingLeft: 16 }}>
              {selectedArticle.meta_description}
            </p>

            {/* Content */}
            <div className="aw-prose">
              {selectedArticle.content.split("\n").map((line, i) => {
                if (line.startsWith("# "))   return <h1 key={i}>{line.slice(2)}</h1>;
                if (line.startsWith("## "))  return <h2 key={i}>{line.slice(3)}</h2>;
                if (line.startsWith("### ")) return <h3 key={i}>{line.slice(4)}</h3>;
                if (line.startsWith("- "))   return <li key={i}>{line.slice(2)}</li>;
                if (line.trim() === "")      return <br key={i}/>;
                // inline bold
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                if (parts.length > 1) return (
                  <p key={i}>
                    {parts.map((p, j) => p.startsWith("**") && p.endsWith("**")
                      ? <strong key={j}>{p.slice(2,-2)}</strong>
                      : p)}
                  </p>
                );
                return <p key={i}>{line}</p>;
              })}
            </div>

            {/* Tags */}
            {selectedArticle.tags?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "36px 0 0" }}>
                {selectedArticle.tags.map((tag, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", background: T.cardBg, border: `1px solid ${T.borderFaint}`, borderRadius: 9999, fontSize: 12, color: T.textMuted }}>
                    <Tag size={10}/>#{tag}
                  </span>
                ))}
              </div>
            )}

            {/* CTA box */}
            <div style={{ marginTop: 56, background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.18)", borderRadius: 14, padding: "40px", textAlign: "center" }}>
              <h3 style={{ fontSize: 22, fontWeight: 900, color: T.white, marginBottom: 12, letterSpacing: "-0.3px" }}>
                Ready to Strengthen Your Security?
              </h3>
              <p style={{ fontSize: 15, color: T.textBody, lineHeight: "24px", marginBottom: 28, maxWidth: 520, margin: "0 auto 28px" }}>
                {selectedArticle.cta_text}
              </p>
              <button onClick={() => navigate("/login")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", background: T.accent, color: T.bg, fontSize: 15, fontWeight: 700, borderRadius: 10, border: "none", cursor: "pointer", boxShadow: "0 0 20px rgba(200,255,0,0.25)", transition: "opacity 0.2s, transform 0.15s", fontFamily: "inherit" }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity="0.88"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="none"; }}>
                Get Started <ArrowRight size={16}/>
              </button>
            </div>
          </article>

          <Footer/>
        </div>
      ) : (

      /* ─── LIST VIEW ─── */
      <div style={{ paddingTop: 81 }}>
        {/* Hero */}
        <div style={{ position: "relative", padding: "88px 24px 72px", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(200,255,0,0.10) 0%, transparent 65%)", pointerEvents: "none" }}/>
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", background: T.accentAlpha10, border: `1px solid ${T.accentAlpha20}`, borderRadius: 9999, marginBottom: 24 }}>
              <BookOpen size={14} style={{ color: T.accent }}/>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, letterSpacing: "0.6px", textTransform: "uppercase" }}>Security Resources & Insights</span>
            </div>
            <h1 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 900, color: T.white, letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 16 }}>
              Learn. Stay Safe.<br/><span style={{ color: T.accent }}>Stay Secure.</span>
            </h1>
            <p style={{ fontSize: 17, color: T.textBody, lineHeight: "28px", maxWidth: 540, margin: "0 auto" }}>
              Expert articles, guides, and resources to help you understand and defend against cyber threats in the MENA region.
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 32px 96px" }}>

          {/* Search & filter */}
          <div style={{ marginBottom: 40, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }}/>
                <input className="aw-search-input" type="text" placeholder="Search articles, topics, or tags…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex", padding: 2 }}>
                    <X size={15}/>
                  </button>
                )}
              </div>
              {/* Category */}
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
                <Filter size={15} style={{ color: T.textMuted, flexShrink: 0 }}/>
                <select className="aw-select" value={selectedCategory} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Count + clear */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, color: T.textMuted }}>
                <span style={{ color: T.accent, fontWeight: 700 }}>{filtered.length}</span>{" "}
                {filtered.length === 1 ? "article" : "articles"} found
              </p>
              {(searchTerm || selectedCategory !== "all") && (
                <button onClick={() => { setSearchTerm(""); setCategory("all"); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: T.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = T.accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}>
                  <X size={12}/>Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.05)", borderTopColor: T.accent, animation: "aw-spin 0.8s linear infinite" }}/>
              <p style={{ fontSize: 14, color: T.textBody }}>Loading articles…</p>
            </div>

          /* Empty */
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <BookOpen size={28} style={{ color: T.textMuted }}/>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: T.white, marginBottom: 8 }}>No articles found</h3>
              <p style={{ fontSize: 14, color: T.textBody, marginBottom: 24 }}>Try adjusting your search or filters</p>
              <button onClick={() => { setSearchTerm(""); setCategory("all"); }}
                style={{ padding: "10px 24px", background: T.accent, color: T.bg, fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Clear Filters
              </button>
            </div>

          /* ★ Articles grid — NO images ★ */
          ) : (
            <div className="aw-articles-grid">
              {filtered.map((article) => (
                <article key={article.id} className="aw-article-card" onClick={() => openArticle(article)}>
                  <div style={{ padding: "24px 24px 22px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* Top row: category + date */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <span className="aw-cat-pill">{article.category}</span>
                      <span style={{ fontSize: 12, color: T.textMuted }}>{formatDate(article.published_at)}</span>
                    </div>

                    {/* Title */}
                    <h3 className="aw-card-title">{article.title}</h3>

                    {/* Excerpt */}
                    <p style={{ fontSize: 13, color: T.textBody, lineHeight: "21px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0 }}>
                      {article.excerpt}
                    </p>

                    {/* Tags */}
                    {article.tags?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {article.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} style={{ padding: "2px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9999, fontSize: 11, color: T.textMuted }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer row */}
                    <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.textMuted }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={12}/>{readingTime(article.content)}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <TrendingUp size={12}/>{article.view_count} views
                        </span>
                      </div>
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: T.accent }}>
                        Read <ArrowRight size={13} className="aw-read-arrow"/>
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Bottom CTA */}
          {!loading && filtered.length > 0 && (
            <div style={{ marginTop: 72, background: "rgba(200,255,0,0.03)", border: "1px solid rgba(200,255,0,0.14)", borderRadius: 16, padding: "48px 40px", textAlign: "center" }}>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: T.white, letterSpacing: "-0.4px", marginBottom: 12 }}>
                Want More Security Resources?
              </h2>
              <p style={{ fontSize: 16, color: T.textBody, lineHeight: "26px", maxWidth: 520, margin: "0 auto 32px" }}>
                Join leading organizations improving their cybersecurity posture with our comprehensive training platform.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => navigate("/login")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", background: T.accent, color: T.bg, fontSize: 15, fontWeight: 700, borderRadius: 10, border: "none", cursor: "pointer", boxShadow: "0 0 20px rgba(200,255,0,0.25)", transition: "opacity 0.2s, transform 0.15s", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity="0.88"; e.currentTarget.style.transform="translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="none"; }}>
                  Get Started <ArrowRight size={16}/>
                </button>
                <button onClick={() => navigate("/assessment")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, color: T.white, fontSize: 15, fontWeight: 700, borderRadius: 10, cursor: "pointer", transition: "background 0.2s, transform 0.15s", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.09)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.transform="none"; }}>
                  Free Assessment
                </button>
              </div>
            </div>
          )}
        </div>

        <Footer/>
      </div>
      )}

      <RequestDemoModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)}/>
    </div>
  );
};
