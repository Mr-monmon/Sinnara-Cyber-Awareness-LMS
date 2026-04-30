import React, { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, BookOpen, Settings,
  Download, Clock, X, Save, Loader2, FileText,
  Video, AlignLeft, Award,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { CertificateTemplate, Course, EmployeeCourse } from "../../lib/types";
import { CourseContentManager } from "./CourseContentManager";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg:          '#12140a',
  bgCard:      '#1a1e0e',
  accent:      '#c8ff00',
  accentDark:  '#12140a',
  white:       '#ffffff',
  textBody:    '#cbd5e1',
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
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  purpleBorder:'rgba(167,139,250,0.22)',
  orange:      '#fb923c',
  orangeBg:    'rgba(251,146,60,0.08)',
  orangeBorder:'rgba(251,146,60,0.22)',
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
} as const;

/* ─────────────────────────────────────────
   CONTENT TYPE CONFIG
───────────────────────────────────────── */
const CONTENT_TYPES = [
  { key: 'TEXT',   icon: AlignLeft, color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   label: 'Text'   },
  { key: 'VIDEO',  icon: Video,     color: T.purple, bg: T.purpleBg, border: T.purpleBorder, label: 'Video'  },
  { key: 'SLIDES', icon: FileText,  color: T.orange, bg: T.orangeBg, border: T.orangeBorder, label: 'Slides' },
] as const;
const getTypeCfg = (t: string) => CONTENT_TYPES.find(c => c.key === t) ?? CONTENT_TYPES[0];

