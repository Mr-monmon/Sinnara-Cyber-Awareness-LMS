import React, { useState, useEffect } from "react";
import {
  Users, Plus, Edit2, Trash2, RefreshCw, ShieldCheck,
  ShieldOff, Key, AlertCircle, X, Check, Loader2, Eye,
  EyeOff, Copy,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import type { User } from "../../lib/types";

const T = {
  bg:           "#12140a",
  bgCard:       "#1a1e0e",
  accent:       "#c8ff00",
  accentDark:   "#12140a",
  white:        "#ffffff",
  textBody:     "#cbd5e1",
  textMuted:    "#64748b",
  border:       "rgba(255,255,255,0.09)",
  borderFaint:  "rgba(255,255,255,0.05)",
  green:        "#34d399",
  greenBg:      "rgba(52,211,153,0.08)",
  greenBorder:  "rgba(52,211,153,0.22)",
  blue:         "#60a5fa",
  blueBg:       "rgba(96,165,250,0.08)",
  blueBorder:   "rgba(96,165,250,0.22)",
  orange:       "#fb923c",
  orangeBg:     "rgba(251,146,60,0.08)",
  orangeBorder: "rgba(251,146,60,0.22)",
  red:          "#f87171",
  redBg:        "rgba(248,113,113,0.08)",
  redBorder:    "rgba(248,113,113,0.22)",
  purple:       "#a78bfa",
  purpleBg:     "rgba(167,139,250,0.08)",
  purpleBorder: "rgba(167,139,250,0.22)",
  yellow:       "#fbbf24",
  yellowBg:     "rgba(251,191,36,0.08)",
  yellowBorder: "rgba(251,191,36,0.22)",
} as const;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .cpu-input {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .cpu-input:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .cpu-input::placeholder { color: rgba(148,163,184,0.40); }
  .cpu-select {
    width: 100%; padding: 10px 14px; box-sizing: border-box;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 13px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none; cursor: pointer;
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    transition: border-color 0.2s;
  }
  .cpu-select:focus { border-color: rgba(200,255,0,0.45); box-shadow: 0 0 0 3px rgba(200,255,0,0.07); }
  .cpu-select option { background: #1a1e0e; color: #ffffff; }
  .cpu-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .cpu-table th {
    padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);
  }
  .cpu-table td {
    padding: 11px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle;
  }
  .cpu-table tr:last-child td { border-bottom: none; }
  .cpu-table tr:hover td { background: rgba(255,255,255,0.025); }
  .cpu-btn-accent {
    background: #c8ff00; color: #12140a; border: none;
    border-radius: 10px; font-size: 13px; font-weight: 700;
    padding: 9px 18px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: opacity 0.15s, transform 0.1s;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .cpu-btn-accent:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .cpu-btn-accent:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .cpu-btn-ghost {
    background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.09);
    border-radius: 8px; font-size: 12px; font-weight: 500;
    padding: 6px 12px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: background 0.15s;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .cpu-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
  .cpu-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
  .cpu-btn-danger {
    background: rgba(248,113,113,0.08); color: #f87171; border: 1px solid rgba(248,113,113,0.22);
    border-radius: 8px; font-size: 12px; font-weight: 500;
    padding: 6px 12px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: background 0.15s;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .cpu-btn-danger:hover:not(:disabled) { background: rgba(248,113,113,0.15); }
  .cpu-btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }
  .cpu-icon-btn {
    background: none; border: none; cursor: pointer; padding: 5px;
    border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.15s; color: #64748b;
  }
  .cpu-icon-btn:hover:not(:disabled) { background: rgba(255,255,255,0.07); color: #cbd5e1; }
  .cpu-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .cpu-toggle {
    position: relative; display: inline-block; width: 36px; height: 20px; cursor: pointer;
  }
  .cpu-toggle input { opacity: 0; width: 0; height: 0; }
  .cpu-toggle-slider {
    position: absolute; inset: 0; background: rgba(255,255,255,0.1);
    border-radius: 20px; transition: background 0.2s;
  }
  .cpu-toggle-slider:before {
    content: ''; position: absolute; width: 14px; height: 14px;
    left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: transform 0.2s;
  }
  input:checked + .cpu-toggle-slider { background: #c8ff00; }
  input:checked + .cpu-toggle-slider:before { transform: translateX(16px); background: #12140a; }
  @keyframes cpu-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .cpu-modal-in { animation: cpu-modal-in 0.28s ease both; }
  @keyframes cpu-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .cpu-fade-up { animation: cpu-fade-up 0.4s ease both; }
`;

if (typeof document !== "undefined" && !document.getElementById("cpu-styles")) {
  const tag = document.createElement("style");
  tag.id = "cpu-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

type PlatformRole = "COMPANY_SUPER_ADMIN" | "COMPANY_ADMIN" | "PHISHING_OPERATOR" | "REVIEWER";

const ROLE_LABELS: Record<PlatformRole, string> = {
  COMPANY_SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Company Admin",
  PHISHING_OPERATOR: "Phishing Operator",
  REVIEWER: "Reviewer",
};

const ROLE_COLORS: Record<PlatformRole, { color: string; bg: string; border: string }> = {
  COMPANY_SUPER_ADMIN: { color: T.yellow, bg: T.yellowBg, border: T.yellowBorder },
  COMPANY_ADMIN: { color: T.accent, bg: "rgba(200,255,0,0.08)", border: "rgba(200,255,0,0.22)" },
  PHISHING_OPERATOR: { color: T.purple, bg: T.purpleBg, border: T.purpleBorder },
  REVIEWER: { color: T.blue, bg: T.blueBg, border: T.blueBorder },
};

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let pw = "";
  for (let i = 0; i < length; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

function RoleBadge({ role }: { role: PlatformRole }) {
  const c = ROLE_COLORS[role];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      whiteSpace: "nowrap",
    }}>
      {ROLE_LABELS[role]}
    </span>
  );
}

interface PlatformUser extends User {
  role: PlatformRole;
}

interface CreateUserForm {
  full_name: string;
  email: string;
  role: "COMPANY_ADMIN" | "PHISHING_OPERATOR" | "REVIEWER";
  temp_password: string;
  force_mfa: boolean;
}

const EMPTY_FORM: CreateUserForm = {
  full_name: "",
  email: "",
  role: "COMPANY_ADMIN",
  temp_password: "",
  force_mfa: false,
};

interface EditRoleModal {
  open: boolean;
  user: PlatformUser | null;
  newRole: "COMPANY_ADMIN" | "PHISHING_OPERATOR" | "REVIEWER";
}

interface ConfirmModal {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  danger?: boolean;
}

export const CompanyPlatformUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create user modal
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState<CreateUserForm>({ ...EMPTY_FORM, temp_password: generatePassword() });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showTempPw, setShowTempPw] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  // Edit role modal
  const [editModal, setEditModal] = useState<EditRoleModal>({
    open: false, user: null, newRole: "COMPANY_ADMIN",
  });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Confirm modal
  const [confirm, setConfirm] = useState<ConfirmModal>({
    open: false, title: "", message: "", onConfirm: () => {}, danger: false,
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === "COMPANY_SUPER_ADMIN";
  const isAdmin = currentUser?.role === "COMPANY_ADMIN";
  const canManage = isSuperAdmin || isAdmin;

  const loadUsers = async () => {
    if (!currentUser?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("company_id", currentUser.company_id)
        .in("role", ["COMPANY_SUPER_ADMIN", "COMPANY_ADMIN", "PHISHING_OPERATOR", "REVIEWER"]);

      if (fetchError) throw fetchError;
      setPlatformUsers((data ?? []) as PlatformUser[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.company_id]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.company_id) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { error: invokeError } = await supabase.functions.invoke("user-admin", {
        body: {
          action: "createUser",
          company_id: currentUser.company_id,
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          temp_password: form.temp_password,
          mfa_enforced: form.force_mfa,
        },
      });
      if (invokeError) throw new Error(invokeError.message);
      setCreateSuccess(true);
      void loadUsers();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const closeCreateModal = () => {
    setCreateModal(false);
    setForm({ ...EMPTY_FORM, temp_password: generatePassword() });
    setCreateError(null);
    setCreateSuccess(false);
    setShowTempPw(false);
    setCopiedPw(false);
  };

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.user) return;
    setEditing(true);
    setEditError(null);
    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({ role: editModal.newRole })
        .eq("id", editModal.user.id);
      if (updateError) throw updateError;
      setEditModal({ open: false, user: null, newRole: "COMPANY_ADMIN" });
      void loadUsers();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setEditing(false);
    }
  };

  const handleAction = async (action: string, userId: string, extraBody?: Record<string, unknown>) => {
    setActionLoading(`${action}-${userId}`);
    try {
      const { error: invokeError } = await supabase.functions.invoke("user-admin", {
        body: { action, user_id: userId, ...extraBody },
      });
      if (invokeError) throw new Error(invokeError.message);
      void loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Failed to perform ${action}`);
    } finally {
      setActionLoading(null);
      setConfirm((prev) => ({ ...prev, open: false }));
    }
  };

  const handleDelete = (target: PlatformUser) => {
    setConfirm({
      open: true,
      title: "Delete User",
      message: `Are you sure you want to delete ${target.full_name}? This action cannot be undone.`,
      danger: true,
      onConfirm: () => handleAction("deleteUser", target.id),
    });
  };

  const handleResetPassword = (target: PlatformUser) => {
    setConfirm({
      open: true,
      title: "Reset Password",
      message: `Send a password reset email to ${target.email}?`,
      danger: false,
      onConfirm: () => handleAction("resetPassword", target.id),
    });
  };

  const handleResetMfa = (target: PlatformUser) => {
    setConfirm({
      open: true,
      title: "Reset MFA",
      message: `Remove all MFA factors for ${target.full_name}? They will need to re-enroll.`,
      danger: true,
      onConfirm: () => handleAction("resetMfa", target.id),
    });
  };

  const handleToggleMfaEnforced = (target: PlatformUser) => {
    const newVal = !target.mfa_enforced;
    setConfirm({
      open: true,
      title: newVal ? "Enforce MFA" : "Disable MFA Enforcement",
      message: newVal
        ? `Require ${target.full_name} to set up MFA on next login?`
        : `Remove MFA enforcement for ${target.full_name}?`,
      danger: false,
      onConfirm: () => handleAction("setMfaEnforced", target.id, { mfa_enforced: newVal }),
    });
  };

  const canEditUser = (target: PlatformUser) => {
    if (target.role === "COMPANY_SUPER_ADMIN") return false;
    return canManage;
  };

  const canDeleteUser = (target: PlatformUser) => {
    if (target.id === currentUser?.id) return false;
    if (target.role === "COMPANY_SUPER_ADMIN") return false;
    if (target.role === "COMPANY_ADMIN" && !isSuperAdmin) return false;
    return canManage;
  };

  return (
    <div
      className="cpu-fade-up"
      style={{
        minHeight: "100vh", background: T.bg, padding: "32px 28px",
        fontFamily: "'Inter', sans-serif", color: T.textBody,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(200,255,0,0.10)", border: "1px solid rgba(200,255,0,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Users size={18} color={T.accent} />
            </div>
            <h1 style={{ color: T.white, fontSize: 22, fontWeight: 800, margin: 0 }}>
              Platform Users
            </h1>
          </div>
          <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>
            Manage admin, operator, and reviewer access for your company portal.
          </p>
        </div>
        {canManage && (
          <button
            className="cpu-btn-accent"
            onClick={() => {
              setForm({ ...EMPTY_FORM, temp_password: generatePassword() });
              setCreateModal(true);
            }}
          >
            <Plus size={15} />
            Add User
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 10, padding: "12px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10, color: T.red, fontSize: 13,
        }}>
          <AlertCircle size={15} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table card */}
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: 14, overflow: "hidden",
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: T.textMuted }}>
            <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: 12, fontSize: 13 }}>Loading users...</p>
          </div>
        ) : platformUsers.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Users size={32} color={T.textMuted} style={{ margin: "0 auto 12px" }} />
            <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>No platform users found.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="cpu-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>MFA Status</th>
                  <th>Created</th>
                  {canManage && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {platformUsers.map((pu) => {
                  const isSelf = pu.id === currentUser?.id;
                  const isTargetSuperAdmin = pu.role === "COMPANY_SUPER_ADMIN";
                  const actionKey = `${pu.id}`;

                  return (
                    <tr key={pu.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%",
                            background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 700, color: T.accent, flexShrink: 0,
                          }}>
                            {pu.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ color: T.white, fontWeight: 600, fontSize: 13 }}>
                              {pu.full_name}
                              {isSelf && (
                                <span style={{ marginLeft: 6, fontSize: 10, color: T.textMuted, fontWeight: 400 }}>
                                  (you)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: T.textMuted }}>{pu.email}</td>
                      <td>
                        <RoleBadge role={pu.role} />
                      </td>
                      <td>
                        {pu.mfa_enforced ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 11, fontWeight: 600, color: T.green,
                          }}>
                            <ShieldCheck size={13} />
                            Enforced
                          </span>
                        ) : (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 11, fontWeight: 500, color: T.textMuted,
                          }}>
                            <ShieldOff size={13} />
                            Optional
                          </span>
                        )}
                      </td>
                      <td style={{ color: T.textMuted }}>
                        {new Date(pu.created_at).toLocaleDateString()}
                      </td>
                      {canManage && (
                        <td>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                            {/* Edit role */}
                            {!isTargetSuperAdmin && (
                              <button
                                className="cpu-icon-btn"
                                title="Edit role"
                                disabled={!!actionLoading}
                                onClick={() => setEditModal({
                                  open: true,
                                  user: pu,
                                  newRole: pu.role === "COMPANY_SUPER_ADMIN" ? "COMPANY_ADMIN" : pu.role as "COMPANY_ADMIN" | "PHISHING_OPERATOR" | "REVIEWER",
                                })}
                              >
                                <Edit2 size={13} />
                              </button>
                            )}

                            {/* Reset password */}
                            <button
                              className="cpu-icon-btn"
                              title="Reset password"
                              disabled={!!actionLoading}
                              onClick={() => handleResetPassword(pu)}
                            >
                              {actionLoading === `resetPassword-${actionKey}` ? (
                                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                              ) : (
                                <Key size={13} />
                              )}
                            </button>

                            {/* Reset MFA */}
                            {pu.mfa_enforced && (
                              <button
                                className="cpu-icon-btn"
                                title="Reset MFA"
                                disabled={!!actionLoading}
                                onClick={() => handleResetMfa(pu)}
                              >
                                {actionLoading === `resetMfa-${actionKey}` ? (
                                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                                ) : (
                                  <RefreshCw size={13} />
                                )}
                              </button>
                            )}

                            {/* Force MFA toggle */}
                            {isSuperAdmin && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
                                <span style={{ fontSize: 10, color: T.textMuted }}>MFA</span>
                                <label className="cpu-toggle" title={pu.mfa_enforced ? "Disable MFA enforcement" : "Enforce MFA"}>
                                  <input
                                    type="checkbox"
                                    checked={!!pu.mfa_enforced}
                                    onChange={() => handleToggleMfaEnforced(pu)}
                                    disabled={!!actionLoading}
                                  />
                                  <span className="cpu-toggle-slider" />
                                </label>
                              </div>
                            )}

                            {/* Delete */}
                            {canDeleteUser(pu) && (
                              <button
                                className="cpu-icon-btn"
                                title="Delete user"
                                disabled={!!actionLoading}
                                onClick={() => handleDelete(pu)}
                                style={{ color: T.red }}
                              >
                                {actionLoading === `deleteUser-${actionKey}` ? (
                                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                                ) : (
                                  <Trash2 size={13} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create User Modal ─── */}
      {createModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}>
          <div
            className="cpu-modal-in"
            style={{
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 16, padding: 36, width: "100%", maxWidth: 480,
              margin: "0 16px", maxHeight: "90vh", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h2 style={{ color: T.white, fontSize: 18, fontWeight: 700, margin: 0 }}>Add Platform User</h2>
                <p style={{ color: T.textMuted, fontSize: 12, margin: "4px 0 0" }}>
                  Create a new admin, operator, or reviewer account.
                </p>
              </div>
              <button
                onClick={closeCreateModal}
                style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {createSuccess ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: T.greenBg, border: `1px solid ${T.greenBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <Check size={24} color={T.green} />
                </div>
                <h3 style={{ color: T.green, fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>
                  User Created Successfully
                </h3>
                <p style={{ color: T.textMuted, fontSize: 13, marginBottom: 24 }}>
                  {form.email} has been added as {ROLE_LABELS[form.role]}.
                </p>
                <button className="cpu-btn-accent" onClick={closeCreateModal}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser}>
                {/* Full Name */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", color: T.textBody, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                    Full Name
                  </label>
                  <input
                    className="cpu-input"
                    type="text"
                    placeholder="Jane Smith"
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    required
                  />
                </div>

                {/* Email */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", color: T.textBody, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                    Email
                  </label>
                  <input
                    className="cpu-input"
                    type="email"
                    placeholder="jane@company.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>

                {/* Role */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", color: T.textBody, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                    Role
                  </label>
                  <select
                    className="cpu-select"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as CreateUserForm["role"] }))}
                  >
                    <option value="COMPANY_ADMIN">Company Admin</option>
                    <option value="PHISHING_OPERATOR">Phishing Operator</option>
                    <option value="REVIEWER">Reviewer</option>
                  </select>
                </div>

                {/* Temporary Password */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", color: T.textBody, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                    Temporary Password
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <input
                        className="cpu-input"
                        type={showTempPw ? "text" : "password"}
                        value={form.temp_password}
                        onChange={(e) => setForm((f) => ({ ...f, temp_password: e.target.value }))}
                        style={{ paddingRight: 36 }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowTempPw((v) => !v)}
                        style={{
                          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 0,
                        }}
                      >
                        {showTempPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="cpu-btn-ghost"
                      onClick={() => {
                        const pw = generatePassword();
                        setForm((f) => ({ ...f, temp_password: pw }));
                      }}
                      style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      <RefreshCw size={12} />
                      New
                    </button>
                    <button
                      type="button"
                      className="cpu-btn-ghost"
                      style={{ flexShrink: 0 }}
                      onClick={() => {
                        navigator.clipboard.writeText(form.temp_password).catch(() => {});
                        setCopiedPw(true);
                        setTimeout(() => setCopiedPw(false), 2000);
                      }}
                    >
                      {copiedPw ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p style={{ color: T.textMuted, fontSize: 11, marginTop: 5 }}>
                    Share this with the user. They will be prompted to change it on first login.
                  </p>
                </div>

                {/* Force MFA */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
                    borderRadius: 10,
                  }}>
                    <label className="cpu-toggle">
                      <input
                        type="checkbox"
                        checked={form.force_mfa}
                        onChange={(e) => setForm((f) => ({ ...f, force_mfa: e.target.checked }))}
                      />
                      <span className="cpu-toggle-slider" />
                    </label>
                    <div>
                      <div style={{ color: T.textBody, fontSize: 13, fontWeight: 500 }}>Enforce 2FA</div>
                      <div style={{ color: T.textMuted, fontSize: 11 }}>
                        Require user to set up two-factor authentication on first login
                      </div>
                    </div>
                  </label>
                </div>

                {createError && (
                  <div style={{
                    background: T.redBg, border: `1px solid ${T.redBorder}`,
                    borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                    color: T.red, fontSize: 13,
                  }}>
                    {createError}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="cpu-btn-ghost"
                    style={{ flex: 1 }}
                    onClick={closeCreateModal}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cpu-btn-accent"
                    style={{ flex: 2, justifyContent: "center" }}
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        Create User
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── Edit Role Modal ─── */}
      {editModal.open && editModal.user && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}>
          <div
            className="cpu-modal-in"
            style={{
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 16, padding: 36, width: "100%", maxWidth: 420,
              margin: "0 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ color: T.white, fontSize: 18, fontWeight: 700, margin: 0 }}>Edit Role</h2>
              <button
                onClick={() => { setEditModal({ open: false, user: null, newRole: "COMPANY_ADMIN" }); setEditError(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: T.textMuted, fontSize: 13, marginBottom: 20 }}>
              Changing role for <strong style={{ color: T.textBody }}>{editModal.user.full_name}</strong>
            </p>

            <form onSubmit={handleEditRole}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: T.textBody, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  New Role
                </label>
                <select
                  className="cpu-select"
                  value={editModal.newRole}
                  onChange={(e) => setEditModal((m) => ({ ...m, newRole: e.target.value as EditRoleModal["newRole"] }))}
                >
                  <option value="COMPANY_ADMIN">Company Admin</option>
                  <option value="PHISHING_OPERATOR">Phishing Operator</option>
                  <option value="REVIEWER">Reviewer</option>
                </select>
              </div>

              {editError && (
                <div style={{
                  background: T.redBg, border: `1px solid ${T.redBorder}`,
                  borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                  color: T.red, fontSize: 13,
                }}>
                  {editError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="cpu-btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => { setEditModal({ open: false, user: null, newRole: "COMPANY_ADMIN" }); setEditError(null); }}
                  disabled={editing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cpu-btn-accent"
                  style={{ flex: 2, justifyContent: "center" }}
                  disabled={editing}
                >
                  {editing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Confirm Modal ─── */}
      {confirm.open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9500,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}>
          <div
            className="cpu-modal-in"
            style={{
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 14, padding: 32, width: "100%", maxWidth: 400,
              margin: "0 16px",
            }}
          >
            <h3 style={{ color: T.white, fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>
              {confirm.title}
            </h3>
            <p style={{ color: T.textMuted, fontSize: 13, margin: "0 0 24px", lineHeight: 1.6 }}>
              {confirm.message}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="cpu-btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setConfirm((p) => ({ ...p, open: false }))}
                disabled={!!actionLoading}
              >
                Cancel
              </button>
              <button
                className={confirm.danger ? "cpu-btn-danger" : "cpu-btn-accent"}
                style={{ flex: 2, justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, padding: "9px 18px", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1 }}
                onClick={confirm.onConfirm}
                disabled={!!actionLoading}
              >
                {actionLoading ? (
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                ) : null}
                {confirm.danger ? "Confirm" : "Yes, proceed"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
