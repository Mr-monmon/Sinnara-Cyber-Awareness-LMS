import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, CheckCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { buildSameHostRedirectUrl } from "../../lib/browserTenant";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#94a3b8',
  textLabel:   '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.09)',
  borderFaint: 'rgba(255,255,255,0.05)',
} as const;

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

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
const AccountSettings = () => {
  const { user, logout } = useAuth();
  const [formData, setFormData]     = useState(initialForm);
  const [showPassword, setShowPassword] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [error, setError]           = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleShow = (field: keyof typeof showPassword) =>
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));

  const setField = (field: keyof typeof formData, val: string) =>
    setFormData(prev => ({ ...prev, [field]: val }));

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!user?.id) { setError("Unable to identify the current user. Please sign in again."); return; }
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) { setError("Please complete all password fields."); return; }
    if (formData.newPassword.length < 6) { setError("New password must be at least 6 characters long."); return; }
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
          description: `Changed password for ${user.email}`,
        }]);
      } catch {}

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
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} style={{ color: T.accent }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
            Account Settings
          </h1>
        </div>
        <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
          Manage your account security and login credentials.
        </p>
      </div>

      {/* ── User info card ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.05s', padding: '18px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.18)', borderRadius: 9999, fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {user?.role?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* ── Password form ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.10s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>

        {/* Form header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <div style={{ padding: '14px 16px', background: 'rgba(200,255,0,0.04)', border: '1px solid rgba(200,255,0,0.12)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <CheckCircle size={15} style={{ color: T.accent, flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: T.textBody, lineHeight: '20px', margin: 0 }}>
                Use at least 6 characters. Avoid reusing your current password.
              </p>
            </div>

            <PasswordField
              label="New Password"
              value={formData.newPassword}
              placeholder="Enter a new password"
              autoComplete="new-password"
              show={showPassword.newPassword}
              onToggle={() => toggleShow('newPassword')}
              onChange={val => setField('newPassword', val)}
            />

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
    </div>
  );
};

export default AccountSettings;
