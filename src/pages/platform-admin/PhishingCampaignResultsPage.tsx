import React, { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import {
  Upload, AlertCircle, CheckCircle, Loader2, X,
  Shield, Mail, MousePointer, FileText, Flag,
  Building2, ChevronRight, Eye,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { parseCSV, calculateCampaignStats, getStatusFromRecord } from "../../lib/gophishCsvParser";
import { RequestWithCompany } from "../../lib/types";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
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
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  orangeBorder:'rgba(251,146,60,0.22)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  purpleBorder:'rgba(167,139,250,0.22)',
} as const;

/* ─────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────── */
const STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  COMPLETED: { color: T.green,  bg: T.greenBg,  border: T.greenBorder  },
  RUNNING:   { color: T.orange, bg: T.orangeBg, border: T.orangeBorder },
  APPROVED:  { color: T.blue,   bg: T.blueBg,   border: T.blueBorder   },
};
const getStatusCfg = (s: string) => STATUS_CFG[s] ?? { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint };

/* ─────────────────────────────────────────
   CSS — id = "aw-pcr-styles" (unique)
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Campaign selector button ── */
  .aw-pcr-camp-btn {
    width: 100%; text-align: left; padding: 12px 14px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; cursor: pointer;
    font-family: 'Inter', sans-serif;
    transition: all 0.18s;
  }
  .aw-pcr-camp-btn:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
  .aw-pcr-camp-btn.active { background: rgba(200,255,0,0.06); border-color: rgba(200,255,0,0.28); }

  /* ── File input styling ── */
  .aw-pcr-file-input {
    display: block; width: 100%;
    font-size: 13px; font-family: 'Inter', sans-serif; color: #94a3b8;
  }
  .aw-pcr-file-input::file-selector-button {
    margin-right: 12px; padding: 8px 16px;
    background: rgba(200,255,0,0.08); border: 1px solid rgba(200,255,0,0.25);
    border-radius: 8px; color: #c8ff00; font-size: 12px; font-weight: 700;
    font-family: 'Inter', sans-serif; cursor: pointer; transition: background 0.18s;
  }
  .aw-pcr-file-input::file-selector-button:hover { background: rgba(200,255,0,0.15); }
  .aw-pcr-file-input:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Table ── */
  .aw-pcr-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-pcr-table th {
    padding: 8px 12px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-pcr-table td {
    padding: 10px 12px; font-size: 12px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .aw-pcr-table tr:last-child td { border-bottom: none; }
  .aw-pcr-table tr:hover td { background: rgba(255,255,255,0.025); }

  /* ── Buttons ── */
  .aw-pcr-upload-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-pcr-upload-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-pcr-upload-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  .aw-pcr-clear-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 12px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-pcr-clear-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  .aw-pcr-details-btn {
    width: 100%; padding: 8px; border-radius: 8px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(200,255,0,0.08); border: 1px solid rgba(200,255,0,0.20);
    color: #c8ff00; transition: all 0.18s; display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .aw-pcr-details-btn:hover { background: rgba(200,255,0,0.15); }

  /* ── Scrollbar ── */
  .aw-pcr-scroll::-webkit-scrollbar { width: 3px; }
  .aw-pcr-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-pcr-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-pcr-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-pcr-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES (unchanged from original)
───────────────────────────────────────── */
interface TargetData {
  campaign_id: string; email: string;
  first_name: string; last_name: string;
  position: string; status: string;
}
interface CampaignTargetUpdate {
  status: string; sent_at: string | null;
  opened_at?: string; clicked_at?: string;
  submitted_at?: string; reported_at?: string;
}
const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
};

/* ─────────────────────────────────────────
   STAT MINI CARD
───────────────────────────────────────── */
const StatMini: React.FC<{ icon: React.ElementType; color: string; bg: string; label: string; value: number }> = ({
  icon: Icon, color, bg, label, value,
}) => (
  <div style={{ padding: '12px 14px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={14} style={{ color }} />
    </div>
    <div>
      <div style={{ fontSize: 18, fontWeight: 900, color: T.white }}>{value}</div>
      <div style={{ fontSize: 11, color: T.textMuted }}>{label}</div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PhishingCampaignResultsPage: React.FC = () => {
  const [campaigns, setCampaigns]       = useState<RequestWithCompany[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<RequestWithCompany | null>(null);
  const [loading, setLoading]           = useState(true);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [csvData, setCsvData]           = useState<ReturnType<typeof parseCSV> | null>(null);
  const [targetData, setTargetData]     = useState<TargetData[]>([]);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);

  const sanitizedEmailHtml = React.useMemo(
    () => selectedCampaign?.email_html_body ? DOMPurify.sanitize(selectedCampaign.email_html_body) : '',
    [selectedCampaign?.email_html_body]
  );

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try {
      const { data, error: err } = await supabase
        .from('phishing_campaign_requests')
        .select(`*, companies(name), users!phishing_campaign_requests_requested_by_fkey(full_name), phishing_templates(name)`)
        .in('status', ['RUNNING', 'COMPLETED', 'APPROVED'])
        .order('created_at', { ascending: false });
      if (err) throw err;
      if (data) setCampaigns(data);
    } catch (err) { setError('Failed to load campaigns'); }
    finally { setLoading(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setSuccess('');
    try {
      const content = await file.text();
      const parsed = parseCSV(content);
      setCsvData(parsed);
      const targets: TargetData[] = parsed.records.map(r => ({
        campaign_id: selectedCampaign!.id, email: r.email,
        first_name: r.first_name, last_name: r.last_name,
        position: r.position, status: getStatusFromRecord(r),
      }));
      setTargetData(targets);
      setSuccess(`Parsed ${parsed.records.length} records from CSV`);
    } catch (err) { setError(getErrorMessage(err, 'Failed to parse CSV file')); }
  };

  const handleViewDetails = (campaignId: string) => {
    const c = campaigns.find(x => x.id === campaignId);
    if (!c) return;
    setSelectedCampaign(c);
    setViewDetailsModal(true);
  };

  const handleSubmit = async () => {
    if (!selectedCampaign || !csvData) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      const stats = calculateCampaignStats(csvData.records);
      await supabase.from('phishing_campaigns').insert({
        company_id: selectedCampaign.company_id,
        campaign_name: selectedCampaign.campaign_name,
        template_id: selectedCampaign.template_id,
        launch_date: new Date().toISOString(),
        request_id: selectedCampaign.id,
        total_targets: stats.total_targets,
        emails_sent: stats.emails_sent,
        emails_opened: stats.emails_opened,
        links_clicked: stats.links_clicked,
        data_submitted: stats.data_submitted,
        emails_reported: stats.emails_reported,
        status: 'COMPLETED',
        completion_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      for (const target of targetData) {
        const gophishRecord = csvData.records.find(r => r.email === target.email);
        if (!gophishRecord) continue;
        const { data: existing } = await supabase.from('phishing_campaign_targets').select('id').eq('campaign_id', selectedCampaign.id).eq('email', target.email).maybeSingle();
        const updateData: CampaignTargetUpdate = { status: target.status, sent_at: gophishRecord.send_date ? new Date(gophishRecord.send_date).toISOString() : null };
        if (target.status === 'OPENED')    updateData.opened_at    = new Date(gophishRecord.modified_date).toISOString();
        if (target.status === 'CLICKED')   updateData.clicked_at   = new Date(gophishRecord.modified_date).toISOString();
        if (target.status === 'SUBMITTED') updateData.submitted_at = new Date(gophishRecord.modified_date).toISOString();
        if (target.status === 'REPORTED')  updateData.reported_at  = new Date(gophishRecord.modified_date).toISOString();
        if (existing) {
          await supabase.from('phishing_campaign_targets').update(updateData).eq('id', existing.id);
        } else {
          await supabase.from('phishing_campaign_targets').insert([{ campaign_id: selectedCampaign.id, employee_id: '00000000-0000-0000-0000-000000000000', email: target.email, first_name: target.first_name, last_name: target.last_name, position: target.position, ...updateData }]);
        }
      }
      setSuccess('Campaign results uploaded successfully!');
      setCsvData(null); setTargetData([]); setSelectedCampaign(null);
      loadCampaigns();
    } catch (err) { setError(getErrorMessage(err, 'Failed to upload campaign results')); }
    finally { setUploading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={18} style={{ color: T.orange }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Phishing Campaign Results</h1>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Upload Gophish campaign statistics to update campaign records.</p>
        </div>
      </div>

      {/* ── Main layout: 1/3 + 2/3 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'flex-start' }}>

        {/* ── LEFT: Campaign selector ── */}
        <div className="aw-fade-up" style={{ animationDelay: '0.05s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={13} style={{ color: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Select Campaign</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>{campaigns.length}</span>
          </div>
          <div className="aw-pcr-scroll" style={{ maxHeight: 480, overflowY: 'auto', padding: '10px' }}>
            {campaigns.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {campaigns.map(c => {
                  const cfg = getStatusCfg(c.status);
                  const isActive = selectedCampaign?.id === c.id;
                  return (
                    <div key={c.id} className={`aw-pcr-camp-btn ${isActive ? 'active' : ''}`}
                      onClick={() => { setSelectedCampaign(c); setCsvData(null); setTargetData([]); setError(''); setSuccess(''); }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.campaign_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Building2 size={11} style={{ color: T.textMuted }} />
                        <span style={{ fontSize: 11, color: T.textMuted }}>{c.companies?.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                          {c.status}
                        </span>
                        <button className="aw-pcr-details-btn" style={{ width: 'auto', padding: '4px 10px', fontSize: 11 }}
                          onClick={e => { e.stopPropagation(); handleViewDetails(c.id); }}>
                          <Eye size={11} /> Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: T.textMuted, fontSize: 13 }}>
                <Shield size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px', display: 'block' }} />
                No campaigns found
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Upload area ── */}
        <div className="aw-fade-up" style={{ animationDelay: '0.08s' }}>
          {selectedCampaign ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Campaign selected badge */}
              <div style={{ padding: '12px 16px', background: T.bgCard, border: `1px solid rgba(200,255,0,0.16)`, borderRadius: 11, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield size={14} style={{ color: T.accent }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCampaign.campaign_name}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{selectedCampaign.companies?.name}</div>
                </div>
                <ChevronRight size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
              </div>

              {/* Messages */}
              {error && (
                <div style={{ padding: '11px 14px', background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.red }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{error}</span>
                  <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, padding: 0 }}><X size={12} /></button>
                </div>
              )}
              {success && (
                <div style={{ padding: '11px 14px', background: T.greenBg, border: `1px solid ${T.greenBorder}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.green }}>
                  <CheckCircle size={14} style={{ flexShrink: 0 }} /> {success}
                </div>
              )}

              {/* File upload card */}
              <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={14} style={{ color: T.accent }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Upload Gophish CSV</span>
                </div>
                <div style={{ padding: '18px 20px' }}>
                  <label className="aw-pcr-label" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                    CSV / TSV File from Gophish export
                  </label>
                  <input
                    type="file" accept=".csv,.txt"
                    className="aw-pcr-file-input"
                    onChange={handleFileUpload}
                    disabled={csvData !== null}
                  />
                  <p style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>Accepts CSV or TSV format exported from Gophish</p>
                </div>
              </div>

              {/* CSV stats + preview */}
              {csvData && (
                <>
                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                    <StatMini icon={Mail}          color={T.blue}   bg={T.blueBg}   label="Emails Sent"     value={csvData.stats.emailsSent}     />
                    <StatMini icon={Eye}           color={T.purple} bg={T.purpleBg} label="Opened"          value={csvData.stats.emailsOpened || 0} />
                    <StatMini icon={MousePointer}  color={T.orange} bg={T.orangeBg} label="Links Clicked"   value={csvData.stats.linksClicked}   />
                    <StatMini icon={FileText}      color={T.red}    bg={T.redBg}    label="Data Submitted"  value={csvData.stats.dataSubmitted}  />
                    <StatMini icon={Flag}          color={T.green}  bg={T.greenBg}  label="Reported"        value={csvData.stats.emailsReported} />
                  </div>

                  {/* Preview table */}
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, fontSize: 12, fontWeight: 700, color: T.textMuted }}>
                      Preview — first 10 records ({targetData.length} total)
                    </div>
                    <div style={{ overflowX: 'auto' }} className="aw-pcr-scroll">
                      <table className="aw-pcr-table">
                        <thead>
                          <tr><th>Email</th><th>Name</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {targetData.slice(0, 10).map((t, i) => (
                            <tr key={i}>
                              <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{t.email}</td>
                              <td>{t.first_name} {t.last_name}</td>
                              <td>
                                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue }}>
                                  {t.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="aw-pcr-clear-btn" onClick={() => { setCsvData(null); setTargetData([]); setError(''); setSuccess(''); }}>
                      Clear
                    </button>
                    <button className="aw-pcr-upload-btn" onClick={handleSubmit} disabled={uploading}>
                      {uploading
                        ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Uploading…</>
                        : <><Upload size={14} /> Upload Results</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Empty state */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, textAlign: 'center', height: '100%' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Upload size={26} style={{ color: T.textMuted }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, margin: '0 0 6px' }}>No campaign selected</p>
              <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>Select a campaign from the left panel to upload results.</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ DETAILS MODAL ═══════════ */}
      {viewDetailsModal && selectedCampaign && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.88)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => setViewDetailsModal(false)}>
          <div className="aw-modal-in aw-pcr-scroll"
            style={{ width: '100%', maxWidth: 860, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden', overflowY: 'auto', maxHeight: '92vh', boxShadow: '0 40px 100px rgba(0,0,0,0.65)', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.orange}, ${T.orange}40)` }} />

            {/* Modal header */}
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: T.bgCard, zIndex: 2, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={16} style={{ color: T.orange }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 900, color: T.white, margin: 0 }}>{selectedCampaign.campaign_name}</h2>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{selectedCampaign.companies?.name}</p>
                </div>
              </div>
              <button onClick={() => setViewDetailsModal(false)}
                style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Meta grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Status',           value: selectedCampaign.status, isStatus: true },
                  { label: 'Template',          value: selectedCampaign.phishing_templates?.name || 'N/A' },
                  { label: 'Scheduled Date',    value: selectedCampaign.scheduled_date ? new Date(selectedCampaign.scheduled_date).toLocaleDateString('en-SA') : 'Not set' },
                  { label: 'Target Employees',  value: String(selectedCampaign.target_employee_count ?? 'N/A') },
                  { label: 'Priority',          value: selectedCampaign.priority || 'N/A' },
                  { label: 'Requested By',      value: (selectedCampaign as any).users?.full_name || 'N/A' },
                ].map(({ label, value, isStatus }) => {
                  const cfg = isStatus ? getStatusCfg(value) : null;
                  return (
                    <div key={label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 9 }}>
                      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                      {isStatus && cfg ? (
                        <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                          {value}
                        </span>
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.textBody }}>{value}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Email subject */}
              {selectedCampaign.email_subject && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Subject</div>
                  <div style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 9, fontSize: 13, color: T.textBody }}>
                    {selectedCampaign.email_subject}
                  </div>
                </div>
              )}

              {/* Admin notes */}
              {selectedCampaign.admin_notes && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Admin Notes</div>
                  <div style={{ padding: '12px 14px', background: T.blueBg, border: `1px solid ${T.blueBorder}`, borderRadius: 9, fontSize: 13, color: T.textBody, whiteSpace: 'pre-wrap' }}>
                    {selectedCampaign.admin_notes}
                  </div>
                </div>
              )}

              {/* Email HTML body */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email HTML Body</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Preview</div>
                    <div style={{ minHeight: 140, maxHeight: 300, overflowY: 'auto', padding: '14px', background: '#ffffff', borderRadius: 9, fontSize: 13, color: '#1a1a1a', border: `1px solid ${T.borderFaint}` }} className="aw-pcr-scroll">
                      {sanitizedEmailHtml
                        ? <div dangerouslySetInnerHTML={{ __html: sanitizedEmailHtml }} />
                        : <p style={{ color: '#94a3b8', margin: 0 }}>No HTML body provided</p>
                      }
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Source</div>
                    <pre style={{ minHeight: 140, maxHeight: 300, overflowY: 'auto', overflowX: 'auto', padding: '12px 14px', background: '#080a04', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 9, fontSize: 11, color: '#94a3b8', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }} className="aw-pcr-scroll">
                      {selectedCampaign.email_html_body || 'No HTML body provided'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.borderFaint}`, flexShrink: 0, background: T.bgCard }}>
              <button onClick={() => setViewDetailsModal(false)}
                style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.18s' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
