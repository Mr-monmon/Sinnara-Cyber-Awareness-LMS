import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Building2, Loader2, Mail, Send } from "lucide-react";
import Quill from "quill";
import { supabase } from "../../lib/supabase";
import { Company } from "../../lib/types";

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
  return `
     <div style="margin:0; padding:32px 16px; background:#12140a; font-family:Arial, sans-serif; color:#ffffff;">
        <div style="max-width:600px; margin:0 auto; background:rgba(200,255,0,0.03); border:1px solid rgba(255,255,255,0.10); border-radius:18px; overflow:hidden; box-shadow:0 12px 32px rgba(0, 0, 0, 0.28);">
          <div style="padding:32px; background:linear-gradient(135deg, #12140a 0%, #1f2610 100%); color:#ffffff; border-bottom:1px solid rgba(255,255,255,0.10);">
            <p style="margin:0 0 10px; font-size:13px; letter-spacing:1.6px; text-transform:uppercase; color:#c8ff00;">Awareone</p>
            <h1 style="margin:0; font-size:22px; line-height:1.3;">Hello, ${escapeHtml(fullName)}</h1>
          </div>
          <div style="padding:32px;">
            <div style="margin:0; font-size:15px; line-height:1.8; color:#94a3b8;">${bodyHtml}</div>
          </div>
      </div>
    </div>
  `;
}

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
  const [loadingDepartments, setLoadingDepartments] = useState(false);
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

  useEffect(() => {
    const loadCompanies = async () => {
      setLoadingCompanies(true);
      setError("");
      try {
        const { data, error: fetchError } = await supabase
          .from("companies")
          .select("id, name")
          .order("name");

        if (fetchError) throw fetchError;
        setCompanies((data as Company[]) || []);
      } catch (e) {
        console.error(e);
        setError("Failed to load companies.");
      } finally {
        setLoadingCompanies(false);
      }
    };
    loadCompanies();
  }, []);

  useEffect(() => {
    if (!companyId) {
      setDepartments([]);
      setDepartmentId("");
      return;
    }

    const loadDepartments = async () => {
      setLoadingDepartments(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("departments")
          .select("id, name")
          .eq("company_id", companyId)
          .order("name");

        if (fetchError) throw fetchError;
        setDepartments((data as DepartmentRow[]) || []);
        setDepartmentId("");
      } catch (e) {
        console.error(e);
        setError("Failed to load departments for this company.");
      } finally {
        setLoadingDepartments(false);
      }
    };
    loadDepartments();
  }, [companyId]);

  useEffect(() => {
    if (
      targetScope !== "department" ||
      loadingDepartments ||
      !companyId ||
      departments.length > 0
    ) {
      return;
    }
    setTargetScope("all");
    setDepartmentId("");
  }, [targetScope, loadingDepartments, companyId, departments.length]);

  useEffect(() => {
    if (!quillHostRef.current || quillInstanceRef.current) {
      return;
    }

    const host = quillHostRef.current;
    host.innerHTML = "";

    const editorElement = document.createElement("div");
    editorElement.className = "min-h-[280px] bg-white";
    host.appendChild(editorElement);

    const quill = new Quill(editorElement, {
      theme: "snow",
      placeholder: "Write your email here...",
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
      const plainText = quill.getText().trim();
      const html = normalizeEditorHtml(quill.root.innerHTML, plainText);
      setMessageHtml((prev) => (prev === html ? prev : html));
      setMessagePlainText((prev) => (prev === plainText ? prev : plainText));
    });

    quill.on("selection-change", (range) => {
      if (range) {
        selectionIndexRef.current = range.index;
      }
    });

    const toolbar = quill.getModule("toolbar") as {
      addHandler: (name: string, handler: () => void) => void;
    };
    toolbar.addHandler("image", () => {
      imageInputRef.current?.click();
    });

    quillInstanceRef.current = quill;

    return () => {
      if (quillHostRef.current) {
        quillHostRef.current.innerHTML = "";
      }
      quillInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const quill = quillInstanceRef.current;
    if (!quill) {
      return;
    }

    const currentHtml = normalizeEditorHtml(
      quill.root.innerHTML,
      quill.getText().trim()
    );

    if (!messageHtml) {
      if (currentHtml) {
        quill.setText("");
      }
      return;
    }

    if (currentHtml !== messageHtml) {
      quill.clipboard.dangerouslyPasteHTML(messageHtml);
    }
  }, [messageHtml]);

  useEffect(() => {
    const quill = quillInstanceRef.current;
    if (!quill) {
      return;
    }

    quill.enable(!(sending || uploadingImage));
  }, [sending, uploadingImage]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";

    if (!file) {
      return;
    }

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
      setError("The email editor is not ready yet.");
      return;
    }

    setError("");
    setSuccess("");
    setUploadingImage(true);

    try {
      const fallbackExtension = file.type.split("/")[1] || "png";
      const rawExtension = file.name.split(".").pop() || fallbackExtension;
      const extension =
        rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "") ||
        fallbackExtension;
      const filePath = `platform-admin/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("emails")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("emails")
        .getPublicUrl(filePath);

      if (!publicUrlData.publicUrl) {
        throw new Error("Could not get the uploaded image URL.");
      }

      const insertIndex =
        selectionIndexRef.current ?? Math.max(quill.getLength() - 1, 0);
      quill.focus();
      quill.setSelection(insertIndex, 0, "silent");
      quill.insertEmbed(insertIndex, "image", publicUrlData.publicUrl, "api");

      const [leaf] = quill.getLeaf(insertIndex);
      if (leaf?.domNode instanceof HTMLImageElement) {
        leaf.domNode.setAttribute("alt", file.name || "Uploaded image");
        leaf.domNode.setAttribute("width", "560");
        leaf.domNode.setAttribute(
          "style",
          "max-width:100%;height:auto;display:block;margin:16px auto;border-radius:12px;"
        );
      }

      quill.insertText(insertIndex + 1, "\n", "api");
      quill.setSelection(insertIndex + 2, 0, "silent");
      selectionIndexRef.current = insertIndex + 2;
    } catch (uploadError) {
      console.error(uploadError);
      setError("Failed to upload the image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedSubject = subject.trim();
    const sanitizedMessageHtml = sanitizeEmailBody(messageHtml);
    const hasMessageContent =
      messagePlainText.trim().length > 0 || /<img\b/i.test(sanitizedMessageHtml);

    if (!companyId) {
      setError("Please select a company.");
      return;
    }
    if (!trimmedSubject) {
      setError("Please enter a message subject.");
      return;
    }
    if (!hasMessageContent) {
      setError("Please enter message content.");
      return;
    }
    if (targetScope === "department" && !departmentId) {
      setError(
        "Please select a department, or choose All company users instead."
      );
      return;
    }

    let query = supabase
      .from("users")
      .select("id, email, full_name")
      .eq("company_id", companyId)
      .in("role", ["EMPLOYEE", "COMPANY_ADMIN"]);

    if (targetScope === "department") {
      query = query.eq("department_id", departmentId);
    }

    const { data: rows, error: usersError } = await query;

    if (usersError) {
      console.error(usersError);
      setError("Could not load recipients. Please try again.");
      return;
    }

    const list = (rows || []) as RecipientRow[];
    const seen = new Set<string>();
    const recipients = list.filter((r) => {
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
        const { error: fnError } = await supabase.functions.invoke(
          "send-email",
          {
            body: {
              to: r.email,
              subject: trimmedSubject,
              html: buildMessageHtml(
                r.full_name || "there",
                sanitizedMessageHtml
              ),
            },
          }
        );
        if (fnError) {
          console.error(fnError);
          failed += 1;
        }
        setSendProgress({ done: i + 1, total: recipients.length });
      }

      if (failed > 0) {
        setError(
          `Sent to ${recipients.length - failed} of ${recipients.length} recipients; ${failed} failed.`
        );
      } else {
        setSuccess(`Sent to ${recipients.length} recipient(s).`);
        setSubject("");
        setMessageHtml("");
        setMessagePlainText("");
      }
    } catch (err) {
      console.error(err);
      setError("Sending failed. Please try again.");
    } finally {
      setSending(false);
      setTimeout(() => setSendProgress(null), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Send email
            </h1>
            <p className="text-sm text-slate-600">
              Send a message to users in a company, or to one department only.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        {error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {success ? (
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            role="status"
          >
            {success}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="email-company"
              className="flex items-center gap-2 text-sm font-medium text-slate-700"
            >
              <Building2 className="h-4 w-4 text-slate-500" />
              Company
            </label>
            <select
              id="email-company"
              value={companyId}
              onChange={(ev) => setCompanyId(ev.target.value)}
              disabled={loadingCompanies || sending || uploadingImage}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
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

          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">
              Send to
            </span>
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="targetScope"
                  checked={targetScope === "all"}
                  onChange={() => setTargetScope("all")}
                  disabled={sending || uploadingImage}
                  className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                All company users
              </label>
              <label
                className={`flex items-center gap-2 text-sm ${
                  !companyId || loadingDepartments
                    ? "cursor-not-allowed text-slate-400"
                    : "cursor-pointer text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="targetScope"
                  checked={targetScope === "department"}
                  onChange={() => setTargetScope("department")}
                  disabled={
                    sending ||
                    uploadingImage ||
                    !companyId ||
                    loadingDepartments ||
                    departments.length === 0
                  }
                  className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                A specific department
              </label>
            </div>
          </div>
        </div>

        {targetScope === "department" ? (
          <div className="space-y-2 flex gap-4 items-center">
            <label
              htmlFor="email-department"
              className="text-sm font-medium text-slate-700"
            >
              Department
            </label>
            <select
              id="email-department"
              value={departmentId}
              onChange={(ev) => setDepartmentId(ev.target.value)}
              disabled={
                !companyId || loadingDepartments || sending || uploadingImage
              }
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            >
              <option value="">
                {loadingDepartments
                  ? "Loading departments…"
                  : companyId
                    ? "Select a department"
                    : "Select a company first"}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {!companyId ? (
              <p className="text-xs text-slate-500">Choose a company first.</p>
            ) : departments.length === 0 && !loadingDepartments ? (
              <p className="text-xs text-slate-600">
                No departments for this company. Use &quot;All company
                users&quot; to send.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <label
            htmlFor="email-subject"
            className="text-sm font-medium text-slate-700"
          >
            Message subject
          </label>
          <input
            id="email-subject"
            type="text"
            value={subject}
            onChange={(ev) => setSubject(ev.target.value)}
            disabled={sending || uploadingImage}
            placeholder="Subject line"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-700">
              Message content
            </label>
            <span className="text-xs text-slate-500">
              Use the toolbar image button to upload PNG, JPG, GIF, or WebP
              files up to 5 MB.
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <div ref={quillHostRef} />
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={handleImageUpload}
          />
          {uploadingImage ? (
            <p className="text-sm text-slate-600">Uploading image…</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={
              sending ||
              uploadingImage ||
              loadingCompanies ||
              !companyId ||
              (targetScope === "department" && !departmentId)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending || uploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? "Sending…" : uploadingImage ? "Uploading image…" : "Send"}
          </button>
          {sendProgress ? (
            <span className="text-sm text-slate-600">
              {sendProgress.done} / {sendProgress.total} sent
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
};

export default EmailPage;
