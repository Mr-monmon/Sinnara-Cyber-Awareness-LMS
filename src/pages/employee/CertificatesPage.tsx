import DOMPurify from "dompurify";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import React, { useCallback, useEffect, useState } from "react";
import { Award, Calendar, CheckCircle, Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { formatLocalizedDate, formatLocalizedNumber } from "../../i18n/utils";
import { supabase } from "../../lib/supabase";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#94a3b8',
  textLabel:   '#cbd5e1',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.09)',
  borderFaint: 'rgba(255,255,255,0.05)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-cert-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    overflow: hidden;
    transition: border-color 0.22s, box-shadow 0.22s, transform 0.22s;
    font-family: 'Inter', sans-serif;
  }
  .aw-cert-card:hover {
    border-color: rgba(251,191,36,0.30);
    box-shadow: 0 12px 36px rgba(0,0,0,0.30), 0 0 0 1px rgba(251,191,36,0.08);
    transform: translateY(-2px);
  }

  .aw-dl-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 11px 20px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(251,191,36,0.12);
    border: 1px solid rgba(251,191,36,0.28);
    color: #fbbf24;
    transition: background 0.18s, border-color 0.18s, transform 0.15s;
  }
  .aw-dl-btn:hover:not(:disabled) {
    background: rgba(251,191,36,0.20);
    border-color: rgba(251,191,36,0.45);
    transform: translateY(-1px);
  }
  .aw-dl-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .aw-cert-meta-row {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 12px; padding: 5px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .aw-cert-meta-row:last-child { border-bottom: none; }

  @keyframes aw-spin  { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== "undefined" && !document.getElementById("aw-cert-styles")) {
  const tag = document.createElement("style");
  tag.id = "aw-cert-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES (unchanged)
───────────────────────────────────────── */
interface CertificateTemplateData {
  id: string; name: string; template_html: string;
  background_image_url: string | null; logo_url: string | null; signature_image_url: string | null;
}
interface Certificate {
  id: string; certificate_number: string; course_id: string; employee_id: string;
  issued_at: string; completion_date: string; score: number | null;
  employee_name: string; course_name: string; template_id: string | null;
  courses: { title: string; description: string };
  certificate_templates: CertificateTemplateData | null;
}
interface CertificateRenderData {
  employeeName: string; courseName: string; certificateNumberText: string;
  issueDateText: string; completionDateText: string; scoreText: string | null;
  titleText: string; certifiesText: string; completedCourseText: string;
  summaryLine1: string; summaryLine2: string; summaryLine3: string;
  backgroundImageUrl: string; logoUrl: string; signatureImageUrl: string;
}

/* ─────────────────────────────────────────
   CERTIFICATE GENERATION HELPERS (unchanged)
───────────────────────────────────────── */
const DEFAULT_CERTIFICATE_WIDTH = 1123;
const DEFAULT_CERTIFICATE_HEIGHT = 794;
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const BLOCK_LEVEL_TAGS = new Set(["ARTICLE","DIV","H1","H2","H3","H4","H5","H6","LI","P","SECTION","SPAN","STRONG","TD","TH"]);

const findRemovalTarget = (node: Node) => {
  let current = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  while (current) { if (BLOCK_LEVEL_TAGS.has(current.tagName)) return current; current = current.parentElement; }
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
};

const stripPlaceholderElements = (template: HTMLTemplateElement, placeholderName: string) => {
  const placeholderPattern = new RegExp(`\\{\\{\\s*${placeholderName}\\s*\\}\\}`);
  const removalTargets = new Set<Element>();
  const textWalker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  let currentTextNode = textWalker.nextNode();
  while (currentTextNode) {
    if (placeholderPattern.test(currentTextNode.textContent || "")) {
      const t = findRemovalTarget(currentTextNode); if (t) removalTargets.add(t);
    }
    currentTextNode = textWalker.nextNode();
  }
  Array.from(template.content.querySelectorAll("*")).forEach((el) => {
    if (Array.from(el.attributes).some((a) => placeholderPattern.test(a.value))) {
      const t = findRemovalTarget(el); if (t) removalTargets.add(t);
    }
  });
  removalTargets.forEach((el) => el.remove());
};

const fillTemplateHtml = (templateHtml: string, values: Record<string, string>, hasScore: boolean) => {
  const template = document.createElement("template");
  template.innerHTML = templateHtml;
  if (!hasScore) stripPlaceholderElements(template, "score");
  const interpolatedHtml = template.innerHTML
    .replace(PLACEHOLDER_PATTERN, (_, key: string) => values[key] ?? "")
    .replace(PLACEHOLDER_PATTERN, "");
  return DOMPurify.sanitize(interpolatedHtml, { USE_PROFILES: { html: true } });
};

const buildGenericCertificateHtml = (data: CertificateRenderData, isRtl: boolean) => {
  const direction = isRtl ? "rtl" : "ltr";
  const alignment = isRtl ? "right" : "left";
  const scoreMarkup = data.scoreText ? `<div style="margin-bottom:12px;font-size:20px;color:#0f172a;font-weight:600;">${data.scoreText}</div>` : "";
  const backgroundImageMarkup = data.backgroundImageUrl
    ? `background-image:linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,248,235,0.96)),url('${data.backgroundImageUrl}');background-size:cover;background-position:center;`
    : "background:linear-gradient(135deg,#fffaf0 0%,#ffffff 42%,#fef3c7 100%);";
  const logoMarkup = data.logoUrl ? `<div style="margin-bottom:18px;text-align:center;"><img src="${data.logoUrl}" alt="Certificate logo" style="max-height:72px;max-width:220px;object-fit:contain;"/></div>` : "";
  const signatureMarkup = data.signatureImageUrl ? `<div style="margin-top:26px;text-align:center;"><img src="${data.signatureImageUrl}" alt="Signature" style="max-height:76px;max-width:220px;object-fit:contain;"/></div>` : "";
  return DOMPurify.sanitize(`
    <div dir="${direction}" style="width:${DEFAULT_CERTIFICATE_WIDTH}px;height:${DEFAULT_CERTIFICATE_HEIGHT}px;box-sizing:border-box;padding:46px;${backgroundImageMarkup}color:#0f172a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border:18px solid #d4a017;position:relative;overflow:hidden;">
      <div style="width:100%;height:100%;box-sizing:border-box;border:2px solid rgba(212,160,23,0.45);background:rgba(255,255,255,0.9);padding:38px 54px;display:flex;flex-direction:column;justify-content:space-between;text-align:center;">
        <div>
          ${logoMarkup}
          <div style="font-size:18px;letter-spacing:0.32em;text-transform:uppercase;color:#a16207;margin-bottom:18px;">AwareOne</div>
          <h1 style="font-size:48px;line-height:1.15;margin:0 0 16px;color:#7c2d12;">${data.titleText}</h1>
          <div style="width:180px;height:4px;border-radius:999px;background:linear-gradient(90deg,#d97706,#f59e0b);margin:0 auto 26px;"></div>
          <p style="margin:0 0 20px;font-size:20px;color:#475569;">${data.certifiesText}</p>
          <div style="font-size:42px;line-height:1.15;font-weight:700;color:#111827;margin-bottom:18px;">${data.employeeName}</div>
          <p style="margin:0 0 12px;font-size:21px;color:#475569;">${data.completedCourseText}</p>
          <div style="font-size:34px;line-height:1.25;font-weight:700;color:#92400e;margin-bottom:28px;">${data.courseName}</div>
          ${scoreMarkup}
        </div>
        <div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;text-align:${alignment};margin-bottom:24px;">
            <div style="padding:18px 20px;border-radius:18px;background:#fffdf8;border:1px solid rgba(148,64,14,0.12);font-size:16px;font-weight:600;">${data.certificateNumberText}</div>
            <div style="padding:18px 20px;border-radius:18px;background:#fffdf8;border:1px solid rgba(148,64,14,0.12);font-size:16px;font-weight:600;">${data.issueDateText}</div>
            <div style="padding:18px 20px;border-radius:18px;background:#fffdf8;border:1px solid rgba(148,64,14,0.12);font-size:16px;font-weight:600;">${data.completionDateText}</div>
          </div>
          <div style="font-size:16px;color:#475569;line-height:1.8;"><div>${data.summaryLine1}</div><div>${data.summaryLine2}</div><div>${data.summaryLine3}</div></div>
          ${signatureMarkup}
        </div>
      </div>
    </div>`, { USE_PROFILES: { html: true } });
};

const waitForRenderableContent = async (element: HTMLElement) => {
  const fontSet = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  if (fontSet?.ready) await fontSet.ready;
  const imagePromises = Array.from(element.querySelectorAll("img")).map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  });
  await Promise.all(imagePromises);
  await new Promise<void>((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(() => resolve()); }); });
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CertificatesPage: React.FC = () => {
  const { user }    = useAuth();
  const { t, i18n } = useTranslation(["common", "employee"]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading]           = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const currentLanguage = i18n.resolvedLanguage;
  const isRtl = i18n.dir() === "rtl";

  const loadCertificates = useCallback(async () => {
    if (!user?.id) { setCertificates([]); setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("issued_certificates")
        .select(`*, courses(title, description), certificate_templates:certificate_templates!issued_certificates_template_id_fkey(id, name, template_html, background_image_url, logo_url, signature_image_url)`)
        .eq("employee_id", user.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      if (data) setCertificates(data as Certificate[]);
    } catch (err) { console.error("Error loading certificates:", err); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { setLoading(true); loadCertificates(); }, [loadCertificates]);

  const handleDownload = async (cert: Certificate) => {
    const employeeName = cert.employee_name || user?.full_name || t("certificates.downloadTemplate.employeeFallback", { ns: "employee" });
    const courseName   = cert.course_name || cert.courses.title;
    const scoreValue   = cert.score !== null ? formatLocalizedNumber(Number(cert.score.toFixed(1)), currentLanguage) : null;
    const renderData: CertificateRenderData = {
      employeeName, courseName,
      certificateNumberText: t("certificates.downloadTemplate.certificateNumber", { ns: "employee", value: cert.certificate_number }),
      issueDateText:         t("certificates.downloadTemplate.issueDate",          { ns: "employee", value: formatLocalizedDate(cert.issued_at, currentLanguage) }),
      completionDateText:    t("certificates.downloadTemplate.completionDate",     { ns: "employee", value: formatLocalizedDate(cert.completion_date, currentLanguage) }),
      scoreText: scoreValue !== null ? t("certificates.downloadTemplate.score", { ns: "employee", value: scoreValue }) : null,
      titleText:            t("certificates.downloadTemplate.title",           { ns: "employee" }),
      certifiesText:        t("certificates.downloadTemplate.certifies",       { ns: "employee" }),
      completedCourseText:  t("certificates.downloadTemplate.completedCourse", { ns: "employee" }),
      summaryLine1: t("certificates.downloadTemplate.summaryLine1", { ns: "employee" }),
      summaryLine2: t("certificates.downloadTemplate.summaryLine2", { ns: "employee" }),
      summaryLine3: t("certificates.downloadTemplate.summaryLine3", { ns: "employee" }),
      backgroundImageUrl: cert.certificate_templates?.background_image_url || "",
      logoUrl:            cert.certificate_templates?.logo_url || "",
      signatureImageUrl:  cert.certificate_templates?.signature_image_url || "",
    };
    const templateValues = {
      employee_name: renderData.employeeName, course_name: renderData.courseName,
      completion_date: formatLocalizedDate(cert.completion_date, currentLanguage),
      issued_at: formatLocalizedDate(cert.issued_at, currentLanguage),
      certificate_number: cert.certificate_number, score: scoreValue || "",
      background_image_url: renderData.backgroundImageUrl, logo_url: renderData.logoUrl, signature_image_url: renderData.signatureImageUrl,
    };
    const templateHtml = cert.certificate_templates?.template_html
      ? fillTemplateHtml(cert.certificate_templates.template_html, templateValues, cert.score !== null)
      : buildGenericCertificateHtml(renderData, isRtl);
    const renderRoot = document.createElement("div");
    renderRoot.setAttribute("aria-hidden", "true");
    Object.assign(renderRoot.style, { position: "fixed", left: "-10000px", top: "0", opacity: "0", pointerEvents: "none", zIndex: "-1", background: "#ffffff" });
    const renderSurface = document.createElement("div");
    renderSurface.dir = isRtl ? "rtl" : "ltr";
    Object.assign(renderSurface.style, { display: "inline-block", background: "#ffffff" });
    renderSurface.innerHTML = templateHtml;
    renderRoot.appendChild(renderSurface);
    setDownloadingId(cert.id);
    try {
      document.body.appendChild(renderRoot);
      await waitForRenderableContent(renderSurface);
      const targetWidth  = renderSurface.scrollWidth  || DEFAULT_CERTIFICATE_WIDTH;
      const targetHeight = renderSurface.scrollHeight || DEFAULT_CERTIFICATE_HEIGHT;
      const canvas = await html2canvas(renderSurface, { backgroundColor: "#ffffff", height: targetHeight, logging: false, scale: 2, useCORS: true, width: targetWidth, windowHeight: targetHeight, windowWidth: targetWidth });
      const pdf = new jsPDF({ orientation: targetWidth > targetHeight ? "landscape" : "portrait", unit: "px", format: [targetWidth, targetHeight], hotfixes: ["px_scaling"] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, targetWidth, targetHeight);
      pdf.save(`Certificate_${cert.certificate_number}.pdf`);
    } catch (err) {
      console.error("Error generating certificate PDF:", err);
      alert(t("certificates.downloadFailed", { ns: "employee" }));
    } finally { renderRoot.remove(); setDownloadingId(null); }
  };

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 14, color: T.textBody }}>Loading certificates…</p>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.goldBg, border: `1px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={18} style={{ color: T.gold }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
            {t("certificates.title", { ns: "employee" })}
          </h1>
        </div>
        <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
          {t("certificates.subtitle", { ns: "employee" })}
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.05s', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        {[
          { icon: Award,         color: T.gold,    bg: T.goldBg,                    border: T.goldBorder,              label: t("certificates.summary.total",  { ns: "employee" }), value: formatLocalizedNumber(certificates.length, currentLanguage) },
          { icon: CheckCircle,   color: '#34d399', bg: 'rgba(52,211,153,0.08)',      border: 'rgba(52,211,153,0.22)',    label: t("certificates.summary.active", { ns: "employee" }), value: formatLocalizedNumber(certificates.length, currentLanguage) },
          { icon: Calendar,      color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',      border: 'rgba(96,165,250,0.22)',    label: t("labels.latestYear", { ns: "common" }),              value: certificates.length > 0 ? formatLocalizedNumber(new Date(certificates[0].issued_at).getFullYear(), currentLanguage) : '—' },
        ].map(({ icon: Icon, color, bg, border, label, value }) => (
          <div key={label} style={{ padding: '14px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, minWidth: 160 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={17} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.white, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Empty state ── */}
      {certificates.length === 0 ? (
        <div className="aw-fade-up" style={{ animationDelay: '0.10s', textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: T.goldBg, border: `1px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Award size={30} style={{ color: T.gold }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: T.white, marginBottom: 8 }}>
            {t("certificates.empty.title", { ns: "employee" })}
          </h3>
          <p style={{ fontSize: 14, color: T.textBody, marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
            {t("certificates.empty.description", { ns: "employee" })}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.textBody }}>
              <CheckCircle size={15} style={{ color: '#34d399' }} />
              {t("certificates.empty.completeCourse", { ns: "employee" })}
            </div>
            <span style={{ color: T.textMuted, fontSize: 16 }}>→</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.textBody }}>
              <Award size={15} style={{ color: T.gold }} />
              {t("certificates.empty.earnCertificate", { ns: "employee" })}
            </div>
          </div>
        </div>
      ) : (
        /* ── Certificate grid ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {certificates.map((cert, idx) => {
            const isDownloading = downloadingId === cert.id;
            const courseName    = cert.course_name || cert.courses.title;

            return (
              <div key={cert.id} className={`aw-cert-card aw-fade-up`} style={{ animationDelay: `${idx * 0.06}s` }}>

                {/* Gold top bar */}
                <div style={{ height: 3, background: `linear-gradient(90deg, ${T.gold}, rgba(251,191,36,0.25))` }} />

                {/* Icon area */}
                <div style={{ padding: '24px 22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: T.goldBg, border: `2px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px rgba(251,191,36,0.12)` }}>
                    <Award size={26} style={{ color: T.gold }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 4px', lineHeight: '22px' }}>
                      {courseName}
                    </h3>
                    {cert.courses.description && (
                      <p style={{ fontSize: 12, color: T.textMuted, lineHeight: '18px', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {cert.courses.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Meta details */}
                <div style={{ margin: '0 18px 16px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10 }}>
                  <div className="aw-cert-meta-row">
                    <span style={{ color: T.textMuted }}>{t("labels.certificateNumber", { ns: "common" })}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: T.textLabel }}>{cert.certificate_number}</span>
                  </div>
                  {cert.score !== null && (
                    <div className="aw-cert-meta-row">
                      <span style={{ color: T.textMuted }}>{t("labels.score", { ns: "common" })}</span>
                      <span style={{ fontWeight: 700, color: '#34d399' }}>{formatLocalizedNumber(Number(cert.score.toFixed(1)), currentLanguage)}%</span>
                    </div>
                  )}
                  <div className="aw-cert-meta-row">
                    <span style={{ color: T.textMuted }}>{t("labels.issued", { ns: "common" })}</span>
                    <span style={{ fontWeight: 600, color: T.textLabel }}>{formatLocalizedDate(cert.issued_at, currentLanguage)}</span>
                  </div>
                  <div className="aw-cert-meta-row">
                    <span style={{ color: T.textMuted }}>{t("labels.completed", { ns: "common" })}</span>
                    <span style={{ fontWeight: 600, color: T.textLabel }}>{formatLocalizedDate(cert.completion_date, currentLanguage)}</span>
                  </div>
                </div>

                {/* Download button */}
                <div style={{ padding: '0 18px 18px' }}>
                  <button className="aw-dl-btn" onClick={() => handleDownload(cert)} disabled={isDownloading}>
                    {isDownloading
                      ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} />{t("certificates.downloading", { ns: "employee" })}</>
                      : <><Download size={14} />{t("certificates.download", { ns: "employee" })}</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
