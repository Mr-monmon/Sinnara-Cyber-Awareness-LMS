import React, { useState, useEffect } from "react";
import { Globe, Plus, Trash2, CheckCircle, XCircle, Loader2, Copy, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { PhishingDomain } from "../../lib/types";

const T = {
  bg:           '#12140a',
  bgCard:       '#1a1e0e',
  accent:       '#c8ff00',
  accentDark:   '#12140a',
  white:        '#ffffff',
  textBody:     '#cbd5e1',
  textMuted:    '#64748b',
  border:       'rgba(255,255,255,0.09)',
  borderFaint:  'rgba(255,255,255,0.05)',
  green:        '#34d399',
  greenBg:      'rgba(52,211,153,0.08)',
  greenBorder:  'rgba(52,211,153,0.22)',
  blue:         '#60a5fa',
  blueBg:       'rgba(96,165,250,0.08)',
  blueBorder:   'rgba(96,165,250,0.22)',
  orange:       '#fb923c',
  orangeBg:     'rgba(251,146,60,0.08)',
  orangeBorder: 'rgba(251,146,60,0.22)',
  red:          '#f87171',
  redBg:        'rgba(248,113,113,0.08)',
  redBorder:    'rgba(248,113,113,0.22)',
} as const;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .aw-pd-input {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09); border-radius: 10px;
    font-size: 14px; color: #ffffff; font-family: 'Inter', sans-serif;
    outline: none; padding: 11px 14px;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-pd-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-pd-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-pd-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-pd-table th {
    padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700;
    color: #64748b; letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-pd-table td {
    padding: 12px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.14s;
  }
  .aw-pd-table tr:last-child td { border-bottom: none; }
  .aw-pd-table tr:hover td { background: rgba(255,255,255,0.025); }
  .aw-pd-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 16px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    transition: all 0.18s;
  }
  .aw-pd-icon-btn {
    width: 30px; height: 30px; border-radius: 7px; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.18s;
  }
  .aw-pd-copy-btn {
    background: none; border: none; cursor: pointer; padding: 2px;
    color: #64748b; transition: color 0.15s;
  }
  .aw-pd-copy-btn:hover { color: #c8ff00; }
  @keyframes aw-pd-spin { to { transform: rotate(360deg); } }
  @keyframes aw-pd-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .aw-pd-fade { animation: aw-pd-fade 0.35s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-pd-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-pd-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });

