import DOMPurify from "dompurify";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import React, { useCallback, useEffect, useState } from "react";
import { Award, Calendar, CheckCircle, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { formatLocalizedDate, formatLocalizedNumber } from "../../i18n/utils";
import { supabase } from "../../lib/supabase";

interface CertificateTemplateData {
  id: string;
  name: string;
  template_html: string;
  background_image_url: string | null;
  logo_url: string | null;
  signature_image_url: string | null;
}

interface Certificate {
  id: string;
  certificate_number: string;
  course_id: string;
  employee_id: string;
  issued_at: string;
  completion_date: string;
  score: number | null;
  employee_name: string;
  course_name: string;
  template_id: string | null;
  courses: {
    title: string;
    description: string;
  };
  certificate_templates: CertificateTemplateData | null;
}

interface CertificateRenderData {
  employeeName: string;
  courseName: string;
  certificateNumberText: string;
  issueDateText: string;
  completionDateText: string;
  scoreText: string | null;
  titleText: string;
  certifiesText: string;
  completedCourseText: string;
  summaryLine1: string;
  summaryLine2: string;
  summaryLine3: string;
  backgroundImageUrl: string;
  logoUrl: string;
  signatureImageUrl: string;
}

const DEFAULT_CERTIFICATE_WIDTH = 1123;
const DEFAULT_CERTIFICATE_HEIGHT = 794;
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const BLOCK_LEVEL_TAGS = new Set([
  "ARTICLE",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "P",
  "SECTION",
  "SPAN",
  "STRONG",
  "TD",
  "TH",
]);

const findRemovalTarget = (node: Node) => {
  let current = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;

  while (current) {
    if (BLOCK_LEVEL_TAGS.has(current.tagName)) {
      return current;
    }

    current = current.parentElement;
  }

  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
};

const stripPlaceholderElements = (
  template: HTMLTemplateElement,
  placeholderName: string
) => {
  const placeholderPattern = new RegExp(`\\{\\{\\s*${placeholderName}\\s*\\}\\}`);
  const removalTargets = new Set<Element>();
  const textWalker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  let currentTextNode = textWalker.nextNode();

  while (currentTextNode) {
    if (placeholderPattern.test(currentTextNode.textContent || "")) {
      const removalTarget = findRemovalTarget(currentTextNode);

      if (removalTarget) {
        removalTargets.add(removalTarget);
      }
    }

    currentTextNode = textWalker.nextNode();
  }

  Array.from(template.content.querySelectorAll("*")).forEach((element) => {
    const hasPlaceholderAttribute = Array.from(element.attributes).some((attribute) =>
      placeholderPattern.test(attribute.value)
    );

    if (hasPlaceholderAttribute) {
      const removalTarget = findRemovalTarget(element);

      if (removalTarget) {
        removalTargets.add(removalTarget);
      }
    }
  });

  removalTargets.forEach((element) => element.remove());
};

const fillTemplateHtml = (
  templateHtml: string,
  values: Record<string, string>,
  hasScore: boolean
) => {
  const template = document.createElement("template");
  template.innerHTML = templateHtml;

  if (!hasScore) {
    stripPlaceholderElements(template, "score");
  }

  const interpolatedHtml = template.innerHTML
    .replace(PLACEHOLDER_PATTERN, (_, key: string) => values[key] ?? "")
    .replace(PLACEHOLDER_PATTERN, "");

  return DOMPurify.sanitize(interpolatedHtml, {
    USE_PROFILES: { html: true },
  });
};

const buildGenericCertificateHtml = (
  data: CertificateRenderData,
  isRtl: boolean
) => {
  const direction = isRtl ? "rtl" : "ltr";
  const alignment = isRtl ? "right" : "left";
  const scoreMarkup = data.scoreText
    ? `
        <div style="margin-bottom: 12px; font-size: 20px; color: #0f172a; font-weight: 600;">
          ${data.scoreText}
        </div>
      `
    : "";

  const backgroundImageMarkup = data.backgroundImageUrl
    ? `background-image: linear-gradient(135deg, rgba(255,255,255,0.88), rgba(255,248,235,0.96)), url('${data.backgroundImageUrl}'); background-size: cover; background-position: center;`
    : "background: linear-gradient(135deg, #fffaf0 0%, #ffffff 42%, #fef3c7 100%);";

  const logoMarkup = data.logoUrl
    ? `
        <div style="margin-bottom: 18px; text-align: center;">
          <img
            src="${data.logoUrl}"
            alt="Certificate logo"
            style="max-height: 72px; max-width: 220px; object-fit: contain;"
          />
        </div>
      `
    : "";

  const signatureMarkup = data.signatureImageUrl
    ? `
        <div style="margin-top: 26px; text-align: center;">
          <img
            src="${data.signatureImageUrl}"
            alt="Signature"
            style="max-height: 76px; max-width: 220px; object-fit: contain;"
          />
        </div>
      `
    : "";

  return DOMPurify.sanitize(
    `
      <div
        dir="${direction}"
        style="
          width: ${DEFAULT_CERTIFICATE_WIDTH}px;
          height: ${DEFAULT_CERTIFICATE_HEIGHT}px;
          box-sizing: border-box;
          padding: 46px;
          ${backgroundImageMarkup}
          color: #0f172a;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          border: 18px solid #d4a017;
          position: relative;
          overflow: hidden;
        "
      >
        <div
          style="
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            border: 2px solid rgba(212, 160, 23, 0.45);
            background: rgba(255, 255, 255, 0.9);
            padding: 38px 54px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
          "
        >
          <div>
            ${logoMarkup}
            <div style="font-size: 18px; letter-spacing: 0.32em; text-transform: uppercase; color: #a16207; margin-bottom: 18px;">
              Sinnara
            </div>
            <h1 style="font-size: 48px; line-height: 1.15; margin: 0 0 16px; color: #7c2d12;">
              ${data.titleText}
            </h1>
            <div style="width: 180px; height: 4px; border-radius: 999px; background: linear-gradient(90deg, #d97706, #f59e0b); margin: 0 auto 26px;"></div>
            <p style="margin: 0 0 20px; font-size: 20px; color: #475569;">
              ${data.certifiesText}
            </p>
            <div style="font-size: 42px; line-height: 1.15; font-weight: 700; color: #111827; margin-bottom: 18px;">
              ${data.employeeName}
            </div>
            <p style="margin: 0 0 12px; font-size: 21px; color: #475569;">
              ${data.completedCourseText}
            </p>
            <div style="font-size: 34px; line-height: 1.25; font-weight: 700; color: #92400e; margin-bottom: 28px;">
              ${data.courseName}
            </div>
            ${scoreMarkup}
          </div>

          <div>
            <div
              style="
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 14px;
                text-align: ${alignment};
                margin-bottom: 24px;
              "
            >
              <div style="padding: 18px 20px; border-radius: 18px; background: #fffdf8; border: 1px solid rgba(148, 64, 14, 0.12); font-size: 16px; font-weight: 600;">
                ${data.certificateNumberText}
              </div>
              <div style="padding: 18px 20px; border-radius: 18px; background: #fffdf8; border: 1px solid rgba(148, 64, 14, 0.12); font-size: 16px; font-weight: 600;">
                ${data.issueDateText}
              </div>
              <div style="padding: 18px 20px; border-radius: 18px; background: #fffdf8; border: 1px solid rgba(148, 64, 14, 0.12); font-size: 16px; font-weight: 600;">
                ${data.completionDateText}
              </div>
            </div>

            <div style="font-size: 16px; color: #475569; line-height: 1.8;">
              <div>${data.summaryLine1}</div>
              <div>${data.summaryLine2}</div>
              <div>${data.summaryLine3}</div>
            </div>

            ${signatureMarkup}
          </div>
        </div>
      </div>
    `,
    {
      USE_PROFILES: { html: true },
    }
  );
};

const waitForRenderableContent = async (element: HTMLElement) => {
  const fontSet = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;

  if (fontSet?.ready) {
    await fontSet.ready;
  }

  const imagePromises = Array.from(element.querySelectorAll("img")).map((image) => {
    if (image.complete) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  });

  await Promise.all(imagePromises);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
};

export const CertificatesPage: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(["common", "employee"]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const currentLanguage = i18n.resolvedLanguage;
  const isRtl = i18n.dir() === "rtl";

  const loadCertificates = useCallback(async () => {
    if (!user?.id) {
      setCertificates([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("issued_certificates")
        .select(`
          *,
          courses(title, description),
          certificate_templates:certificate_templates!issued_certificates_template_id_fkey(
            id,
            name,
            template_html,
            background_image_url,
            logo_url,
            signature_image_url
          )
        `)
        .eq("employee_id", user.id)
        .order("issued_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setCertificates(data as Certificate[]);
      }
    } catch (error) {
      console.error("Error loading certificates:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    loadCertificates();
  }, [loadCertificates]);

  const handleDownload = async (cert: Certificate) => {
    const employeeName =
      cert.employee_name ||
      user?.full_name ||
      t("certificates.downloadTemplate.employeeFallback", { ns: "employee" });
    const courseName = cert.course_name || cert.courses.title;
    const scoreValue =
      cert.score !== null
        ? formatLocalizedNumber(Number(cert.score.toFixed(1)), currentLanguage)
        : null;

    const renderData: CertificateRenderData = {
      employeeName,
      courseName,
      certificateNumberText: t("certificates.downloadTemplate.certificateNumber", {
        ns: "employee",
        value: cert.certificate_number,
      }),
      issueDateText: t("certificates.downloadTemplate.issueDate", {
        ns: "employee",
        value: formatLocalizedDate(cert.issued_at, currentLanguage),
      }),
      completionDateText: t("certificates.downloadTemplate.completionDate", {
        ns: "employee",
        value: formatLocalizedDate(cert.completion_date, currentLanguage),
      }),
      scoreText:
        scoreValue !== null
          ? t("certificates.downloadTemplate.score", {
              ns: "employee",
              value: scoreValue,
            })
          : null,
      titleText: t("certificates.downloadTemplate.title", { ns: "employee" }),
      certifiesText: t("certificates.downloadTemplate.certifies", { ns: "employee" }),
      completedCourseText: t("certificates.downloadTemplate.completedCourse", {
        ns: "employee",
      }),
      summaryLine1: t("certificates.downloadTemplate.summaryLine1", { ns: "employee" }),
      summaryLine2: t("certificates.downloadTemplate.summaryLine2", { ns: "employee" }),
      summaryLine3: t("certificates.downloadTemplate.summaryLine3", { ns: "employee" }),
      backgroundImageUrl: cert.certificate_templates?.background_image_url || "",
      logoUrl: cert.certificate_templates?.logo_url || "",
      signatureImageUrl: cert.certificate_templates?.signature_image_url || "",
    };

    const templateValues = {
      employee_name: renderData.employeeName,
      course_name: renderData.courseName,
      completion_date: formatLocalizedDate(cert.completion_date, currentLanguage),
      issued_at: formatLocalizedDate(cert.issued_at, currentLanguage),
      certificate_number: cert.certificate_number,
      score: scoreValue || "",
      background_image_url: renderData.backgroundImageUrl,
      logo_url: renderData.logoUrl,
      signature_image_url: renderData.signatureImageUrl,
    };

    const templateHtml = cert.certificate_templates?.template_html
      ? fillTemplateHtml(
          cert.certificate_templates.template_html,
          templateValues,
          cert.score !== null
        )
      : buildGenericCertificateHtml(renderData, isRtl);

    const renderRoot = document.createElement("div");
    renderRoot.setAttribute("aria-hidden", "true");
    renderRoot.style.position = "fixed";
    renderRoot.style.left = "-10000px";
    renderRoot.style.top = "0";
    renderRoot.style.opacity = "0";
    renderRoot.style.pointerEvents = "none";
    renderRoot.style.zIndex = "-1";
    renderRoot.style.background = "#ffffff";

    const renderSurface = document.createElement("div");
    renderSurface.dir = isRtl ? "rtl" : "ltr";
    renderSurface.style.display = "inline-block";
    renderSurface.style.background = "#ffffff";
    renderSurface.innerHTML = templateHtml;
    renderRoot.appendChild(renderSurface);

    setDownloadingId(cert.id);

    try {
      document.body.appendChild(renderRoot);
      await waitForRenderableContent(renderSurface);

      const targetWidth = renderSurface.scrollWidth || DEFAULT_CERTIFICATE_WIDTH;
      const targetHeight = renderSurface.scrollHeight || DEFAULT_CERTIFICATE_HEIGHT;

      const canvas = await html2canvas(renderSurface, {
        backgroundColor: "#ffffff",
        height: targetHeight,
        logging: false,
        scale: 2,
        useCORS: true,
        width: targetWidth,
        windowHeight: targetHeight,
        windowWidth: targetWidth,
      });

      const pdf = new jsPDF({
        orientation: targetWidth > targetHeight ? "landscape" : "portrait",
        unit: "px",
        format: [targetWidth, targetHeight],
        hotfixes: ["px_scaling"],
      });

      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        targetWidth,
        targetHeight
      );
      pdf.save(`Certificate_${cert.certificate_number}.pdf`);
    } catch (error) {
      console.error("Error generating certificate PDF:", error);
      alert(t("certificates.downloadFailed", { ns: "employee" }));
    } finally {
      renderRoot.remove();
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {t("certificates.title", { ns: "employee" })}
        </h1>
        <p className="text-slate-600">{t("certificates.subtitle", { ns: "employee" })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-amber-50 rounded-lg">
              <Award className="h-6 w-6 text-amber-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {formatLocalizedNumber(certificates.length, currentLanguage)}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {t("certificates.summary.total", { ns: "employee" })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {formatLocalizedNumber(certificates.length, currentLanguage)}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {t("certificates.summary.active", { ns: "employee" })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {certificates.length > 0
                ? formatLocalizedNumber(
                    new Date(certificates[0].issued_at).getFullYear(),
                    currentLanguage
                  )
                : "-"}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {t("labels.latestYear", { ns: "common" })}
          </div>
        </div>
      </div>

      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => {
            const isDownloading = downloadingId === cert.id;

            return (
              <div
                key={cert.id}
                className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 rounded-xl shadow-md border-2 p-6 hover:shadow-xl transition-all"
              >
                <div className="flex items-center justify-center mb-4">
                  <div className="p-4 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500">
                    <Award className="h-10 w-10 text-white" />
                  </div>
                </div>

                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {cert.course_name || cert.courses.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                    {cert.courses.description}
                  </p>
                </div>

                <div className="bg-white/80 rounded-lg p-3 mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {t("labels.certificateNumber", { ns: "common" })}
                    </span>
                    <span className="font-mono font-semibold text-slate-900 text-xs">
                      {cert.certificate_number}
                    </span>
                  </div>
                  {cert.score !== null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {t("labels.score", { ns: "common" })}:
                      </span>
                      <span className="font-bold text-green-600">
                        {formatLocalizedNumber(Number(cert.score.toFixed(1)), currentLanguage)}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {t("labels.issued", { ns: "common" })}:
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatLocalizedDate(cert.issued_at, currentLanguage)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {t("labels.completed", { ns: "common" })}:
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatLocalizedDate(cert.completion_date, currentLanguage)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload(cert)}
                  disabled={isDownloading}
                  className="w-full py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-wait"
                >
                  <Download className="h-4 w-4" />
                  {isDownloading
                    ? t("certificates.downloading", { ns: "employee" })
                    : t("certificates.download", { ns: "employee" })}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-50 rounded-full mb-4">
            <Award className="h-10 w-10 text-amber-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            {t("certificates.empty.title", { ns: "employee" })}
          </h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            {t("certificates.empty.description", { ns: "employee" })}
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>{t("certificates.empty.completeCourse", { ns: "employee" })}</span>
            </div>
            <div className="text-slate-300">→</div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              <span>{t("certificates.empty.earnCertificate", { ns: "employee" })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
