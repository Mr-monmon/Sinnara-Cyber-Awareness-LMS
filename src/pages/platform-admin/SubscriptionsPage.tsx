import React, { useState, useEffect } from "react";
import {
  CreditCard, DollarSign, FileText, Plus, Edit2, Trash2,
  AlertCircle, Check, X, Download, Bell, Save, Loader2,
  Building2, TrendingUp, Clock,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Company, Invoice } from "../../lib/types";
import { useAuth } from '../../contexts/AuthContext';

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
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Table ── */
  .aw-sub-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-sub-table th {
    padding: 10px 14px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-sub-table td {
    padding: 12px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .aw-sub-table tr:last-child td { border-bottom: none; }
  .aw-sub-table tr:hover td { background: rgba(255,255,255,0.025); }

  /* ── Tabs ── */
  .aw-sub-tab {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: none; color: #64748b; transition: all 0.18s;
  }
  .aw-sub-tab:hover { background: rgba(255,255,255,0.05); color: #cbd5e1; }
  .aw-sub-tab.active {
    background: rgba(200,255,0,0.10);
    border: 1px solid rgba(200,255,0,0.22);
    color: #c8ff00;
  }

  /* ── Icon action btns ── */
  .aw-sub-icon-btn {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none;
  }
  .aw-sub-icon-btn.pay  { color: #34d399; border-color: rgba(52,211,153,0.22);  background: rgba(52,211,153,0.07);  }
  .aw-sub-icon-btn.pay:hover  { background: rgba(52,211,153,0.16); }
  .aw-sub-icon-btn.edit { color: #60a5fa; border-color: rgba(96,165,250,0.22);  background: rgba(96,165,250,0.07);  }
  .aw-sub-icon-btn.edit:hover { background: rgba(96,165,250,0.16); }
  .aw-sub-icon-btn.del  { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-sub-icon-btn.del:hover  { background: rgba(248,113,113,0.16); }
  .aw-sub-icon-btn.bell { color: #fb923c; border-color: rgba(251,146,60,0.22);  background: rgba(251,146,60,0.07);  }
  .aw-sub-icon-btn.bell:hover { background: rgba(251,146,60,0.16); }
  .aw-sub-icon-btn.bell.sent { color: #64748b; border-color: rgba(255,255,255,0.09); background: rgba(255,255,255,0.04); cursor: not-allowed; }

  /* ── Form inputs ── */
  .aw-sub-input, .aw-sub-select, .aw-sub-textarea {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-sub-input   { padding: 11px 14px; }
  .aw-sub-textarea { padding: 11px 14px; resize: vertical; min-height: 80px; }
  .aw-sub-select  {
    padding: 11px 36px 11px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-sub-input:focus, .aw-sub-select:focus, .aw-sub-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-sub-input::placeholder, .aw-sub-textarea::placeholder { color: rgba(148,163,184,0.35); }
  .aw-sub-select option { background: #1a1e0e; color: #ffffff; }
  .aw-sub-label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif; }
  input[type="date"].aw-sub-input::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.4); cursor: pointer; }

  /* ── Primary btn ── */
  .aw-sub-btn-primary {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 16px rgba(200,255,0,0.18);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-sub-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-sub-btn-primary:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  .aw-sub-btn-ghost {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 16px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-sub-btn-ghost:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  /* ── Scrollbar ── */
  .aw-sub-scroll::-webkit-scrollbar { width: 3px; }
  .aw-sub-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-sub-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-sub-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-sub-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const SAR = (n: number) => `${n.toLocaleString()} SAR`;

const SUB_STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  ACTIVE:    { color: T.green,  bg: T.greenBg,  border: T.greenBorder  },
  EXPIRED:   { color: T.red,    bg: T.redBg,    border: T.redBorder    },
  CANCELLED: { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint },
  PENDING:   { color: T.gold,   bg: T.goldBg,   border: T.goldBorder   },
};
const INV_STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  PAID:      { color: T.green,  bg: T.greenBg,  border: T.greenBorder  },
  PENDING:   { color: T.gold,   bg: T.goldBg,   border: T.goldBorder   },
  OVERDUE:   { color: T.red,    bg: T.redBg,    border: T.redBorder    },
  CANCELLED: { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint },
  REFUNDED:  { color: T.purple, bg: T.purpleBg, border: T.purpleBorder },
};

const Badge: React.FC<{ label: string; cfg: { color: string; bg: string; border: string } }> = ({ label, cfg }) => (
  <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
    {label}
  </span>
);

const SUB_TYPE_LABELS: Record<string, string> = { POC_3M: 'Trial 3M', MONTHLY_6: '6 Months', YEARLY_1: '1 Year', YEARLY_2: '2 Years', CUSTOM: 'Custom' };

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard: React.FC<{ icon: React.ElementType; color: string; bg: string; label: string; value: string | number; delay?: string }> = ({ icon: Icon, color, bg, label, value, delay = '0s' }) => (
  <div className="aw-fade-up" style={{ animationDelay: delay, padding: '18px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: bg, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} style={{ color }} />
      </div>
      <span style={{ fontSize: 24, fontWeight: 900, color: T.white }}>{value}</span>
    </div>
    <div style={{ fontSize: 12, color: T.textMuted }}>{label}</div>
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const SubscriptionsPage: React.FC = () => {
  const { user }    = useAuth();
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices'>('subscriptions');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice]     = useState<Invoice | null>(null);
  const [selectedCompany, setSelectedCompany]   = useState('');
  const [savingInvoice, setSavingInvoice]       = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    company_id: '', issue_date: new Date().toISOString().split('T')[0], due_date: '', amount: 0, notes: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, iRes] = await Promise.all([
        supabase.from("companies").select("*").order("name"),
        supabase.from("invoices").select("*").order("issue_date", { ascending: false }),
      ]);
      if (cRes.data) setCompanies(cRes.data);
      if (iRes.data) setInvoices(iRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || 'Unknown';
  const getDaysRemaining = (end: string) => Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);

  /* ── Invoice actions ── */
  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingInvoice(true);
    try {
      const tax = invoiceForm.amount * 0.15;
      const total = invoiceForm.amount + tax;
      if (editingInvoice) {
        await supabase.from("invoices").update({ company_id: invoiceForm.company_id, issue_date: invoiceForm.issue_date, due_date: invoiceForm.due_date, amount: invoiceForm.amount, tax, total, notes: invoiceForm.notes }).eq("id", editingInvoice.id);
        await supabase.from("audit_logs").insert([{ user_id: user?.id, action_type: "UPDATE", entity_type: "INVOICE", entity_id: editingInvoice.id, description: `Updated invoice: ${editingInvoice.invoice_number}`, new_value: { amount: invoiceForm.amount, total } }]);
      } else {
        const { data: max } = await supabase.from("invoices").select("invoice_number").order("invoice_number", { ascending: false }).limit(1).maybeSingle();
        const next = max?.invoice_number ? parseInt(max.invoice_number.replace('INV-', '')) + 1 : 1;
        const invNum = 'INV-' + next.toString().padStart(6, '0');
        await supabase.from("invoices").insert([{ company_id: invoiceForm.company_id, invoice_number: invNum, issue_date: invoiceForm.issue_date, due_date: invoiceForm.due_date, amount: invoiceForm.amount, tax, total, currency: 'SAR', status: 'PENDING', notes: invoiceForm.notes }]);
        await supabase.from("audit_logs").insert([{ user_id: user?.id, action_type: "CREATE", entity_type: "INVOICE", description: `Created invoice: ${invNum}`, new_value: { invoice_number: invNum, amount: invoiceForm.amount, total } }]);
        alert('Invoice created: ' + invNum);
      }
      setShowInvoiceModal(false); setEditingInvoice(null);
      setInvoiceForm({ company_id: '', issue_date: new Date().toISOString().split('T')[0], due_date: '', amount: 0, notes: '' });
      await loadData();
    } catch (err) { alert('Failed to save invoice: ' + (err as any).message); }
    finally { setSavingInvoice(false); }
  };

  const handleEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setInvoiceForm({ company_id: inv.company_id, issue_date: inv.issue_date.split('T')[0], due_date: inv.due_date.split('T')[0], amount: inv.amount, notes: inv.notes || '' });
    setShowInvoiceModal(true);
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    await supabase.from("invoices").delete().eq("id", inv.id);
    await supabase.from("audit_logs").insert([{ user_id: user?.id, action_type: "DELETE", entity_type: "INVOICE", entity_id: inv.id, description: `Deleted invoice: ${inv.invoice_number}` }]);
    await loadData();
  };

  const handleUpdateInvoiceStatus = async (id: string, status: string) => {
    const updateData: any = { status };
    if (status === 'PAID') { updateData.payment_date = new Date().toISOString(); updateData.payment_method = 'Manual'; }
    await supabase.from("invoices").update(updateData).eq("id", id);
    await supabase.from("audit_logs").insert([{ user_id: user?.id, action_type: "UPDATE", entity_type: "INVOICE", entity_id: id, description: `Invoice status → ${status}`, new_value: { status } }]);
    await loadData();
  };

  const handleUpdateSubscription = async (company: Company, newStatus: string) => {
    await supabase.from("companies").update({ is_active: newStatus === 'ACTIVE' }).eq("id", company.id);
    await supabase.from("audit_logs").insert([{ user_id: user?.id, action_type: "UPDATE_COMPANY", entity_type: "COMPANY", entity_id: company.id, description: `Subscription → ${newStatus}`, new_value: { is_active: newStatus === 'ACTIVE' } }]);
    await loadData();
  };

  const handleSendReminder = async (company: Company) => {
    if (!company.admin_email) { alert("No admin email configured"); return; }
    if (!confirm(`Send renewal reminder to ${company.admin_email}?`)) return;
    const days = company.subscription_end ? getDaysRemaining(company.subscription_end) : 0;
    await supabase.from("companies").update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() }).eq("id", company.id);
    await supabase.from("audit_logs").insert([{ user_id: user?.id, action_type: "SEND_REMINDER", entity_type: "SUBSCRIPTION", entity_id: company.id, description: `Sent renewal reminder to ${company.name}`, new_value: { days_remaining: days, recipient: company.admin_email } }]);
    await loadData();
    alert(`Reminder sent to ${company.admin_email}`);
  };

  const exportCSV = () => {
    const rows = filteredInvoices.map(i => [i.invoice_number, getCompanyName(i.company_id), fmt(i.issue_date), fmt(i.due_date), i.amount, i.tax, i.total, i.currency, i.status, i.payment_method || '', i.notes || '']);
    const csv = [['Invoice#','Company','Issue','Due','Amount','Tax','Total','Currency','Status','Payment','Notes'], ...rows].map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportReport = () => {
    const content = filteredInvoices.map(i => `${i.invoice_number} | ${getCompanyName(i.company_id)} | ${SAR(i.total)} | ${i.status}`).join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = `invoice-report-${new Date().toISOString().split('T')[0]}.txt`; a.click(); URL.revokeObjectURL(url);
  };

  /* Computed stats */
  const totalRevenue      = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const pendingAmount     = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((s, i) => s + i.total, 0);
  const activeSubs        = companies.filter(c => c.subscription_end && getDaysRemaining(c.subscription_end) > 0 && c.is_active !== false).length;
  const expiringSubs      = companies.filter(c => c.subscription_end && getDaysRemaining(c.subscription_end) > 0 && getDaysRemaining(c.subscription_end) <= 30).length;
  const filteredCompanies = selectedCompany ? companies.filter(c => c.id === selectedCompany) : companies;
  const filteredInvoices  = selectedCompany ? invoices.filter(i => i.company_id === selectedCompany) : invoices;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={18} style={{ color: T.accent }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Subscriptions & Invoices</h1>
        </div>
        <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Manage company subscriptions and billing.</p>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 22 }}>
        <StatCard icon={DollarSign}  color={T.green}  bg={T.greenBg}  label="Total Revenue (SAR)"   value={totalRevenue.toLocaleString()} delay="0.00s" />
        <StatCard icon={AlertCircle} color={T.gold}   bg={T.goldBg}   label="Pending Amount (SAR)"  value={pendingAmount.toLocaleString()} delay="0.04s" />
        <StatCard icon={TrendingUp}  color={T.blue}   bg={T.blueBg}   label="Active Subscriptions"  value={activeSubs} delay="0.08s" />
        <StatCard icon={Clock}       color={T.orange} bg={T.orangeBg} label="Expiring in 30 Days"   value={expiringSubs} delay="0.12s" />
      </div>

      {/* ── Main card ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.15s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>

        {/* Header: tabs + filters */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`aw-sub-tab ${activeTab === 'subscriptions' ? 'active' : ''}`} onClick={() => setActiveTab('subscriptions')}>
              <CreditCard size={13} /> Subscriptions
            </button>
            <button className={`aw-sub-tab ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>
              <FileText size={13} /> Invoices
            </button>
          </div>

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Company filter */}
            <select
              style={{ padding: '8px 32px 8px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 12, color: T.textBody, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
              value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}
            >
              <option value="">All Companies</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {activeTab === 'invoices' && (
              <>
                <button className="aw-sub-btn-ghost" onClick={exportCSV} style={{ padding: '8px 14px', fontSize: 12 }}><Download size={13} /> CSV</button>
                <button className="aw-sub-btn-ghost" onClick={exportReport} style={{ padding: '8px 14px', fontSize: 12 }}><FileText size={13} /> Report</button>
                <button className="aw-sub-btn-primary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => { setEditingInvoice(null); setInvoiceForm({ company_id: '', issue_date: new Date().toISOString().split('T')[0], due_date: '', amount: 0, notes: '' }); setShowInvoiceModal(true); }}>
                  <Plus size={13} /> New Invoice
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── SUBSCRIPTIONS TAB ── */}
        {activeTab === 'subscriptions' && (
          <div style={{ overflowX: 'auto' }} className="aw-sub-scroll">
            <table className="aw-sub-table">
              <thead>
                <tr>
                  <th>Company</th><th>Admin</th><th>Type</th>
                  <th>Start</th><th>End</th><th>Days Left</th>
                  <th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.filter(c => c.subscription_end).map(co => {
                  const days     = getDaysRemaining(co.subscription_end!);
                  const isActive = co.is_active !== false && days > 0;
                  const expiring = days > 0 && days <= 30;
                  const daysColor = days < 0 ? T.red : days < 30 ? T.orange : T.green;

                  return (
                    <tr key={co.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                            {co.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: T.white }}>{co.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: T.textBody }}>{co.admin_name || '—'}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{co.admin_email || '—'}</div>
                      </td>
                      <td><span style={{ fontSize: 12, color: T.textMuted }}>{SUB_TYPE_LABELS[co.subscription_type || ''] || '—'}</span></td>
                      <td style={{ color: T.textMuted, fontSize: 12 }}>{fmt(co.subscription_start)}</td>
                      <td style={{ color: T.textMuted, fontSize: 12 }}>{fmt(co.subscription_end)}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: daysColor, fontSize: 13 }}>
                          {days < 0 ? 'Expired' : `${days}d`}
                        </span>
                      </td>
                      <td>
                        <Badge label={isActive ? 'Active' : 'Expired'} cfg={isActive ? SUB_STATUS_CFG.ACTIVE : SUB_STATUS_CFG.EXPIRED} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                          {expiring && (
                            <button className={`aw-sub-icon-btn bell ${co.reminder_sent ? 'sent' : ''}`}
                              disabled={co.reminder_sent}
                              title={co.reminder_sent ? `Reminder already sent` : 'Send renewal reminder'}
                              onClick={() => handleSendReminder(co)}>
                              <Bell size={13} />
                            </button>
                          )}
                          {isActive ? (
                            <button onClick={() => handleUpdateSubscription(co, 'EXPIRED')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 7, color: T.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              <X size={11} /> Deactivate
                            </button>
                          ) : (
                            <button onClick={() => handleUpdateSubscription(co, 'ACTIVE')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: T.greenBg, border: `1px solid ${T.greenBorder}`, borderRadius: 7, color: T.green, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              <Check size={11} /> Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredCompanies.filter(c => c.subscription_end).length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted, fontSize: 13 }}>No subscriptions found</div>
            )}
          </div>
        )}

        {/* ── INVOICES TAB ── */}
        {activeTab === 'invoices' && (
          <div style={{ overflowX: 'auto' }} className="aw-sub-scroll">
            <table className="aw-sub-table">
              <thead>
                <tr>
                  <th>Invoice #</th><th>Company</th><th>Issue Date</th><th>Due Date</th>
                  <th>Amount</th><th>VAT 15%</th><th>Total</th>
                  <th>Status</th><th>Payment</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const cfg = INV_STATUS_CFG[inv.status] ?? INV_STATUS_CFG.PENDING;
                  return (
                    <tr key={inv.id}>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: T.accent }}>{inv.invoice_number}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Building2 size={11} style={{ color: T.textMuted }} />
                          <span style={{ color: T.textBody }}>{getCompanyName(inv.company_id)}</span>
                        </div>
                      </td>
                      <td style={{ color: T.textMuted, fontSize: 12 }}>{fmt(inv.issue_date)}</td>
                      <td style={{ color: T.textMuted, fontSize: 12 }}>{fmt(inv.due_date)}</td>
                      <td style={{ color: T.textBody }}>{SAR(inv.amount)}</td>
                      <td style={{ color: T.textMuted }}>{SAR(inv.tax)}</td>
                      <td><span style={{ fontWeight: 700, color: T.white }}>{SAR(inv.total)} {inv.currency}</span></td>
                      <td><Badge label={inv.status} cfg={cfg} /></td>
                      <td style={{ color: T.textMuted, fontSize: 11 }}>
                        {inv.payment_date ? (
                          <div>
                            <div>{fmt(inv.payment_date)}</div>
                            <div style={{ color: T.textMuted }}>{inv.payment_method || '—'}</div>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {inv.status === 'PENDING' && (
                            <button className="aw-sub-icon-btn pay" title="Mark as Paid" onClick={() => handleUpdateInvoiceStatus(inv.id, 'PAID')}>
                              <Check size={13} />
                            </button>
                          )}
                          <button className="aw-sub-icon-btn edit" title="Edit" onClick={() => handleEditInvoice(inv)}>
                            <Edit2 size={13} />
                          </button>
                          <button className="aw-sub-icon-btn del" title="Delete" onClick={() => handleDeleteInvoice(inv)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredInvoices.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted, fontSize: 13 }}>No invoices found</div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════ INVOICE MODAL ═══════════ */}
      {showInvoiceModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowInvoiceModal(false); setEditingInvoice(null); }}>
          <div className="aw-modal-in" style={{ width: '100%', maxWidth: 500, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.55)', fontFamily: "'Inter', sans-serif" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} style={{ color: T.blue }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>{editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}</h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{editingInvoice ? editingInvoice.invoice_number : 'New invoice will be assigned a number'}</p>
                </div>
              </div>
              <button onClick={() => { setShowInvoiceModal(false); setEditingInvoice(null); }}
                style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice}>
              <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                <div>
                  <label className="aw-sub-label">Company <span style={{ color: T.accent }}>*</span></label>
                  <select className="aw-sub-select" required value={invoiceForm.company_id} onChange={e => setInvoiceForm(p => ({ ...p, company_id: e.target.value }))}>
                    <option value="">— Select Company —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="aw-sub-label">Issue Date <span style={{ color: T.accent }}>*</span></label>
                    <input className="aw-sub-input" type="date" required value={invoiceForm.issue_date} onChange={e => setInvoiceForm(p => ({ ...p, issue_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="aw-sub-label">Due Date <span style={{ color: T.accent }}>*</span></label>
                    <input className="aw-sub-input" type="date" required value={invoiceForm.due_date} onChange={e => setInvoiceForm(p => ({ ...p, due_date: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="aw-sub-label">Amount (SAR) <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-sub-input" type="number" required min="0" step="0.01" placeholder="10000" value={invoiceForm.amount || ''} onChange={e => setInvoiceForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />

                  {/* VAT preview */}
                  {invoiceForm.amount > 0 && (
                    <div style={{ marginTop: 10, padding: '12px 14px', background: T.blueBg, border: `1px solid ${T.blueBorder}`, borderRadius: 9 }}>
                      {[
                        { label: 'Base Amount', value: SAR(invoiceForm.amount), bold: false },
                        { label: 'VAT (15%)',    value: SAR(invoiceForm.amount * 0.15), bold: false },
                      ].map(r => (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textBody, marginBottom: 5 }}>
                          <span>{r.label}</span>
                          <span style={{ fontWeight: r.bold ? 800 : 500 }}>{r.value}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: T.white, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.blueBorder}` }}>
                        <span>Total</span>
                        <span style={{ color: T.blue }}>{SAR(invoiceForm.amount * 1.15)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="aw-sub-label">Notes</label>
                  <textarea className="aw-sub-textarea" placeholder="Additional notes…" rows={3} value={invoiceForm.notes} onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>

              <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10 }}>
                <button type="button" className="aw-sub-btn-ghost" onClick={() => { setShowInvoiceModal(false); setEditingInvoice(null); }} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button type="submit" className="aw-sub-btn-primary" disabled={savingInvoice} style={{ flex: 1, justifyContent: 'center' }}>
                  {savingInvoice ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</> : <><Save size={14} /> {editingInvoice ? 'Save Changes' : 'Create Invoice'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
