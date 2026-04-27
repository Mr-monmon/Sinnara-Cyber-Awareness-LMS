import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import {
  Building2,
  Loader2,
  Mail,
  Send,
  Users,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  X,
} from "lucide-react";
import Quill from "quill";
import { supabase } from "../../lib/supabase";
import { Company } from "../../lib/types";
import { brandedEmailLayout } from "../../lib/email";

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
  red: "#f87171",
  redBg: "rgba(248,113,113,0.08)",
  redBorder: "rgba(248,113,113,0.22)",
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.08)",
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Form inputs ── */
  .aw-ep-input, .aw-ep-select {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-ep-input  { padding: 11px 14px; }
  .aw-ep-select {
    padding: 11px 36px 11px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-ep-input:focus, .aw-ep-select:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-ep-input::placeholder { color: rgba(148,163,184,0.35); }
  .aw-ep-input:disabled, .aw-ep-select:disabled { opacity: 0.45; cursor: not-allowed; }
  .aw-ep-select option { background: #1a1e0e; color: #ffffff; }

  .aw-ep-label {
    display: block; font-size: 12px; font-weight: 600; color: #94a3b8;
    margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif;
  }

  /* ── Radio option ── */
  .aw-ep-radio-row {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 14px; border-radius: 10px; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
    transition: all 0.18s; font-family: 'Inter', sans-serif;
  }
  .aw-ep-radio-row.selected { background: rgba(200,255,0,0.06); border-color: rgba(200,255,0,0.25); }
  .aw-ep-radio-row.disabled { opacity: 0.40; cursor: not-allowed; }
  .aw-ep-radio-row:not(.disabled):hover { background: rgba(255,255,255,0.05); }
  .aw-ep-radio-dot {
    width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.25);
    display: flex; align-items: center; justify-content: center;
    transition: all 0.18s;
  }
  .aw-ep-radio-row.selected .aw-ep-radio-dot {
    border-color: #c8ff00; background: #c8ff00;
  }
  .aw-ep-radio-inner { width: 7px; height: 7px; border-radius: 50%; background: #12140a; }

  /* ── Progress bar ── */
  .aw-ep-progress-track {
    height: 6px; background: rgba(255,255,255,0.07);
    border-radius: 9999px; overflow: hidden;
  }
  .aw-ep-progress-fill {
    height: 100%; border-radius: 9999px;
    background: linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.55));
    box-shadow: 0 0 8px rgba(200,255,0,0.30);
    transition: width 0.3s ease;
  }

  /* ── Send button ── */
  .aw-ep-send-btn {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 13px 28px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 15px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 22px rgba(200,255,0,0.22);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-ep-send-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-ep-send-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  /* ── Quill editor override — dark theme ── */
  .aw-ep-editor-wrap .ql-toolbar {
    background: rgba(255,255,255,0.04) !important;
    border-color: rgba(255,255,255,0.09) !important;
    border-radius: 10px 10px 0 0 !important;
  }
  .aw-ep-editor-wrap .ql-toolbar .ql-stroke { stroke: #94a3b8 !important; }
  .aw-ep-editor-wrap .ql-toolbar .ql-fill   { fill:   #94a3b8 !important; }
  .aw-ep-editor-wrap .ql-toolbar .ql-picker-label { color: #94a3b8 !important; }
  .aw-ep-editor-wrap .ql-toolbar button:hover .ql-stroke { stroke: #c8ff00 !important; }
  .aw-ep-editor-wrap .ql-toolbar button:hover .ql-fill   { fill:   #c8ff00 !important; }
  .aw-ep-editor-wrap .ql-toolbar .ql-active .ql-stroke { stroke: #c8ff00 !important; }
  .aw-ep-editor-wrap .ql-toolbar .ql-active .ql-fill   { fill:   #c8ff00 !important; }
  .aw-ep-editor-wrap .ql-container {
    background: #ffffff !important;
    border-color: rgba(255,255,255,0.09) !important;
    border-radius: 0 0 10px 10px !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 14px !important;
    min-height: 280px;
  }
  .aw-ep-editor-wrap .ql-editor { min-height: 280px; color: #1a1a1a !important; }
  .aw-ep-editor-wrap .ql-editor.ql-blank::before { color: #94a3b8 !important; font-style: normal !important; }
  .aw-ep-editor-wrap .ql-picker-options {
    background: #1a1e0e !important;
    border-color: rgba(255,255,255,0.09) !important;
    color: #ffffff !important;
  }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("aw-ep-styles")
) {
  const tag = document.createElement("style");
  tag.id = "aw-ep-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   CONSTANTS (unchanged)
───────────────────────────────────────── */
type TargetScope = "all" | "department";
const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const EMAIL_BODY_ALLOWED_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "u",
  "ul",
];
const EMAIL_BODY_ALLOWED_ATTR = [
  "alt",
  "height",
  "href",
  "rel",
  "src",
  "style",
  "target",
  "width",
];

interface DepartmentRow {
  id: string;
  name: string;
}
interface RecipientRow {
  id: string;
  email: string;
  full_name: string;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function sanitizeEmailBody(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: EMAIL_BODY_ALLOWED_TAGS,
    ALLOWED_ATTR: EMAIL_BODY_ALLOWED_ATTR,
  });
}
function normalizeEditorHtml(html: string, plainText: string) {
  return plainText.trim().length > 0 || /<img\b/i.test(html) ? html : "";
}
function buildMessageHtml(fullName: string, bodyHtml: string) {
  return brandedEmailLayout(`
    <div style="padding:32px; background:linear-gradient(135deg, #12140a 0%, #1f2610 100%); color:#ffffff; border-bottom:1px solid rgba(255,255,255,0.10);">
      <p style="margin:0 0 10px; font-size:13px; letter-spacing:1.6px; text-transform:uppercase; color:#c8ff00;">Awareone</p>
      <h1 style="margin:0; font-size:22px; line-height:1.3;">Hello, ${escapeHtml(fullName)}</h1>
    </div>
    <div style="padding:32px;">
      <div style="margin:0; font-size:15px; line-height:1.8; color:#94a3b8;">${bodyHtml}</div>
    </div>
  `);
}

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
const EmailPage = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [targetScope, setTargetScope] = useState<TargetScope>("all");
  const [subject, setSubject] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [messagePlainText, setMessagePlainText] = useState("");
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sendProgress, setSendProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const quillHostRef = useRef<HTMLDivElement | null>(null);
  const quillInstanceRef = useRef<Quill | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const selectionIndexRef = useRef<number | null>(null);

  /* Load companies */
  useEffect(() => {
    const load = async () => {
      setLoadingCompanies(true);
      setError("");
      try {
        const { data, error: e } = await supabase
          .from("companies")
          .select("id, name")
          .order("name");
        if (e) throw e;
        setCompanies((data as Company[]) || []);
      } catch {
        setError("Failed to load companies.");
      } finally {
        setLoadingCompanies(false);
      }
    };
    load();
  }, []);

  /* Load departments */
  useEffect(() => {
    if (!companyId) {
      setDepartments([]);
      setDepartmentId("");
      return;
    }
    const load = async () => {
      setLoadingDepts(true);
      try {
        const { data, error: e } = await supabase
          .from("departments")
          .select("id, name")
          .eq("company_id", companyId)
          .order("name");
        if (e) throw e;
        setDepartments((data as DepartmentRow[]) || []);
        setDepartmentId("");
      } catch {
        setError("Failed to load departments.");
      } finally {
        setLoadingDepts(false);
      }
    };
    load();
  }, [companyId]);

  useEffect(() => {
    if (
      targetScope === "department" &&
      !loadingDepts &&
      companyId &&
      departments.length === 0
    ) {
      setTargetScope("all");
      setDepartmentId("");
    }
  }, [targetScope, loadingDepts, companyId, departments.length]);

  /* Quill init */
  useEffect(() => {
    if (!quillHostRef.current || quillInstanceRef.current) return;
    const host = quillHostRef.current;
    host.innerHTML = "";
    const editorEl = document.createElement("div");
    editorEl.style.minHeight = "280px";
    host.appendChild(editorEl);
    const quill = new Quill(editorEl, {
      theme: "snow",
      placeholder: "Write your email here…",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "blockquote", "image"],
          ["clean"],
        ],
      },
    });
    quill.on("text-change", () => {
      const pt = quill.getText().trim();
      const html = normalizeEditorHtml(quill.root.innerHTML, pt);
      setMessageHtml((prev) => (prev === html ? prev : html));
      setMessagePlainText((prev) => (prev === pt ? prev : pt));
    });
    quill.on("selection-change", (range) => {
      if (range) selectionIndexRef.current = range.index;
    });
    (quill.getModule("toolbar") as any).addHandler("image", () =>
      imageInputRef.current?.click()
    );
    quillInstanceRef.current = quill;
    return () => {
      if (quillHostRef.current) quillHostRef.current.innerHTML = "";
      quillInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const quill = quillInstanceRef.current;
    if (!quill) return;
    const curr = normalizeEditorHtml(
      quill.root.innerHTML,
      quill.getText().trim()
    );
    if (!messageHtml) {
      if (curr) quill.setText("");
      return;
    }
    if (curr !== messageHtml) quill.clipboard.dangerouslyPasteHTML(messageHtml);
  }, [messageHtml]);

  useEffect(() => {
    quillInstanceRef.current?.enable(!(sending || uploadingImage));
  }, [sending, uploadingImage]);

  /* Image upload */
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Please upload a PNG, JPG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError("Images must be 5 MB or smaller.");
      return;
    }
    const quill = quillInstanceRef.current;
    if (!quill) {
      setError("Editor not ready.");
      return;
    }
    setError("");
    setSuccess("");
    setUploadingImage(true);
    try {
      const ext = (
        file.name.split(".").pop() ||
        file.type.split("/")[1] ||
        "png"
      )
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const filePath = `platform-admin/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("emails")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from("emails")
        .getPublicUrl(filePath);
      if (!urlData.publicUrl) throw new Error("Could not get image URL.");
      const idx =
        selectionIndexRef.current ?? Math.max(quill.getLength() - 1, 0);
      quill.focus();
      quill.setSelection(idx, 0, "silent");
      quill.insertEmbed(idx, "image", urlData.publicUrl, "api");
      const [leaf] = quill.getLeaf(idx);
      if (leaf?.domNode instanceof HTMLImageElement) {
        leaf.domNode.setAttribute("alt", file.name || "Uploaded image");
        leaf.domNode.setAttribute("width", "560");
        leaf.domNode.setAttribute(
          "style",
          "max-width:100%;height:auto;display:block;margin:16px auto;border-radius:12px;"
        );
      }
      quill.insertText(idx + 1, "\n", "api");
      quill.setSelection(idx + 2, 0, "silent");
      selectionIndexRef.current = idx + 2;
    } catch {
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  /* Submit */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const trimSub = subject.trim();
    const sanitized = sanitizeEmailBody(messageHtml);
    const hasContent =
      messagePlainText.trim().length > 0 || /<img\b/i.test(sanitized);
    if (!companyId) {
      setError("Please select a company.");
      return;
    }
    if (!trimSub) {
      setError("Please enter a subject.");
      return;
    }
    if (!hasContent) {
      setError("Please write the email content.");
      return;
    }
    if (targetScope === "department" && !departmentId) {
      setError("Please select a department.");
      return;
    }

    let q = supabase
      .from("users")
      .select("id, email, full_name")
      .eq("company_id", companyId)
      .in("role", ["EMPLOYEE", "COMPANY_ADMIN"]);
    if (targetScope === "department") q = q.eq("department_id", departmentId);
    const { data: rows, error: usersErr } = await q;
    if (usersErr) {
      setError("Could not load recipients.");
      return;
    }

    const seen = new Set<string>();
    const recipients = ((rows || []) as RecipientRow[]).filter((r) => {
      const em = (r.email || "").trim().toLowerCase();
      if (!em || seen.has(em)) return false;
      seen.add(em);
      return true;
    });
    if (recipients.length === 0) {
      setError("No users match this selection.");
      return;
    }

    setSending(true);
    setSendProgress({ done: 0, total: recipients.length });
    let failed = 0;
    try {
      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        const { error: fnErr } = await supabase.functions.invoke("send-email", {
          body: {
            to: r.email,
            subject: trimSub,
            html: buildMessageHtml(r.full_name || "there", sanitized),
          },
        });
        if (fnErr) {
          console.error(fnErr);
          failed++;
        }
        setSendProgress({ done: i + 1, total: recipients.length });
      }
      if (failed > 0) {
        setError(
          `Sent to ${recipients.length - failed} of ${
            recipients.length
          }; ${failed} failed.`
        );
      } else {
        setSuccess(
          `Email sent to ${recipients.length} recipient${
            recipients.length !== 1 ? "s" : ""
          } ✓`
        );
        setSubject("");
        setMessageHtml("");
        setMessagePlainText("");
      }
    } catch {
      setError("Sending failed. Please try again.");
    } finally {
      setSending(false);
      setTimeout(() => setSendProgress(null), 3000);
    }
  };

  const pct = sendProgress
    ? Math.round((sendProgress.done / sendProgress.total) * 100)
    : 0;
  const isDisabled =
    sending ||
    uploadingImage ||
    loadingCompanies ||
    !companyId ||
    (targetScope === "department" && !departmentId);

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* ── Page header ── */}
      <div
        className="aw-fade-up"
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: T.blueBg,
            border: `1px solid ${T.blueBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Mail size={18} style={{ color: T.blue }} />
        </div>
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: T.white,
              letterSpacing: "-0.3px",
              margin: 0,
            }}
          >
            Send Email
          </h1>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            Send a message to company users or a specific department.
          </p>
        </div>
      </div>

      {/* ── Feedback messages ── */}
      {error && (
        <div
          className="aw-fade-up"
          style={{
            padding: "12px 16px",
            background: T.redBg,
            border: `1px solid ${T.redBorder}`,
            borderRadius: 10,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 13,
            color: T.red,
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.red,
              padding: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {success && (
        <div
          className="aw-fade-up"
          style={{
            padding: "12px 16px",
            background: T.greenBg,
            border: `1px solid ${T.greenBorder}`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: T.green,
          }}
        >
          <CheckCircle size={15} /> {success}
        </div>
      )}

      {/* ── Form ── */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {/* ── Left: Targeting ── */}
          <div
            className="aw-fade-up"
            style={{
              animationDelay: "0.05s",
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${T.borderFaint}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Users size={14} style={{ color: T.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>
                Recipients
              </span>
            </div>
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Company */}
              <div>
                <label className="aw-ep-label">
                  <Building2
                    size={11}
                    style={{
                      display: "inline",
                      marginRight: 5,
                      verticalAlign: "middle",
                    }}
                  />
                  Company <span style={{ color: T.accent }}>*</span>
                </label>
                <select
                  className="aw-ep-select"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  disabled={loadingCompanies || sending || uploadingImage}
                  required
                >
                  <option value="">
                    {loadingCompanies ? "Loading…" : "Select a company"}
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target scope */}
              <div>
                <label className="aw-ep-label">Send to</label>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 7 }}
                >
                  {/* All users */}
                  <div
                    className={`aw-ep-radio-row ${
                      targetScope === "all" ? "selected" : ""
                    }`}
                    onClick={() =>
                      !sending && !uploadingImage && setTargetScope("all")
                    }
                  >
                    <div className="aw-ep-radio-dot">
                      {targetScope === "all" && (
                        <div className="aw-ep-radio-inner" />
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: targetScope === "all" ? T.white : T.textBody,
                        }}
                      >
                        All Company Users
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>
                        Employees & Company Admins
                      </div>
                    </div>
                  </div>

                  {/* Specific department */}
                  <div
                    className={`aw-ep-radio-row ${
                      targetScope === "department" ? "selected" : ""
                    } ${
                      !companyId || loadingDepts || departments.length === 0
                        ? "disabled"
                        : ""
                    }`}
                    onClick={() => {
                      if (
                        !companyId ||
                        loadingDepts ||
                        departments.length === 0 ||
                        sending ||
                        uploadingImage
                      )
                        return;
                      setTargetScope("department");
                    }}
                  >
                    <div className="aw-ep-radio-dot">
                      {targetScope === "department" && (
                        <div className="aw-ep-radio-inner" />
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            targetScope === "department" ? T.white : T.textBody,
                        }}
                      >
                        Specific Department
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>
                        {!companyId
                          ? "Select a company first"
                          : departments.length === 0 && !loadingDepts
                          ? "No departments found"
                          : "Target one department only"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Department selector */}
              {targetScope === "department" && (
                <div>
                  <label className="aw-ep-label">
                    Department <span style={{ color: T.accent }}>*</span>
                  </label>
                  <select
                    className="aw-ep-select"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    disabled={
                      !companyId || loadingDepts || sending || uploadingImage
                    }
                  >
                    <option value="">
                      {loadingDepts
                        ? "Loading departments…"
                        : "Select a department"}
                    </option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipient count pill */}
              {companyId && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "rgba(200,255,0,0.05)",
                    border: "1px solid rgba(200,255,0,0.16)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: T.textBody,
                  }}
                >
                  {targetScope === "all"
                    ? "📩 Will be sent to all employees & admins in this company"
                    : departmentId
                    ? "📩 Will be sent to all users in the selected department"
                    : "🔍 Select a department to continue"}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Subject ── */}
          <div
            className="aw-fade-up"
            style={{
              animationDelay: "0.08s",
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${T.borderFaint}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Mail size={14} style={{ color: T.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>
                Email Details
              </span>
            </div>
            <div style={{ padding: "16px 20px", flex: 1 }}>
              <label className="aw-ep-label">
                Subject Line <span style={{ color: T.accent }}>*</span>
              </label>
              <input
                className="aw-ep-input"
                type="text"
                placeholder="e.g. Important Security Update"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending || uploadingImage}
              />
              <p style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>
                This will appear as the email subject in the recipient's inbox.
              </p>

              {/* Tips */}
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  background: T.orangeBg,
                  border: "1px solid rgba(251,146,60,0.22)",
                  borderRadius: 9,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.orange,
                  }}
                >
                  <ImageIcon size={12} /> Image Upload Tips
                </div>
                <ul
                  style={{
                    fontSize: 11,
                    color: T.textBody,
                    margin: 0,
                    paddingLeft: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <li>Use the toolbar image button to embed images</li>
                  <li>Supported: PNG, JPG, GIF, WebP</li>
                  <li>Max size: 5 MB per image</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ── Email Editor ── */}
        <div
          className="aw-fade-up"
          style={{
            animationDelay: "0.12s",
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: `1px solid ${T.borderFaint}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Mail size={14} style={{ color: T.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>
                Email Content
              </span>
            </div>
            {uploadingImage && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: T.orange,
                }}
              >
                <Loader2
                  size={13}
                  style={{ animation: "aw-spin 0.8s linear infinite" }}
                />{" "}
                Uploading image…
              </div>
            )}
          </div>
          <div style={{ padding: "16px 20px" }}>
            <div className="aw-ep-editor-wrap">
              <div ref={quillHostRef} />
            </div>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />
        </div>

        {/* ── Send button + progress ── */}
        <div
          className="aw-fade-up"
          style={{
            animationDelay: "0.16s",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            className="aw-ep-send-btn"
            disabled={isDisabled}
          >
            {sending || uploadingImage ? (
              <>
                <Loader2
                  size={16}
                  style={{ animation: "aw-spin 0.8s linear infinite" }}
                />{" "}
                {sending ? "Sending…" : "Uploading image…"}
              </>
            ) : (
              <>
                <Send size={15} /> Send Email
              </>
            )}
          </button>

          {/* Progress */}
          {sendProgress && (
            <div
              style={{
                flex: 1,
                minWidth: 200,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: T.textBody,
                }}
              >
                <span>
                  Sending {sendProgress.done} of {sendProgress.total} emails…
                </span>
                <span style={{ color: T.accent, fontWeight: 700 }}>{pct}%</span>
              </div>
              <div className="aw-ep-progress-track">
                <div
                  className="aw-ep-progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default EmailPage;
