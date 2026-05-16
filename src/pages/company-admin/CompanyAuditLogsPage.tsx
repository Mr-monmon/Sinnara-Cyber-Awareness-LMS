import React, { useState, useEffect } from "react";
import { History, Search, Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const T = {
  bg:           "#12140a",
  bgCard:       "#1a1e0e",
  accent:       "#c8ff00",
  accentDark:   "#12140a",
  white:        "#ffffff",
  textBody:     "#94a3b8",
  textLabel:    "#cbd5e1",
  textMuted:    "#64748b",
  border:       "rgba(255,255,255,0.09)",
  borderFaint:  "rgba(255,255,255,0.05)",
  green:        "#34d399",  greenBg:    "rgba(52,211,153,0.08)",  greenBorder:  "rgba(52,211,153,0.22)",
  blue:         "#60a5fa",  blueBg:     "rgba(96,165,250,0.08)",  blueBorder:   "rgba(96,165,250,0.22)",
  red:          "#f87171",  redBg:      "rgba(248,113,113,0.08)", redBorder:    "rgba(248,113,113,0.22)",
  orange:       "#fb923c",  orangeBg:   "rgba(251,146,60,0.08)",  orangeBorder: "rgba(251,146,60,0.22)",
  purple:       "#a78bfa",  purpleBg:   "rgba(167,139,250,0.08)", purpleBorder: "rgba(167,139,250,0.22)",
} as const;

const ACTION_CFG: Record<string, { color: string; bg: string; border: string }> = {
  CREATE_USER:      { color: T.green,  bg: T.greenBg,   border: T.greenBorder   },
  UPLOAD_EMPLOYEES: { color: T.green,  bg: T.greenBg,   border: T.greenBorder   },
  UPDATE_USER:      { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  ASSIGN_COURSE:    { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  ASSIGN_EXAM:      { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  COMPLETE_COURSE:  { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  COMPLETE_EXAM:    { color: T.blue,   bg: T.blueBg,    border: T.blueBorder    },
  DELETE_USER:      { color: T.red,    bg: T.redBg,     border: T.redBorder     },
  RESET_PASSWORD:   { color: T.orange, bg: T.orangeBg,  border: T.orangeBorder  },
  CHANGE_PASSWORD:  { color: T.orange, bg: T.orangeBg,  border: T.orangeBorder  },
  UNLOCK_ACCOUNT:   { color: T.orange, bg: T.orangeBg,  border: T.orangeBorder  },
  LOGIN:            { color: T.purple, bg: T.purpleBg,  border: T.purpleBorder  },
  LOGIN_FAILED:     { color: T.red,    bg: T.redBg,     border: T.redBorder     },
};

const ACTION_LABELS: Record<string, string> = {
  CREATE_USER:      "New Employee",
  UPDATE_USER:      "Edit Employee",
  DELETE_USER:      "Delete Employee",
  UPLOAD_EMPLOYEES: "Bulk Import",
  ASSIGN_COURSE:    "Assign Course",
  ASSIGN_EXAM:      "Assign Exam",
  COMPLETE_COURSE:  "Course Completed",
  COMPLETE_EXAM:    "Exam Completed",
  RESET_PASSWORD:   "Reset Password",
  CHANGE_PASSWORD:  "Change Password",
  UNLOCK_ACCOUNT:   "Unlock Account",
  LOGIN:            "Login",
  LOGIN_FAILED:     "Login Failed",
};

interface AuditLog {
  id: string;
  action_type: string;
  entity_type: string | null;
  entity_name: string | null;
  description: string | null;
  created_at: string;
  users: { full_name: string | null; email: string | null } | null;
}

const PAGE_SIZE = 20;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CFG[action] ?? { color: T.textMuted, bg: "rgba(255,255,255,0.04)", border: T.borderFaint };
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 9999,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.3px",
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: "nowrap",
    }}>
      {ACTION_LABELS[action] ?? action.replace(/_/g, " ")}
    </span>
  );
}

export const CompanyAuditLogsPage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs]           = useState<AuditLog[]>([]);
  const [filtered, setFiltered]   = useState<AuditLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterDate, setFilterDate]     = useState("");
  const [page, setPage]           = useState(1);

  useEffect(() => { loadLogs(); }, [user]);
  useEffect(() => { applyFilter(); }, [logs, search, filterAction, filterDate]);

  const loadLogs = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("id, action_type, entity_type, entity_name, description, created_at, users(full_name, email)")
      .eq("company_id", user.company_id)
      .order("created_at", { ascending: false })
      .limit(1000);
    setLogs(data ?? []);
    setLoading(false);
  };

  const applyFilter = () => {
    let f = [...logs];
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(l =>
        l.description?.toLowerCase().includes(q) ||
        l.entity_name?.toLowerCase().includes(q) ||
        l.users?.full_name?.toLowerCase().includes(q) ||
        l.users?.email?.toLowerCase().includes(q)
      );
    }
    if (filterAction) f = f.filter(l => l.action_type === filterAction);
    if (filterDate)   f = f.filter(l => new Date(l.created_at) >= new Date(filterDate));
    setFiltered(f);
    setPage(1);
  };

  const clearFilters = () => { setSearch(""); setFilterAction(""); setFilterDate(""); };
  const hasFilters = search || filterAction || filterDate;

  const exportCSV = () => {
    const rows = [
      "Date,User,Email,Action,Entity,Description",
      ...filtered.map(l =>
        `${fmt(l.created_at)},${l.users?.full_name ?? "System"},${l.users?.email ?? ""},${l.action_type},${l.entity_type ?? "-"},"${(l.description ?? "").replace(/"/g, '""')}"`
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const actionTypes = Array.from(new Set(logs.map(l => l.action_type))).sort();
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const inputStyle: React.CSSProperties = {
    padding: "9px 12px", background: "rgba(255,255,255,0.05)",
    border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13,
    color: T.white, outline: "none", fontFamily: "inherit",
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.06)", borderTopColor: T.accent, animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <History size={18} style={{ color: T.purple }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: 0, letterSpacing: "-0.3px" }}>Activity Log</h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: "2px 0 0" }}>All actions performed within your company workspace</p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.04)", color: T.textLabel, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { label: "Total Events", value: logs.length },
          { label: "Filtered", value: filtered.length },
          { label: "Today", value: logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length },
        ].map(s => (
          <div key={s.label} style={{ padding: "8px 14px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13 }}>
            <span style={{ color: T.textMuted, marginRight: 6 }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: T.white }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
          <input
            style={{ ...inputStyle, paddingLeft: 32, width: "100%" }}
            placeholder="Search by user, action, or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          style={{ ...inputStyle, minWidth: 160 }}
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
        >
          <option value="">All Actions</option>
          {actionTypes.map(a => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
        </select>
        <input
          type="date"
          lang="en" dir="ltr"
          style={{ ...inputStyle, colorScheme: "dark" }}
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
        />
        {hasFilters && (
          <button onClick={clearFilters} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        {paged.length === 0 ? (
          <div style={{ textAlign: "center", padding: "52px 24px", color: T.textMuted, fontSize: 14 }}>
            {hasFilters ? "No events match your filters." : "No activity logged yet."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.borderFaint}` }}>
                {["Date & Time", "User", "Action", "Details"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.5px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: i < paged.length - 1 ? `1px solid ${T.borderFaint}` : "none", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 16px", color: T.textMuted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmt(log.created_at)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: T.white }}>{log.users?.full_name ?? "System"}</div>
                    {log.users?.email && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{log.users.email}</div>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <ActionBadge action={log.action_type} />
                  </td>
                  <td style={{ padding: "12px 16px", color: T.textBody, maxWidth: 360 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.description ?? log.entity_name ?? "—"}
                    </div>
                    {log.entity_type && (
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{log.entity_type}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: safePage === 1 ? T.textMuted : T.white, cursor: safePage === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 13, color: T.textMuted }}>
            Page <strong style={{ color: T.white }}>{safePage}</strong> of <strong style={{ color: T.white }}>{totalPages}</strong>
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: safePage === totalPages ? T.textMuted : T.white, cursor: safePage === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
