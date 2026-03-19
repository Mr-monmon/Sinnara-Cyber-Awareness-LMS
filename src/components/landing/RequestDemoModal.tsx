import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RequestDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ── Design Tokens ── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  bgInput:     'rgba(255,255,255,0.05)',
  bgInputFocus:'rgba(255,255,255,0.08)',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#94a3b8',
  textLabel:   '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.10)',
  borderFocus: 'rgba(200,255,0,0.50)',
  overlay:     'rgba(0,0,0,0.75)',
};

const FIELDS: Array<{
  key: keyof typeof defaultForm;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}> = [
  { key: 'full_name',      label: 'Full Name',           type: 'text',   required: true },
  { key: 'email',          label: 'Email',               type: 'email',  required: true },
  { key: 'phone',          label: 'Phone Number',        type: 'tel'  },
  { key: 'company_name',   label: 'Company Name',        type: 'text' },
  { key: 'employee_count', label: 'Number of Employees', type: 'number', required: true, placeholder: 'e.g. 50' },
  { key: 'message',        label: 'Message',             type: 'textarea', rows: 3 },
];

const defaultForm = {
  full_name: '',
  email: '',
  phone: '',
  company_name: '',
  employee_count: '',
  message: '',
};

/* ── Shared input style ── */
const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  fontSize: 14,
  color: T.white,
  outline: 'none',
  transition: 'background 0.2s, border-color 0.2s',
  fontFamily: 'inherit',
};

export const RequestDemoModal: React.FC<RequestDemoModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({ ...defaultForm });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [focused, setFocused]       = useState<string | null>(null);

  if (!isOpen) return null;

  const set = (key: string, val: string) =>
    setFormData(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from('demo_requests').insert([{
        ...formData,
        employee_count: parseInt(formData.employee_count) || null,
      }]);
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFormData({ ...defaultForm });
      }, 2500);
    } catch (err) {
      console.error('Error submitting demo request:', err);
      alert('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* ── Backdrop ── */
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: T.overlay,
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Modal card ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-modal-title"
        style={{
          position: 'relative',
          width: '100%', maxWidth: 480,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: T.bgCard,
          border: `1px solid rgba(255,255,255,0.10)`,
          borderRadius: 16,
          padding: 36,
          boxShadow: '0 25px 60px rgba(0,0,0,0.60)',
          /* Custom scrollbar */
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(200,255,0,0.30) transparent',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.07)',
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.textBody,
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.13)'; (e.currentTarget as HTMLElement).style.color = T.white; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = T.textBody; }}
        >
          <X size={16} />
        </button>

        {/* ── Accent top bar ── */}
        <div style={{ width: 40, height: 3, background: T.accent, borderRadius: 9999, marginBottom: 24 }} />

        {/* ── Heading ── */}
        <h2
          id="demo-modal-title"
          style={{ fontSize: 24, fontWeight: 900, color: T.white, margin: '0 0 6px', letterSpacing: '-0.3px' }}
        >
          Request a Demo
        </h2>
        <p style={{ fontSize: 14, color: T.textBody, margin: '0 0 28px', lineHeight: '20px' }}>
          Fill out the form below and we'll get back to you shortly.
        </p>

        {/* ── Success state ── */}
        {success ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(200,255,0,0.12)',
              border: `1px solid rgba(200,255,0,0.30)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle size={28} style={{ color: T.accent }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.white, margin: '0 0 8px' }}>
              Request Submitted!
            </h3>
            <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
              We'll contact you soon.
            </p>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FIELDS.map(({ key, label, type, required, placeholder, rows }) => (
              <div key={key}>
                <label
                  htmlFor={`demo-${key}`}
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textLabel, marginBottom: 6 }}
                >
                  {label}{required && <span style={{ color: T.accent, marginLeft: 3 }}>*</span>}
                </label>

                {type === 'textarea' ? (
                  <textarea
                    id={`demo-${key}`}
                    rows={rows ?? 3}
                    value={formData[key]}
                    onChange={e => set(key, e.target.value)}
                    onFocus={() => setFocused(key)}
                    onBlur={() => setFocused(null)}
                    style={{
                      ...inputBase,
                      resize: 'none',
                      borderColor: focused === key ? T.borderFocus : T.border,
                      background: focused === key ? T.bgInputFocus : T.bgInput,
                    }}
                  />
                ) : (
                  <input
                    id={`demo-${key}`}
                    type={type}
                    required={required}
                    placeholder={placeholder}
                    min={type === 'number' ? 1 : undefined}
                    value={formData[key]}
                    onChange={e => set(key, e.target.value)}
                    onFocus={() => setFocused(key)}
                    onBlur={() => setFocused(null)}
                    style={{
                      ...inputBase,
                      borderColor: focused === key ? T.borderFocus : T.border,
                      background: focused === key ? T.bgInputFocus : T.bgInput,
                    }}
                  />
                )}
              </div>
            ))}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '14px 24px',
                background: submitting ? 'rgba(200,255,0,0.50)' : T.accent,
                color: T.accentDark,
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 10,
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: submitting ? 'none' : '0 0 20px rgba(200,255,0,0.25)',
                transition: 'opacity 0.2s, transform 0.15s, box-shadow 0.2s',
                lineHeight: '20px',
              }}
              onMouseEnter={e => { if (!submitting) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>

      {/* Webkit scrollbar style */}
      <style>{`
        [role="dialog"]::-webkit-scrollbar { width: 5px; }
        [role="dialog"]::-webkit-scrollbar-track { background: transparent; }
        [role="dialog"]::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.25); border-radius: 9999px; }
        input:-webkit-autofill,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #1a1e0e inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff;
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  );
};
