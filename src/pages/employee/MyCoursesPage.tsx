import React, { useCallback, useState, useEffect } from "react";
import { BookOpen, PlayCircle, CheckCircle, Clock, Award, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { formatLocalizedDate, formatLocalizedNumber } from "../../i18n/utils";
import { supabase } from "../../lib/supabase";
import { Course } from "../../lib/types";
import { CourseViewerPage } from "./CourseViewerPage";

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
  green:       '#34d399',
  greenBg:     'rgba(52,211,153,0.08)',
  greenBorder: 'rgba(52,211,153,0.22)',
  blue:        '#60a5fa',
  blueBg:      'rgba(96,165,250,0.08)',
  blueBorder:  'rgba(96,165,250,0.22)',
} as const;

type StatusKey = 'COMPLETED' | 'IN_PROGRESS' | 'ASSIGNED';

const STATUS_CONFIG: Record<StatusKey, { color: string; bg: string; border: string; barColor: string }> = {
  COMPLETED:   { color: T.green,  bg: T.greenBg,  border: T.greenBorder, barColor: T.green  },
  IN_PROGRESS: { color: T.blue,   bg: T.blueBg,   border: T.blueBorder,  barColor: T.blue   },
  ASSIGNED:    { color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint, barColor: T.textMuted },
};

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-course-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.22s, box-shadow 0.22s, transform 0.18s;
    font-family: 'Inter', sans-serif;
    display: flex;
    flex-direction: column;
  }
  .aw-course-card:hover {
    border-color: rgba(200,255,0,0.22);
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    transform: translateY(-2px);
  }

  /* ── Course action btn ── */
  .aw-course-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px;
    padding: 11px 18px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    transition: opacity 0.18s, transform 0.15s;
  }
  .aw-course-btn.start {
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 16px rgba(200,255,0,0.18);
  }
  .aw-course-btn.continue {
    background: rgba(96,165,250,0.12);
    border: 1px solid rgba(96,165,250,0.28);
    color: #60a5fa;
  }
  .aw-course-btn.certificate {
    background: rgba(52,211,153,0.10);
    border: 1px solid rgba(52,211,153,0.28);
    color: #34d399;
  }
  .aw-course-btn:hover { opacity: 0.88; transform: translateY(-1px); }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== "undefined" && !document.getElementById("aw-courses-styles")) {
  const tag = document.createElement("style");
  tag.id = "aw-courses-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface CourseProgress {
  course_id: string; employee_id: string;
  progress_percentage: number; status: string;
  completed_at: string | null; assigned_at: string;
}
interface EmployeeCourseRow {
  courses: Course | null;
  course_id: string | null;
  employee_id: string;
  progress_percentage: number | string | null;
  status: string;
  completed_at: string | null;
  assigned_at: string;
}
type Props = { navigateToCertificates: () => void; };

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const MyCoursesPage: React.FC<Props> = ({ navigateToCertificates }) => {
  const { user }    = useAuth();
  const { t, i18n } = useTranslation(["common", "employee"]);
  const [courses, setCourses]             = useState<Course[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, CourseProgress>>({});
  const [loading, setLoading]             = useState(true);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const currentLanguage = i18n.resolvedLanguage;
  const isArabic = currentLanguage?.toLowerCase().startsWith("ar") ?? false;

  const loadCourses = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("employee_courses")
        .select("*, courses:course_id (*)")
        .eq("employee_id", user.id);
      if (error) throw error;
      if (data) {
        const rows = data as EmployeeCourseRow[];
        setCourses(rows.map((ec) => ec.courses).filter((course): course is Course => Boolean(course)));
        const progressMap: Record<string, CourseProgress> = {};
        rows.forEach((ec) => {
          if (ec.course_id) {
            progressMap[ec.course_id] = {
              course_id: ec.course_id, employee_id: ec.employee_id,
              progress_percentage: Number(ec.progress_percentage) || 0,
              status: ec.status, completed_at: ec.completed_at, assigned_at: ec.assigned_at,
            };
          }
        });
        setCourseProgress(progressMap);
      }
    } catch (err) { console.error("Error loading courses:", err); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  const handleStartCourse = async (course: Course, status: StatusKey) => {
    if (!user) return;
    if (status === "COMPLETED") { navigateToCertificates(); return; }
    const existingProgress = courseProgress[course.id];
    if (existingProgress?.status === "ASSIGNED") {
      await supabase.from("employee_courses")
        .update({ status: "IN_PROGRESS", started_at: new Date().toISOString() })
        .eq("employee_id", user.id).eq("course_id", course.id);
    }
    setViewingCourse(course);
  };

  const getCourseProgress = (courseId: string) => courseProgress[courseId]?.progress_percentage || 0;

  const getCourseStatus = (courseId: string): StatusKey => {
    const prog = courseProgress[courseId];
    if (!prog) return "ASSIGNED";
    const p = prog.progress_percentage || 0;
    if (p >= 100) return "COMPLETED";
    if (p > 0)    return "IN_PROGRESS";
    return "ASSIGNED";
  };

  const getCourseDisplayText = (course: Course) => ({
    title: isArabic ? course.title_ar || course.title : course.title,
    description: isArabic
      ? course.description_ar || course.description
      : course.description,
  });

  /* ── Course viewer ── */
  if (viewingCourse) {
    const viewingCourseText = getCourseDisplayText(viewingCourse);

    return (
      <CourseViewerPage
        courseId={viewingCourse.id} courseTitle={viewingCourseText.title}
        onBack={() => { setViewingCourse(null); loadCourses(); }}
      />
    );
  }

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 14, color: T.textBody }}>Loading courses…</p>
    </div>
  );

  /* Stats */
  const completedCount  = Object.values(courseProgress).filter(p => p.progress_percentage >= 100).length;
  const inProgressCount = Object.values(courseProgress).filter(p => p.progress_percentage > 0 && p.progress_percentage < 100).length;
  const notStartedCount = courses.length - completedCount - inProgressCount;

  const statusLabel: Record<StatusKey, string> = {
    COMPLETED:   t("courses.summary.completed",  { ns: "employee" }),
    IN_PROGRESS: t("courses.summary.inProgress", { ns: "employee" }),
    ASSIGNED:    t("courses.summary.notStarted", { ns: "employee" }),
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={18} style={{ color: T.accent }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
            {t("courses.title", { ns: "employee" })}
          </h1>
        </div>
        <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
          {t("courses.subtitle", { ns: "employee" })}
        </p>
      </div>

      {/* ── Stats ── */}
      {courses.length > 0 && (
        <div className="aw-fade-up" style={{ animationDelay: '0.05s', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          {[
            { icon: BookOpen,     color: T.accent,    bg: 'rgba(200,255,0,0.08)',  border: 'rgba(200,255,0,0.20)',  label: t("courses.summary.total",      { ns: "employee" }), value: courses.length   },
            { icon: CheckCircle,  color: T.green,     bg: T.greenBg,              border: T.greenBorder,          label: t("courses.summary.completed",  { ns: "employee" }), value: completedCount   },
            { icon: Clock,        color: '#fbbf24',   bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)', label: t("courses.summary.inProgress", { ns: "employee" }), value: inProgressCount  },
            { icon: PlayCircle,   color: T.textMuted, bg: 'rgba(255,255,255,0.04)', border: T.borderFaint,          label: t("courses.summary.notStarted", { ns: "employee" }), value: notStartedCount  },
          ].map(({ icon: Icon, color, bg, border, label, value }) => (
            <div key={label} style={{ padding: '14px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, minWidth: 150 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.white, lineHeight: 1 }}>
                  {formatLocalizedNumber(value, currentLanguage)}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {courses.length === 0 ? (
        <div className="aw-fade-up" style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={26} style={{ color: T.accent }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, marginBottom: 6 }}>
            {t("courses.empty.title", { ns: "employee" })}
          </h3>
          <p style={{ fontSize: 14, color: T.textBody }}>
            {t("courses.empty.description", { ns: "employee" })}
          </p>
        </div>
      ) : (
        /* ── Courses grid ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {courses.map((course, idx) => {
            const progress   = getCourseProgress(course.id);
            const status     = getCourseStatus(course.id);
            const cfg        = STATUS_CONFIG[status];
            const isCompleted  = status === 'COMPLETED';
            const isInProgress = status === 'IN_PROGRESS';
            const courseText = getCourseDisplayText(course);

            return (
              <div
                key={course.id}
                className={`aw-course-card aw-fade-up`}
                style={{ animationDelay: `${idx * 0.05}s` }}
                onClick={() => handleStartCourse(course, status)}
              >
                {/* Status bar */}
                <div style={{ height: 3, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}30)` }} />

                <div style={{ padding: '20px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>

                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isCompleted
                        ? <CheckCircle size={18} style={{ color: T.green }} />
                        : isInProgress
                        ? <PlayCircle  size={18} style={{ color: T.blue  }} />
                        : <BookOpen    size={18} style={{ color: T.textMuted }} />
                      }
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                      {statusLabel[status]}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 dir={isArabic ? "rtl" : "ltr"} style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 6px', lineHeight: '22px' }}>
                    {courseText.title}
                  </h3>

                  {/* Description */}
                  <p dir={isArabic ? "rtl" : "ltr"} style={{ fontSize: 13, color: T.textMuted, margin: '0 0 14px', lineHeight: '20px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {courseText.description}
                  </p>

                  {/* Duration */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMuted, marginBottom: 14 }}>
                    <Clock size={12} style={{ color: T.textMuted }} />
                    {formatLocalizedNumber(course.duration_minutes, currentLanguage)} {t("labels.minutes", { ns: "common" })}
                  </div>

                  {/* Progress bar */}
                  {!isCompleted && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: T.textMuted }}>{t("labels.progress", { ns: "common" })}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isInProgress ? T.blue : T.textMuted }}>
                          {formatLocalizedNumber(Math.round(progress), currentLanguage)}%
                        </span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${progress}%`,
                          background: isInProgress ? T.blue : 'rgba(255,255,255,0.15)',
                          borderRadius: 9999,
                          boxShadow: isInProgress ? '0 0 8px rgba(96,165,250,0.40)' : 'none',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Completed date */}
                  {isCompleted && courseProgress[course.id]?.completed_at && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.green, marginBottom: 14 }}>
                      <Award size={13} style={{ flexShrink: 0 }} />
                      {t("labels.completedOn", { ns: "common" })} {formatLocalizedDate(courseProgress[course.id].completed_at!, currentLanguage)}
                    </div>
                  )}

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* CTA button */}
                  <button
                    className={`aw-course-btn ${isCompleted ? 'certificate' : isInProgress ? 'continue' : 'start'}`}
                    onClick={e => { e.stopPropagation(); handleStartCourse(course, status); }}
                  >
                    {isCompleted
                      ? <><Award size={14} />{t("courses.card.viewCertificate", { ns: "employee" })}</>
                      : isInProgress
                      ? <><PlayCircle size={14} />{t("actions.continue", { ns: "common" })}<ChevronRight size={13} /></>
                      : <><BookOpen size={14} />{t("courses.card.startCourse", { ns: "employee" })}<ChevronRight size={13} /></>
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