/* ─────────────────────────────────────────
   CSS  — id = "aw-csp-styles" (unique)
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Course card ── */
  .aw-csp-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden;
    font-family: 'Inter', sans-serif;
    display: flex; flex-direction: column;
    transition: border-color 0.2s, transform 0.18s;
  }
  .aw-csp-card:hover { border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }

  /* ── Icon action btns ── */
  .aw-csp-icon-btn {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none; flex-shrink: 0;
  }
  .aw-csp-icon-btn.dl       { color: #34d399; border-color: rgba(52,211,153,0.22);  background: rgba(52,211,153,0.08);  }
  .aw-csp-icon-btn.dl:hover       { background: rgba(52,211,153,0.18); }
  .aw-csp-icon-btn.manage   { color: #a78bfa; border-color: rgba(167,139,250,0.22); background: rgba(167,139,250,0.08); }
  .aw-csp-icon-btn.manage:hover   { background: rgba(167,139,250,0.18); }
  .aw-csp-icon-btn.edit     { color: #60a5fa; border-color: rgba(96,165,250,0.22);  background: rgba(96,165,250,0.08);  }
  .aw-csp-icon-btn.edit:hover     { background: rgba(96,165,250,0.18); }
  .aw-csp-icon-btn.del      { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-csp-icon-btn.del:hover      { background: rgba(248,113,113,0.16); }

  /* ── Form inputs ── */
  .aw-csp-input, .aw-csp-select, .aw-csp-textarea {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-csp-input   { padding: 11px 14px; }
  .aw-csp-textarea { padding: 11px 14px; resize: vertical; }
  .aw-csp-select  {
    padding: 11px 36px 11px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-csp-input:focus, .aw-csp-select:focus, .aw-csp-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-csp-input::placeholder, .aw-csp-textarea::placeholder { color: rgba(148,163,184,0.35); }
  .aw-csp-select option { background: #1a1e0e; color: #ffffff; }
  input[type="number"].aw-csp-input::-webkit-inner-spin-button { filter: invert(1) opacity(0.3); }

  .aw-csp-label {
    display: block; font-size: 12px; font-weight: 600; color: #94a3b8;
    margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif;
  }

  /* ── Content type selector ── */
  .aw-csp-type-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
    padding: 11px 8px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.02); cursor: pointer;
    font-size: 12px; font-weight: 600; font-family: 'Inter', sans-serif;
    color: #64748b; transition: all 0.18s;
  }
  .aw-csp-type-btn:hover { background: rgba(255,255,255,0.05); }

  /* ── Modal save btn ── */
  .aw-csp-save-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-csp-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-csp-cancel-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 13px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-csp-cancel-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  /* ── Scrollbar ── */
  .aw-csp-scroll::-webkit-scrollbar { width: 4px; }
  .aw-csp-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-csp-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-csp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-csp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   DEFAULT FORM
───────────────────────────────────────── */
const defaultForm = {
  title: '', description: '', title_ar: '', description_ar: '',
  content_type: 'TEXT' as 'VIDEO' | 'SLIDES' | 'TEXT',
  duration_minutes: 30, order_index: 0, certificate_id: '',
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CoursesPage: React.FC = () => {
  const [courses, setCourses]               = useState<Course[]>([]);
  const [showModal, setShowModal]           = useState(false);
  const [editingCourse, setEditingCourse]   = useState<Course | null>(null);
  const [managingCourse, setManagingCourse] = useState<Course | null>(null);
  const [employeeCourses, setEmployeeCourses] = useState<EmployeeCourse[]>([]);
  const [certTemplates, setCertTemplates]   = useState<CertificateTemplate[]>([]);
  const [form, setForm]                     = useState({ ...defaultForm });
  const [saving, setSaving]                 = useState(false);

  useEffect(() => { loadCourses(); loadEmployeeCourses(); loadCertTemplates(); }, []);

  const loadCourses = async () => {
    const { data } = await supabase.from("courses").select("*, certificate_templates(id,name)").order("order_index");
    if (data) setCourses(data);
  };
  const loadEmployeeCourses = async () => {
    const { data } = await supabase.from("employee_courses").select(`*, employee:users!employee_courses_employee_id_fkey(id, full_name, email, department:departments!users_department_id_fkey(id, name))`).order("assigned_at");
    if (data) setEmployeeCourses(data as unknown as EmployeeCourse[]);
  };
  const loadCertTemplates = async () => {
    const { data } = await supabase.from("certificate_templates").select("*").order("created_at", { ascending: false });
    if (data) setCertTemplates(data as unknown as CertificateTemplate[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        ...form,
        title_ar:        form.title_ar.trim()        || form.title.trim(),
        description_ar:  form.description_ar.trim()  || form.description.trim(),
        certificate_id:  form.certificate_id || null,
      };
      if (editingCourse) {
        const { error } = await supabase.from("courses").update(payload).eq("id", editingCourse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert([payload]);
        if (error) throw error;
      }
      setShowModal(false); setEditingCourse(null); setForm({ ...defaultForm });
      await loadCourses();
    } catch { alert("Failed to save course"); }
    finally { setSaving(false); }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setForm({ title: course.title, description: course.description, title_ar: course.title_ar || '', description_ar: course.description_ar || '', content_type: course.content_type, duration_minutes: course.duration_minutes, order_index: course.order_index, certificate_id: course.certificate_id || '' });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this course?")) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) { alert("Failed to delete course"); return; }
    await loadCourses();
  };

  const handleDownload = async (courseId: string) => {
    const rows = employeeCourses.filter(ec => ec.course_id === courseId);
    if (!rows.length) { alert("No employee records for this course"); return; }
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["name", "email", "department", "progress_%", "completed_at"];
    const lines = rows.map(r => {
      const e = (r as any).employee;
      return [esc(e?.full_name), esc(e?.email), esc(e?.department?.name), esc(r.progress_percentage), esc(r.completed_at)].join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const course = courses.find(c => c.id === courseId);
    const a = document.createElement("a");
    a.href = url; a.download = `${(course?.title ?? "course").replace(/[^a-zA-Z0-9_-]+/g, "_")}_progress.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  /* Manage course content — render sub-page */
  if (managingCourse) return <CourseContentManager course={managingCourse} onBack={() => setManagingCourse(null)} />;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} style={{ color: T.purple }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Training Courses</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Manage training content available to your company.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Stats */}
          <div style={{ padding: '7px 14px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: T.purple }}>{courses.length}</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>courses</span>
          </div>
          <button
            onClick={() => { setEditingCourse(null); setForm({ ...defaultForm, order_index: courses.length }); setShowModal(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark, boxShadow: '0 0 18px rgba(200,255,0,0.20)' }}
          >
            <Plus size={14} /> Add Course
          </button>
        </div>
      </div>

      {/* ── Courses grid ── */}
      {courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={26} style={{ color: T.textMuted }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, margin: '0 0 6px' }}>No courses yet</p>
          <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 20px' }}>Click "Add Course" to create your first training course.</p>
          <button onClick={() => { setEditingCourse(null); setForm({ ...defaultForm }); setShowModal(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark }}>
            <Plus size={14} /> Add Course
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {courses.map((course, idx) => {
            const cfg = getTypeCfg(course.content_type);
            const hasCert = !!(course as any).certificate_templates;
            const empCount = employeeCourses.filter(ec => ec.course_id === course.id).length;
            const completedCount = employeeCourses.filter(ec => ec.course_id === course.id && ec.completed_at).length;

            return (
              <div key={course.id} className={`aw-csp-card aw-fade-up`} style={{ animationDelay: `${idx * 0.04}s` }}>
                {/* Color bar */}
                <div style={{ height: 2, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}40)` }} />

                {/* Card header */}
                <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Top row: icon + actions */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <cfg.icon size={17} style={{ color: cfg.color }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="aw-csp-icon-btn dl"     title="Export progress CSV" onClick={() => handleDownload(course.id)}><Download size={13} /></button>
                      <button className="aw-csp-icon-btn manage" title="Manage Content"       onClick={() => setManagingCourse(course)}><Settings size={13} /></button>
                      <button className="aw-csp-icon-btn edit"   title="Edit Course"          onClick={() => handleEdit(course)}><Edit2 size={13} /></button>
                      <button className="aw-csp-icon-btn del"    title="Delete Course"        onClick={() => handleDelete(course.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {/* Title + desc */}
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 5px', lineHeight: '21px' }}>
                      {course.title}
                    </h3>
                    <p style={{ fontSize: 12, color: T.textMuted, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '18px' }}>
                      {course.description}
                    </p>
                  </div>

                  {/* Meta badges */}
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 'auto' }}>
                    {/* Type */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    {/* Duration */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textMuted }}>
                      <Clock size={9} /> {course.duration_minutes} min
                    </span>
                    {/* Certificate */}
                    {hasCert && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 600, background: T.goldBg, border: '1px solid rgba(251,191,36,0.22)', color: T.gold }}>
                        <Award size={9} /> Certificate
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress footer */}
                {empCount > 0 && (
                  <div style={{ padding: '10px 18px', borderTop: `1px solid ${T.borderFaint}`, background: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 5 }}>
                        <span>Completion</span>
                        <span style={{ color: T.green, fontWeight: 700 }}>{completedCount}/{empCount}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${empCount > 0 ? (completedCount / empCount) * 100 : 0}%`, background: T.green, borderRadius: 9999, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ MODAL ═══════════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.86)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowModal(false); setEditingCourse(null); }}>
          <div className="aw-modal-in aw-csp-scroll" style={{ width: '100%', maxWidth: 560, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', overflowY: 'auto', maxHeight: '92vh', boxShadow: '0 40px 100px rgba(0,0,0,0.60)', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />

            {/* Modal header */}
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: T.bgCard, zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={15} style={{ color: T.purple }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>{editingCourse ? 'Edit Course' : 'Add New Course'}</h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Fill in the course details below</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setEditingCourse(null); }}
                style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ overflowY: 'auto', flex: 1, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 15 }} className="aw-csp-scroll">

                {/* Content type selector */}
                <div>
                  <label className="aw-csp-label">Content Type <span style={{ color: T.accent }}>*</span></label>
                  <div style={{ display: 'flex', gap: 9 }}>
                    {CONTENT_TYPES.map(({ key, icon: Icon, color, bg, border, label }) => {
                      const active = form.content_type === key;
                      return (
                        <button key={key} type="button"
                          className="aw-csp-type-btn"
                          style={{ background: active ? bg : 'rgba(255,255,255,0.02)', borderColor: active ? border : 'rgba(255,255,255,0.08)', color: active ? color : T.textMuted }}
                          onClick={() => setForm(p => ({ ...p, content_type: key as any }))}>
                          <Icon size={13} style={{ color: active ? color : T.textMuted }} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title EN + AR */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="aw-csp-label">Title (English) <span style={{ color: T.accent }}>*</span></label>
                    <input className="aw-csp-input" type="text" required placeholder="e.g. Phishing Awareness" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="aw-csp-label">Title (Arabic) <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                    <input className="aw-csp-input" type="text" dir="rtl" placeholder="العنوان بالعربي" value={form.title_ar} onChange={e => setForm(p => ({ ...p, title_ar: e.target.value }))} />
                  </div>
                </div>

                {/* Description EN + AR */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="aw-csp-label">Description (English) <span style={{ color: T.accent }}>*</span></label>
                    <textarea className="aw-csp-textarea" required rows={3} placeholder="Brief course description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="aw-csp-label">Description (Arabic) <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                    <textarea className="aw-csp-textarea" rows={3} dir="rtl" placeholder="الوصف بالعربي" value={form.description_ar} onChange={e => setForm(p => ({ ...p, description_ar: e.target.value }))} />
                  </div>
                </div>

                {/* Duration + Certificate */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="aw-csp-label">Duration (minutes) <span style={{ color: T.accent }}>*</span></label>
                    <input className="aw-csp-input" type="number" required min="1" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <label className="aw-csp-label">Certificate Template <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                    <select className="aw-csp-select" value={form.certificate_id} onChange={e => setForm(p => ({ ...p, certificate_id: e.target.value }))}>
                      <option value="">No certificate</option>
                      {certTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Info note */}
                <div style={{ padding: '12px 14px', background: T.blueBg, border: `1px solid ${T.blueBorder}`, borderRadius: 10, display: 'flex', gap: 10, fontSize: 12, color: T.textBody }}>
                  <BookOpen size={13} style={{ color: T.blue, flexShrink: 0, marginTop: 1 }} />
                  After creating the course, use the <strong style={{ color: T.accent }}>Manage Content</strong> (⚙) button to add sections — videos, articles, and quizzes.
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0, background: T.bgCard }}>
                <button type="button" className="aw-csp-cancel-btn" onClick={() => { setShowModal(false); setEditingCourse(null); }}>Cancel</button>
                <button type="submit" className="aw-csp-save-btn" disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
                    : <><Save size={14} /> {editingCourse ? 'Update Course' : 'Create Course'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
