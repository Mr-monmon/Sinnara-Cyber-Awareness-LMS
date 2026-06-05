import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Search, Trash2, RefreshCw,
  ChevronDown, ChevronRight, ExternalLink, Filter,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

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
  green:        "#34d399",
  greenBg:      "rgba(52,211,153,0.10)",
  greenBorder:  "rgba(52,211,153,0.30)",
  orange:       "#fb923c",
  orangeBg:     "rgba(251,146,60,0.10)",
  orangeBorder: "rgba(251,146,60,0.30)",
  red:          "#f87171",
  redBg:        "rgba(248,113,113,0.10)",
  redBorder:    "rgba(248,113,113,0.30)",
} as const;

interface ErrorLog {
  id: string;
  user_id: string | null;
  company_id: string | null;
  user_email: string | null;
  user_role: string | null;
  error_name: string;
  error_message: string;
  error_stack: string | null;
  component_stack: string | null;
  url: string | null;
  user_agent: string | null;
  fingerprint: string;
  resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
  occurred_at: string;
  companies?: { name: string } | null;
}

interface GroupedError {
  fingerprint: string;
  error_name: string;
  error_message: string;
  count: number;
  resolved: boolean;
  last_seen: string;
  first_seen: string;
  affected_users: number;
  affected_companies: number;
  occurrences: ErrorLog[];
}

