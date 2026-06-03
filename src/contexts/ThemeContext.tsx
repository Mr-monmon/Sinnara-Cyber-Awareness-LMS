import React, { createContext, useContext, useState, useEffect } from "react";

/* ─────────────────────────────────────────
   TOKEN INTERFACE
───────────────────────────────────────── */
export interface ThemeTokens {
  bg:          string;
  bgCard:      string;
  bgDeep:      string;
  accent:      string;
  accentDark:  string;
  white:       string;
  textBody:    string;
  textLabel:   string;
  textMuted:   string;
  border:      string;
  borderFaint: string;
  green:       string;
  greenBg:     string;
  greenBorder: string;
  blue:        string;
  blueBg:      string;
  blueBorder:  string;
  orange:      string;
  orangeBg:    string;
  purple:      string;
  purpleBg:    string;
  red:         string;
  redBg:       string;
  redBorder:   string;
  yellow:      string;
  yellowBg:    string;
  yellowBorder:string;
  gold:        string;
  goldBg:      string;
  goldBorder:  string;
  sidebar:     string;
  topbar:      string;
}

/* ─────────────────────────────────────────
   TOKEN SETS
───────────────────────────────────────── */
export const DARK_TOKENS: ThemeTokens = {
  bg:          "#12140a",
  bgCard:      "#1a1e0e",
  bgDeep:      "#0e100a",
  accent:      "#c8ff00",
  accentDark:  "#12140a",
  white:       "#ffffff",
  textBody:    "#cbd5e1",
  textLabel:   "#cbd5e1",
  textMuted:   "#64748b",
  border:      "rgba(255,255,255,0.09)",
  borderFaint: "rgba(255,255,255,0.05)",
  green:       "#34d399",
  greenBg:     "rgba(52,211,153,0.08)",
  greenBorder: "rgba(52,211,153,0.22)",
  blue:        "#60a5fa",
  blueBg:      "rgba(96,165,250,0.08)",
  blueBorder:  "rgba(96,165,250,0.22)",
  orange:      "#fb923c",
  orangeBg:    "rgba(251,146,60,0.08)",
  purple:      "#a78bfa",
  purpleBg:    "rgba(167,139,250,0.08)",
  red:         "#f87171",
  redBg:       "rgba(248,113,113,0.08)",
  redBorder:   "rgba(248,113,113,0.22)",
  yellow:      "#fbbf24",
  yellowBg:    "rgba(251,191,36,0.08)",
  yellowBorder:"rgba(251,191,36,0.22)",
  gold:        "#fbbf24",
  goldBg:      "rgba(251,191,36,0.08)",
  goldBorder:  "rgba(251,191,36,0.22)",
  sidebar:     "#0e100a",
  topbar:      "rgba(18,20,10,0.95)",
};

export const LIGHT_TOKENS: ThemeTokens = {
  bg:          "#f1f5f9",
  bgCard:      "#ffffff",
  bgDeep:      "#e2e8f0",
  accent:      "#16a34a",
  accentDark:  "#ffffff",
  white:       "#0f172a",
  textBody:    "#334155",
  textLabel:   "#475569",
  textMuted:   "#94a3b8",
  border:      "rgba(0,0,0,0.09)",
  borderFaint: "rgba(0,0,0,0.05)",
  green:       "#16a34a",
  greenBg:     "rgba(22,163,74,0.08)",
  greenBorder: "rgba(22,163,74,0.22)",
  blue:        "#2563eb",
  blueBg:      "rgba(37,99,235,0.08)",
  blueBorder:  "rgba(37,99,235,0.22)",
  orange:      "#ea580c",
  orangeBg:    "rgba(234,88,12,0.08)",
  purple:      "#7c3aed",
  purpleBg:    "rgba(124,58,237,0.08)",
  red:         "#dc2626",
  redBg:       "rgba(220,38,38,0.08)",
  redBorder:   "rgba(220,38,38,0.22)",
  yellow:      "#d97706",
  yellowBg:    "rgba(217,119,6,0.08)",
  yellowBorder:"rgba(217,119,6,0.22)",
  gold:        "#d97706",
  goldBg:      "rgba(217,119,6,0.08)",
  goldBorder:  "rgba(217,119,6,0.22)",
  sidebar:     "#ffffff",
  topbar:      "rgba(255,255,255,0.95)",
};

