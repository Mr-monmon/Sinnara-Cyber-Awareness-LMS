import { FormEvent, useState, useEffect, ReactNode } from "react";
import {
  Eye, EyeOff, KeyRound, Loader2, ShieldCheck, CheckCircle, ShieldOff, AlertCircle,
  LayoutDashboard, CreditCard, Users, CalendarDays, CalendarCheck, Target,
  Mail, Send, Fish, BadgeCheck,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { buildSameHostRedirectUrl } from "../../lib/browserTenant";
import { checkPassword } from "../../lib/passwordPolicy";
import { PasswordStrengthMeter } from "../../components/PasswordStrengthMeter";
import { TwoFactorSetupModal } from "../../components/auth/TwoFactorSetupModal";
import { useTheme, type ThemeTokens } from "../../contexts/ThemeContext";
import {
  getCompanySubscriptionOverview,
  type CompanySubscriptionOverview,
} from "../../lib/subscription";

/* tokens injected via useTheme() inside the component */

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-acc-input {
    width: 100%;
    padding: 12px 44px 12px 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    font-size: 14px;
    color: #ffffff;
    outline: none;
    font-family: 'Inter', sans-serif;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-acc-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-acc-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-acc-input:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 1000px #1a1e0e inset !important;
    -webkit-text-fill-color: #ffffff !important;
  }

  .aw-acc-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 7px;
    letter-spacing: 0.3px;
    font-family: 'Inter', sans-serif;
  }

  .aw-eye-btn {
    position: absolute; right: 0; top: 0; bottom: 0;
    width: 44px; display: flex; align-items: center; justify-content: center;
    background: none; border: none; cursor: pointer;
    color: #64748b; transition: color 0.18s;
  }
  .aw-eye-btn:hover { color: #cbd5e1; }

  .aw-submit-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 28px;
    background: #c8ff00; color: #12140a;
    font-size: 14px; font-weight: 700;
    border-radius: 10px; border: none; cursor: pointer;
    font-family: 'Inter', sans-serif;
    box-shadow: 0 0 20px rgba(200,255,0,0.22);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-submit-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-submit-btn:disabled {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.25);
    cursor: not-allowed;
    box-shadow: none;
  }

  /* ── Tabs ── */
  .aw-acc-tabs {
    display: flex; gap: 6px; padding: 5px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; width: fit-content; max-width: 100%;
    flex-wrap: wrap;
  }
  .aw-acc-tab {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 18px; border-radius: 9px; border: 1px solid transparent;
    background: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    color: #64748b; transition: all 0.18s; white-space: nowrap;
  }
  .aw-acc-tab:hover:not(.active) { background: rgba(255,255,255,0.05); color: #cbd5e1; }
  .aw-acc-tab.active {
    background: rgba(200,255,0,0.09);
    border-color: rgba(200,255,0,0.28);
    color: #c8ff00;
  }

  /* ── Metric tile ── */
  .aw-acc-tile {
    padding: 15px 16px; border-radius: 12px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    display: flex; flex-direction: column; gap: 9px; min-width: 0;
  }

  @keyframes aw-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== "undefined" && !document.getElementById("aw-account-styles")) {
  const tag = document.createElement("style");
  tag.id = "aw-account-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
const initialForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

/* ─────────────────────────────────────────
   PASSWORD INPUT
───────────────────────────────────────── */
const PasswordField: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  autoComplete: string;
  show: boolean;
  onToggle: () => void;
  onChange: (val: string) => void;
}> = ({ label, value, placeholder, autoComplete, show, onToggle, onChange }) => (
  <div>
    <label className="aw-acc-label">{label}</label>
    <div style={{ position: 'relative' }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="aw-acc-input"
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button type="button" className="aw-eye-btn" onClick={onToggle}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  </div>
);

/* ─────────────────────────────────────────
   OVERVIEW — helpers & presentational parts
───────────────────────────────────────── */
const SUB_TYPE_LABEL: Record<string, string> = {
  POC_3M:    "Proof of Concept — 3 Months",
  MONTHLY_6: "6 Months",
  YEARLY_1:  "1 Year",
  YEARLY_2:  "2 Years",
  CUSTOM:    "Custom",
};

const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(String(value).slice(0, 10));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtNum = (n?: number | null) => (n === null || n === undefined ? "—" : n.toLocaleString("en-US"));

/** Usage meter. Colour escalates as the limit is approached. */
const UsageBar: React.FC<{ used: number; limit: number; T: ThemeTokens }> = ({ used, limit, T }) => {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  const pct = Math.round(ratio * 100);
  const tone = ratio >= 1 ? T.red : ratio >= 0.8 ? T.gold : T.green;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ height: 6, borderRadius: 9999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: tone, borderRadius: 9999, transition: "width 0.45s ease" }} />
      </div>
      <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
        {fmtNum(used)} of {fmtNum(limit)} used · {pct}%
      </span>
    </div>
  );
};