export const PhishingDomainsPage: React.FC = () => {
  const [domains, setDomains]         = useState<PhishingDomain[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [newDomain, setNewDomain]     = useState('');
  const [copied, setCopied]           = useState<string | null>(null);
  const [error, setError]             = useState('');

  useEffect(() => { loadDomains(); }, []);

  const loadDomains = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('phishing_domains')
        .select('*')
        .eq('is_platform_domain', true)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setDomains(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/;
    if (!domainRegex.test(domain)) {
      setError('Invalid domain format. Example: phish.example.com');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '').substring(0, 24);
      const { error: err } = await supabase.from('phishing_domains').insert({
        company_id:        null,
        domain_name:       domain,
        is_platform_domain: true,
        is_verified:       false,
        verification_token: token,
        dns_record:        `TXT @ sinnara-verify=${token}`,
      });
      if (err) throw err;
      setNewDomain('');
      loadDomains();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add domain';
      setError(msg.includes('unique') ? 'Domain already exists.' : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this domain? Company admins will no longer be able to use it.')) return;
    setDeletingId(id);
    try {
      const { error: err } = await supabase.from('phishing_domains').delete().eq('id', id);
      if (err) throw err;
      setDomains(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete domain.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleVerify = async (domain: PhishingDomain) => {
    setVerifyingId(domain.id);
    try {
      const { error: err } = await supabase
        .from('phishing_domains')
        .update({ is_verified: true, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', domain.id);
      if (err) throw err;
      setDomains(prev => prev.map(d => d.id === domain.id ? { ...d, is_verified: true, verified_at: new Date().toISOString() } : d));
    } catch (err) {
      console.error(err);
      alert('Failed to verify domain.');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleUnverify = async (domain: PhishingDomain) => {
    setVerifyingId(domain.id);
    try {
      const { error: err } = await supabase
        .from('phishing_domains')
        .update({ is_verified: false, verified_at: null, updated_at: new Date().toISOString() })
        .eq('id', domain.id);
      if (err) throw err;
      setDomains(prev => prev.map(d => d.id === domain.id ? { ...d, is_verified: false, verified_at: null } : d));
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const verified   = domains.filter(d => d.is_verified);
  const unverified = domains.filter(d => !d.is_verified);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="aw-pd-fade" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Globe size={18} style={{ color: T.blue }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Phishing Domains</h1>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Manage sending domains available to company admins for phishing campaigns.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="aw-pd-fade" style={{ animationDelay: '0.04s', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {[
          { label: 'Total Domains',   value: domains.length, color: T.accent },
          { label: 'Verified',        value: verified.length, color: T.green  },
          { label: 'Pending Verify',  value: unverified.length, color: T.orange },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 16px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 11 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add domain card */}
      <div className="aw-pd-fade" style={{ animationDelay: '0.07s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '0 0 12px' }}>Add New Domain</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="aw-pd-input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="e.g. phish.sinnara.com"
            value={newDomain}
            onChange={e => { setNewDomain(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            className="aw-pd-btn"
            onClick={handleAdd}
            disabled={saving || !newDomain.trim()}
            style={{ background: T.accent, color: T.accentDark, opacity: saving || !newDomain.trim() ? 0.5 : 1, cursor: saving || !newDomain.trim() ? 'not-allowed' : 'pointer' }}>
            {saving
              ? <Loader2 size={14} style={{ animation: 'aw-pd-spin 0.8s linear infinite' }} />
              : <Plus size={14} />}
            Add Domain
          </button>
        </div>
        {error && (
          <p style={{ fontSize: 12, color: T.red, marginTop: 8, marginBottom: 0 }}>{error}</p>
        )}
        <p style={{ fontSize: 11, color: T.textMuted, marginTop: 10, marginBottom: 0, lineHeight: 1.6 }}>
          After adding, a DNS TXT record will be generated. Add it to your domain's DNS settings to verify ownership.
          Verified domains are available to all company admins when creating phishing campaign requests.
        </p>
      </div>

      {/* Domains table */}
      <div className="aw-pd-fade" style={{ animationDelay: '0.1s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>All Domains</span>
          <button
            onClick={loadDomains}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Loader2 size={24} style={{ color: T.accent, animation: 'aw-pd-spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : domains.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Globe size={30} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px', display: 'block' }} />
            <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>No domains added yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="aw-pd-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>DNS Record</th>
                  <th>Verified At</th>
                  <th>Added</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map(domain => (
                  <tr key={domain.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: T.white }}>{domain.domain_name}</span>
                    </td>
                    <td>
                      {domain.is_verified ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green }}>
                          <CheckCircle size={10} /> VERIFIED
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, color: T.orange }}>
                          <XCircle size={10} /> PENDING
                        </span>
                      )}
                    </td>
                    <td>
                      {domain.dns_record ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <code style={{ fontSize: 10, color: T.textMuted, background: 'rgba(255,255,255,0.04)', padding: '3px 7px', borderRadius: 5, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {domain.dns_record}
                          </code>
                          <button
                            className="aw-pd-copy-btn"
                            title="Copy DNS record"
                            onClick={() => copyToClipboard(domain.dns_record!, domain.id)}>
                            {copied === domain.id
                              ? <CheckCircle size={12} style={{ color: T.green }} />
                              : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: T.textMuted, fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: T.textMuted }}>
                      {domain.verified_at ? fmt(domain.verified_at) : '—'}
                    </td>
                    <td style={{ fontSize: 11, color: T.textMuted }}>
                      {fmt(domain.created_at)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {verifyingId === domain.id ? (
                          <Loader2 size={14} style={{ color: T.accent, animation: 'aw-pd-spin 0.8s linear infinite' }} />
                        ) : domain.is_verified ? (
                          <button
                            className="aw-pd-icon-btn"
                            title="Mark as unverified"
                            onClick={() => handleUnverify(domain)}
                            style={{ background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, color: T.orange }}>
                            <XCircle size={13} />
                          </button>
                        ) : (
                          <button
                            className="aw-pd-icon-btn"
                            title="Mark as verified"
                            onClick={() => handleVerify(domain)}
                            style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green }}>
                            <CheckCircle size={13} />
                          </button>
                        )}
                        <button
                          className="aw-pd-icon-btn"
                          title="Delete domain"
                          onClick={() => handleDelete(domain.id)}
                          disabled={deletingId === domain.id}
                          style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, opacity: deletingId === domain.id ? 0.5 : 1 }}>
                          {deletingId === domain.id
                            ? <Loader2 size={13} style={{ animation: 'aw-pd-spin 0.8s linear infinite' }} />
                            : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
