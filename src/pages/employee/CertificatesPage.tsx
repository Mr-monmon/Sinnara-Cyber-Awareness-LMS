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
   TYPES
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
  /* raw values for direct use in the new template */
  rawCertificateNumber: string;
  rawCompletionDate: string;
}

/* ─────────────────────────────────────────
   CERTIFICATE GENERATION HELPERS
───────────────────────────────────────── */
const DEFAULT_CERTIFICATE_WIDTH  = 800;
const DEFAULT_CERTIFICATE_HEIGHT = 566;
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

/* ─────────────────────────────────────────
   buildGenericCertificateHtml
   Uses the new AwareOne dark certificate design.
   Certificate number shown next to completion date.
───────────────────────────────────────── */
const buildGenericCertificateHtml = (data: CertificateRenderData): string => {
  return DOMPurify.sanitize(`
<div style="width:800px;height:566px;background:#12140a;font-family:'Arial',Arial,sans-serif;position:relative;overflow:hidden;display:flex;box-sizing:border-box;">

  <!-- Background: radial glow top-right -->
  <div style="position:absolute;top:-120px;right:-80px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(200,255,0,0.09) 0%,transparent 65%);pointer-events:none;"></div>

  <!-- Background: radial glow bottom-left -->
  <div style="position:absolute;bottom:-60px;left:20px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(200,255,0,0.06) 0%,transparent 65%);pointer-events:none;"></div>

  <!-- Grid dots pattern -->
  <svg style="position:absolute;top:0;right:0;width:600px;height:566px;opacity:.04;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="gdots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.5" fill="#c8ff00"/>
      </pattern>
    </defs>
    <rect width="600" height="566" fill="url(#gdots)"/>
  </svg>

  <!-- Corner flourish top-right -->
  <svg style="position:absolute;top:0;right:0;width:140px;height:140px;opacity:.22;pointer-events:none;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
    <path d="M140 0 L140 50 Q140 0 90 0 Z" fill="#c8ff00"/>
    <path d="M140 0 L140 80 Q140 0 60 0 Z" fill="none" stroke="#c8ff00" stroke-width="1"/>
    <path d="M140 0 L140 110 Q140 0 30 0 Z" fill="none" stroke="#c8ff00" stroke-width=".6"/>
  </svg>

  <!-- Corner flourish bottom-left -->
  <svg style="position:absolute;bottom:0;left:0;width:100px;height:100px;opacity:.22;pointer-events:none;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M0 100 L0 50 Q0 100 50 100 Z" fill="#c8ff00"/>
    <path d="M0 100 L0 20 Q0 100 80 100 Z" fill="none" stroke="#c8ff00" stroke-width="1"/>
    <path d="M0 100 L0 10 Q0 100 90 100 Z" fill="none" stroke="#c8ff00" stroke-width=".6"/>
  </svg>

  <!-- Vertical divider -->
  <div style="position:absolute;left:230px;top:30px;bottom:30px;width:1px;background:linear-gradient(to bottom,transparent,rgba(200,255,0,0.30),rgba(200,255,0,0.30),transparent);z-index:2;"></div>

  <!-- ═══ LEFT PANEL ═══ -->
  <div style="width:230px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:30px 20px;position:relative;z-index:3;">

    <!-- Static rings -->
    <div style="position:absolute;top:50%;left:50%;margin:-85px 0 0 -85px;width:170px;height:170px;border-radius:50%;border:1px dashed rgba(200,255,0,0.16);pointer-events:none;"></div>
    <div style="position:absolute;top:50%;left:50%;margin:-65px 0 0 -65px;width:130px;height:130px;border-radius:50%;border:1px solid rgba(200,255,0,0.08);pointer-events:none;"></div>

    <!-- Logo -->
    <div style="position:relative;z-index:1;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="250 290 760 730" width="76" height="76" style="display:block;filter:drop-shadow(0 0 12px rgba(200,255,0,0.45));">
        <path d="M0 0 C20 0 22 1 27.56 1.08 C35.10 1.03 39.25 1.01 48.20 0.95 C62.37 0.88 80.68 0.81 102.68 0.67 C124.93 0.57 136.70 0.50 147.79 0.45 C163.09 0.43 170.02 2.19 176.87 8.75 C180.36 14.79 181.78 18.20 186.75 28.56 C191 37 192.41 39.81 195.25 45.43 C198.07 51.08 201.43 58.43 204 63 C209.78 74.88 211.18 78.25 220.33 97.59 C225 109 227.30 112.59 233.06 123.5 C239 136 242.37 142.94 257.28 173.65 C270 206 272 205 277.93 217.25 C285 234 295 254 299 260.68 C302 272 304 272 309.49 283.20 C318 305 321.37 307.72 327.74 325.05 C338 343 339 346 350.31 370.25 C354 377 358 390 363.37 396.62 C381 443 385.55 459.19 376.18 492.93 C366 504 362.96 511.27 353.25 517.37 C326.25 529.48 293.34 535.53 278 536 C265.75 522 251.54 500.07 243 490 C213.94 466.17 192.13 459.25 167.11 461.33 C119 475 88.01 487.22 74.18 493.18 C-63 536 -105.29 540.39 -177.93 511.56 C-221.63 440.70 -229.81 410.08 -226 348 C-218.58 305.54 -200.60 268.05 -184.12 231.51 C-178 218 -153 171 -148 154.12 C-142 142 -134.21 126.21 -110 78 C-86.29 32 -78 17 -71 5 C-67 4 -58.80 0.88 0 1 Z" fill="#c8ff00" transform="translate(319,357)"/>
        <path d="M0 0 C7.67 0.004 15.57 -0.007 27.52 0.026 C35.31 2.26 47.5 3.82 62.31 6.26 C80.31 10.26 103.80 17.55 119.31 23.26 C156.06 42.70 177 57.20 207.31 85.26 C227.31 109.26 243.31 131.26 260.31 160.26 C277.31 211.26 284.93 272.76 284.31 290.26 C278.43 341.51 268.31 374.13 264.31 385.26 C250.31 411.26 235.06 437.45 211.31 465.26 C196.31 481.26 184.31 491.26 160.31 508.26 C134.93 522.95 109.31 534.26 78.34 543.88 C57.31 548.26 43.31 551.26 21.78 552.39 C-25.68 550.26 -69.03 541.29 -92.68 525.26 C-90.50 513.93 -85.16 491.47 -99.68 418.01 C-117.68 376.26 -147.89 317.92 -153.68 306.26 C-167.68 276.26 -182.68 245.26 -209.68 187.26 C-228.68 149.20 -221.68 127.26 -213.68 116.765 C-197.68 96.26 -191.68 91.26 -168.68 68.26 C-140.39 45.92 -87.68 21.26 -56.68 10.26 C-22.83 3.30 -7.84 0.01 0 0 Z" fill="#c8ff00" transform="translate(814.6875,337.734375)"/>
      </svg>
    </div>

    <!-- Brand name -->
    <div style="text-align:center;position:relative;z-index:1;">
      <div style="font-size:18px;font-weight:900;letter-spacing:1px;color:#ffffff;">AWARE<span style="color:#c8ff00;">ONE</span></div>
      <div style="width:36px;height:1.5px;background:#c8ff00;margin:6px auto;"></div>
      <div style="font-size:8px;letter-spacing:3px;color:rgba(200,255,0,0.65);text-transform:uppercase;">Cybersecurity Training</div>
    </div>

    <!-- Seal -->
    <div style="position:relative;z-index:1;margin-top:6px;">
      <svg width="68" height="68" viewBox="0 0 68 68" xmlns="http://www.w3.org/2000/svg">
        <circle cx="34" cy="34" r="30" fill="none" stroke="rgba(200,255,0,0.30)" stroke-width="1.5" stroke-dasharray="4 3"/>
        <circle cx="34" cy="34" r="23" fill="rgba(200,255,0,0.06)" stroke="rgba(200,255,0,0.22)" stroke-width="1"/>
        <text x="34" y="30" text-anchor="middle" font-family="Arial" font-size="6.5" font-weight="700" fill="#c8ff00" letter-spacing="1.5">CERTIFIED</text>
        <text x="34" y="40" text-anchor="middle" font-family="Arial" font-size="6" fill="rgba(200,255,0,0.60)" letter-spacing="1">COMPLETION</text>
        <path d="M22 44 Q34 48 46 44" fill="none" stroke="rgba(200,255,0,0.35)" stroke-width=".8"/>
      </svg>
    </div>

  </div>

  <!-- ═══ RIGHT PANEL ═══ -->
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 44px 36px 36px;position:relative;z-index:3;">

    <!-- Accent line -->
    <div style="width:48px;height:2px;background:#c8ff00;margin-bottom:18px;"></div>

    <!-- Label -->
    <div style="font-size:10px;font-weight:700;letter-spacing:4px;color:rgba(200,255,0,0.70);text-transform:uppercase;margin-bottom:10px;">Certificate of Completion</div>

    <!-- Heading -->
    <div style="font-size:30px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;margin-bottom:6px;">This certifies that</div>

    <!-- Employee name -->
    <div style="font-size:36px;font-weight:700;color:#c8ff00;letter-spacing:-0.5px;line-height:1.1;margin:10px 0;word-break:break-word;">${data.employeeName}</div>

    <!-- Separator -->
    <div style="width:100%;height:1px;background:linear-gradient(to right,rgba(200,255,0,0.25),transparent);margin:10px 0 14px;"></div>

    <!-- Description -->
    <div style="font-size:12px;color:rgba(203,213,225,0.85);line-height:1.7;margin-bottom:16px;">
      has successfully completed the training course and demonstrated<br/>
      proficiency in the required competencies and assessments.
    </div>

    <!-- Course name -->
    <div style="background:rgba(200,255,0,0.06);border:1px solid rgba(200,255,0,0.20);border-radius:8px;padding:12px 16px;margin-bottom:18px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;color:rgba(200,255,0,0.60);text-transform:uppercase;margin-bottom:5px;">Course</div>
      <div style="font-size:17px;font-weight:700;color:#ffffff;word-break:break-word;">${data.courseName}</div>
    </div>

    <!-- Date + Certificate Number side by side -->
    <div style="display:flex;gap:12px;margin-bottom:20px;">

      <!-- Completion date -->
      <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 14px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:rgba(200,255,0,0.55);text-transform:uppercase;margin-bottom:4px;">Date of Completion</div>
        <div style="font-size:13px;font-weight:700;color:#cbd5e1;">${data.rawCompletionDate}</div>
      </div>

      <!-- Certificate number -->
      <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 14px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:rgba(200,255,0,0.55);text-transform:uppercase;margin-bottom:4px;">Certificate No.</div>
        <div style="font-size:12px;font-weight:700;color:#cbd5e1;font-family:monospace;letter-spacing:0.5px;">${data.rawCertificateNumber}</div>
      </div>

    </div>

    <!-- Signature + branding -->
    <div style="display:flex;align-items:flex-end;justify-content:space-between;">
      <div>
        <div style="width:110px;height:1px;background:rgba(255,255,255,0.20);margin-bottom:5px;"></div>
        <div style="font-size:9px;color:rgba(148,163,184,0.65);letter-spacing:1px;">AUTHORIZED SIGNATURE</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:8px;color:rgba(200,255,0,0.45);letter-spacing:1.5px;text-transform:uppercase;">AwareOne Platform</div>
        <div style="font-size:8px;color:rgba(148,163,184,0.45);margin-top:2px;">awareone.net</div>
      </div>
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
    const rawCompletionDate  = formatLocalizedDate(cert.completion_date, currentLanguage);
    const rawCertificateNumber = cert.certificate_number;

    const renderData: CertificateRenderData = {
      employeeName,
      courseName,
      certificateNumberText:  t("certificates.downloadTemplate.certificateNumber", { ns: "employee", value: rawCertificateNumber }),
      issueDateText:          t("certificates.downloadTemplate.issueDate",          { ns: "employee", value: formatLocalizedDate(cert.issued_at, currentLanguage) }),
      completionDateText:     t("certificates.downloadTemplate.completionDate",     { ns: "employee", value: rawCompletionDate }),
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
      /* raw values used by buildGenericCertificateHtml */
      rawCertificateNumber,
      rawCompletionDate,
    };

    const templateValues = {
      employee_name:       renderData.employeeName,
      course_name:         renderData.courseName,
      completion_date:     rawCompletionDate,
      issued_at:           formatLocalizedDate(cert.issued_at, currentLanguage),
      certificate_number:  rawCertificateNumber,
      score:               scoreValue || "",
      background_image_url: renderData.backgroundImageUrl,
      logo_url:            renderData.logoUrl,
      signature_image_url: renderData.signatureImageUrl,
    };

    /* Use custom template if available, otherwise use new generic dark template */
    const templateHtml = cert.certificate_templates?.template_html
      ? fillTemplateHtml(cert.certificate_templates.template_html, templateValues, cert.score !== null)
      : buildGenericCertificateHtml(renderData);

    const renderRoot = document.createElement("div");
    renderRoot.setAttribute("aria-hidden", "true");
    Object.assign(renderRoot.style, {
      position: "fixed", left: "-10000px", top: "0",
      opacity: "0", pointerEvents: "none", zIndex: "-1", background: "#12140a",
    });
    const renderSurface = document.createElement("div");
    renderSurface.dir = isRtl ? "rtl" : "ltr";
    Object.assign(renderSurface.style, { display: "inline-block", background: "#12140a" });
    renderSurface.innerHTML = templateHtml;
    renderRoot.appendChild(renderSurface);
    setDownloadingId(cert.id);
    try {
      document.body.appendChild(renderRoot);
      await waitForRenderableContent(renderSurface);
      const targetWidth  = renderSurface.scrollWidth  || DEFAULT_CERTIFICATE_WIDTH;
      const targetHeight = renderSurface.scrollHeight || DEFAULT_CERTIFICATE_HEIGHT;
      const canvas = await html2canvas(renderSurface, {
        backgroundColor: "#12140a", height: targetHeight, logging: false,
        scale: 2, useCORS: true, width: targetWidth,
        windowHeight: targetHeight, windowWidth: targetWidth,
      });
      const pdf = new jsPDF({
        orientation: targetWidth > targetHeight ? "landscape" : "portrait",
        unit: "px", format: [targetWidth, targetHeight], hotfixes: ["px_scaling"],
      });
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
          { icon: Award,       color: T.gold,    bg: T.goldBg,               border: T.goldBorder,             label: t("certificates.summary.total",  { ns: "employee" }), value: formatLocalizedNumber(certificates.length, currentLanguage) },
          { icon: CheckCircle, color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.22)',  label: t("certificates.summary.active", { ns: "employee" }), value: formatLocalizedNumber(certificates.length, currentLanguage) },
          { icon: Calendar,    color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.22)',  label: t("labels.latestYear", { ns: "common" }),              value: certificates.length > 0 ? formatLocalizedNumber(new Date(certificates[0].issued_at).getFullYear(), currentLanguage) : '—' },
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
          <p style={{ fontSize: 14, color: T.textBody, margin: '0 auto 28px', maxWidth: 380 }}>
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
                <div style={{ height: 3, background: `linear-gradient(90deg, ${T.gold}, rgba(251,191,36,0.25))` }} />
                <div style={{ padding: '24px 22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: T.goldBg, border: `2px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px rgba(251,191,36,0.12)` }}>
                    <Award size={26} style={{ color: T.gold }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 4px', lineHeight: '22px' }}>{courseName}</h3>
                    {cert.courses.description && (
                      <p style={{ fontSize: 12, color: T.textMuted, lineHeight: '18px', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {cert.courses.description}
                      </p>
                    )}
                  </div>
                </div>
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