/** A single label/value tile, optionally with a usage meter underneath. */
const Tile: React.FC<{
  icon: React.ElementType;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
  used?: number | null;
  limit?: number | null;
  T: ThemeTokens;
}> = ({ icon: Icon, label, value, hint, tone, used, limit, T }) => {
  const showBar = typeof used === "number" && typeof limit === "number" && limit > 0;
  return (
    <div className="aw-acc-tile">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={13} style={{ color: tone || T.textMuted, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.4px", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: tone || T.white, lineHeight: "24px", wordBreak: "break-word" }}>
        {value}
      </div>
      {showBar && <UsageBar used={used as number} limit={limit as number} T={T} />}
      {hint && !showBar && <span style={{ fontSize: 11, color: T.textMuted }}>{hint}</span>}
    </div>
  );
};

/** Card wrapper matching the existing password / 2FA cards. */
const Card: React.FC<{
  icon: React.ElementType; title: string; subtitle?: string;
  right?: ReactNode; children: ReactNode; delay?: string; T: ThemeTokens;
}> = ({ icon: Icon, title, subtitle, right, children, delay, T }) => (
  <div className="aw-fade-up" style={{ animationDelay: delay, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.borderFaint}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: T.borderFaint, border: `1px solid ${T.borderFaint}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} style={{ color: T.textLabel }} />
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: "0 0 2px" }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>{subtitle}</p>}
      </div>
      {right}
    </div>
    <div style={{ padding: "18px 22px" }}>{children}</div>
  </div>
);

const TILE_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
const AccountSettings = () => {
  const { user, logout } = useAuth();
  const { tokens: T } = useTheme();
  const [formData, setFormData]     = useState(initialForm);
  const [showPassword, setShowPassword] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [error, setError]           = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /*
   * This screen is shared with the employee dashboard, which is how employees
   * ended up seeing their company's subscription type, licence limit and
   * contract dates. Billing is an administrator concern, so the Overview tab
   * only exists for company admins — everyone else gets Security alone.
   *
   * The real boundary is RLS (see 20260620000002_restrict_billing_reads_to_admins),
   * which now refuses these rows to non-admins. This check is what stops the
   * request being made at all, so a non-admin doesn't sit through a load that
   * can only end in an empty panel.
   */
  const canViewBilling =
    user?.role === "COMPANY_ADMIN" ||
    user?.role === "COMPANY_SUPER_ADMIN" ||
    user?.role === "PLATFORM_ADMIN";

  // ── Overview (subscription + phishing limits) ────────────────────────
  const [tab, setTab] = useState<"overview" | "security">(canViewBilling ? "overview" : "security");
  const [overview, setOverview] = useState<CompanySubscriptionOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(canViewBilling);

  useEffect(() => {
    let cancelled = false;
    const companyId = user?.company_id;
    if (!canViewBilling || !companyId) { setOverviewLoading(false); return; }
    setOverviewLoading(true);
    getCompanySubscriptionOverview(companyId)
      .then(res => { if (!cancelled) setOverview(res); })
      .catch(err => { console.warn("[AccountSettings] overview load failed", err); })
      .finally(() => { if (!cancelled) setOverviewLoading(false); });
    return () => { cancelled = true; };
  }, [user?.company_id, canViewBilling]);

  /*
   * A role change mid-session (or a profile that loads after first render) must
   * not leave a non-admin parked on a tab they can no longer see.
   */
  useEffect(() => {
    if (!canViewBilling && tab === "overview") setTab("security");
  }, [canViewBilling, tab]);

  // ── MFA state ────────────────────────────────────────────────────────
  const [mfaEnrolled, setMfaEnrolled] = useState<boolean | null>(null);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);

  const loadMfaStatus = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const totpFactors = data?.totp ?? [];
    const verified = totpFactors.some((f) => f.status === "verified");
    setMfaEnrolled(verified);
  };

  useEffect(() => { void loadMfaStatus(); }, []);

  const handleDisableMfa = async () => {
    if (user?.mfa_enforced) {
      alert("Your administrator has enforced MFA on your account. You cannot disable it yourself.");
      return;
    }
    if (!confirm("Disable two-factor authentication on your account? You can re-enable it anytime.")) return;
    setMfaBusy(true);
    setMfaMessage(null);
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factors = factorsData?.all ?? factorsData?.totp ?? [];
      for (const f of factors) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      setMfaEnrolled(false);
      setMfaMessage("Two-factor authentication has been disabled.");
    } catch (e) {
      setMfaMessage(e instanceof Error ? e.message : "Failed to disable 2FA");
    } finally {
      setMfaBusy(false);
    }
  };

  const toggleShow = (field: keyof typeof showPassword) =>
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));

  const setField = (field: keyof typeof formData, val: string) =>
    setFormData(prev => ({ ...prev, [field]: val }));

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!user?.id) { setError("Unable to identify the current user. Please sign in again."); return; }
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) { setError("Please complete all password fields."); return; }
    const policy = checkPassword(formData.newPassword, user.email);
    if (!policy.valid) { setError(`New password does not meet the policy: ${policy.errors.join(", ")}.`); return; }
    if (formData.newPassword !== formData.confirmPassword) { setError("New password and confirmation do not match."); return; }
    if (formData.currentPassword === formData.newPassword) { setError("New password must be different from the current password."); return; }

    setIsSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: formData.currentPassword });
      if (signInError) { setError("Current password is incorrect."); return; }

      const { error: updateError } = await supabase.auth.updateUser({ password: formData.newPassword });
      if (updateError) throw updateError;

      try {
        await supabase.from("audit_logs").insert([{
          user_id: user.id, action_type: "CHANGE_PASSWORD",
          entity_type: "USER", entity_id: user.id,
          company_id: user.company_id ?? null,
          description: `Changed password for ${user.email}`,
        }]);
      } catch { /* intentional */ }

      setFormData(initialForm);
      alert("Password updated successfully. Please sign in again.");
      await logout();
      window.location.href = buildSameHostRedirectUrl(window.location.href, "/login");
    } catch {
      setError("Failed to update password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.accent + '14', border: `1px solid ${T.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} style={{ color: T.accent }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
            Account Settings
          </h1>
        </div>
        <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
          {canViewBilling
            ? 'Review your company subscription and manage your account security.'
            : 'Manage your account security.'}
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="aw-fade-up aw-acc-tabs" style={{ animationDelay: '0.03s' }}>
        {([
          ...(canViewBilling ? [{ key: 'overview' as const, label: 'Overview', Icon: LayoutDashboard }] : []),
          { key: 'security' as const, label: 'Security',  Icon: ShieldCheck     },
        ]).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={`aw-acc-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ══════════════ OVERVIEW TAB (company admins only) ══════════════ */}
      {canViewBilling && tab === 'overview' && (
        overviewLoading ? (
          <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '28px 22px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, color: T.textMuted, fontSize: 13 }}>
            <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
            Loading subscription details…
          </div>
        ) : (
          <>
            {/* ── Subscription ── */}
            <Card
              T={T} delay="0.05s" icon={CreditCard}
              title="Subscription"
              subtitle="Your company's current plan and licensing."
              right={(() => {
                const s = overview?.subscription;
                if (!s) return null;
                const cfg = s.expired
                  ? { c: T.red,   bg: T.redBg,   b: T.redBorder,   label: 'Expired' }
                  : !s.is_active
                    ? { c: T.gold, bg: T.goldBg, b: T.goldBorder, label: 'Inactive' }
                    : s.expires_soon
                      ? { c: T.gold, bg: T.goldBg, b: T.goldBorder, label: `Expires in ${s.days_remaining} day${s.days_remaining === 1 ? '' : 's'}` }
                      : { c: T.green, bg: T.greenBg, b: T.greenBorder, label: 'Active' };
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 9999, background: cfg.bg, border: `1px solid ${cfg.b}`, color: cfg.c, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    <BadgeCheck size={12} /> {cfg.label}
                  </span>
                );
              })()}
            >
              {overview?.subscription ? (
                <div style={TILE_GRID}>
                  <Tile T={T} icon={CreditCard} label="Subscription Type"
                    value={SUB_TYPE_LABEL[overview.subscription.subscription_type] || overview.subscription.subscription_type || '—'} />
                  <Tile T={T} icon={Users} label="License Limit"
                    value={fmtNum(overview.subscription.license_count)}
                    used={overview.licensesUsed} limit={overview.subscription.license_count}
                    hint="Employee accounts included in your plan" />
                  <Tile T={T} icon={CalendarDays} label="Start Date"
                    value={fmtDate(overview.subscription.start_date)} />
                  <Tile T={T} icon={CalendarCheck} label="End Date"
                    value={fmtDate(overview.subscription.end_date)}
                    tone={overview.subscription.expired ? T.red : undefined}
                    hint={overview.subscription.expired
                      ? 'Subscription period has ended'
                      : `${overview.subscription.days_remaining} day${overview.subscription.days_remaining === 1 ? '' : 's'} remaining`} />
                </div>
              ) : (
                <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
                  No subscription details are available for your company. Please contact your account manager.
                </p>
              )}
            </Card>

            {/* ── Phishing limits ── */}
            <Card
              T={T} delay="0.10s" icon={Fish}
              title="Company Phishing Limits"
              subtitle="Simulation quotas allocated to your company."
              right={overview?.phishing ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 9999, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  <Target size={12} /> {overview.phishing.phishing_mode === 'TICKET' ? 'Managed (Ticket)' : 'Self-service'}
                </span>
              ) : null}
            >
              {overview?.phishing ? (
                <div style={TILE_GRID}>
                  <Tile T={T} icon={Target} label="Phishing Mode"
                    value={overview.phishing.phishing_mode === 'TICKET' ? 'Ticket' : 'Custom'}
                    hint={overview.phishing.phishing_mode === 'TICKET'
                      ? 'Campaigns are run for you by the platform team'
                      : 'You build and launch campaigns yourself'} />
                  <Tile T={T} icon={Send} label="Max Campaigns / Year"
                    value={fmtNum(overview.phishing.max_campaigns_per_year)}
                    used={overview.phishing.campaigns_used_this_year}
                    limit={overview.phishing.max_campaigns_per_year} />
                  <Tile T={T} icon={Mail} label="Max Emails / Month"
                    value={fmtNum(overview.phishing.max_emails_per_month)}
                    used={overview.phishing.emails_sent_this_month}
                    limit={overview.phishing.max_emails_per_month} />
                  <Tile T={T} icon={Users} label="Max Targets / Campaign"
                    value={fmtNum(overview.phishing.max_targets_per_campaign)}
                    hint="Recipients allowed in a single campaign" />
                </div>
              ) : (
                <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
                  No phishing limits are configured for your company yet.
                </p>
              )}
            </Card>
          </>
        )
      )}

      {/* ══════════════ SECURITY TAB ══════════════ */}
      {tab === 'security' && (
      <>
      {/* ── User info card ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.05s', padding: '18px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.accent + '14', border: `1px solid ${T.accent}2e`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.accent }}>
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 2px' }}>
            {user?.full_name || 'Current User'}
          </p>
          <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>{user?.email || '—'}</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: T.accent + '12', border: `1px solid ${T.accent}2e`, borderRadius: 9999, fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {user?.role?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* ── Password form ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.10s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>

        {/* Form header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: T.borderFaint, border: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KeyRound size={16} style={{ color: T.textLabel }} />
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 2px' }}>Change Password</h2>
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>Enter your current password, then choose a new one.</p>
          </div>
        </div>

        {/* Fields */}
        <form onSubmit={handleChangePassword}>
          <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>

            <PasswordField
              label="Current Password"
              value={formData.currentPassword}
              placeholder="Enter your current password"
              autoComplete="current-password"
              show={showPassword.currentPassword}
              onToggle={() => toggleShow('currentPassword')}
              onChange={val => setField('currentPassword', val)}
            />

            {/* Tip */}
            <div style={{ padding: '14px 16px', background: T.accent + '0a', border: `1px solid ${T.accent}1f`, borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <CheckCircle size={15} style={{ color: T.accent, flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: T.textBody, lineHeight: '20px', margin: 0 }}>
                Use at least 10 characters with upper, lower, number, and symbol.
              </p>
            </div>

            <div>
              <PasswordField
                label="New Password"
                value={formData.newPassword}
                placeholder="Enter a new password"
                autoComplete="new-password"
                show={showPassword.newPassword}
                onToggle={() => toggleShow('newPassword')}
                onChange={val => setField('newPassword', val)}
              />
              <PasswordStrengthMeter password={formData.newPassword} email={user?.email} />
            </div>

            <PasswordField
              label="Confirm New Password"
              value={formData.confirmPassword}
              placeholder="Re-enter the new password"
              autoComplete="new-password"
              show={showPassword.confirmPassword}
              onToggle={() => toggleShow('confirmPassword')}
              onChange={val => setField('confirmPassword', val)}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{ margin: '0 24px 16px', padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, fontSize: 13, color: '#f87171', fontFamily: 'inherit' }}>
              {error}
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={isSubmitting} className="aw-submit-btn">
              {isSubmitting ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Updating…
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Two-Factor Authentication ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.15s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: T.borderFaint, border: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={16} style={{ color: T.textLabel }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 2px' }}>Two-Factor Authentication (2FA)</h2>
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
              Add an extra layer of security with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy).
            </p>
          </div>
          {mfaEnrolled !== null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              borderRadius: 9999, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
              background: mfaEnrolled ? 'rgba(52,211,153,0.10)' : 'rgba(251,146,60,0.10)',
              border: mfaEnrolled ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(251,146,60,0.25)',
              color: mfaEnrolled ? '#34d399' : '#fb923c',
            }}>
              {mfaEnrolled ? <><CheckCircle size={12} /> Enabled</> : <><AlertCircle size={12} /> Disabled</>}
            </span>
          )}
        </div>

        <div style={{ padding: '20px 24px' }}>
          {user?.mfa_enforced && !mfaEnrolled && (
            <div style={{ padding: '12px 14px', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.22)', borderRadius: 10, fontSize: 13, color: '#fb923c', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Your administrator requires 2FA on your account. Please set it up now to continue using the platform securely.</span>
            </div>
          )}

          {mfaMessage && (
            <div style={{ padding: '10px 14px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.22)', borderRadius: 10, fontSize: 13, color: '#34d399', marginBottom: 16 }}>
              {mfaMessage}
            </div>
          )}

          {mfaEnrolled === null ? (
            <div style={{ fontSize: 13, color: T.textMuted }}>Loading…</div>
          ) : mfaEnrolled ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, fontSize: 13, color: T.textBody, minWidth: 200 }}>
                Two-factor authentication is currently active on your account. You'll be asked for a 6-digit code from your authenticator app on every sign-in.
              </div>
              {!user?.mfa_enforced && (
                <button
                  onClick={handleDisableMfa}
                  disabled={mfaBusy}
                  className="aw-submit-btn"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                >
                  {mfaBusy ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : <ShieldOff size={15} />}
                  Disable 2FA
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowMfaSetup(true)}
              className="aw-submit-btn"
            >
              <ShieldCheck size={15} /> Enable 2FA
            </button>
          )}
        </div>
      </div>

      </>
      )}

      {showMfaSetup && (
        <TwoFactorSetupModal
          onComplete={() => {
            setShowMfaSetup(false);
            setMfaMessage("Two-factor authentication has been enabled.");
            void loadMfaStatus();
          }}
          onSkip={() => setShowMfaSetup(false)}
        />
      )}
    </div>
  );
};

export default AccountSettings;
