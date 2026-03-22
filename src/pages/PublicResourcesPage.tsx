import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Clock,
  TrendingUp,
  ArrowRight,
  Search,
  X,
  ArrowLeft,
  ExternalLink,
  Share2,
  Filter,
  Tag,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

/* ─────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────── */
const T = {
  bg: "#12140a",
  bgCard: "#1a1e0e",
  accent: "#c8ff00",
  accentDark: "#12140a",
  white: "#ffffff",
  textBody: "#94a3b8",
  textLabel: "#cbd5e1",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.10)",
  borderFaint: "rgba(255,255,255,0.05)",
  cardBg: "rgba(255,255,255,0.03)",
} as const;

/* ─────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── search input ── */
  .aw-search-input {
    width: 100%;
    padding: 12px 44px 12px 42px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px;
    font-size: 14px;
    color: #ffffff;
    outline: none;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    font-family: 'Inter', sans-serif;
  }
  .aw-search-input:focus {
    background: rgba(255,255,255,0.08);
    border-color: rgba(200,255,0,0.50);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.08);
  }
  .aw-search-input::placeholder { color: rgba(148,163,184,0.40); }

  /* ── select ── */
  .aw-select {
    padding: 12px 36px 12px 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px;
    font-size: 14px;
    color: #cbd5e1;
    outline: none;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    transition: border-color 0.2s;
    min-width: 160px;
  }
  .aw-select:focus { border-color: rgba(200,255,0,0.50); }
  .aw-select option { background: #1a1e0e; color: #cbd5e1; }

  /* ── article card ── */
  .aw-article-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
  }
  .aw-article-card:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(200,255,0,0.20);
    transform: translateY(-3px);
    box-shadow: 0 16px 40px rgba(0,0,0,0.30);
  }
  .aw-article-card:hover .aw-card-title { color: #c8ff00; }
  .aw-article-card:hover .aw-read-arrow { transform: translateX(4px); }

  .aw-card-title {
    font-size: 17px;
    font-weight: 700;
    color: #ffffff;
    line-height: 26px;
    transition: color 0.2s;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .aw-read-arrow { transition: transform 0.25s ease; }

  /* ── articles grid ── */
  .aw-articles-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  @media (max-width: 1024px) { .aw-articles-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px)  { .aw-articles-grid { grid-template-columns: 1fr; } }

  /* ── article body prose ── */
  .aw-prose { font-family: 'Inter', sans-serif; }
  .aw-prose p   { font-size: 16px; color: #94a3b8; line-height: 28px; margin-bottom: 20px; }
  .aw-prose h1  { font-size: 28px; font-weight: 900; color: #ffffff; margin: 36px 0 16px; }
  .aw-prose h2  { font-size: 22px; font-weight: 800; color: #ffffff; margin: 28px 0 12px; }
  .aw-prose h3  { font-size: 18px; font-weight: 700; color: #ffffff; margin: 20px 0 10px; }
  .aw-prose li  { font-size: 15px; color: #94a3b8; line-height: 26px; margin-bottom: 6px; margin-left: 20px; list-style: disc; }
  .aw-prose strong { color: #ffffff; font-weight: 700; }
  .aw-prose br { display: block; margin-bottom: 8px; }

  /* ── category pill ── */
  .aw-cat-pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    background: rgba(200,255,0,0.10);
    color: #c8ff00;
    border: 1px solid rgba(200,255,0,0.20);
    white-space: nowrap;
  }

  /* ── sticky article nav ── */
  .aw-sticky-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(18,20,10,0.90);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding: 14px 0;
  }

  @keyframes aw-spin { to { transform: rotate(360deg); } }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("aw-resources-styles")
) {
  const tag = document.createElement("style");
  tag.id = "aw-resources-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

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
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: T.bg,
  fontFamily: "'Inter', sans-serif",
};

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

/* ─────────────────────────────────────────
   BACK BUTTON
───────────────────────────────────────── */
const BackBtn: React.FC<{ label: string; onClick: () => void }> = ({
  label,
  onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14,
      color: T.textBody,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      transition: "color 0.2s",
      fontFamily: "inherit",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
    onMouseLeave={(e) => (e.currentTarget.style.color = T.textBody)}
  >
    <ArrowLeft size={16} /> {label}
  </button>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PublicResourcesPage = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filtered, setFiltered] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setCategory] = useState("all");
  const [selectedArticle, setSelected] = useState<Article | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadArticles();
    const hash = window.location.hash.substring(1);
    if (hash) loadArticleBySlug(hash);
  }, []);

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
    } catch (err) {
      console.error(err);
    }
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
  };

  const handleShare = async (article: Article) => {
    const url = `${window.location.origin}/resources#${article.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.excerpt,
          url,
        });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ══════════
     ARTICLE DETAIL
  ══════════ */
  if (selectedArticle) {
    return (
      <div style={pageStyle}>
        {/* Sticky top bar */}
        <div className="aw-sticky-nav">
          <div
            style={{
              maxWidth: 860,
              margin: "0 auto",
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <BackBtn label="Back to Resources" onClick={closeArticle} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => navigate("/")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: T.textMuted,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.textBody)}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = T.textMuted)
                }
              >
                <ArrowLeft size={14} /> Home
              </button>
              <span style={{ color: T.borderFaint }}>|</span>
              <button
                onClick={() => handleShare(selectedArticle)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: copied ? T.accent : T.textMuted,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "color 0.2s",
                }}
              >
                <Share2 size={14} />
                {copied ? "Copied!" : "Share"}
              </button>
            </div>
          </div>
        </div>

        {/* Article body */}
        <article
          style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 80px" }}
        >
          {/* Meta row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <span className="aw-cat-pill">{selectedArticle.category}</span>
            <span style={{ fontSize: 13, color: T.textMuted }}>
              {formatDate(selectedArticle.published_at)}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
                color: T.textMuted,
              }}
            >
              <Clock size={13} /> {readingTime(selectedArticle.content)}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
                color: T.textMuted,
              }}
            >
              <TrendingUp size={13} /> {selectedArticle.view_count} views
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "clamp(26px,4vw,42px)",
              fontWeight: 900,
              color: T.white,
              lineHeight: 1.2,
              letterSpacing: "-0.5px",
              marginBottom: 16,
            }}
          >
            {selectedArticle.title}
          </h1>

          {/* Meta description */}
          <p
            style={{
              fontSize: 18,
              color: T.textBody,
              lineHeight: "30px",
              marginBottom: 32,
              borderLeft: `3px solid ${T.accent}`,
              paddingLeft: 16,
            }}
          >
            {selectedArticle.meta_description}
          </p>

          {/* Featured image */}
          {selectedArticle.featured_image_url && (
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: 36,
                border: `1px solid ${T.border}`,
              }}
            >
              <img
                src={selectedArticle.featured_image_url}
                alt={selectedArticle.title}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          )}

          {/* Content */}
          <div className="aw-prose">
            {selectedArticle.content.split("\n").map((line, i) => {
              if (line.startsWith("# "))
                return <h1 key={i}>{line.slice(2)}</h1>;
              if (line.startsWith("## "))
                return <h2 key={i}>{line.slice(3)}</h2>;
              if (line.startsWith("### "))
                return <h3 key={i}>{line.slice(4)}</h3>;
              if (line.startsWith("**") && line.endsWith("**"))
                return (
                  <p key={i}>
                    <strong>{line.replace(/\*\*/g, "")}</strong>
                  </p>
                );
              if (line.startsWith("- "))
                return <li key={i}>{line.slice(2)}</li>;
              if (line.trim() === "") return <br key={i} />;
              return <p key={i}>{line}</p>;
            })}
          </div>

          {/* Tags */}
          {selectedArticle.tags?.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                margin: "32px 0",
              }}
            >
              {selectedArticle.tags.map((tag, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 12px",
                    background: T.cardBg,
                    border: `1px solid ${T.borderFaint}`,
                    borderRadius: 9999,
                    fontSize: 12,
                    color: T.textMuted,
                  }}
                >
                  <Tag size={10} />#{tag}
                </span>
              ))}
            </div>
          )}

          {/* Article CTA */}
          <div
            style={{
              marginTop: 48,
              background: "rgba(200,255,0,0.04)",
              border: "1px solid rgba(200,255,0,0.18)",
              borderRadius: 14,
              padding: "36px",
              textAlign: "center",
            }}
          >
            <h3
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: T.white,
                marginBottom: 12,
                letterSpacing: "-0.3px",
              }}
            >
              Ready to Strengthen Your Security?
            </h3>
            <p
              style={{
                fontSize: 15,
                color: T.textBody,
                lineHeight: "24px",
                marginBottom: 28,
                maxWidth: 520,
                margin: "0 auto 28px",
              }}
            >
              {selectedArticle.cta_text}
            </p>
            <button
              onClick={() => navigate("/login")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 32px",
                background: T.accent,
                color: T.accentDark,
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(200,255,0,0.25)",
                transition: "opacity 0.2s, transform 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.88";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "none";
              }}
            >
              Get Started <ArrowRight size={16} />
            </button>
          </div>
        </article>
      </div>
    );
  }

  /* ══════════
     LIST VIEW
  ══════════ */
  return (
    <div style={pageStyle}>
      {/* ── Hero banner ── */}
      <div
        style={{
          position: "relative",
          padding: "96px 24px 80px",
          overflow: "hidden",
        }}
      >
        {/* Glow */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(200,255,0,0.10) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            textAlign: "center",
            position: "relative",
          }}
        >
          {/* Back to home */}
          <div style={{ position: "absolute", top: -48, left: 0 }}>
            <BackBtn label="Back to Home" onClick={() => navigate("/")} />
          </div>

          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              background: "rgba(200,255,0,0.08)",
              border: "1px solid rgba(200,255,0,0.20)",
              borderRadius: 9999,
              marginBottom: 24,
            }}
          >
            <BookOpen size={14} style={{ color: T.accent }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.accent,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
              }}
            >
              Security Resources & Insights
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(32px,5vw,52px)",
              fontWeight: 900,
              color: T.white,
              letterSpacing: "-0.8px",
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            Learn. Stay Safe.
            <br />
            <span style={{ color: T.accent }}>Stay Secure.</span>
          </h1>
          <p
            style={{
              fontSize: 17,
              color: T.textBody,
              lineHeight: "28px",
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            Expert articles, guides, and resources to help you understand and
            defend against cyber threats in the MENA region.
          </p>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 96px" }}>
        {/* Search & filter bar */}
        <div
          style={{
            marginBottom: 40,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: T.textMuted,
                  pointerEvents: "none",
                }}
              />
              <input
                className="aw-search-input"
                type="text"
                placeholder="Search articles, topics, or tags…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: T.textMuted,
                    display: "flex",
                    padding: 2,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = T.white)}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = T.textMuted)
                  }
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Category select */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Filter size={15} style={{ color: T.textMuted, flexShrink: 0 }} />
              <select
                className="aw-select"
                value={selectedCategory}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p style={{ fontSize: 13, color: T.textMuted }}>
              <span style={{ color: T.accent, fontWeight: 700 }}>
                {filtered.length}
              </span>{" "}
              {filtered.length === 1 ? "article" : "articles"} found
              {selectedCategory !== "all" && (
                <span style={{ color: T.textMuted }}>
                  {" "}
                  in{" "}
                  <span style={{ color: T.textLabel }}>{selectedCategory}</span>
                </span>
              )}
            </p>
            {(searchTerm || selectedCategory !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setCategory("all");
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: T.textMuted,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.accent)}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = T.textMuted)
                }
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── States ── */}
        {loading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 0",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: `3px solid rgba(255,255,255,0.05)`,
                borderTopColor: T.accent,
                animation: "aw-spin 0.8s linear infinite",
              }}
            />
            <p style={{ fontSize: 14, color: T.textBody }}>Loading articles…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid rgba(255,255,255,0.08)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <BookOpen size={28} style={{ color: T.textMuted }} />
            </div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: T.white,
                marginBottom: 8,
              }}
            >
              No articles found
            </h3>
            <p style={{ fontSize: 14, color: T.textBody, marginBottom: 24 }}>
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setCategory("all");
              }}
              style={{
                padding: "10px 24px",
                background: T.accent,
                color: T.accentDark,
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          /* ── Articles grid ── */
          <div className="aw-articles-grid">
            {filtered.map((article) => (
              <article
                key={article.id}
                className="aw-article-card"
                onClick={() => openArticle(article)}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    height: 180,
                    background: "rgba(255,255,255,0.04)",
                    position: "relative",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {article.featured_image_url ? (
                    <img
                      src={article.featured_image_url}
                      alt={article.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background:
                          "linear-gradient(135deg, rgba(200,255,0,0.05) 0%, rgba(255,255,255,0.02) 100%)",
                      }}
                    >
                      <BookOpen
                        size={32}
                        style={{ color: "rgba(200,255,0,0.25)" }}
                      />
                    </div>
                  )}
                  {/* Category overlay */}
                  <div style={{ position: "absolute", top: 12, left: 12 }}>
                    <span className="aw-cat-pill">{article.category}</span>
                  </div>
                </div>

                {/* Body */}
                <div
                  style={{
                    padding: "20px 22px 22px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <h3 className="aw-card-title">{article.title}</h3>

                  <p
                    style={{
                      fontSize: 13,
                      color: T.textBody,
                      lineHeight: "21px",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {article.excerpt}
                  </p>

                  {/* Meta */}
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      fontSize: 12,
                      color: T.textMuted,
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Clock size={12} /> {readingTime(article.content)}
                    </span>
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <TrendingUp size={12} /> {article.view_count} views
                    </span>
                  </div>

                  {/* Tags */}
                  {article.tags?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {article.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "2px 8px",
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid rgba(255,255,255,0.07)`,
                            borderRadius: 9999,
                            fontSize: 11,
                            color: T.textMuted,
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Read link */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 8,
                      borderTop: `1px solid rgba(255,255,255,0.05)`,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.accent,
                    }}
                  >
                    Read Article
                    <ArrowRight size={14} className="aw-read-arrow" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ── Bottom CTA ── */}
        {!loading && filtered.length > 0 && (
          <div
            style={{
              marginTop: 64,
              background: "rgba(200,255,0,0.03)",
              border: "1px solid rgba(200,255,0,0.14)",
              borderRadius: 16,
              padding: "48px 40px",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: T.white,
                letterSpacing: "-0.4px",
                marginBottom: 12,
              }}
            >
              Want More Security Resources?
            </h2>
            <p
              style={{
                fontSize: 16,
                color: T.textBody,
                lineHeight: "26px",
                maxWidth: 520,
                margin: "0 auto 32px",
              }}
            >
              Join leading organizations improving their cybersecurity posture
              with our comprehensive training platform.
            </p>
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => navigate("/login")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 32px",
                  background: T.accent,
                  color: T.accentDark,
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 0 20px rgba(200,255,0,0.25)",
                  transition: "opacity 0.2s, transform 0.15s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.88";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.transform = "none";
                }}
              >
                Get Started <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate("/assessment")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 32px",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${T.border}`,
                  color: T.white,
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "background 0.2s, transform 0.15s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                Take Free Assessment <ExternalLink size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
