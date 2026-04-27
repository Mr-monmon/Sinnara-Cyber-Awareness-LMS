import React, { useState, useEffect } from 'react';
import {
  X, Calendar, Building2, User, CreditCard,
  Save, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react';
import { Company } from '../../lib/types';

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.09)',
  borderFaint: 'rgba(255,255,255,0.05)',
  green:       '#34d399',
  greenBg:     'rgba(52,211,153,0.08)',
  greenBorder: 'rgba(52,211,153,0.22)',
  blue:        '#60a5fa',
  blueBg:      'rgba(96,165,250,0.08)',
  blueBorder:  'rgba(96,165,250,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  purpleBorder:'rgba(167,139,250,0.22)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-cfm-input, .aw-cfm-select {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-cfm-input  { padding: 11px 14px; }
  .aw-cfm-select {
    padding: 11px 36px 11px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-cfm-input:focus, .aw-cfm-select:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-cfm-input.error { border-color: rgba(248,113,113,0.50); box-shadow: 0 0 0 3px rgba(248,113,113,0.07); }
  .aw-cfm-input:disabled, .aw-cfm-select:disabled { opacity: 0.45; cursor: not-allowed; }
  .aw-cfm-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-cfm-select option { background: #1a1e0e; color: #ffffff; }
  input[type="date"].aw-cfm-input::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.4); cursor: pointer; }

  .aw-cfm-label {
    display: block; font-size: 12px; font-weight: 600; color: #94a3b8;
    margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif;
  }

  /* ── Section block ── */
  .aw-cfm-section {
    border-radius: 12px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.07);
  }
  .aw-cfm-section-header {
    padding: 12px 16px; display: flex; align-items: center; gap: 9px;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  /* ── Toggle checkbox ── */
  .aw-cfm-toggle {
    display: flex; align-items: center; gap: 10px; cursor: pointer;
    padding: 10px 14px; border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
    transition: all 0.18s; font-family: 'Inter', sans-serif;
  }
  .aw-cfm-toggle.on  { background: rgba(52,211,153,0.06); border-color: rgba(52,211,153,0.22); }
  .aw-cfm-toggle:hover { background: rgba(255,255,255,0.05); }

  /* ── Save button ── */
  .aw-cfm-save {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 20px rgba(200,255,0,0.22);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-cfm-save:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-cfm-save:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  .aw-cfm-cancel {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 13px 22px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-cfm-cancel:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  /* ── Scrollbar ── */
  .aw-cfm-scroll::-webkit-scrollbar { width: 4px; }
  .aw-cfm-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-cfm-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(14px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-cfm-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-cfm-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const sanitizeSubdomain = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '');

interface CompanyFormModalProps {
  company: Company | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  companies: Company[];
}

/* ─────────────────────────────────────────
   SECTION COMPONENT
───────────────────────────────────────── */
const Sec: React.FC<{
  icon: React.ElementType; color: string; bg: string; border: string;
  title: string; children: React.ReactNode;
}> = ({ icon: Icon, color, bg, border, title, children }) => (
  <div className="aw-cfm-section" style={{ background: 'rgba(255,255,255,0.01)' }}>
    <div className="aw-cfm-section-header" style={{ background: bg, color }}>
      <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} style={{ color }} />
      </div>
      {title}
    </div>
    <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {children}
    </div>
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CompanyFormModal: React.FC<CompanyFormModalProps> = ({
  company, onClose, onSave, companies,
}) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', subdomain: '', admin_name: '', admin_email: '', admin_phone: '',
    package_type: 'TYPE_A' as 'TYPE_A' | 'TYPE_B',
    license_limit: 10, subscription_type: 'POC_3M',
    subscription_start: new Date().toISOString().split('T')[0],
    subscription_end: '', is_active: true, status: 'ACTIVE',
  });

  const normSub = sanitizeSubdomain(form.subdomain);
  const isDupe  = normSub.length > 0 && companies.some(c => c.id !== company?.id && sanitizeSubdomain(c.subdomain || '') === normSub);

  useEffect(() => {
    if (company) {
      setForm({
        name:               company.name || '',
        subdomain:          sanitizeSubdomain(company.subdomain || ''),
        admin_name:         (company as any).admin_name || '',
        admin_email:        (company as any).admin_email || '',
        admin_phone:        (company as any).admin_phone || '',
        package_type:       company.package_type === 'TYPE_B' ? 'TYPE_B' : 'TYPE_A',
        license_limit:      company.license_limit || 10,
        subscription_type:  (company as any).subscription_type || 'POC_3M',
        subscription_start: (company as any).subscription_start?.split('T')[0] || new Date().toISOString().split('T')[0],
        subscription_end:   (company as any).subscription_end?.split('T')[0] || '',
        is_active:          (company as any).is_active !== false,
        status:             (company as any).status || 'ACTIVE',
      });
    }
  }, [company]);

  /* Auto-calculate end date */
  useEffect(() => {
    if (form.subscription_type === 'CUSTOM') return;
    const monthsMap: Record<string, number> = { POC_3M: 3, MONTHLY_6: 6, YEARLY_1: 12, YEARLY_2: 24 };
    const months = monthsMap[form.subscription_type];
    if (!months) return;
    const end = new Date(form.subscription_start);
    end.setMonth(end.getMonth() + months);
    setForm(prev => ({ ...prev, subscription_end: end.toISOString().split('T')[0] }));
  }, [form.subscription_type, form.subscription_start]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDupe) return;
    setSaving(true);
    try { await onSave({ ...form, subdomain: normSub }); }
    finally { setSaving(false); }
  };

  const durationDays = form.subscription_end
    ? Math.ceil((new Date(form.subscription_end).getTime() - new Date(form.subscription_start).getTime()) / 86400000)
    : null;

  const isEdit = !!company;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.85)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="aw-modal-in"
        style={{ width: '100%', maxWidth: 700, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.60)', display: 'flex', flexDirection: 'column', maxHeight: '94vh', fontFamily: "'Inter', sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))', flexShrink: 0 }} />

        {/* Sticky header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0, background: T.bgCard, position: 'sticky', top: 0, zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={18} style={{ color: T.accent }} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 900, color: T.white, margin: 0, letterSpacing: '-0.2px' }}>
                {isEdit ? 'Edit Company' : 'Add New Company'}
              </h2>
              <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                {isEdit ? `Editing: ${company?.name}` : 'Fill in company details below'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer', transition: 'all 0.18s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLElement).style.color = T.white; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = T.textMuted; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="aw-cfm-scroll" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Company Info ── */}
            <Sec icon={Building2} color={T.accent} bg="rgba(200,255,0,0.04)" border="rgba(200,255,0,0.12)" title="Company Information">
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>

                <div>
                  <label className="aw-cfm-label">Company Name <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-cfm-input" type="text" required placeholder="Advanced Technology Co." value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>

                <div>
                  <label className="aw-cfm-label">Subdomain <span style={{ color: T.accent }}>*</span></label>
                  <input
                    className={`aw-cfm-input ${isDupe ? 'error' : ''}`}
                    type="text" required pattern="[a-z]+"
                    placeholder="advancedtech"
                    value={form.subdomain}
                    onChange={e => setForm(p => ({ ...p, subdomain: sanitizeSubdomain(e.target.value) }))}
                    autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  />
                  {isDupe ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 11, color: T.red }}>
                      <AlertCircle size={11} /> This subdomain is already in use.
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>Letters only — numbers and symbols are removed automatically.</p>
                  )}
                </div>

                <div>
                  <label className="aw-cfm-label">Package Type <span style={{ color: T.accent }}>*</span></label>
                  <select className="aw-cfm-select" required value={form.package_type} onChange={e => setForm(p => ({ ...p, package_type: e.target.value as any }))}>
                    <option value="TYPE_A">Type A — Full Courses</option>
                    <option value="TYPE_B">Type B — Exams Only</option>
                  </select>
                </div>

                <div>
                  <label className="aw-cfm-label">License Limit <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-cfm-input" type="number" required min="1" value={form.license_limit} onChange={e => setForm(p => ({ ...p, license_limit: parseInt(e.target.value) || 1 }))} />
                </div>

                <div>
                  <label className="aw-cfm-label">Status <span style={{ color: T.accent }}>*</span></label>
                  <select className="aw-cfm-select" required value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            </Sec>

            {/* ── Admin Info ── */}
            <Sec icon={User} color={T.green} bg={T.greenBg} border={T.greenBorder} title="Company Manager">
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label className="aw-cfm-label">Manager Name <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-cfm-input" type="text" required placeholder="Ahmed Mohammed" value={form.admin_name} onChange={e => setForm(p => ({ ...p, admin_name: e.target.value }))} />
                </div>
                <div>
                  <label className="aw-cfm-label">Email <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-cfm-input" type="email" required placeholder="admin@company.com" value={form.admin_email} disabled={isEdit} onChange={e => setForm(p => ({ ...p, admin_email: e.target.value }))} />
                  {isEdit && <p style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>Email cannot be changed after creation.</p>}
                </div>
                <div>
                  <label className="aw-cfm-label">Phone <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-cfm-input" type="tel" required placeholder="05xxxxxxxx" value={form.admin_phone} onChange={e => setForm(p => ({ ...p, admin_phone: e.target.value }))} />
                </div>
              </div>
            </Sec>

            {/* ── Subscription ── */}
            <Sec icon={CreditCard} color={T.purple} bg={T.purpleBg} border={T.purpleBorder} title="Subscription">
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label className="aw-cfm-label">Subscription Type <span style={{ color: T.accent }}>*</span></label>
                  <select className="aw-cfm-select" required value={form.subscription_type} onChange={e => setForm(p => ({ ...p, subscription_type: e.target.value }))}>
                    <option value="POC_3M">POC 3 Months (Trial)</option>
                    <option value="MONTHLY_6">6 Months</option>
                    <option value="YEARLY_1">1 Year</option>
                    <option value="YEARLY_2">2 Years</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="aw-cfm-label">Start Date <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-cfm-input" type="date" required value={form.subscription_start} onChange={e => setForm(p => ({ ...p, subscription_start: e.target.value }))} />
                </div>

                <div>
                  <label className="aw-cfm-label">
                    End Date {form.subscription_type !== 'CUSTOM' && <span style={{ color: T.textMuted, fontWeight: 400 }}>(auto-calculated)</span>}
                    {form.subscription_type === 'CUSTOM' && <span style={{ color: T.accent }}>*</span>}
                  </label>
                  <input
                    className="aw-cfm-input" type="date" required value={form.subscription_end}
                    disabled={form.subscription_type !== 'CUSTOM'}
                    onChange={e => setForm(p => ({ ...p, subscription_end: e.target.value }))}
                  />
                </div>

                {/* Active toggle */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label className="aw-cfm-label">Active Subscription</label>
                  <div
                    className={`aw-cfm-toggle ${form.is_active ? 'on' : ''}`}
                    onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  >
                    {/* Custom toggle pill */}
                    <div style={{ width: 36, height: 20, borderRadius: 9999, background: form.is_active ? T.green : 'rgba(255,255,255,0.10)', border: `1px solid ${form.is_active ? T.greenBorder : T.borderFaint}`, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: form.is_active ? T.accentDark : 'rgba(255,255,255,0.40)', position: 'absolute', top: 2, left: form.is_active ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.30)' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: form.is_active ? T.green : T.textMuted }}>
                      {form.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Duration badge */}
              {durationDays && durationDays > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, borderRadius: 9, fontSize: 13, color: T.purple }}>
                    <Calendar size={13} />
                    <strong>Duration:</strong> {durationDays} days
                    {' '}({form.subscription_start} → {form.subscription_end})
                  </div>
                </div>
              )}
            </Sec>
          </div>

          {/* Sticky footer */}
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0, background: T.bgCard }}>
            <button type="button" className="aw-cfm-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="aw-cfm-save" disabled={isDupe || saving}>
              {saving
                ? <><Loader2 size={15} style={{ animation: 'aw-spin 0.8s linear infinite' }} />{isEdit ? 'Saving…' : 'Creating…'}</>
                : <><Save size={15} />{isEdit ? 'Save Changes' : 'Add Company'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