/* ─────────────────────────────────────────
   CSS OVERRIDES FOR LIGHT MODE
   (for CSS-class-based hover/active states)
───────────────────────────────────────── */
const LIGHT_CSS_OVERRIDES = `
  /* ── DashboardLayout menu ── */
  [data-theme="light"] .aw-menu-item { color: #475569; }
  [data-theme="light"] .aw-menu-item:hover { background: rgba(0,0,0,0.04); color: #0f172a; }
  [data-theme="light"] .aw-menu-item.active { background: rgba(22,163,74,0.10); color: #16a34a; }
  [data-theme="light"] .aw-menu-item.parent-active { background: rgba(0,0,0,0.04); color: #0f172a; }
  [data-theme="light"] .aw-child-item { color: #64748b; }
  [data-theme="light"] .aw-child-item:hover { background: rgba(0,0,0,0.03); color: #334155; }
  [data-theme="light"] .aw-child-item.active { background: rgba(22,163,74,0.08); color: #16a34a; }
  [data-theme="light"] .aw-section-label { color: #94a3b8; }

  /* ── EmployeeDashboard quick-action buttons ── */
  [data-theme="light"] .aw-d-qbtn { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.07); }
  [data-theme="light"] .aw-d-qbtn:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12); transform: translateX(3px); }

  /* ── Course cards ── */
  [data-theme="light"] .aw-course-card { background: #ffffff; border-color: rgba(0,0,0,0.08); }
  [data-theme="light"] .aw-course-card:hover { border-color: rgba(22,163,74,0.30); box-shadow: 0 10px 30px rgba(0,0,0,0.10); }

  /* ── Exam cards ── */
  [data-theme="light"] .aw-exam-card { background: #ffffff; border-color: rgba(0,0,0,0.08); }
  [data-theme="light"] .aw-exam-card.can-take:hover { border-color: rgba(22,163,74,0.30); box-shadow: 0 10px 30px rgba(0,0,0,0.10); }

  /* ── Certificate cards ── */
  [data-theme="light"] .aw-cert-card { background: #ffffff; border-color: rgba(0,0,0,0.08); }
  [data-theme="light"] .aw-cert-card:hover { border-color: rgba(217,119,6,0.35); box-shadow: 0 12px 36px rgba(0,0,0,0.12); }
  [data-theme="light"] .aw-dl-btn { background: rgba(217,119,6,0.10); border-color: rgba(217,119,6,0.28); color: #d97706; }
  [data-theme="light"] .aw-dl-btn:hover:not(:disabled) { background: rgba(217,119,6,0.18); }

  /* ── CourseViewer section items ── */
  [data-theme="light"] .aw-section-item.current { background: rgba(22,163,74,0.08); border-color: rgba(22,163,74,0.22); }
  [data-theme="light"] .aw-section-item.completed:not(.current) { background: rgba(22,163,74,0.05); border-color: rgba(22,163,74,0.15); }
  [data-theme="light"] .aw-section-item:not(:disabled):not(.current):not(.completed):hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.09); }

  /* ── CourseViewer quiz options ── */
  [data-theme="light"] .aw-quiz-option { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.08); color: #334155; }
  [data-theme="light"] .aw-quiz-option:hover { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.13); }
  [data-theme="light"] .aw-quiz-option.selected { background: rgba(22,163,74,0.08); border-color: rgba(22,163,74,0.40); color: #0f172a; }

  /* ── CourseViewer action buttons ── */
  [data-theme="light"] .aw-btn-accent { background: #16a34a; color: #ffffff; box-shadow: 0 0 20px rgba(22,163,74,0.22); }
  [data-theme="light"] .aw-btn-green { background: rgba(22,163,74,0.10); border-color: rgba(22,163,74,0.28); color: #16a34a; }
  [data-theme="light"] .aw-btn-green:hover { background: rgba(22,163,74,0.18); }

  /* ── ExamViewer option buttons ── */
  [data-theme="light"] .aw-option-btn { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.09); color: #334155; }
  [data-theme="light"] .aw-option-btn:hover { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.14); }
  [data-theme="light"] .aw-option-btn.selected { background: rgba(22,163,74,0.09); border-color: rgba(22,163,74,0.42); color: #0f172a; }

  /* ── ExamViewer nav dots ── */
  [data-theme="light"] .aw-nav-dot.current { background: #16a34a; color: #ffffff; }
  [data-theme="light"] .aw-nav-dot.answered { background: rgba(22,163,74,0.14); color: #16a34a; border-color: rgba(22,163,74,0.28); }
  [data-theme="light"] .aw-nav-dot.unanswered { background: rgba(0,0,0,0.04); color: #64748b; border-color: rgba(0,0,0,0.07); }
  [data-theme="light"] .aw-nav-dot.unanswered:hover { background: rgba(0,0,0,0.08); color: #334155; }

  /* ── ExamViewer primary button ── */
  [data-theme="light"] .aw-btn-primary { background: #16a34a; color: #ffffff; box-shadow: 0 0 20px rgba(22,163,74,0.22); }

  /* ── AccountSettings inputs ── */
  [data-theme="light"] .aw-acc-input { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.09); color: #0f172a; }
  [data-theme="light"] .aw-acc-input:focus { border-color: rgba(22,163,74,0.50); box-shadow: 0 0 0 3px rgba(22,163,74,0.08); background: rgba(0,0,0,0.04); }
  [data-theme="light"] .aw-acc-input::placeholder { color: rgba(71,85,105,0.45); }
  [data-theme="light"] .aw-acc-input:-webkit-autofill,
  [data-theme="light"] .aw-acc-input:-webkit-autofill:hover,
  [data-theme="light"] .aw-acc-input:-webkit-autofill:focus { -webkit-text-fill-color: #0f172a; }
`;

/* ─────────────────────────────────────────
   CONTEXT
───────────────────────────────────────── */
interface ThemeContextValue {
  isDark: boolean;
  tokens: ThemeTokens;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  tokens: DARK_TOKENS,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/* ─────────────────────────────────────────
   PROVIDER
───────────────────────────────────────── */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("aw-theme");
      return saved !== null ? saved === "dark" : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    try { localStorage.setItem("aw-theme", isDark ? "dark" : "light"); } catch {}

    /* Inject / update light-mode CSS overrides */
    const STYLE_ID = "aw-theme-overrides";
    let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = STYLE_ID;
      document.head.appendChild(tag);
    }
    tag.textContent = isDark ? "" : LIGHT_CSS_OVERRIDES;
  }, [isDark]);

  const toggleTheme = () => setIsDark((v) => !v);

  return (
    <ThemeContext.Provider value={{ isDark, tokens: isDark ? DARK_TOKENS : LIGHT_TOKENS, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
