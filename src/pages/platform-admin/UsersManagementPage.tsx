import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Trash2,
  Upload,
  Download,
  Building2,
  Plus,
  Key,
  X,
  Save,
  Loader2,
  Shield,
  UserCog,
  User,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { User as UserType, Company } from "../../lib/types";
import { useAuth } from "../../contexts/AuthContext";
import {
  buildSameHostRedirectUrl,
  buildTenantRedirectUrl,
} from "../../lib/browserTenant";
import { sendNotificationEmail } from "../../lib/email";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg: "#12140a",
  bgCard: "#1a1e0e",
  accent: "#c8ff00",
  accentDark: "#12140a",
  white: "#ffffff",
  textBody: "#cbd5e1",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.09)",
  borderFaint: "rgba(255,255,255,0.05)",
  green: "#34d399",
  greenBg: "rgba(52,211,153,0.08)",
  greenBorder: "rgba(52,211,153,0.22)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.08)",
  blueBorder: "rgba(96,165,250,0.22)",
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.08)",
  orangeBorder: "rgba(251,146,60,0.22)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.08)",
  redBorder: "rgba(248,113,113,0.22)",
  purple: "#a78bfa",
  purpleBg: "rgba(167,139,250,0.08)",
  purpleBorder: "rgba(167,139,250,0.22)",
} as const;

/* ─────────────────────────────────────────
   ROLE CONFIG
───────────────────────────────────────── */
const ROLE_CFG: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    label: string;
    icon: React.ElementType;
  }
