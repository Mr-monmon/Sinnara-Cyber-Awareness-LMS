import React, { useState, useEffect } from "react";
import { BookOpen, Download, Plus, X, Users, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { Course, EmployeeCourse } from "../../lib/types";

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
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-course-assign-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    overflow: hidden;
    font-family: 'Inter', sans-serif;
    transition: border-color 0.2s;
  }
  .aw-course-assign-card:hover { border-color: rgba(255,255,255,0.13); }

  /* ── Dept toggle button ── */
  .aw-dept-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 14px; border-radius: 8px;
    font-size: 12px; font-weight: 600;
    font-family: 'Inter', sans-serif; cursor: pointer;
    transition: all 0.18s;
  }
  .aw-dept-btn.assigned {
    background: rgba(200,255,0,0.08);
    border: 1px solid rgba(200,255,0,0.28);
    color: #c8ff00;
  }
  .aw-dept-btn.assigned:hover {
    background: rgba(248,113,113,0.08);
    border-color: rgba(248,113,113,0.30);
    color: #f87171;
  }
  .aw-dept-btn.unassigned {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.09);
    color: #64748b;
  }
  .aw-dept-btn.unassigned:hover {
    background: rgba(200,255,0,0.05);
    border-color: rgba(200,255,0,0.20);
    color: #c8ff00;
  }
  .aw-dept-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── All Depts badge/button ── */
  .aw-all-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 8px;
    font-size: 12px; font-weight: 700;
    font-family: 'Inter', sans-serif; cursor: pointer;
    transition: all 0.18s;
  }
  .aw-all-btn.active {
    background: rgba(52,211,153,0.08);
    border: 1px solid rgba(52,211,153,0.25);
    color: #34d399;
  }
  .aw-all-btn.inactive {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.09);
    color: #64748b;
  }
  .aw-all-btn.inactive:hover {
    background: rgba(52,211,153,0.05);
    border-color: rgba(52,211,153,0.20);
    color: #34d399;
  }
  .aw-all-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Download btn ── */
  .aw-dl-icon-btn {
    width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.22);
    color: #34d399; cursor: pointer; transition: all 0.18s; flex-shrink: 0;
  }
  .aw-dl-icon-btn:hover { background: rgba(52,211,153,0.16); border-color: rgba(52,211,153,0.38); }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-ca-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-ca-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Department { id: string; name: string; }

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CourseAssignmentPage: React.FC = () => {
  const { user }      = useAuth();
  const [courses, setCourses]             = useState<Course[]>([]);
  const [departments, setDepartments]     = useState<Department[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState<string | null>(null);
  const [employeeCourses, setEmployeeCourses] = useState<EmployeeCourse[]>([]);

  useEffect(() => { loadData(); loadEmployeeCourses(); }, [user]);

  const loadData = async () => {
    if (!user?.company_id) return;
    try {
      const [coursesRes, deptsRes] = await Promise.all([
        supabase.from("courses").select("*").order("order_index"),
        supabase.from("departments").select("id, name").eq("company_id", user.company_id).order("name"),
      ]);
      if (coursesRes.data) setCourses(coursesRes.data);
      if (deptsRes.data)   setDepartments(deptsRes.data);
    } catch (err) { console.error("Error loading data:", err); }
    finally { setLoading(false); }
  };

  const loadEmployeeCourses = async () => {
    const { data } = await supabase
      .from("employee_courses")
      .select(`*, employee:users!employee_courses_employee_id_fkey(id, full_name, email, company_id, department:departments!users_department_id_fkey(id, name))`)
      .order("assigned_at");
    if (data) setEmployeeCourses(data as unknown as EmployeeCourse[]);
  };

  const toggleDepartment = async (courseId: string, deptId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course || saving === courseId) return;
    setSaving(courseId);
    const isAll = !course.department_ids || course.department_ids.length === 0;
    let newDepts: string[];
    if (isAll) {
      newDepts = departments.map(d => d.id).filter(id => id !== deptId);
    } else {
      const curr = course.department_ids || [];
      newDepts = curr.includes(deptId) ? curr.filter(id => id !== deptId) : [...curr, deptId];
    }
    try {
      const { error } = await supabase.from("courses")
        .update({ department_ids: newDepts.length > 0 ? newDepts : null }).eq("id", courseId);
      if (error) throw error;
      setCourses(courses.map(c => c.id === courseId ? { ...c, department_ids: newDepts.length > 0 ? newDepts : null } : c));
      await loadData();
    } catch (err) {
      console.error("Error updating course departments:", err);
      alert("Failed to update department assignment. Please try again.");
    } finally { setSaving(null); }
  };

  const assignToAll = async (courseId: string) => {
    setSaving(courseId);
    try {
      const { error } = await supabase.from("courses").update({ department_ids: null }).eq("id", courseId);
      if (error) throw error;
      setCourses(courses.map(c => c.id === courseId ? { ...c, department_ids: null } : c));
    } catch { alert("Failed to assign course to all departments"); }
    finally { setSaving(null); }
  };

  const handleDownload = async (courseId: string) => {
    const rows = employeeCourses.filter(ec => ec.course_id === courseId && (ec as any).employee?.company_id === user?.company_id);
    if (rows.length === 0) { alert("No employee course records found for this course"); return; }
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["user name","user email","department","progress_percentage","completed_at"];
    const lines = rows.map(row => {
      const emp = (row as any).employee;
      return [esc(emp?.full_name), esc(emp?.email), esc(emp?.department?.name), esc(row.progress_percentage), esc(row.completed_at)].join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const course = courses.find(c => c.id === courseId);
    const fileName = `${(course?.title ?? "course").trim().replace(/[^a-zA-Z0-9_-]+/g, "_")}_employee_courses.csv`;
    const a = document.createElement("a");
    a.href = url; a.setAttribute("download", fileName);
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 14, color: T.textBody }}>Loading courses…</p>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={18} style={{ color: T.accent }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
            Course Assignment
          </h1>
        </div>
        <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
          Control which departments have access to each course. Leave empty to make available to all departments.
        </p>
      </div>

      {/* ── No departments warning ── */}
      {departments.length === 0 ? (
        <div style={{ padding: '20px 22px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.24)', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Users size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', margin: '0 0 4px' }}>No departments found</p>
            <p style={{ fontSize: 13, color: T.textBody, margin: 0 }}>Please create departments first before assigning courses.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {courses.map((course, idx) => {
            const isAll      = !course.department_ids || course.department_ids.length === 0;
            const assigned   = course.department_ids || [];
            const isSavingThis = saving === course.id;

            return (
              <div
                key={course.id}
                className={`aw-course-assign-card aw-fade-up`}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                {/* Card header */}
                <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: `1px solid ${T.borderFaint}` }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookOpen size={17} style={{ color: T.accent }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 3px', lineHeight: '21px' }}>
                      {course.title}
                    </h3>
                    <p style={{ fontSize: 13, color: T.textMuted, margin: 0, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {course.description}
                    </p>
                  </div>

                  {/* Saving indicator */}
                  {isSavingThis && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.accent }}>
                      <Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} />
                      Saving…
                    </div>
                  )}

                  {/* Download button */}
                  <button className="aw-dl-icon-btn" onClick={() => handleDownload(course.id)} title="Download employee progress CSV">
                    <Download size={14} />
                  </button>
                </div>

                {/* Department assignment */}
                <div style={{ padding: '16px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                      Assigned Departments
                    </span>

                    <button
                      className={`aw-all-btn ${isAll ? 'active' : 'inactive'}`}
                      onClick={() => assignToAll(course.id)}
                      disabled={isSavingThis}
                    >
                      {isAll ? <CheckCircle size={12} /> : <Users size={12} />}
                      {isAll ? 'All Departments' : 'Assign to All'}
                    </button>
                  </div>

                  {/* Department pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {departments.map(dept => {
                      const isAssigned = isAll || assigned.includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          className={`aw-dept-btn ${isAssigned ? 'assigned' : 'unassigned'}`}
                          onClick={() => toggleDepartment(course.id, dept.id)}
                          disabled={isSavingThis}
                        >
                          {isAssigned
                            ? <><X size={11} /> {dept.name}</>
                            : <><Plus size={11} /> {dept.name}</>
                          }
                        </button>
                      );
                    })}
                  </div>

                  {/* Counter */}
                  {!isAll && assigned.length > 0 && (
                    <p style={{ fontSize: 11, color: T.textMuted, marginTop: 10, margin: '10px 0 0' }}>
                      Available to <strong style={{ color: T.textBody }}>{assigned.length}</strong> department{assigned.length !== 1 ? 's' : ''}
                    </p>
                  )}
                  {isAll && (
                    <p style={{ fontSize: 11, color: T.green, marginTop: 10 }}>
                      ✓ Available to all {departments.length} departments
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── No courses ── */}
      {courses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={26} style={{ color: T.textMuted }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, marginBottom: 6 }}>No courses available</p>
          <p style={{ fontSize: 13, color: T.textMuted }}>Courses will appear here once they are created by the platform admin.</p>
        </div>
      )}
    </div>
  );
};