type Filter = "all" | "unresolved" | "resolved";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ErrorLogsPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("unresolved");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("error_logs")
      .select("*, companies(name)")
      .order("occurred_at", { ascending: false })
      .limit(500);
    setLogs((data as ErrorLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo<GroupedError[]>(() => {
    const map = new Map<string, GroupedError>();
    for (const log of logs) {
      const g = map.get(log.fingerprint);
      if (!g) {
        map.set(log.fingerprint, {
          fingerprint: log.fingerprint,
          error_name:    log.error_name,
          error_message: log.error_message,
          count: 1,
          resolved: log.resolved,
          last_seen:  log.occurred_at,
          first_seen: log.occurred_at,
          affected_users:     log.user_id    ? 1 : 0,
          affected_companies: log.company_id ? 1 : 0,
          occurrences: [log],
        });
      } else {
        g.count += 1;
        g.occurrences.push(log);
        if (log.occurred_at > g.last_seen)  g.last_seen  = log.occurred_at;
        if (log.occurred_at < g.first_seen) g.first_seen = log.occurred_at;
        // Group "resolved" status reflects most recent occurrence
      }
    }
    // Recompute uniques per group
    for (const g of map.values()) {
      g.affected_users     = new Set(g.occurrences.map(o => o.user_id).filter(Boolean)).size;
      g.affected_companies = new Set(g.occurrences.map(o => o.company_id).filter(Boolean)).size;
      // Group is "resolved" only if the most recent occurrence is resolved
      const newest = g.occurrences.reduce((a, b) => a.occurred_at > b.occurred_at ? a : b);
      g.resolved = newest.resolved;
    }
    return Array.from(map.values()).sort((a, b) => b.last_seen.localeCompare(a.last_seen));
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grouped.filter(g => {
      if (filter === "unresolved" && g.resolved) return false;
      if (filter === "resolved"   && !g.resolved) return false;
      if (q) {
        const hay = `${g.error_name} ${g.error_message}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [grouped, filter, search]);

  const stats = useMemo(() => ({
    total:      grouped.length,
    unresolved: grouped.filter(g => !g.resolved).length,
    last24h:    logs.filter(l => Date.now() - new Date(l.occurred_at).getTime() < 86400000).length,
    affected:   new Set(logs.map(l => l.user_id).filter(Boolean)).size,
  }), [grouped, logs]);

  const toggleExpand = (fp: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(fp)) { next.delete(fp); } else { next.add(fp); }
      return next;
    });
  };

  const markResolved = async (fingerprint: string, resolved: boolean) => {
    setActing(fingerprint);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("error_logs")
      .update({
        resolved,
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? user?.id ?? null : null,
      })
      .eq("fingerprint", fingerprint);
    await load();
    setActing(null);
  };

  const deleteGroup = async (fingerprint: string) => {
    if (!confirm("Delete all occurrences of this error? This cannot be undone.")) return;
    setActing(fingerprint);
    await supabase.from("error_logs").delete().eq("fingerprint", fingerprint);
    await load();
    setActing(null);
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: T.redBg, border: `1px solid ${T.redBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={20} style={{ color: T.red }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, margin: 0, letterSpacing: "-0.3px" }}>Error Logs</h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: "2px 0 0" }}>Application errors captured from all users across the platform</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: "transparent", color: T.white, fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }}
        >
          <RefreshCw size={13} style={{ animation: loading ? "spin 0.8s linear infinite" : undefined }} /> Refresh
        </button>
      </div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {[
          { label: "Distinct Errors",    value: stats.total,      tone: T.white  },
          { label: "Unresolved",         value: stats.unresolved, tone: T.red    },
          { label: "Last 24 Hours",      value: stats.last24h,    tone: T.orange },
          { label: "Affected Users",     value: stats.affected,   tone: T.white  },
        ].map((s, i) => (
          <div key={i} style={{ padding: "14px 16px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.tone, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, padding: 3 }}>
          {(["unresolved", "all", "resolved"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "7px 14px",
                borderRadius: 7,
                border: "none",
                background: filter === f ? T.accent : "transparent",
                color: filter === f ? T.accentDark : T.textLabel,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "capitalize",
              }}
            >{f}</button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 220, display: "inline-flex", alignItems: "center", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, padding: "0 12px" }}>
          <Search size={14} style={{ color: T.textMuted, marginRight: 8 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by error name or message…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.white, fontSize: 13, padding: "10px 0", fontFamily: "inherit" }}
          />
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Filter size={12} /> {filtered.length} of {grouped.length}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.06)", borderTopColor: T.accent, animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "60px 20px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, textAlign: "center" }}>
          <CheckCircle2 size={36} style={{ color: T.green, marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: T.white }}>
            {grouped.length === 0 ? "No errors recorded" : "No errors match the filter"}
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
            {grouped.length === 0 ? "Everything is running smoothly." : "Adjust the filter or search to see more."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(g => {
            const isOpen = expanded.has(g.fingerprint);
            const isActing = acting === g.fingerprint;
            return (
              <div key={g.fingerprint} style={{ background: T.bgCard, border: `1px solid ${g.resolved ? T.border : T.redBorder}`, borderRadius: 11, overflow: "hidden" }}>
                {/* Row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }} onClick={() => toggleExpand(g.fingerprint)}>
                  <div style={{ flexShrink: 0 }}>
                    {isOpen ? <ChevronDown size={14} style={{ color: T.textMuted }} /> : <ChevronRight size={14} style={{ color: T.textMuted }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 5,
                        fontSize: 10,
                        fontWeight: 800,
                        background: g.resolved ? T.greenBg : T.redBg,
                        color: g.resolved ? T.green : T.red,
                        border: `1px solid ${g.resolved ? T.greenBorder : T.redBorder}`,
                        letterSpacing: "0.4px",
                      }}>{g.resolved ? "RESOLVED" : "ACTIVE"}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: T.white }}>{g.error_name}</span>
                      <span style={{ fontSize: 11, color: T.textMuted }}>×{g.count}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.textBody, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.error_message}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>Last seen: {fmtRelative(g.last_seen)}</span>
                      <span>{g.affected_users} user{g.affected_users === 1 ? "" : "s"}</span>
                      <span>{g.affected_companies} compan{g.affected_companies === 1 ? "y" : "ies"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {!g.resolved ? (
                      <button
                        onClick={() => markResolved(g.fingerprint, true)}
                        disabled={isActing}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}`, borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        <CheckCircle2 size={12} /> Resolve
                      </button>
                    ) : (
                      <button
                        onClick={() => markResolved(g.fingerprint, false)}
                        disabled={isActing}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", background: "transparent", color: T.textLabel, border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      onClick={() => deleteGroup(g.fingerprint)}
                      disabled={isActing}
                      title="Delete all occurrences"
                      style={{ display: "inline-flex", alignItems: "center", padding: "7px 9px", background: "transparent", color: T.red, border: `1px solid ${T.border}`, borderRadius: 7, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Expanded occurrences */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${T.borderFaint}`, padding: "14px 16px 16px 38px", background: "rgba(0,0,0,0.18)" }}>
                    <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10 }}>
                      Recent Occurrences ({g.occurrences.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {g.occurrences.slice(0, 10).map(occ => (
                        <div key={occ.id} style={{ padding: "10px 12px", background: T.bg, border: `1px solid ${T.borderFaint}`, borderRadius: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, color: T.textLabel }}>
                              {occ.user_email ?? "anonymous"}
                              {occ.user_role && <span style={{ marginLeft: 6, padding: "1px 6px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 10, color: T.textMuted, fontWeight: 700 }}>{occ.user_role}</span>}
                              {occ.companies?.name && <span style={{ marginLeft: 6, fontSize: 11, color: T.textMuted }}>· {occ.companies.name}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>{fmtDate(occ.occurred_at)}</div>
                          </div>
                          {occ.url && (
                            <div style={{ fontSize: 11, color: T.textMuted, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                              <ExternalLink size={10} />
                              <span style={{ wordBreak: "break-all" }}>{occ.url}</span>
                            </div>
                          )}
                          {occ.error_stack && (
                            <details style={{ marginTop: 4 }}>
                              <summary style={{ cursor: "pointer", fontSize: 11, color: T.textMuted, fontWeight: 700 }}>Stack trace</summary>
                              <pre style={{ margin: "6px 0 0", fontSize: 10, color: T.textBody, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 200, overflow: "auto", padding: 8, background: "rgba(0,0,0,0.4)", borderRadius: 6 }}>
                                {occ.error_stack}
                              </pre>
                            </details>
                          )}
                          {occ.component_stack && (
                            <details style={{ marginTop: 4 }}>
                              <summary style={{ cursor: "pointer", fontSize: 11, color: T.textMuted, fontWeight: 700 }}>Component stack</summary>
                              <pre style={{ margin: "6px 0 0", fontSize: 10, color: T.textBody, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflow: "auto", padding: 8, background: "rgba(0,0,0,0.4)", borderRadius: 6 }}>
                                {occ.component_stack}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                      {g.occurrences.length > 10 && (
                        <div style={{ fontSize: 11, color: T.textMuted, textAlign: "center", padding: 6 }}>
                          + {g.occurrences.length - 10} more occurrences
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
