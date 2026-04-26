import React, { useState, useEffect } from 'react';
import { Download, FileText, TrendingUp, Users, BarChart2, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PublicAssessment } from '../../lib/types';

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
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-ps-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-ps-table th {
    padding: 10px 14px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-ps-table td {
    padding: 12px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .aw-ps-table tr:last-child td { border-bottom: none; }
  .aw-ps-table tr:hover td { background: rgba(255,255,255,0.02); }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-bar-in  { from { width:0%; } to { width:var(--w); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-ps-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-ps-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const fmt = (d: string) => new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });

const pctConfig = (pct: number) => {
  if (pct >= 90) return { color: T.green,  bg: T.greenBg,  border: T.greenBorder  };
  if (pct >= 70) return { color: T.blue,   bg: T.blueBg,   border: T.blueBorder   };
  if (pct >= 50) return { color: T.gold,   bg: T.goldBg,   border: T.goldBorder   };
  return              { color: T.red,    bg: T.redBg,    border: T.redBorder    };
};

/* ─────────────────────────────────────────
   MINI LINE SPARKLINE (SVG)
───────────────────────────────────────── */
const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (data.length < 2) return null;
  const W = 80; const H = 28;
  const min = Math.min(...data); const max = Math.max(...data);
  const range = max - min || 1;
  const xStep = (W - 4) / (data.length - 1);
  const points = data.map((v, i) => `${2 + i * xStep},${H - 2 - ((v - min) / range) * (H - 4)}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ─────────────────────────────────────────
   SCORE DISTRIBUTION BAR
───────────────────────────────────────── */
const DistBar: React.FC<{ pct: number; color: string; label: string; count: number; total: number }> = ({ pct, color, label, count, total }) => {
  const width = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span style={{ width: 40, color: T.textMuted, fontWeight: 600, fontSize: 11 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ '--w': `${width}%`, width: `${width}%`, height: '100%', background: color, borderRadius: 9999, animation: 'aw-bar-in 0.6s ease both' } as React.CSSProperties} />
      </div>
      <span style={{ width: 28, textAlign: 'right', color: T.textBody, fontWeight: 700 }}>{count}</span>
    </div>
  );
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PublicSubmissionsPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<PublicAssessment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [stats, setStats] = useState({ total: 0, averageScore: 0, averagePercentage: 0 });

  useEffect(() => { loadSubmissions(); }, []);

  const loadSubmissions = async () => {
    const { data } = await supabase.from('public_assessments').select('*').order('completed_at', { ascending: false });
    if (data) {
      setSubmissions(data);
      const total = data.length;
      const totalScore = data.reduce((s, x) => s + x.score, 0);
      const totalQ     = data.reduce((s, x) => s + x.total_questions, 0);
      setStats({ total, averageScore: total > 0 ? Math.round(totalScore / total) : 0, averagePercentage: totalQ > 0 ? Math.round((totalScore / totalQ) * 100) : 0 });
    }
    setLoading(false);
  };

  const exportCSV = () => {
    const headers = ['Name','Email','Phone','Company','Job Title','Score','Total','Percentage','Date'];
    const rows = submissions.map(s => [s.full_name, s.email, s.phone || '', s.company_name || '', s.job_title || '', s.score, s.total_questions, `${Math.round((s.score / s.total_questions) * 100)}%`, new Date(s.completed_at).toLocaleDateString()]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url;
    a.download = `public-assessments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  /* Search filter */
  const filtered = search.trim()
    ? submissions.filter(s =>
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        (s.company_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : submissions;

  /* Score distribution */
  const dist = {
    excellent: submissions.filter(s => (s.score / s.total_questions) >= 0.9).length,
    good:      submissions.filter(s => { const p = s.score / s.total_questions; return p >= 0.7 && p < 0.9; }).length,
    average:   submissions.filter(s => { const p = s.score / s.total_questions; return p >= 0.5 && p < 0.7; }).length,
    low:       submissions.filter(s => (s.score / s.total_questions) < 0.5).length,
  };

  /* Trend: last 7 days avg pct */
  const sparkData = (() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toDateString();
    });
    return days.map(day => {
      const dayItems = submissions.filter(s => new Date(s.completed_at).toDateString() === day);
      return dayItems.length > 0 ? Math.round(dayItems.reduce((sum, s) => sum + (s.score / s.total_questions) * 100, 0) / dayItems.length) : 0;
    });
  })();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.purpleBg, border: '1px solid rgba(167,139,250,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} style={{ color: T.purple }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Public Submissions</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>View and analyze visitor assessment results.</p>
        </div>
        <button
          onClick={exportCSV}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green, transition: 'background 0.18s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.16)')}
          onMouseLeave={e => (e.currentTarget.style.background = T.greenBg)}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        {[
          { icon: Users,     color: T.accent,  bg: 'rgba(200,255,0,0.08)', border: 'rgba(200,255,0,0.20)', label: 'Total Submissions', value: stats.total,                   suffix: '' },
          { icon: TrendingUp,color: T.green,   bg: T.greenBg,              border: T.greenBorder,           label: 'Avg Score',         value: stats.averageScore,             suffix: ' pts' },
          { icon: BarChart2, color: T.blue,    bg: T.blueBg,               border: T.blueBorder,            label: 'Avg Percentage',    value: stats.averagePercentage,        suffix: '%' },
        ].map(({ icon: Icon, color, bg, border, label, value, suffix }, i) => (
          <div key={label} className="aw-fade-up" style={{ animationDelay: `${i * 0.05}s`, padding: '18px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={17} style={{ color }} />
              </div>
              <span style={{ fontSize: 26, fontWeight: 900, color: T.white }}>{value}{suffix}</span>
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{label}</div>
          </div>
        ))}

        {/* 7-day trend sparkline card */}
        <div className="aw-fade-up" style={{ animationDelay: '0.15s', padding: '18px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${T.orange}, ${T.orange}40)` }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: T.orangeBg, border: `1px solid ${T.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={17} style={{ color: T.orange }} />
            </div>
            <Sparkline data={sparkData} color={T.orange} />
          </div>
          <div style={{ fontSize: 12, color: T.textMuted }}>7-Day Score Trend</div>
        </div>
      </div>

      {/* ── Score distribution ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.18s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '13px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={14} style={{ color: T.accent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Score Distribution</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>{submissions.length} total</span>
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <DistBar label="≥90%" color={T.green}  count={dist.excellent} total={submissions.length} pct={0} />
          <DistBar label="≥70%" color={T.blue}   count={dist.good}      total={submissions.length} pct={0} />
          <DistBar label="≥50%" color={T.gold}   count={dist.average}   total={submissions.length} pct={0} />
          <DistBar label="<50%" color={T.red}    count={dist.low}       total={submissions.length} pct={0} />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.22s', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
            <input
              style={{ width: '100%', padding: '8px 36px 8px 32px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.white, outline: 'none', fontFamily: 'inherit' }}
              placeholder="Search by name, email, company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={e => (e.target.style.borderColor = 'rgba(200,255,0,0.40)')}
              onBlur={e  => (e.target.style.borderColor = T.border)}
            />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0 }}><X size={12} /></button>}
          </div>
          <span style={{ fontSize: 12, color: T.textMuted, flexShrink: 0 }}>
            Showing <strong style={{ color: T.textBody }}>{filtered.length}</strong> of {submissions.length}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="aw-ps-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Company</th>
                <th>Job Title</th>
                <th>Score</th>
                <th>Result</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const pct = Math.round((s.score / s.total_questions) * 100);
                const cfg = pctConfig(pct);
                return (
                  <tr key={s.id}>
                    <td style={{ color: T.textMuted, fontSize: 12, fontFamily: 'monospace' }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                          {s.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: T.white }}>{s.full_name}</span>
                      </div>
                    </td>
                    <td style={{ color: T.textMuted }}>{s.email}</td>
                    <td style={{ color: T.textMuted }}>{s.phone || '—'}</td>
                    <td>
                      {s.company_name
                        ? <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blue }}>{s.company_name}</span>
                        : <span style={{ color: T.textMuted }}>—</span>
                      }
                    </td>
                    <td style={{ color: T.textMuted }}>{s.job_title || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: T.white, fontSize: 13 }}>{s.score}/{s.total_questions}</span>
                        <div style={{ width: 36, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 9999 }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                        {pct}%
                      </span>
                    </td>
                    <td style={{ color: T.textMuted, fontSize: 12 }}>{fmt(s.completed_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted, fontSize: 13 }}>
            {search ? `No results matching "${search}"` : 'No public assessment submissions yet.'}
          </div>
        )}
      </div>
    </div>
  );
};
