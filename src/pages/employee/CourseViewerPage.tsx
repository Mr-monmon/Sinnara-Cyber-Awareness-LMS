import React, { useState, useEffect } from "react";
import {
  ArrowLeft, CheckCircle, Circle, PlayCircle,
  FileText, ClipboardCheck, ChevronRight, Award,
  RotateCcw, Check, Lock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { formatLocalizedNumber } from "../../i18n/utils";
import ArticlePreview from "./ArticlePreview";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  bgDeep:      '#0e100a',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#94a3b8',
  textLabel:   '#ffffff',
  textMuted:   '#64748b',
  border:      'rgba(255,255,255,0.09)',
  borderFaint: 'rgba(255,255,255,0.05)',
  green:       '#34d399',
  greenBg:     'rgba(52,211,153,0.08)',
  greenBorder: 'rgba(52,211,153,0.22)',
  blue:        '#60a5fa',
  blueBg:      'rgba(96,165,250,0.08)',
  blueBorder:  'rgba(96,165,250,0.22)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Sidebar section item ── */
  .aw-section-item {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 9px; border: 1px solid transparent;
    background: none; cursor: pointer; text-align: left;
    font-family: 'Inter', sans-serif; transition: all 0.18s;
  }
  .aw-section-item:disabled { cursor: not-allowed; opacity: 0.40; }
  .aw-section-item.current {
    background: rgba(200,255,0,0.08);
    border-color: rgba(200,255,0,0.22);
  }
  .aw-section-item.completed:not(.current) {
    background: rgba(52,211,153,0.05);
    border-color: rgba(52,211,153,0.18);
  }
  .aw-section-item:not(:disabled):not(.current):not(.completed):hover {
    background: rgba(255,255,255,0.04);
    border-color: rgba(255,255,255,0.09);
  }

  /* ── Quiz option ── */
  .aw-quiz-option {
    width: 100%; display: flex; align-items: center; gap: 12px;
    padding: 13px 16px; border-radius: 10px; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.02);
    font-family: 'Inter', sans-serif; font-size: 14px; color: #ffffff;
    transition: all 0.18s; text-align: left;
  }
  .aw-quiz-option:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.13); }
  .aw-quiz-option.selected {
    background: rgba(200,255,0,0.07);
    border-color: rgba(200,255,0,0.38);
    color: #ffffff;
  }

  /* ── Action buttons ── */
  .aw-btn-accent {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px 24px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 20px rgba(200,255,0,0.22);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-btn-accent:hover { opacity: 0.88; transform: translateY(-1px); }

  .aw-btn-green {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px 24px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.30); color: #34d399;
    transition: background 0.18s, transform 0.15s;
  }
  .aw-btn-green:hover { background: rgba(52,211,153,0.20); transform: translateY(-1px); }

  .aw-btn-ghost {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 16px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-btn-ghost:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  .aw-btn-retry {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 11px 24px; border-radius: 9px; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(96,165,250,0.10); border: 1px solid rgba(96,165,250,0.28);
    color: #60a5fa; transition: background 0.18s;
  }
  .aw-btn-retry:hover { background: rgba(96,165,250,0.18); }

  /* ── Section type icon bg ── */
  .aw-type-icon { width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.35s ease both; }
`;

if (typeof document !== "undefined" && !document.getElementById("aw-course-viewer-styles")) {
  const tag = document.createElement("style");
  tag.id = "aw-course-viewer-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface CourseSection {
  id: string; course_id: string; title: string;
  section_type: "VIDEO" | "ARTICLE" | "QUIZ";
  content: string; content_data: any;
  duration_minutes: number; order_index: number;
}
interface SectionProgress {
  id: string; section_id: string;
  completed: boolean; completed_at: string | null;
}
interface CourseViewerProps {
  courseId: string; courseTitle: string; onBack: () => void;
}

/* ─────────────────────────────────────────
   TYPE ICON CONFIG
───────────────────────────────────────── */
const typeConfig = {
  VIDEO:   { Icon: PlayCircle,     color: T.blue,   bg: T.blueBg,   border: T.blueBorder  },
  ARTICLE: { Icon: FileText,       color: T.accent, bg: 'rgba(200,255,0,0.08)', border: 'rgba(200,255,0,0.20)' },
  QUIZ:    { Icon: ClipboardCheck, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.20)' },
} as const;

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CourseViewerPage: React.FC<CourseViewerProps> = ({
  courseId, courseTitle, onBack,
}) => {
  const { user }    = useAuth();
  const { t, i18n } = useTranslation(["common", "employee"]);
  const [sections, setSections]           = useState<CourseSection[]>([]);
  const [progress, setProgress]           = useState<Record<string, SectionProgress>>({});
  const [isLoading, setIsLoading]         = useState(true);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers]     = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore]         = useState(0);
  const currentLanguage = i18n.resolvedLanguage;
  const isRtl = i18n.dir() === "rtl";

  useEffect(() => { loadCourseData(); }, [courseId, user?.id]);

  const loadCourseData = async () => {
    if (!user) return;
    setIsLoading(true);
    const [sectionsRes, progressRes] = await Promise.all([
      supabase.from("course_sections").select("*").eq("course_id", courseId).order("order_index"),
      supabase.from("course_section_progress").select("*").eq("employee_id", user.id).eq("course_id", courseId),
    ]);
    setIsLoading(false);
    if (sectionsRes.data) setSections(sectionsRes.data);
    const progressMap: Record<string, SectionProgress> = {};
    if (progressRes.data) {
      progressRes.data.forEach((p: any) => {
        progressMap[p.section_id] = { id: p.id, section_id: p.section_id, completed: p.completed, completed_at: p.completed_at };
      });
    }
    setProgress(progressMap);
  };

  const currentSection     = sections[currentSectionIndex];
  const totalSections      = sections.length;
  const completedSections  = Object.values(progress).filter(p => p.completed).length;
  const progressPercentage = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  const isSectionCompleted  = (sectionId: string) => progress[sectionId]?.completed || false;
  const canAccessSection    = (index: number) => index === 0 || isSectionCompleted(sections[index - 1]?.id);

  const convertYouTubeUrl = (url: string) => {
    if (!url) return url;
    if (url.includes("youtube.com/watch?v=")) return `https://www.youtube.com/embed/${url.split("watch?v=")[1].split("&")[0]}`;
    if (url.includes("youtu.be/")) return `https://www.youtube.com/embed/${url.split("youtu.be/")[1].split("?")[0]}`;
    return url;
  };

  const markSectionComplete = async (sectionId: string) => {
    if (!user) return;
    const { error } = await supabase.from("course_section_progress").upsert(
      { employee_id: user.id, course_id: courseId, section_id: sectionId, completed: true, completed_at: new Date().toISOString() },
      { onConflict: "employee_id,section_id" }
    );
    if (error) { alert(t("courseViewer.completionFailed", { ns: "employee", message: error.message })); return; }
    await loadCourseData();
    await updateCourseProgress();
    if (sections[currentSectionIndex + 1]?.section_type === "QUIZ") { setQuizSubmitted(false); setQuizAnswers({}); }
  };

  const updateCourseProgress = async () => {
    if (!user) return;
    const completedCount = Object.values(progress).filter(p => p.completed).length + 1;
    const progressPercent = Math.round((completedCount / totalSections) * 100);
    await supabase.from("employee_courses")
      .update({ progress_percentage: progressPercent, completed_at: progressPercent === 100 ? new Date().toISOString() : null, last_accessed_at: new Date().toISOString() })
      .eq("employee_id", user.id).eq("course_id", courseId);
  };

  const handleNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setQuizSubmitted(false); setQuizAnswers({}); setQuizScore(0);
    } else { updateCourseCompletion(); }
  };

  const updateCourseCompletion = async () => {
    if (!user) return;
    const allCompleted = sections.every(s => progress[s.id]?.completed);
    if (!allCompleted) { alert(t("courseViewer.completeAllSections", { ns: "employee" })); return; }
    const completedDate = new Date().toISOString();
    const { data: existing, error: checkError } = await supabase.from("employee_courses").select("id, status").eq("employee_id", user.id).eq("course_id", courseId).maybeSingle();
    if (checkError) { alert(t("courseViewer.checkEnrollmentError", { ns: "employee", message: checkError.message })); return; }
    if (existing?.status === "COMPLETED") { alert(t("courseViewer.alreadyCompleted", { ns: "employee" })); onBack(); return; }
    const { error: updateError } = await supabase.from("employee_courses")
      .update({ status: "COMPLETED", progress_percentage: 100, completed_at: completedDate, last_accessed_at: completedDate, completed_sections: sections.length, total_sections: sections.length })
      .eq("employee_id", user.id).eq("course_id", courseId);
    if (updateError) { alert(t("courseViewer.completionFailed", { ns: "employee", message: updateError.message })); return; }
    await new Promise(resolve => setTimeout(resolve, 2000));
    const { data: certificate } = await supabase.from("issued_certificates").select("*").eq("employee_id", user.id).eq("course_id", courseId).maybeSingle();
    if (!certificate) {
      const [{ data: employeeData }, { data: courseData }] = await Promise.all([
        supabase.from("users").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("courses").select("title, certificate_id").eq("id", courseId).maybeSingle(),
      ]);
      const certNumber = `CERT-${new Date().getFullYear()}-${Math.floor(Math.random() * 999999).toString().padStart(6, "0")}`;
      await supabase.from("issued_certificates").insert({
        certificate_number: certNumber, employee_id: user.id, course_id: courseId,
        template_id: courseData?.certificate_id || null,
        employee_name: employeeData?.full_name || user.full_name,
        course_name: courseData?.title || t("courseViewer.fallbackCourseName", { ns: "employee" }),
        completion_date: new Date().toISOString().split("T")[0],
        issued_at: new Date().toISOString(), issued_by: user.id,
      });
      alert(t("courseViewer.certificateGenerated", { ns: "employee" }));
    } else {
      alert(t("courseViewer.certificateReady", { ns: "employee" }));
    }
    onBack();
  };

  const handleSubmitQuiz = () => {
    if (!currentSection || currentSection.section_type !== "QUIZ") return;
    const questions = currentSection.content_data?.questions || [];
    let correct = 0;
    questions.forEach((q: any, i: number) => { if (quizAnswers[i] === q.correct_answer) correct++; });
    const score = Math.round((correct / questions.length) * 100);
    setQuizScore(score); setQuizSubmitted(true);
    if (score >= 60) markSectionComplete(currentSection.id);
  };

  /* ── Loading ── */
  if (!currentSection && isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 14, fontFamily: 'Inter, sans-serif', flexDirection: 'column' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 14, color: T.textBody }}>{t("courseViewer.loading", { ns: "employee" })}</p>
    </div>
  );

  if (!currentSection && !isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 14, fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
      <FileText size={32} style={{ color: T.textMuted }} />
      <p style={{ fontSize: 15, color: T.textBody }}>{t("courseViewer.noContent", { ns: "employee" })}</p>
      <button className="aw-btn-ghost" onClick={onBack}>{t("actions.goBack", { ns: "common" })}</button>
    </div>
  );

  const cfg = typeConfig[currentSection.section_type];
  const SectionIcon = cfg.Icon;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: T.bg }}>

      {/* ══════════════════════
          STICKY HEADER
      ══════════════════════ */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(18,20,10,0.96)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${T.border}`,
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Row 1: back + progress */}
          <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <button className="aw-btn-ghost" onClick={onBack} style={{ padding: '7px 14px' }}>
              <ArrowLeft size={14} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
              {t("courseViewer.backToCourses", { ns: "employee" })}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
                {formatLocalizedNumber(progressPercentage, currentLanguage)}%
              </span>
              <div style={{ width: 120, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPercentage}%`, background: T.accent, borderRadius: 9999, boxShadow: '0 0 8px rgba(200,255,0,0.40)', transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
                {completedSections}/{totalSections} {t("courseViewer.contentsTitle", { ns: "employee" })}
              </span>
            </div>
          </div>

          {/* Row 2: course title */}
          <div style={{ paddingBottom: 12 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: T.white, margin: 0, letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: T.accent, fontSize: 12, fontWeight: 700 }}>
                {currentSectionIndex + 1}/{totalSections}
              </span>
              {courseTitle}
            </h1>
          </div>
        </div>
      </div>

      {/* ══════════════════════
          BODY
      ══════════════════════ */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 60px', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ position: 'sticky', top: 116, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: T.textMuted, marginBottom: 10, paddingLeft: 2 }}>
            {t("courseViewer.contentsTitle", { ns: "employee" })}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sections.map((section, index) => {
              const completed  = isSectionCompleted(section.id);
              const accessible = canAccessSection(index);
              const isCurrent  = index === currentSectionIndex;
              const scfg       = typeConfig[section.section_type];

              return (
                <button
                  key={section.id}
                  className={`aw-section-item ${isCurrent ? 'current' : ''} ${completed && !isCurrent ? 'completed' : ''}`}
                  disabled={!accessible}
                  onClick={() => accessible && setCurrentSectionIndex(index)}
                  style={{ textAlign: isRtl ? 'right' : 'left' }}
                >
                  {/* Type icon */}
                  <div className="aw-type-icon" style={{ background: isCurrent ? scfg.bg : 'rgba(255,255,255,0.03)', border: `1px solid ${isCurrent ? scfg.border : T.borderFaint}` }}>
                    <scfg.Icon size={14} style={{ color: isCurrent ? scfg.color : completed ? T.green : T.textMuted }} />
                  </div>

                  {/* Label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isCurrent ? T.white : completed ? T.textLabel : T.textMuted, lineHeight: '17px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {section.title}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                      {formatLocalizedNumber(section.duration_minutes, currentLanguage)} {t("labels.minutes", { ns: "common" })}
                    </div>
                  </div>

                  {/* Status indicator */}
                  {!accessible
                    ? <Lock size={12} style={{ color: T.textMuted, flexShrink: 0 }} />
                    : completed
                    ? <CheckCircle size={14} style={{ color: T.green, flexShrink: 0 }} />
                    : <Circle     size={14} style={{ color: T.borderFaint, flexShrink: 0 }} />
                  }
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="aw-fade-up" key={currentSectionIndex}>

          {/* Content card */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>

            {/* Section header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SectionIcon size={20} style={{ color: cfg.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: T.white, margin: '0 0 3px', letterSpacing: '-0.2px' }}>
                  {currentSection.title}
                </h2>
                <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                  {t("courseViewer.sectionOf", { ns: "employee", current: formatLocalizedNumber(currentSectionIndex + 1, currentLanguage), total: formatLocalizedNumber(totalSections, currentLanguage) })}
                  {' · '}
                  {formatLocalizedNumber(currentSection.duration_minutes, currentLanguage)} {t("labels.minutes", { ns: "common" })}
                </p>
              </div>
              {isSectionCompleted(currentSection.id) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: T.greenBg, border: `1px solid ${T.greenBorder}`, borderRadius: 9999, fontSize: 11, fontWeight: 700, color: T.green, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  <CheckCircle size={12} /> Completed
                </div>
              )}
            </div>

            {/* ── VIDEO ── */}
            {currentSection.section_type === "VIDEO" && (
              <div style={{ padding: '24px' }}>
                <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000', borderRadius: 10, overflow: 'hidden', marginBottom: 20, border: `1px solid ${T.border}` }}>
                  {currentSection.content.includes("youtube.com") || currentSection.content.includes("youtu.be") ? (
                    <iframe
                      src={convertYouTubeUrl(currentSection.content)}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <PlayCircle size={48} style={{ color: T.textMuted, opacity: 0.50 }} />
                      <a href={currentSection.content} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.blue, textDecoration: 'none' }}>
                        {t("courseViewer.videoLink", { ns: "employee" })}
                      </a>
                    </div>
                  )}
                </div>

                {!isSectionCompleted(currentSection.id) && (
                  <button className="aw-btn-green" onClick={() => markSectionComplete(currentSection.id)}>
                    <CheckCircle size={16} />
                    {t("courseViewer.markComplete", { ns: "employee" })}
                  </button>
                )}
              </div>
            )}

            {/* ── ARTICLE ── */}
            {currentSection.section_type === "ARTICLE" && (
              <div style={{ padding: '24px' }}>
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10, marginBottom: 20, color: '#ffffff' }}>
                  <ArticlePreview html={currentSection.content} />
                </div>
                {!isSectionCompleted(currentSection.id) && (
                  <button className="aw-btn-green" onClick={() => markSectionComplete(currentSection.id)}>
                    <CheckCircle size={16} />
                    {t("courseViewer.markComplete", { ns: "employee" })}
                  </button>
                )}
              </div>
            )}

            {/* ── QUIZ ── */}
            {currentSection.section_type === "QUIZ" && (
              <div style={{ padding: '24px' }}>
                {!quizSubmitted ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
                      {currentSection.content_data?.questions?.map((q: any, qIdx: number) => (
                        <div key={qIdx} style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 12 }}>
                          {/* Question */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.22)', fontSize: 11, fontWeight: 800, color: '#fbbf24', flexShrink: 0 }}>
                              {qIdx + 1}
                            </span>
                            <p style={{ fontSize: 15, fontWeight: 600, color: T.white, margin: 0, lineHeight: '22px' }}>{q.question}</p>
                          </div>
                          {/* Options */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {q.options.map((opt: string, oIdx: number) => {
                              const isSelected = quizAnswers[qIdx] === opt;
                              return (
                                <button
                                  key={oIdx}
                                  className={`aw-quiz-option ${isSelected ? 'selected' : ''}`}
                                  onClick={() => setQuizAnswers({ ...quizAnswers, [qIdx]: opt })}
                                  style={{ textAlign: isRtl ? 'right' : 'left' }}
                                >
                                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isSelected ? T.accent : 'rgba(255,255,255,0.20)'}`, background: isSelected ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.18s' }}>
                                    {isSelected && <Check size={10} style={{ color: T.accentDark }} />}
                                  </div>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      className="aw-btn-accent"
                      disabled={Object.keys(quizAnswers).length !== currentSection.content_data?.questions?.length}
                      onClick={handleSubmitQuiz}
                      style={Object.keys(quizAnswers).length !== currentSection.content_data?.questions?.length ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)', boxShadow: 'none', cursor: 'not-allowed' } : {}}
                    >
                      <ClipboardCheck size={16} />
                      {t("courseViewer.submitAnswers", { ns: "employee" })}
                    </button>
                  </>
                ) : (
                  /* ── Quiz result ── */
                  <div className="aw-fade-up" style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                    {/* Score circle */}
                    <div style={{
                      width: 100, height: 100, borderRadius: '50%', margin: '0 auto 20px',
                      background: quizScore >= 60 ? T.greenBg : T.redBg,
                      border: `3px solid ${quizScore >= 60 ? T.greenBorder : T.redBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 28px ${quizScore >= 60 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`,
                    }}>
                      <span style={{ fontSize: 26, fontWeight: 900, color: quizScore >= 60 ? T.green : T.red }}>
                        {formatLocalizedNumber(quizScore, currentLanguage)}%
                      </span>
                    </div>

                    <h3 style={{ fontSize: 20, fontWeight: 800, color: quizScore >= 60 ? T.green : T.red, marginBottom: 8 }}>
                      {quizScore >= 60 ? t("courseViewer.passedQuiz", { ns: "employee" }) : t("courseViewer.failedQuiz", { ns: "employee" })}
                    </h3>
                    <p style={{ fontSize: 14, color: T.textBody, marginBottom: 24, lineHeight: '22px' }}>
                      {quizScore >= 60 ? t("courseViewer.continueNext", { ns: "employee" }) : t("courseViewer.minimumScore", { ns: "employee" })}
                    </p>

                    {quizScore < 60 && (
                      <button className="aw-btn-retry" onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); }}>
                        <RotateCcw size={14} /> {t("courseViewer.retry", { ns: "employee" })}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Navigation footer ── */}
          {isSectionCompleted(currentSection.id) && (
            <div className="aw-fade-up" style={{ animationDelay: '0.1s' }}>
              {currentSectionIndex < sections.length - 1 ? (
                <button className="aw-btn-accent" onClick={handleNextSection}>
                  {t("courseViewer.nextSection", { ns: "employee" })}
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  className="aw-btn-green"
                  onClick={updateCourseCompletion}
                  style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green, boxShadow: '0 0 20px rgba(52,211,153,0.12)' }}
                >
                  <Award size={16} />
                  {t("courseViewer.finishCourse", { ns: "employee" })} 🎉
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