> = {
  PLATFORM_ADMIN: {
    color: T.red,
    bg: T.redBg,
    border: T.redBorder,
    label: "Platform Admin",
    icon: Shield,
  },
  COMPANY_ADMIN: {
    color: T.blue,
    bg: T.blueBg,
    border: T.blueBorder,
    label: "Company Admin",
    icon: UserCog,
  },
  EMPLOYEE: {
    color: T.green,
    bg: T.greenBg,
    border: T.greenBorder,
    label: "Employee",
    icon: User,
  },
};

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Table ── */
  .aw-um-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
  .aw-um-table th {
    padding: 10px 14px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.9px; text-transform: uppercase;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }
  .aw-um-table td {
    padding: 12px 14px; font-size: 13px; color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.14s;
  }
  .aw-um-table tr:hover td { background: rgba(255,255,255,0.025); }
  .aw-um-table tr:last-child td { border-bottom: none; }

  /* ── Form inputs ── */
  .aw-um-input, .aw-um-select {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-um-input  { padding: 11px 14px; }
  .aw-um-select {
    padding: 11px 36px 11px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-um-input:focus, .aw-um-select:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-um-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-um-select option { background: #1a1e0e; color: #ffffff; }

  /* Inline role select in table */
  .aw-um-role-select {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; font-size: 12px; color: #cbd5e1;
    font-family: 'Inter', sans-serif; outline: none; cursor: pointer;
    padding: 5px 26px 5px 10px; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 8px center;
    transition: border-color 0.18s;
  }
  .aw-um-role-select:focus { border-color: rgba(200,255,0,0.40); outline: none; }
  .aw-um-role-select option { background: #1a1e0e; }

  .aw-um-label {
    display: block; font-size: 12px; font-weight: 600;
    color: #94a3b8; margin-bottom: 7px; letter-spacing: 0.3px;
    font-family: 'Inter', sans-serif;
  }

  /* ── Icon action btns ── */
  .aw-um-icon-btn {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none;
  }
  .aw-um-icon-btn.reset { color: #fb923c; border-color: rgba(251,146,60,0.22); background: rgba(251,146,60,0.07); }
  .aw-um-icon-btn.reset:hover { background: rgba(251,146,60,0.16); }
  .aw-um-icon-btn.del   { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-um-icon-btn.del:hover   { background: rgba(248,113,113,0.18); }

  /* ── Header action btns ── */
  .aw-um-btn-primary {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 16px rgba(200,255,0,0.18);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-um-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

  .aw-um-btn-ghost {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 16px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-um-btn-ghost:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  .aw-um-btn-green {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 16px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.28);
    color: #34d399; transition: all 0.18s;
  }
  .aw-um-btn-green:hover { background: rgba(52,211,153,0.18); }

  /* ── Modal save btn ── */
  .aw-um-save-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.18);
    transition: opacity 0.2s;
  }
  .aw-um-save-btn:hover { opacity: 0.88; }
  .aw-um-save-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  /* ── Scrollbar ── */
  .aw-um-scroll::-webkit-scrollbar { width: 3px; }
  .aw-um-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-um-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("aw-um-styles")
) {
  const tag = document.createElement("style");
  tag.id = "aw-um-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const cfg = ROLE_CFG[role] ?? ROLE_CFG.EMPLOYEE;
  const Icon = cfg.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.4px",
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
      }}
    >
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const Avatar: React.FC<{ name: string; size?: number }> = ({
  name,
  size = 32,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: "rgba(200,255,0,0.08)",
      border: "1px solid rgba(200,255,0,0.20)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.4,
      fontWeight: 700,
      color: T.accent,
      flexShrink: 0,
    }}
  >
    {name?.charAt(0)?.toUpperCase() || "?"}
  </div>
);

/* ─────────────────────────────────────────
   MODAL WRAPPER
───────────────────────────────────────── */
const Modal: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  iconColor?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}> = ({
  title,
  subtitle,
  icon: Icon,
  iconColor = T.accent,
  onClose,
  children,
  maxWidth = 480,
}) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      background: "rgba(10,12,6,0.82)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    }}
    onClick={onClose}
  >
    <div
      className="aw-modal-in"
      style={{
        width: "100%",
        maxWidth,
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
        fontFamily: "'Inter', sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          height: 3,
          background: "linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))",
        }}
      />
      <div
        style={{
          padding: "18px 22px",
          borderBottom: `1px solid ${T.borderFaint}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {Icon && (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: `${iconColor}14`,
                border: `1px solid ${iconColor}28`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={16} style={{ color: iconColor }} />
            </div>
          )}
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: T.white,
                margin: 0,
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${T.borderFaint}`,
            color: T.textMuted,
            cursor: "pointer",
          }}
        >
          <X size={13} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const UsersManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const defaultLoginUrl = buildSameHostRedirectUrl(
    window.location.href,
    "/login"
  );
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterRole, setFilterRole] = useState("");

  /* Modals */
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [uploadCompanyId, setUploadCompanyId] = useState<string>("");
  const [newUserData, setNewUserData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "EMPLOYEE",
    company_id: "",
  });

  // Password re-authentication state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    type: "role_change" | "delete" | "reset_password";
    userId: string;
    userEmail: string;
    userFullName: string;
    companyId?: string;
    newRole?: string;
    newPassword?: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compsRes, usersRes] = await Promise.all([
        supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("companies").select("id, name").order("name"),
      ]);
      if (usersRes.data) setUsers(usersRes.data as unknown as UserType[]);
      if (compsRes.data) setCompanies(compsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyName = (id?: string) =>
    id ? companies.find((c) => c.id === id)?.name || "—" : "—";

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)) &&
      (!filterCompany || u.company_id === filterCompany) &&
      (!filterRole || u.role === filterRole)
    );
  });

  const verifyCurrentUserPassword = async (pw: string): Promise<boolean> => {
    if (!user?.email) return false;
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: pw,
    });
    return !error;
  };

  const handlePasswordConfirm = async () => {
    if (!confirmPassword) {
      setPasswordError("Please enter your password");
      return;
    }

    const isValid = await verifyCurrentUserPassword(confirmPassword);

    if (!isValid) {
      setPasswordError("Invalid password. Please try again.");
      return;
    }
    if (pendingAction) {
      switch (pendingAction.type) {
        case "role_change":
          await executeRoleChange(pendingAction.userId, pendingAction.newRole!);
          break;
        case "delete":
          await executeDeleteUser(pendingAction.userId);
          break;
        case "reset_password":
          await executeResetPassword(
            pendingAction.userId,
            pendingAction.userEmail,
            pendingAction.newPassword!
          );
          break;
      }
    }

    setShowPasswordModal(false);
    setConfirmPassword("");
    setPasswordError("");
    setPendingAction(null);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setConfirmPassword("");
    setPasswordError("");
    setPendingAction(null);
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      PLATFORM_ADMIN: "bg-red-100 text-red-800 border-red-200",
      COMPANY_ADMIN: "bg-blue-100 text-blue-800 border-blue-200",
      EMPLOYEE: "bg-green-100 text-green-800 border-green-200",
    };

    const labels = {
      PLATFORM_ADMIN: "Platform Admin",
      COMPANY_ADMIN: "Company Admin",
      EMPLOYEE: "Employee",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium border ${
          styles[role as keyof typeof styles]
        }`}
      >
        {labels[role as keyof typeof labels]}
      </span>
    );
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserData.full_name || !newUserData.email || !newUserData.password) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const { data: createResult, error: createError } =
        await supabase.functions.invoke("user-admin", {
          body: {
            action: "createUser",
            full_name: newUserData.full_name,
            email: newUserData.email.toLowerCase(),
            phone: newUserData.phone || null,
            password: newUserData.password,
            role: newUserData.role,
            company_id: newUserData.company_id || null,
          },
        });

      if (createError || !createResult?.success)
        throw new Error(createResult?.error || "Failed to create user");

      await supabase.from("audit_logs").insert([
        {
          user_id: user?.id,
          action_type: "CREATE_USER",
          entity_type: "USER",
          description: `Created user: ${newUserData.email}`,
          new_value: { email: newUserData.email, role: newUserData.role },
        },
      ]);

      setShowAddUserModal(false);
      setNewUserData({
        full_name: "",
        email: "",
        phone: "",
        password: "",
        role: "EMPLOYEE",
        company_id: "",
      });
      await loadData();
      alert("User added successfully!");
    } catch (error) {
      console.error("Error adding user:", error);
      alert("Failed to add user. Email might already exist.");
    }
  };

  const handleResetPassword = (userId: string, userEmail: string) => {
    const newPassword = prompt("Enter new password for " + userEmail + ":");

    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }

    if (
      !confirm(
        "Are you sure you want to reset the password for " + userEmail + "?"
      )
    ) {
      return;
    }

    // Show password confirmation modal
    setPendingAction({
      type: "reset_password",
      userId,
      userEmail,
      newPassword: newPassword,
    });

    setShowPasswordModal(true);
  };

  const executeResetPassword = async (
    userId: string,
    userEmail: string,
    newPassword: string
  ) => {
    try {
      const { data: resetResult, error: resetError } =
        await supabase.functions.invoke("user-admin", {
          body: { action: "resetPassword", userId, password: newPassword },
        });

      if (resetError || !resetResult?.success)
        throw new Error(resetResult?.error || "Failed to reset password");

      await supabase.from("audit_logs").insert([
        {
          user_id: user?.id,
          action_type: "RESET_PASSWORD",
          entity_type: "USER",
          entity_id: userId,
          description: `Password reset for ${userEmail}`,
        },
      ]);

      alert("Password reset successfully!");
    } catch (error) {
      console.error("Error resetting password:", error);
      alert("Failed to reset password");
    }
  };

  const handleRoleChange = (
    userId: string,
    newRole: string,
    userEmail: string
  ) => {
    if (!confirm("Are you sure you want to change this user's role?")) {
      return;
    }
    if (!confirm(`Reset password for ${userEmail}?`)) return;
    setPendingAction({
      type: "role_change",
      userId,
      userEmail,
      newRole,
      userFullName,
      companyId,
    });
    setShowPasswordModal(true);
  };

  const executeRoleChange = async (
    userId: string,
    newRole: string,
    userEmail: string,
    userFullName: string,
    companyId?: string
  ) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      await supabase.from("audit_logs").insert([
        {
          user_id: user?.id,
          action_type: "ROLE_CHANGE",
          entity_type: "USER",
          entity_id: userId,
          description: `Changed user role to ${newRole}`,
          new_value: { role: newRole },
        },
      ]);

      try {
        await sendNotificationEmail(
          userEmail,
          userFullName,
          "Your account role has been updated",
          "Role Updated",
          `Your account role has been updated to ${newRole}. You may notice changes in your dashboard the next time you sign in.`,
          { loginUrl: getLoginUrlForCompany(companyId) }
        );
      } catch (emailErr) {
        console.warn("Role change email could not be sent:", emailErr);
      }

      await loadData();
      alert("Role changed successfully");
    } catch (error) {
      console.error("Error changing role:", error);
      alert("Failed to change role");
    }
  };

  const handleDeleteUser = (
    userId: string,
    userEmail: string,
    userFullName: string
  ) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone."
      )
    ) {
      return;
    }

    // Show password confirmation modal
    setPendingAction({
      type: "delete",
      userId,
      userEmail,
      userFullName,
    });
    setShowPasswordModal(true);
  };

  const executeDeleteUser = async (
    userId: string,
    userEmail: string,
    userFullName: string
  ) => {
    try {
      const { data: delResult, error: delError } =
        await supabase.functions.invoke("user-admin", {
          body: { action: "deleteUser", userId },
        });

      if (delError || !delResult?.success)
        throw new Error(delResult?.error || "Failed to delete user");

      await supabase.from("audit_logs").insert([
        {
          user_id: user?.id,
          action_type: "DELETE_USER",
          entity_type: "USER",
          entity_id: userId,
          description: "Deleted user",
        },
      ]);

      try {
        await sendNotificationEmail(
          userEmail,
          userFullName,
          "Your account has been removed",
          "Account Removed",
          "Your account on Awareone has been removed. If you believe this was a mistake, please reach out to your organization's administrator."
        );
      } catch (emailErr) {
        console.warn("Account deletion email could not be sent:", emailErr);
      }

      await loadData();
      alert("User deleted successfully");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadCompanyId) {
      alert("Select a company and file");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length < 2) {
          alert("File is empty or incorrectly formatted");
          return;
        }
        const headers = lines[0]
          .toLowerCase()
          .split(",")
          .map((h) => h.trim());
        const emailIdx = headers.findIndex((h) => h.includes("email"));
        const nameIdx = headers.findIndex((h) => h.includes("name"));
        const phoneIdx = headers.findIndex(
          (h) => h.includes("phone") || h.includes("mobile")
        );
        const deptIdx = headers.findIndex((h) => h.includes("department"));
        if (emailIdx === -1 || nameIdx === -1) {
          alert("File must contain email and name columns");
          return;
        }
        const employees: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim());

          if (values.length < 2) continue;

          const email = values[emailIdx]?.toLowerCase();
          const fullName = values[nameIdx];
          const failedRows: number[] = [];


          if (!email || !fullName) {
            failedRows.push(i + 1);
            continue;
          }

          employees.push({
            email,
            full_name: fullName,
            phone: phoneIdx !== -1 ? values[phoneIdx] : null,
            department: deptIdx !== -1 ? values[deptIdx] : null,
            password: "Password123!",
            role: "EMPLOYEE",
            company_id: uploadCompanyId,
          });
        }

        if (employees.length === 0) {
          alert("No valid data in file");
          return;
        }

        const { data: bulkResult, error: bulkError } =
          await supabase.functions.invoke("user-admin", {
            body: { action: "bulkCreate", users: employees },
          });

        if (bulkError) throw bulkError;

        await supabase.from("audit_logs").insert([
          {
            user_id: user?.id,
            action_type: "UPLOAD_EMPLOYEES",
            entity_type: "EMPLOYEE",
            description: `Uploaded ${
              bulkResult?.succeeded ?? 0
            } employees from CSV`,
            new_value: {
              count: bulkResult?.succeeded ?? 0,
              company_id: uploadCompanyId,
            },
          },
        ]);

        const succeededEmails: Set<string> = new Set(
          (bulkResult?.results ?? [])
            .filter((r: { email: string; success: boolean }) => r.success)
            .map((r: { email: string; success: boolean }) => r.email)
        );

        await Promise.allSettled(
          employees
            .filter((emp) => succeededEmails.has(emp.email))
            .map((emp) =>
              sendNotificationEmail(
                emp.email,
                emp.full_name,
                "Welcome to Awareone",
                "Welcome aboard",
                "Your account has been created. Use the credentials below to sign in.",
                {
                  loginUrl: getLoginUrlForCompany(uploadCompanyId),
                  credentials: {
                    email: emp.email,
                    password: "Password123!",
                    role: "Employee",
                  },
                  showSecurityNote: true,
                }
              )
            )
        );

        setShowUploadModal(false);
        setUploadCompanyId("");
        await loadData();

        const serverFailed = bulkResult?.failed ?? 0;
        const message =
          failedRows.length > 0 || serverFailed > 0
            ? `Added ${
                bulkResult?.succeeded ?? 0
              } employees successfully.\nCSV row failures: ${
                failedRows.length > 0 ? failedRows.join(", ") : "none"
              }. Server failures: ${serverFailed}.`
            : `Added ${bulkResult?.succeeded ?? 0} employees successfully!`;

        alert(message);
      } catch (error) {
        console.error("Error uploading employees:", error);
        alert("Failed to upload employees. Check data format.");
      }
    };
    reader.readAsText(file);
  };

  const exportCSV = () => {
    const csv = [
      "Name,Email,Phone,Role,Company,Department",
      ...filteredUsers.map(
        (u) =>
          `${u.full_name},${u.email},${u.phone || ""},${
            u.role
          },${getCompanyName(u.company_id)},${u.department || ""}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getFilteredUsers = () => {
    return users.filter((u) => {
      const matchesSearch =
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCompany =
        !selectedCompany || u.company_id === selectedCompany;
      const matchesRole = !selectedRole || u.role === selectedRole;

      return matchesSearch && matchesCompany && matchesRole;
    });
  };

  const filteredUsers = getFilteredUsers();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 0",
          gap: 14,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.06)",
            borderTopColor: T.accent,
            animation: "aw-spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  /* Stats */
  const roleCounts = {
    PLATFORM_ADMIN: 0,
    COMPANY_ADMIN: 0,
    EMPLOYEE: 0,
  } as Record<string, number>;
  users.forEach((u) => {
    if (roleCounts[u.role] !== undefined) roleCounts[u.role]++;
  });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Page header ── */}
      <div
        className="aw-fade-up"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 22,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 5,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(200,255,0,0.08)",
                border: "1px solid rgba(200,255,0,0.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={18} style={{ color: T.accent }} />
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: T.white,
                letterSpacing: "-0.3px",
                margin: 0,
              }}
            >
              User Management
            </h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            Manage all users and permissions across the platform.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 9,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button className="aw-um-btn-ghost" onClick={exportCSV}>
            <Download size={13} /> Export CSV
          </button>
          <button
            className="aw-um-btn-green"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload size={13} /> Bulk Upload
          </button>
          <button
            className="aw-um-btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={13} /> Add User
          </button>
        </div>
      </div>

      {/* ── Role stats ── */}
      <div
        className="aw-fade-up"
        style={{
          animationDelay: "0.04s",
          display: "flex",
          gap: 10,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        {Object.entries(ROLE_CFG).map(([role, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div
              key={role}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={14} style={{ color: cfg.color }} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: T.white,
                    lineHeight: 1,
                  }}
                >
                  {roleCounts[role] ?? 0}
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                  {cfg.label}
                </div>
              </div>
            </div>
          );
        })}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            fontSize: 12,
            color: T.textMuted,
          }}
        >
          <Users size={12} style={{ color: T.accent }} />
          Showing{" "}
          <strong style={{ color: T.textBody }}>
            {filtered.length}
          </strong> of{" "}
          <strong style={{ color: T.textBody }}>{users.length}</strong>
        </div>
      </div>

      {/* ── Filters ── */}
      <div
        className="aw-fade-up"
        style={{
          animationDelay: "0.06s",
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ flex: "2 1 200px", position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: T.textMuted,
              pointerEvents: "none",
            }}
          />
          <input
            className="aw-um-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 11,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: T.textMuted,
                padding: 0,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <select
          className="aw-um-select"
          style={{ flex: "1 1 160px" }}
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="aw-um-select"
          style={{ flex: "1 1 140px" }}
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="PLATFORM_ADMIN">Platform Admin</option>
          <option value="COMPANY_ADMIN">Company Admin</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div
        className="aw-fade-up"
        style={{
          animationDelay: "0.09s",
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div className="aw-um-scroll" style={{ overflowX: "auto" }}>
          <table className="aw-um-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Company</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <Avatar name={u.full_name} />
                      <span style={{ fontWeight: 600, color: T.white }}>
                        {u.full_name}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: T.textMuted }}>{u.email}</td>
                  <td style={{ color: T.textMuted }}>{u.phone || "—"}</td>
                  <td>
                    <RoleBadge role={u.role} />
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: T.textMuted,
                      }}
                    >
                      <Building2 size={11} />
                      {getCompanyName(u.company_id)}
                    </div>
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 7,
                      }}
                    >
                      <button
                        className="aw-um-icon-btn reset"
                        title="Reset Password"
                        onClick={() => handleResetPassword(u.id, u.email)}
                      >
                        <Key size={13} />
                      </button>
                      <select
                        className="aw-um-role-select"
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(u.id, e.target.value, u.email)
                        }
                      >
                        <option value="PLATFORM_ADMIN">Platform Admin</option>
                        <option value="COMPANY_ADMIN">Company Admin</option>
                        <option value="EMPLOYEE">Employee</option>
                      </select>
                      <button
                        className="aw-um-icon-btn del"
                        title="Delete"
                        onClick={() => handleDelete(u.id, u.email)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "52px 24px" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${T.borderFaint}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}
            >
              <Users size={22} style={{ color: T.textMuted }} />
            </div>
            <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
              No users matching your filters
            </p>
          </div>
        )}
      </div>

      {/* ═══════════ ADD USER MODAL ═══════════ */}
      {showAddModal && (
        <Modal
          title="Add New User"
          subtitle="Fill in the user details"
          icon={Plus}
          onClose={() => setShowAddModal(false)}
        >
          <form onSubmit={handleAddUser}>
            <div
              style={{
                padding: "18px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div>
                <label className="aw-um-label">
                  Full Name <span style={{ color: T.accent }}>*</span>
                </label>
                <input
                  className="aw-um-input"
                  required
                  placeholder="John Smith"
                  value={newUser.full_name}
                  onChange={(e) =>
                    setNewUser((p) => ({ ...p, full_name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="aw-um-label">
                  Email <span style={{ color: T.accent }}>*</span>
                </label>
                <input
                  className="aw-um-input"
                  type="email"
                  required
                  placeholder="john@company.com"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="aw-um-label">
                  Password <span style={{ color: T.accent }}>*</span>
                </label>
                <input
                  className="aw-um-input"
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser((p) => ({ ...p, password: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="aw-um-label">Phone</label>
                <input
                  className="aw-um-input"
                  type="tel"
                  placeholder="+966 5x xxx xxxx"
                  value={newUser.phone}
                  onChange={(e) =>
                    setNewUser((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label className="aw-um-label">
                    Role <span style={{ color: T.accent }}>*</span>
                  </label>
                  <select
                    className="aw-um-select"
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, role: e.target.value }))
                    }
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="COMPANY_ADMIN">Company Admin</option>
                    <option value="PLATFORM_ADMIN">Platform Admin</option>
                  </select>
                </div>
                <div>
                  <label className="aw-um-label">Company</label>
                  <select
                    className="aw-um-select"
                    value={newUser.company_id}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, company_id: e.target.value }))
                    }
                  >
                    <option value="">— Select —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div
              style={{
                padding: "14px 22px",
                borderTop: `1px solid ${T.borderFaint}`,
                display: "flex",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="aw-um-btn-ghost"
                onClick={() => setShowAddModal(false)}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="aw-um-save-btn"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2
                      size={14}
                      style={{ animation: "aw-spin 0.8s linear infinite" }}
                    />{" "}
                    Creating…
                  </>
                ) : (
                  <>
                    <Save size={14} /> Add User
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════ BULK UPLOAD MODAL ═══════════ */}
      {showUploadModal && (
        <Modal
          title="Bulk Upload Employees"
          subtitle="Upload a CSV file"
          icon={Upload}
          iconColor={T.green}
          onClose={() => {
            setShowUploadModal(false);
            setUploadCompanyId("");
          }}
        >
          <div
            style={{
              padding: "18px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                background: T.blueBg,
                border: `1px solid ${T.blueBorder}`,
                borderRadius: 10,
                fontSize: 13,
                color: T.blue,
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>
                Required CSV Format:
              </strong>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  fontSize: 12,
                }}
              >
                {[
                  "First row: column headers (name, email, phone, department)",
                  "Email and name are required",
                  "Phone and department are optional",
                  "Default password: Password123!",
                ].map((tip) => (
                  <div key={tip} style={{ display: "flex", gap: 7 }}>
                    <span style={{ color: T.accent }}>·</span>
                    {tip}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="aw-um-label">
                Select Company <span style={{ color: T.accent }}>*</span>
              </label>
              <select
                className="aw-um-select"
                value={uploadCompanyId}
                onChange={(e) => setUploadCompanyId(e.target.value)}
                required
              >
                <option value="">— Select Company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="aw-um-label">CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  fontSize: 13,
                  color: T.textBody,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              />
            </div>
          </div>
          <div
            style={{
              padding: "14px 22px",
              borderTop: `1px solid ${T.borderFaint}`,
            }}
          >
            <button
              className="aw-um-btn-ghost"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setShowUploadModal(false);
                setUploadCompanyId("");
              }}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* ═══════════ PASSWORD CONFIRM MODAL ═══════════ */}
      {showPassModal && (
        <Modal
          title="Confirm Your Identity"
          subtitle="Enter your password to proceed"
          icon={Key}
          iconColor={T.orange}
          onClose={() => {
            setShowPassModal(false);
            setConfirmPw("");
            setPwError("");
            setPendingAction(null);
          }}
          maxWidth={400}
        >
          <div
            style={{
              padding: "18px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <label className="aw-um-label">Your Password</label>
              <input
                className="aw-um-input"
                type="password"
                autoFocus
                placeholder="Enter your password"
                value={confirmPw}
                onChange={(e) => {
                  setConfirmPw(e.target.value);
                  setPwError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePwConfirm();
                }}
              />
              {pwError && (
                <p style={{ fontSize: 12, color: T.red, marginTop: 5 }}>
                  {pwError}
                </p>
              )}
            </div>
          </div>
          <div
            style={{
              padding: "14px 22px",
              borderTop: `1px solid ${T.borderFaint}`,
              display: "flex",
              gap: 10,
            }}
          >
            <button
              className="aw-um-btn-ghost"
              onClick={() => {
                setShowPassModal(false);
                setConfirmPw("");
                setPwError("");
                setPendingAction(null);
              }}
              style={{ flex: 1, justifyContent: "center" }}
            >
              Cancel
            </button>
            <button
              className="aw-um-save-btn"
              onClick={handlePwConfirm}
              style={{
                background: T.orange,
                boxShadow: "0 0 16px rgba(251,146,60,0.20)",
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
