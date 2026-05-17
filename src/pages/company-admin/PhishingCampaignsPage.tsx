import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Plus, Target, Mail, Users, Play, Pause, Trash2,
  ChevronRight, ChevronLeft, X, Check, Clock, AlertTriangle,
  BarChart3, MousePointerClick, Key, Eye, Send, Globe,
  RefreshCw, Copy, CheckCircle, Filter,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

/* ─────────────────────────────────────────
   VARIABLE RESOLUTION ENGINE
   Replaces all {{.VarName}} tokens in HTML/text.
   Called per-target at queue build time.
───────────────────────────────────────── */
function resolveVariables(
  html: string,
  target: {
    email: string;
    first_name?: string;
    last_name?: string;
    department?: string;
    position?: string;
    recipient_id?: string;
  },
  meta: {
    campaign_id: string;
    company_name: string;
    redirect_url: string;
    tracking_base: string;
  },
  customVars: Record<string, string> = {}
): string {
  const domain     = target.email.split('@')[1] || '';
  const clickUrl   = `${meta.tracking_base}?t=click&c=${meta.campaign_id}&r=${encodeURIComponent(target.recipient_id ?? '')}&url=${btoa(meta.redirect_url || 'https://www.google.com')}`;
  const pixelUrl   = `${meta.tracking_base}?t=open&c=${meta.campaign_id}&r=${encodeURIComponent(target.recipient_id ?? '')}`;
  const trackPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

  const built_in: Record<string, string> = {
    '{{.FirstName}}':    target.first_name || target.email.split('@')[0] || '',
    '{{.LastName}}':     target.last_name  || '',
    '{{.Email}}':        target.email,
    '{{.Position}}':     target.position   || '',
    '{{.Department}}':   target.department || '',
    '{{.Company}}':      meta.company_name,
    '{{.CompanyDomain}}': domain,
    '{{.ManagerName}}':  '',   // available if provided via custom vars
    '{{.LoginURL}}':     clickUrl,
    '{{.URL}}':          clickUrl,
    '{{.TrackingURL}}':  clickUrl,  // some templates use TrackingURL as the main link
    '{{.TrackingPixel}}': trackPixel,
    '{{.RId}}':          target.recipient_id || '',
    '{{.RandomInt}}':    String(Math.floor(Math.random() * 9999) + 1),
    '{{.Date}}':         new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };

  // Custom company vars: {{.VarName}} → value
  const custom: Record<string, string> = {};
  for (const [k, v] of Object.entries(customVars)) {
    custom[`{{.${k}}}`] = v;
  }

  const allVars = { ...built_in, ...custom };
  let result = html;
  for (const [token, value] of Object.entries(allVars)) {
    result = result.replaceAll(token, value);
  }
  return result;
}

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg: '#12140a', bgCard: '#1a1e0e', accent: '#c8ff00', accentDark: '#12140a',
  white: '#ffffff', textBody: '#cbd5e1', textMuted: '#64748b',
  border: 'rgba(255,255,255,0.09)', borderFaint: 'rgba(255,255,255,0.05)',
  green: '#34d399', greenBg: 'rgba(52,211,153,0.08)', greenBorder: 'rgba(52,211,153,0.22)',
  blue: '#60a5fa', blueBg: 'rgba(96,165,250,0.08)', blueBorder: 'rgba(96,165,250,0.22)',
  orange: '#fb923c', orangeBg: 'rgba(251,146,60,0.08)', orangeBorder: 'rgba(251,146,60,0.22)',
  red: '#f87171', redBg: 'rgba(248,113,113,0.08)', redBorder: 'rgba(248,113,113,0.22)',
  purple: '#a78bfa', purpleBg: 'rgba(167,139,250,0.08)', purpleBorder: 'rgba(167,139,250,0.22)',
  gold: '#fbbf24', goldBg: 'rgba(251,191,36,0.08)', goldBorder: 'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .aw-pc-btn { padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px; transition: all 0.18s; }
  .aw-pc-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-pc-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; color: #ffffff; font-family: 'Inter',sans-serif; font-size: 13px; outline: none; box-sizing: border-box; }
  .aw-pc-input:focus { border-color: rgba(200,255,0,0.40); }
  .aw-pc-input::placeholder { color: #475569; }
  .aw-pc-select { width: 100%; padding: 9px 12px; background: #1a1e0e; border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; color: #ffffff; font-family: 'Inter',sans-serif; font-size: 13px; outline: none; cursor: pointer; }
  .aw-pc-select:focus { border-color: rgba(200,255,0,0.40); }
  .aw-pc-textarea { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; color: #ffffff; font-family: 'JetBrains Mono', monospace; font-size: 12px; outline: none; resize: vertical; box-sizing: border-box; }
  .aw-pc-textarea:focus { border-color: rgba(200,255,0,0.40); }
  .aw-pc-row { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); transition: all 0.18s; cursor: pointer; }
  .aw-pc-row:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
  .aw-pc-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.3s ease both; }
  .aw-pc-step { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; font-size:13px; font-weight:800; font-family:'Inter',sans-serif; }
  .aw-pc-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .aw-pc-scenario-card { padding: 14px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.18s; }
  .aw-pc-scenario-card:hover { border-color: rgba(200,255,0,0.30); background: rgba(200,255,0,0.04); }
  .aw-pc-scenario-card.selected { border-color: #c8ff00; background: rgba(200,255,0,0.06); }
  .aw-pc-lp-card { padding: 14px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.18s; }
  .aw-pc-lp-card:hover { border-color: rgba(96,165,250,0.40); background: rgba(96,165,250,0.04); }
  .aw-pc-lp-card.selected { border-color: #60a5fa; background: rgba(96,165,250,0.06); }
  .aw-pc-range { width: 100%; accent-color: #c8ff00; }
  .aw-pc-toggle { position:relative; width:42px; height:24px; cursor:pointer; }
  .aw-pc-toggle input { opacity:0; width:0; height:0; }
  .aw-pc-toggle-slider { position:absolute; top:0; left:0; right:0; bottom:0; background:#334155; border-radius:9999px; transition:0.3s; }
  .aw-pc-toggle input:checked + .aw-pc-toggle-slider { background:#c8ff00; }
  .aw-pc-toggle-slider:before { content:''; position:absolute; height:18px; width:18px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:0.3s; }
  .aw-pc-toggle input:checked + .aw-pc-toggle-slider:before { transform:translateX(18px); background:#12140a; }
`;
if (typeof document !== 'undefined' && !document.getElementById('aw-pc-styles')) {
  const s = document.createElement('style'); s.id = 'aw-pc-styles'; s.textContent = STYLES; document.head.appendChild(s);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Campaign {
  id: string; name: string; status: string;
  emails_sent?: number; emails_opened?: number; links_clicked?: number; data_submitted?: number;
  total_queue_size?: number; launched_at?: string; created_at?: string;
  company_id?: string;
}
interface Target { id: string; email: string; first_name?: string; last_name?: string; status?: string; sent_at?: string; opened_at?: string; clicked_at?: string; submitted_at?: string; recipient_id?: string; }
interface Group { id: string; name: string; member_count?: number; }
interface SmtpProfile { id: string; name: string; from_email: string; from_name: string; }
interface EmailTemplate { id: string; name: string; subject: string; html_content: string; }
interface LandingPage { id: string; name: string; html_content?: string; }
interface Scenario { id: string; name: string; description?: string; category: string; difficulty: string; email_subject: string; email_html: string; landing_page_html?: string; tags?: string[]; }
interface PhishingAlert { id: string; title: string; message: string; priority: string; alert_type: string; is_read: boolean; created_at: string; }
interface PhishingEvent { id: string; event_type: string; email?: string; ip_address?: string; browser?: string; os?: string; created_at: string; metadata?: Record<string, unknown>; }

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const PREVIEW_VARS: Record<string, string> = {
  '{{.FirstName}}': 'John', '{{.LastName}}': 'Smith', '{{.Email}}': 'john.smith@company.com',
  '{{.Department}}': 'Finance', '{{.Position}}': 'Senior Analyst', '{{.Company}}': 'Acme Corp',
  '{{.From}}': 'IT Support', '{{.TrackingURL}}': '#', '{{.URL}}': '#',
};
const applyPreview = (html: string) => Object.entries(PREVIEW_VARS).reduce((s, [k, v]) => s.replaceAll(k, v), html);

const statusColor = (s: string) => {
  if (s === 'RUNNING') return { color: T.green, bg: T.greenBg, border: T.greenBorder };
  if (s === 'COMPLETED') return { color: T.blue, bg: T.blueBg, border: T.blueBorder };
  if (s === 'PAUSED') return { color: T.orange, bg: T.orangeBg, border: T.orangeBorder };
  if (s === 'SCHEDULED') return { color: T.purple, bg: T.purpleBg, border: T.purpleBorder };
  return { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint };
};

const difficultyColor = (d: string) => {
  if (d === 'EASY') return T.green; if (d === 'MEDIUM') return T.orange;
  if (d === 'HARD') return T.red; if (d === 'EXPERT') return T.purple;
  return T.textMuted;
};

const fmtTime = (ts: string) => {
  const d = new Date(ts); const now = Date.now(); const diff = now - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
};

const eventIcon: Record<string, { icon: React.ElementType; color: string }> = {
  EMAIL_QUEUED: { icon: Clock, color: T.textMuted }, EMAIL_SENT: { icon: Send, color: T.blue },
  EMAIL_FAILED: { icon: X, color: T.red }, EMAIL_OPENED: { icon: Eye, color: T.green },
  LINK_CLICKED: { icon: MousePointerClick, color: T.orange }, FORM_SUBMITTED: { icon: Key, color: T.red },
  EMAIL_REPORTED: { icon: Flag, color: T.purple },
};
// @ts-ignore
const Flag = AlertTriangle;

const TIMEZONES = ['Asia/Riyadh', 'Asia/Dubai', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'];
const VARIABLE_CHIPS = ['{{.FirstName}}', '{{.LastName}}', '{{.Email}}', '{{.Department}}', '{{.Position}}', '{{.Company}}', '{{.TrackingURL}}'];

/* ─────────────────────────────────────────
   LABEL COMPONENT
───────────────────────────────────────── */
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{children}</div>
);

/* ─────────────────────────────────────────
   TOGGLE COMPONENT
───────────────────────────────────────── */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <label className="aw-pc-toggle">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className="aw-pc-toggle-slider" />
  </label>
);

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export const PhishingCampaignsPage: React.FC = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'wizard' | 'detail'>('list');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Detail view state
  const [targets, setTargets] = useState<Target[]>([]);
  const [events, setEvents] = useState<PhishingEvent[]>([]);
  const [alerts, setAlerts] = useState<PhishingAlert[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [targetEvents, setTargetEvents] = useState<PhishingEvent[]>([]);

  // Wizard state
  const [step, setStep] = useState(1);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [smtpProfiles, setSmtpProfiles] = useState<SmtpProfile[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [limits, setLimits] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  // Wizard form
  const [form, setForm] = useState({
    name: '', selectedScenario: null as Scenario | null,
    selectedGroups: [] as string[], smtpProfileId: '', fromName: '', fromAddress: '',
    emailsPerMinute: 10, randomDelay: false, randomDelayMax: 60,
    businessHoursOnly: false, businessHoursStart: 9, businessHoursEnd: 17, timezone: 'Asia/Riyadh',
    launchType: 'immediate' as 'immediate' | 'scheduled', scheduledAt: '',
    emailTemplateId: '', emailSubject: '', emailHtml: '',
    landingPageId: '', captureCredentials: false, redirectUrl: 'https://www.google.com',
  });
  const [showPreview, setShowPreview] = useState(false);

  const companyId = user?.company_id;

  const loadCampaigns = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('phishing_campaigns').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      setCampaigns(data || []);
    } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const loadWizardData = async () => {
    if (!companyId) return;
    const [scRes, grRes, smRes, etRes, lpRes, limRes] = await Promise.all([
      supabase.from('phishing_scenarios').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('phishing_groups').select('id, name').eq('company_id', companyId),
      supabase.from('smtp_profiles').select('id, name, from_email, from_name'),
      supabase.from('phishing_company_email_templates').select('id, name, subject, html_content').eq('company_id', companyId),
      supabase.from('phishing_company_landing_pages').select('id, name, html_content').eq('company_id', companyId),
      supabase.from('company_phishing_limits').select('*').eq('company_id', companyId).maybeSingle(),
    ]);
    setScenarios(scRes.data || []);
    setGroups(grRes.data || []);
    setSmtpProfiles(smRes.data || []);
    setEmailTemplates(etRes.data || []);
    setLandingPages(lpRes.data || []);
    setLimits(limRes.data);
  };

  const openWizard = () => {
    setStep(1);
    setForm({
      name: '', selectedScenario: null, selectedGroups: [], smtpProfileId: '', fromName: '', fromAddress: '',
      emailsPerMinute: 10, randomDelay: false, randomDelayMax: 60,
      businessHoursOnly: false, businessHoursStart: 9, businessHoursEnd: 17, timezone: 'Asia/Riyadh',
      launchType: 'immediate', scheduledAt: '',
      emailTemplateId: '', emailSubject: '', emailHtml: '',
      landingPageId: '', captureCredentials: false, redirectUrl: 'https://www.google.com',
    });
    loadWizardData();
    setView('wizard');
  };

  const openDetail = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setView('detail');
    const [tRes, eRes, aRes] = await Promise.all([
      supabase.from('phishing_campaign_targets').select('*').eq('campaign_id', campaign.id).order('created_at'),
      supabase.from('phishing_events').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('phishing_alerts').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: false }),
    ]);
    setTargets(tRes.data || []);
    setEvents(eRes.data || []);
    setAlerts(aRes.data || []);
    setSelectedTarget(null);
    setTargetEvents([]);
  };

  const openTargetDetail = async (t: Target) => {
    setSelectedTarget(t);
    const { data } = await supabase.from('phishing_events').select('*').eq('target_id', t.id).order('created_at', { ascending: false });
    setTargetEvents(data || []);
  };

  const pauseCampaign = async (id: string) => {
    await supabase.from('phishing_campaigns').update({ status: 'PAUSED', paused_at: new Date().toISOString() }).eq('id', id);
    loadCampaigns();
  };
  const resumeCampaign = async (id: string) => {
    await supabase.from('phishing_campaigns').update({ status: 'RUNNING', paused_at: null }).eq('id', id);
    loadCampaigns();
  };
  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign and all its data?')) return;
    await supabase.from('phishing_campaigns').delete().eq('id', id);
    loadCampaigns();
  };

  // Wizard: apply scenario
  const applyScenario = (sc: Scenario) => {
    setForm(f => ({
      ...f, selectedScenario: sc, emailSubject: sc.email_subject, emailHtml: sc.email_html,
    }));
  };

  // Wizard: apply email template
  const applyEmailTemplate = (id: string) => {
    const tpl = emailTemplates.find(t => t.id === id);
    if (tpl) setForm(f => ({ ...f, emailTemplateId: id, emailSubject: tpl.subject || f.emailSubject, emailHtml: tpl.html_content || f.emailHtml }));
    else setForm(f => ({ ...f, emailTemplateId: id }));
  };

  // Wizard: apply smtp profile
  const applySmtp = (id: string) => {
    const p = smtpProfiles.find(s => s.id === id);
    if (p) setForm(f => ({ ...f, smtpProfileId: id, fromName: p.from_name, fromAddress: p.from_email }));
    else setForm(f => ({ ...f, smtpProfileId: id }));
  };

  // Group target count
  const getGroupCount = (gid: string) => groups.find(g => g.id === gid)?.member_count ?? 0;
  const totalTargets = form.selectedGroups.reduce((s, g) => s + getGroupCount(g), 0);

  // Launch campaign
  const launchCampaign = async (asDraft: boolean) => {
    if (!companyId || !form.name.trim()) return;
    setSaving(true);
    try {
      const scheduledAt = form.launchType === 'scheduled' && form.scheduledAt ? form.scheduledAt : null;
      const status = asDraft ? 'DRAFT' : (scheduledAt ? 'SCHEDULED' : 'RUNNING');

      // ── 1. Load group members first to get target count ──
      const { data: members } = await supabase
        .from('phishing_group_members')
        .select('email, first_name, last_name, position, department')
        .in('group_id', form.selectedGroups);

      const targetCount = members?.length ?? 0;

      // ── 2. Server-side limit enforcement (backend RPC) ──
      if (!asDraft && status !== 'DRAFT') {
        const { data: limitCheck } = await supabase.rpc('check_phishing_limits', {
          p_company_id:   companyId,
          p_target_count: targetCount,
        });
        if (limitCheck && !limitCheck.allowed) {
          alert(`Campaign blocked: ${limitCheck.reason}`);
          setSaving(false);
          return;
        }
      }

      // ── 3. Fetch company info for variable resolution ──
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();
      const companyName = companyData?.name || '';

      // ── 4. Fetch custom variables for this company ──
      const { data: customVarRows } = await supabase
        .from('phishing_custom_variables')
        .select('variable_name, variable_value')
        .eq('company_id', companyId);
      const customVars: Record<string, string> = {};
      for (const row of (customVarRows || [])) {
        customVars[row.variable_name] = row.variable_value;
      }

      // ── 5. Create campaign record ──
      const { data: camp, error: campErr } = await supabase.from('phishing_campaigns').insert({
        company_id: companyId,
        name: form.name,
        status,
        smtp_profile_id: form.smtpProfileId || null,
        group_ids: form.selectedGroups,
        scenario_id: form.selectedScenario?.id || null,
        emails_per_minute: form.emailsPerMinute,
        random_delay_enabled: form.randomDelay,
        random_delay_max_seconds: form.randomDelayMax,
        business_hours_only: form.businessHoursOnly,
        business_hours_start: form.businessHoursStart,
        business_hours_end: form.businessHoursEnd,
        timezone: form.timezone,
        scheduled_at: scheduledAt,
        launched_at: !asDraft && !scheduledAt ? new Date().toISOString() : null,
      }).select().single();
      if (campErr || !camp) throw campErr || new Error('Campaign creation failed');

      // ── 6. Insert targets (no employee_id — group-based targeting) ──
      if (members && members.length > 0) {
        const targetsInsert = members.map(m => ({
          campaign_id: camp.id,
          email:       m.email,
          first_name:  m.first_name  || '',
          last_name:   m.last_name   || '',
          position:    m.position    || '',
          department:  m.department  || '',
          status:      'PENDING',
        }));
        // Insert in batches of 500
        for (let i = 0; i < targetsInsert.length; i += 500) {
          await supabase.from('phishing_campaign_targets').insert(targetsInsert.slice(i, i + 500));
        }
      }

      // ── 7. Enqueue emails if launching now ──
      if (status === 'RUNNING') {
        const emailHtml  = form.emailHtml  || form.selectedScenario?.email_html  || '<p>Security Awareness Test</p>';
        const subject    = form.emailSubject || form.selectedScenario?.email_subject || 'Important Security Notice';
        const fromAddr   = form.fromAddress || 'noreply@awareone.io';
        const fromName   = form.fromName   || 'AwareOne Security';
        const redirectUrl = form.redirectUrl || 'https://www.google.com';

        // Fetch inserted targets with their recipient_ids (generated by DB)
        const { data: insertedTargets } = await supabase
          .from('phishing_campaign_targets')
          .select('id, email, first_name, last_name, position, department, recipient_id')
          .eq('campaign_id', camp.id);

        if (insertedTargets && insertedTargets.length > 0) {
          // Get Supabase URL for tracking base
          const supabaseUrl = (supabase as unknown as { supabaseUrl?: string }).supabaseUrl
            || import.meta.env?.VITE_SUPABASE_URL
            || '';
          const trackBase = `${supabaseUrl}/functions/v1/phishing-track`;

          const intervalMs = 60000 / Math.max(form.emailsPerMinute, 1);
          const baseTime   = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();

          const queueEntries = insertedTargets.map((t, i) => {
            const randomDelaySec = form.randomDelay
              ? Math.floor(Math.random() * Math.max(form.randomDelayMax, 1))
              : 0;
            const sendAt = new Date(baseTime + i * intervalMs + randomDelaySec * 1000);

            // Full variable resolution per target
            const resolvedHtml = resolveVariables(emailHtml, {
              email:       t.email,
              first_name:  t.first_name,
              last_name:   t.last_name,
              department:  t.department,
              position:    t.position,
              recipient_id: t.recipient_id,
            }, {
              campaign_id:   camp.id,
              company_name:  companyName,
              redirect_url:  redirectUrl,
              tracking_base: trackBase,
            }, customVars);

            // Ensure tracking pixel is in the HTML
            const pixelUrl   = `${trackBase}?t=open&c=${camp.id}&r=${encodeURIComponent(t.recipient_id)}`;
            const trackPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
            const finalHtml  = resolvedHtml.includes('phishing-track?t=open')
              ? resolvedHtml
              : resolvedHtml.includes('</body>')
                ? resolvedHtml.replace('</body>', trackPixel + '</body>')
                : resolvedHtml + trackPixel;

            return {
              campaign_id:    camp.id,
              target_id:      t.id,
              company_id:     companyId,
              smtp_profile_id: form.smtpProfileId || null,
              recipient_email: t.email,
              recipient_id:   t.recipient_id,
              email_subject:  resolveVariables(subject, { email: t.email, first_name: t.first_name, last_name: t.last_name, department: t.department, position: t.position, recipient_id: t.recipient_id }, { campaign_id: camp.id, company_name: companyName, redirect_url: redirectUrl, tracking_base: trackBase }, customVars),
              email_html:     finalHtml,
              from_address:   fromAddr,
              from_name:      fromName,
              scheduled_at:   sendAt.toISOString(),
            };
          });

          // Insert queue in batches of 100 (handles 10k+ campaigns)
          for (let i = 0; i < queueEntries.length; i += 100) {
            await supabase.from('campaign_email_queue').insert(queueEntries.slice(i, i + 100));
          }
          await supabase.from('phishing_campaigns')
            .update({ total_queue_size: queueEntries.length })
            .eq('id', camp.id);

          // Update monthly email usage counter (backend enforcement)
          await supabase.rpc('update_company_email_usage', {
            p_company_id: companyId,
            p_count: queueEntries.length,
          });

          // Trigger first batch immediately (fire-and-forget)
          supabase.functions.invoke('process-campaign', {
            body: { campaign_id: camp.id, batch_size: 50 },
          }).catch(() => {});
        }

        // Alert: campaign started
        await supabase.from('phishing_alerts').insert({
          campaign_id: camp.id,
          company_id:  companyId,
          alert_type:  'CAMPAIGN_STARTED',
          priority:    'LOW',
          title:       `Campaign Started: ${form.name}`,
          message:     `Phishing campaign "${form.name}" launched with ${targetCount} targets.`,
        });
      }

      setView('list');
      loadCampaigns();
    } catch (err) {
      console.error('[launchCampaign]', err);
      alert('Failed to launch campaign: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally { setSaving(false); }
  };

  /* ── Render: Campaign List ── */
  const renderList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Shield size={16} style={{ color: T.accent }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase' }}>Phishing Campaigns</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: 0 }}>Campaign Management</h1>
        </div>
        <button className="aw-pc-btn" onClick={openWizard} style={{ background: T.accent, color: T.accentDark, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> New Campaign
        </button>
      </div>

      {/* Stats bar */}
      {campaigns.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {[
            { label: 'Total', value: campaigns.length, color: T.accent },
            { label: 'Running', value: campaigns.filter(c => c.status === 'RUNNING').length, color: T.green },
            { label: 'Completed', value: campaigns.filter(c => c.status === 'COMPLETED').length, color: T.blue },
            { label: 'Drafts', value: campaigns.filter(c => c.status === 'DRAFT').length, color: T.textMuted },
          ].map(s => (
            <div key={s.label} style={{ padding: '14px 16px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign table */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={14} style={{ color: T.accent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>All Campaigns</span>
          <button onClick={loadCampaigns} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted }}>
            <RefreshCw size={13} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Shield size={40} style={{ color: T.textMuted, margin: '0 auto 12px' }} />
            <p style={{ color: T.textBody, margin: '0 0 16px' }}>No phishing campaigns yet.</p>
            <button className="aw-pc-btn" onClick={openWizard} style={{ background: T.accent, color: T.accentDark }}>Create First Campaign</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {campaigns.map(c => {
              const sc = statusColor(c.status);
              const sent = c.emails_sent || 0;
              const opened = c.emails_opened || 0;
              const clicked = c.links_clicked || 0;
              const total = c.total_queue_size || 1;
              return (
                <div key={c.id} className="aw-pc-row" onClick={() => openDetail(c)} style={{ borderRadius: 0, border: 'none', borderBottom: `1px solid ${T.borderFaint}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span className="aw-pc-chip" style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>{c.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{c.launched_at ? `Launched ${fmtTime(c.launched_at)}` : `Created ${c.created_at ? fmtTime(c.created_at) : ''}`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
                    {[
                      { label: 'Sent', value: sent, color: T.blue },
                      { label: 'Opened', value: opened, color: T.green },
                      { label: 'Clicked', value: clicked, color: T.orange },
                      { label: 'Rate', value: sent > 0 ? `${Math.round((clicked/sent)*100)}%` : '0%', color: T.red },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: T.textMuted }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {c.status === 'RUNNING' && (
                      <button className="aw-pc-btn" onClick={() => pauseCampaign(c.id)} style={{ padding: '6px 10px', background: T.orangeBg, color: T.orange, border: `1px solid ${T.orangeBorder}` }}>
                        <Pause size={13} />
                      </button>
                    )}
                    {c.status === 'PAUSED' && (
                      <button className="aw-pc-btn" onClick={() => resumeCampaign(c.id)} style={{ padding: '6px 10px', background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }}>
                        <Play size={13} />
                      </button>
                    )}
                    <button className="aw-pc-btn" onClick={() => deleteCampaign(c.id)} style={{ padding: '6px 10px', background: T.redBg, color: T.red, border: `1px solid ${T.redBorder}` }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  /* ── Render: Campaign Detail ── */
  const renderDetail = () => {
    if (!selectedCampaign) return null;
    const sc = statusColor(selectedCampaign.status);
    const sent = selectedCampaign.emails_sent || 0;
    const opened = selectedCampaign.emails_opened || 0;
    const clicked = selectedCampaign.links_clicked || 0;
    const submitted = selectedCampaign.data_submitted || 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setView('list'); setSelectedCampaign(null); }} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', color: T.textBody, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 13 }}>
            <ChevronLeft size={14} /> Back
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: T.white, margin: 0 }}>{selectedCampaign.name}</h2>
              <span className="aw-pc-chip" style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>{selectedCampaign.status}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { label: 'Emails Sent', value: sent, color: T.blue, icon: Send },
            { label: 'Opened', value: opened, color: T.green, icon: Eye },
            { label: 'Link Clicked', value: clicked, color: T.orange, icon: MousePointerClick },
            { label: 'Credentials', value: submitted, color: T.red, icon: Key },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ padding: '16px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Icon size={16} style={{ color }} />
                <span style={{ fontSize: 22, fontWeight: 900, color }}>{value}</span>
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>{label}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{sent > 0 ? `${Math.round((value / sent) * 100)}%` : '0%'} rate</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          {/* Targets */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Targets ({targets.length})</span>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {targets.map(t => {
                const tsc = statusColor(t.status || 'PENDING');
                return (
                  <div key={t.id} className="aw-pc-row" onClick={() => openTargetDetail(t)} style={{ borderRadius: 0, border: 'none', borderBottom: `1px solid ${T.borderFaint}`, padding: '10px 18px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{t.email}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{t.first_name} {t.last_name}</div>
                    </div>
                    <span className="aw-pc-chip" style={{ color: tsc.color, background: tsc.bg, border: `1px solid ${tsc.border}`, fontSize: 10 }}>{t.status || 'PENDING'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Events / Alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Unread alerts */}
            {alerts.filter(a => !a.is_read).length > 0 && (
              <div style={{ background: T.bgCard, border: `1px solid ${T.redBorder}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} style={{ color: T.red }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.red }}>Alerts ({alerts.filter(a => !a.is_read).length})</span>
                </div>
                {alerts.filter(a => !a.is_read).slice(0, 4).map(a => (
                  <div key={a.id} style={{ padding: '10px 14px', borderBottom: `1px solid ${T.borderFaint}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{fmtTime(a.created_at)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Event timeline */}
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.borderFaint}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.white }}>Event Timeline</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {events.slice(0, 50).map(ev => {
                  const ei = eventIcon[ev.event_type] || { icon: Shield, color: T.textMuted };
                  const Icon = ei.icon;
                  return (
                    <div key={ev.id} style={{ padding: '8px 14px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${ei.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={11} style={{ color: ei.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.textBody, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.email || '—'}</div>
                        <div style={{ fontSize: 10, color: T.textMuted }}>{ev.event_type.replace('_', ' ')}</div>
                      </div>
                      <div style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>{fmtTime(ev.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Target detail panel */}
        {selectedTarget && (
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.white }}>{selectedTarget.email}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>Target Event History</div>
              </div>
              <button onClick={() => setSelectedTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {targetEvents.map(ev => {
                const ei = eventIcon[ev.event_type] || { icon: Shield, color: T.textMuted };
                const Icon = ei.icon;
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    <Icon size={14} style={{ color: ei.color }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.textBody }}>{ev.event_type.replace('_', ' ')}</span>
                      {ev.browser && <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{ev.browser} / {ev.os}</span>}
                    </div>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{fmtTime(ev.created_at)}</span>
                  </div>
                );
              })}
              {targetEvents.length === 0 && <div style={{ color: T.textMuted, fontSize: 12 }}>No events yet for this target.</div>}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── Render: Wizard ── */
  const renderWizard = () => {
    const steps = ['Setup', 'Targets & Sending', 'Email', 'Landing Page'];
    const canProceed = [
      form.name.trim().length > 0,
      form.selectedGroups.length > 0,
      form.emailSubject.trim().length > 0 && form.emailHtml.trim().length > 0,
      true,
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', color: T.textBody, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 13 }}>
            <ChevronLeft size={14} /> Cancel
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.white, margin: 0 }}>New Phishing Campaign</h2>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="aw-pc-step" style={{ background: i + 1 === step ? T.accent : (i + 1 < step ? T.green : 'rgba(255,255,255,0.08)'), color: i + 1 === step ? T.accentDark : (i + 1 < step ? T.accentDark : T.textMuted) }}>
                  {i + 1 < step ? <Check size={13} /> : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: i + 1 === step ? 700 : 500, color: i + 1 === step ? T.white : T.textMuted, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i + 1 < step ? T.green : T.borderFaint, margin: '0 10px' }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <Label>Campaign Name *</Label>
                <input className="aw-pc-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Q2 IT Support Phishing Test" />
              </div>
              <div>
                <Label>Scenario (optional)</Label>
                <div className="aw-pc-card-grid">
                  {scenarios.map(sc => (
                    <div key={sc.id} className={`aw-pc-scenario-card ${form.selectedScenario?.id === sc.id ? 'selected' : ''}`} onClick={() => applyScenario(sc)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>{sc.category}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: difficultyColor(sc.difficulty) }}>{sc.difficulty}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 4 }}>{sc.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{sc.description?.slice(0, 80)}</div>
                      {form.selectedScenario?.id === sc.id && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={11} style={{ color: T.accent }} /><span style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>Selected</span></div>}
                    </div>
                  ))}
                  <div className={`aw-pc-scenario-card ${!form.selectedScenario ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, selectedScenario: null }))}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 4 }}>Custom</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>Build your own email and landing page</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <Label>Target Groups * ({totalTargets} targets)</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groups.map(g => (
                    <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${form.selectedGroups.includes(g.id) ? T.accent + '40' : T.borderFaint}`, borderRadius: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.selectedGroups.includes(g.id)} onChange={e => setForm(f => ({ ...f, selectedGroups: e.target.checked ? [...f.selectedGroups, g.id] : f.selectedGroups.filter(x => x !== g.id) }))} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{g.member_count || 0} members</div>
                      </div>
                      {form.selectedGroups.includes(g.id) && <Check size={14} style={{ color: T.accent }} />}
                    </label>
                  ))}
                  {groups.length === 0 && <div style={{ color: T.textMuted, fontSize: 13 }}>No groups found. Create groups in Phishing Groups first.</div>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <Label>SMTP Profile</Label>
                  <select className="aw-pc-select" value={form.smtpProfileId} onChange={e => applySmtp(e.target.value)}>
                    <option value="">Platform Default</option>
                    {smtpProfiles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <select className="aw-pc-select" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div>
                  <Label>From Name</Label>
                  <input className="aw-pc-input" value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} placeholder="IT Support" />
                </div>
                <div>
                  <Label>From Address</Label>
                  <input className="aw-pc-input" value={form.fromAddress} onChange={e => setForm(f => ({ ...f, fromAddress: e.target.value }))} placeholder="it@company.com" type="email" />
                </div>
              </div>

              <div>
                <Label>Sending Speed: {form.emailsPerMinute} emails/min</Label>
                <input type="range" className="aw-pc-range" min={1} max={100} value={form.emailsPerMinute} onChange={e => setForm(f => ({ ...f, emailsPerMinute: Number(e.target.value) }))} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textMuted }}>
                  <span>1/min</span><span>100/min</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Label>Random Delay</Label>
                    <Toggle checked={form.randomDelay} onChange={v => setForm(f => ({ ...f, randomDelay: v }))} />
                  </div>
                  {form.randomDelay && (
                    <div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Max delay: {form.randomDelayMax}s</div>
                      <input type="range" className="aw-pc-range" min={1} max={300} value={form.randomDelayMax} onChange={e => setForm(f => ({ ...f, randomDelayMax: Number(e.target.value) }))} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Label>Business Hours Only</Label>
                    <Toggle checked={form.businessHoursOnly} onChange={v => setForm(f => ({ ...f, businessHoursOnly: v }))} />
                  </div>
                  {form.businessHoursOnly && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="aw-pc-input" type="number" min={0} max={23} value={form.businessHoursStart} onChange={e => setForm(f => ({ ...f, businessHoursStart: Number(e.target.value) }))} style={{ width: 80 }} />
                      <span style={{ color: T.textMuted, lineHeight: '36px' }}>to</span>
                      <input className="aw-pc-input" type="number" min={0} max={23} value={form.businessHoursEnd} onChange={e => setForm(f => ({ ...f, businessHoursEnd: Number(e.target.value) }))} style={{ width: 80 }} />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Launch Type</Label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['immediate', 'scheduled'] as const).map(lt => (
                    <button key={lt} onClick={() => setForm(f => ({ ...f, launchType: lt }))} className="aw-pc-btn" style={{ background: form.launchType === lt ? T.accent : 'rgba(255,255,255,0.06)', color: form.launchType === lt ? T.accentDark : T.textBody }}>
                      {lt === 'immediate' ? 'Immediate' : 'Scheduled'}
                    </button>
                  ))}
                </div>
                {form.launchType === 'scheduled' && (
                  <div style={{ marginTop: 10 }}>
                    <input className="aw-pc-input" type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <Label>Email Template (optional)</Label>
                  <select className="aw-pc-select" value={form.emailTemplateId} onChange={e => applyEmailTemplate(e.target.value)}>
                    <option value="">Custom / From Scenario</option>
                    {emailTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Email Subject *</Label>
                  <input className="aw-pc-input" value={form.emailSubject} onChange={e => setForm(f => ({ ...f, emailSubject: e.target.value }))} placeholder="Your account requires attention" />
                </div>
              </div>

              {/* Variable chips */}
              <div>
                <Label>Template Variables (click to copy)</Label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {VARIABLE_CHIPS.map(v => (
                    <button key={v} onClick={() => navigator.clipboard?.writeText(v)} style={{ padding: '4px 10px', background: 'rgba(96,165,250,0.08)', border: `1px solid rgba(96,165,250,0.22)`, borderRadius: 6, fontSize: 11, color: T.blue, cursor: 'pointer', fontFamily: 'monospace' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Label>Email HTML *</Label>
                  <button onClick={() => setShowPreview(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.blue, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Eye size={13} /> {showPreview ? 'Edit' : 'Preview'}
                  </button>
                </div>
                {showPreview ? (
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, height: 360, overflow: 'auto', background: '#fff' }}>
                    <iframe srcDoc={applyPreview(form.emailHtml)} style={{ width: '100%', height: '100%', border: 'none' }} title="Email Preview" />
                  </div>
                ) : (
                  <textarea className="aw-pc-textarea" rows={14} value={form.emailHtml} onChange={e => setForm(f => ({ ...f, emailHtml: e.target.value }))} placeholder="<html><body>...</body></html>" />
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <Label>Landing Page (optional)</Label>
                <div className="aw-pc-card-grid">
                  <div className={`aw-pc-lp-card ${!form.landingPageId ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, landingPageId: '' }))}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 4 }}>No Landing Page</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>Link redirects directly to destination</div>
                  </div>
                  {landingPages.map(lp => (
                    <div key={lp.id} className={`aw-pc-lp-card ${form.landingPageId === lp.id ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, landingPageId: lp.id }))}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 4 }}>{lp.name}</div>
                      {form.landingPageId === lp.id && <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={11} style={{ color: T.blue }} /><span style={{ fontSize: 10, color: T.blue, fontWeight: 700 }}>Selected</span></div>}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Label>Capture Credentials</Label>
                    <Toggle checked={form.captureCredentials} onChange={v => setForm(f => ({ ...f, captureCredentials: v }))} />
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>Log submitted form data in events</div>
                </div>
                <div>
                  <Label>Redirect URL After Submission</Label>
                  <input className="aw-pc-input" value={form.redirectUrl} onChange={e => setForm(f => ({ ...f, redirectUrl: e.target.value }))} placeholder="https://www.google.com" />
                </div>
              </div>

              {/* Summary */}
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 10 }}>Campaign Summary</div>
                {[
                  ['Name', form.name],
                  ['Scenario', form.selectedScenario?.name || 'Custom'],
                  ['Target Groups', form.selectedGroups.length + ` groups (${totalTargets} targets)`],
                  ['Sending Speed', `${form.emailsPerMinute} emails/min`],
                  ['Business Hours', form.businessHoursOnly ? `${form.businessHoursStart}:00 – ${form.businessHoursEnd}:00 ${form.timezone}` : 'No restriction'],
                  ['Launch', form.launchType === 'immediate' ? 'Immediate' : (form.scheduledAt || 'Not set')],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: T.textMuted }}>{k}</span>
                    <span style={{ color: T.textBody, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                {limits && (limits as Record<string, unknown>).emails_sent_this_month !== undefined && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: T.orange }}>
                      Monthly usage: {(limits as Record<string, number>).emails_sent_this_month || 0} / {(limits as Record<string, number>).max_emails_per_month || 5000} emails
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="aw-pc-btn" onClick={() => setStep(s => s - 1)} disabled={step === 1} style={{ background: 'rgba(255,255,255,0.06)', color: T.textBody, opacity: step === 1 ? 0.4 : 1 }}>
            <ChevronLeft size={14} style={{ display: 'inline', marginRight: 4 }} /> Previous
          </button>
          {step < 4 ? (
            <button className="aw-pc-btn" onClick={() => setStep(s => s + 1)} disabled={!canProceed[step - 1]} style={{ background: canProceed[step - 1] ? T.accent : 'rgba(255,255,255,0.08)', color: canProceed[step - 1] ? T.accentDark : T.textMuted }}>
              Next <ChevronRight size={14} style={{ display: 'inline', marginLeft: 4 }} />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="aw-pc-btn" onClick={() => launchCampaign(true)} disabled={saving} style={{ background: 'rgba(255,255,255,0.06)', color: T.textBody }}>
                Save as Draft
              </button>
              <button className="aw-pc-btn" onClick={() => launchCampaign(false)} disabled={saving || !form.name.trim()} style={{ background: T.accent, color: T.accentDark, display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
                {saving ? 'Launching…' : 'Launch Campaign'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {view === 'list' && renderList()}
      {view === 'wizard' && renderWizard()}
      {view === 'detail' && renderDetail()}
    </div>
  );
};
