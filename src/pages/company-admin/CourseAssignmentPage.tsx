import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Download, Plus, X, Users, CheckCircle,
  Loader2, AlertTriangle,
} from "lucide-react";
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
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
} as const;

/* ─────────────────────────────────────────
   CSS  (id = "aw-crsa-styles")
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-crsa-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden;
    font-family: 'Inter', sans-serif;
    transition: border-color 0.2s;
  }
  .aw-crsa-card:hover { border-color: rgba(255,255,255,0.14); }

  .aw-crsa-dept {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 13px; border-radius: 8px;
    font-size: 12px; font-weight: 600;
    font-family: 'Inter', sans-serif;
    cursor: pointer; transition: all 0.18s; white-space: nowrap;
  }
  .aw-crsa-dept.on  { background: rgba(200,255,0,0.08); border: 1px solid rgba(200,255,0,0.28); color: #c8ff00; }
  .aw-crsa-dept.on:hover  { background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.30); color: #f87171; }
  .aw-crsa-dept.off { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #64748b; }
  .aw-crsa-dept.off:hover { background: rgba(200,255,0,0.05); border-color: rgba(200,255,0,0.20); color: #c8ff00; }
  .aw-crsa-dept:disabled  { opacity: 0.38; cursor: not-allowed; }

  .aw-crsa-all {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 13px; border-radius: 8px;
    font-size: 12px; font-weight: 700;
    font-family: 'Inter', sans-serif;
    cursor: pointer; transition: all 0.18s;
  }
  .aw-crsa-all.on  { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25); color: #34d399; }
  .aw-crsa-all.off { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #64748b; }
  .aw-crsa-all.off:hover { background: rgba(52,211,153,0.05); border-color: rgba(52,211,153,0.20); color: #34d399; }
  .aw-crsa-all:disabled { opacity: 0.38; cursor: not-allowed; }

  .aw-crsa-dl {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.22);
    color: #34d399; cursor: pointer; transition: all 0.18s; flex-shrink: 0;
  }
  .aw-crsa-dl:hover { background: rgba(52,211,153,0.18); }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-crsa-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-crsa-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Department { id: string; name: string; }

/* Mini SVG progress ring */
const Ring: React.FC<{ pct: number; size?: number; color: string }> = ({ pct, size = 34, color }) => {
  const R = (size - 5) / 2; const C = size / 2;
  const circ = 2 * Math.PI * R;
  const dash  = Math.min(pct, 100) / 100 * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3.5} />
      <circle cx={C} cy={C} r={R} fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${C}px ${C}px`, filter: `drop-shadow(0 0 4px ${color}60)` }} />
      <text x={C} y={C + 3.5} textAnchor="middle" fill={color} fontSize={size * 0.24} fontWeight="900" fontFamily="Inter">{pct}%</text>
    </svg>
  );
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CourseAssignmentPage: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses]               = useState<Course[]>([]);
  const [departments, setDepartments]       = useState<Department[]>([]);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState<string | null>(null);
  const [employeeCourses, setEmployeeCourses] = useState<EmployeeCourse[]>([]);

  // Map: courseId → departmentId[] that are allowed for THIS company.
  // Empty array (or missing key) = no restriction = all departments can see it.
  const [courseDeptMap, setCourseDeptMap]   = useState<Record<string, string[]>>({});

  useEffect(() => { loadData(); loadEmployeeCourses(); }, [user]);

  /* ── Helper: reload only the dept-restriction map ── */
  const reloadDeptMap = useCallback(async () => {
    if (!user?.company_id) return;
    const { data } = await supabase
      .from("company_course_departments")
      .select("course_id, department_id")
      .eq("company_id", user.company_id);

    const map: Record<string, string[]> = {};
    data?.forEach(r => {
      if (!map[r.course_id]) map[r.course_id] = [];
      map[r.course_id].push(r.department_id);
    });
    setCourseDeptMap(map);
  }, [user?.company_id]);

  /* ── Main data load ── */
  const loadData = async () => {
    if (!user?.company_id) return;
    try {
      // 1. Only fetch courses that are assigned to this company (via company_courses)
      const { data: ccData, error: ccErr } = await supabase
        .from("company_courses")
        .select("course_id, courses(*)")
        .eq("company_id", user.company_id);

      if (ccErr) throw ccErr;

      const courseList = (ccData ?? [])
        .map((cc: any) => cc.courses)
        .filter(Boolean) as Course[];

      // Sort by order_index (same as platform admin view)
      courseList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setCourses(courseList);

      // 2. Departments for this company
      const { data: dRes } = await supabase
        .from("departments")
        .select("id, name")
        .eq("company_id", user.company_id)
        .order("name");
      setDepartments(dRes ?? []);

      // 3. Department restrictions for this company
      const { data: deptData } = await supabase
        .from("company_course_departments")
        .select("course_id, department_id")
        .eq("company_id", user.company_id);

      const map: Record<string, string[]> = {};
      deptData?.forEach(r => {
        if (!map[r.course_id]) map[r.course_id] = [];
        map[r.course_id].push(r.department_id);
      });
      setCourseDeptMap(map);

    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadEmployeeCourses = async () => {
    if (!user?.company_id) return;
    const { data } = await supabase
      .from("employee_courses")
      .select(`
        *,
        employee:users!employee_courses_employee_id_fkey(
          id, full_name, email, company_id,
          department:departments!users_department_id_fkey(id, name)
        )
      `)
      .order("assigned_at");
    if (data) setEmployeeCourses(data as unknown as EmployeeCourse[]);
  };

  /* ── Toggle one department for a course ── */
  const toggleDepartment = async (courseId: string, deptId: string) => {
    if (saving === courseId || !user?.company_id) return;
    setSaving(courseId);

    const current = courseDeptMap[courseId] ?? [];
    const isAll   = current.length === 0; // no restrictions = all visible

    try {
      if (isAll) {
        // Currently "all depts can see" → clicking one dept = restrict to all EXCEPT that dept
        const otherDepts = departments.map(d => d.id).filter(id => id !== deptId);
        if (otherDepts.length > 0) {
          await supabase.from("company_course_departments").insert(
            otherDepts.map(id => ({
              company_id:    user.company_id,
              course_id:     courseId,
              department_id: id,
            }))
          );
        }
        // Edge: only 1 dept total → removing it means 0 rows → back to "all" 
        // This is acceptable — nothing to insert, map stays empty.
      } else if (current.includes(deptId)) {
        // Dept is already allowed → remove it
        await supabase
          .from("company_course_departments")
          .delete()
          .eq("company_id",    user.company_id)
          .eq("course_id",     courseId)
          .eq("department_id", deptId);
      } else {
        // Dept is not yet allowed → add it
        await supabase.from("company_course_departments").insert({
          company_id:    user.company_id,
          course_id:     courseId,
          department_id: deptId,
        });
      }

      await reloadDeptMap();
    } catch {
      alert("Failed to update. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  /* ── Assign course to ALL departments (remove all restrictions) ── */
  const assignToAll = async (courseId: string) => {
    if (saving === courseId || !user?.company_id) return;
    setSaving(courseId);
    try {
      await supabase
        .from("company_course_departments")
        .delete()
        .eq("company_id", user.company_id)
        .eq("course_id",  courseId);

      setCourseDeptMap(prev => {
        const next = { ...prev };
        delete next[courseId];
        return next;
      });
    } catch {
      alert("Failed to assign to all departments");
    } finally {
      setSaving(null);
    }
  };

  /* ── CSV export ── */
  const handleDownload = async (courseId: string) => {
    const rows = employeeCourses.filter(ec =>
      ec.course_id === courseId &&
      (ec as any).employee?.company_id === user?.company_id
    );
    if (!rows.length) { alert("No employee records for this course"); return; }
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["name", "email", "department", "progress_%", "completed_at"];
    const lines = rows.map(r => {
      const e = (r as any).employee;
      return [
        esc(e?.full_name), esc(e?.email),
        esc(e?.department?.name),
        esc(r.progress_percentage),
        esc(r.completed_at),
      ].join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const course = courses.find(c => c.id === courseId);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(course?.title ?? "course").replace(/[^a-zA-Z0-9_-]+/g, "_")}_progress.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── Stats from employee_courses (per company) ── */
  const getStats = (courseId: string) => {
    const rows = employeeCourses.filter(ec =>
      ec.course_id === courseId &&
      (ec as any).employee?.company_id === user?.company_id
    );
    const completed = rows.filter(r => r.completed_at).length;
    const avg = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.progress_percentage || 0), 0) / rows.length)
      : 0;
    return { total: rows.length, completed, avg };
  };

  /* ─────────────── LOADING ─────────────── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
    </div>
  );

  /* ─────────────── RENDER ─────────────── */
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} style={{ color: T.accent }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Course Assignment</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
            Control which departments can access each course. Leave all unselected to make it available to everyone.
          </p>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {[
            { label: 'Assigned Courses', value: courses.length,     color: T.accent },
            { label: 'Departments',       value: departments.length, color: T.blue   },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px 14px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── No departments warning ── */}
      {departments.length === 0 && courses.length > 0 && (
        <div className="aw-fade-up" style={{ padding: '16px 18px', background: T.goldBg, border: '1px solid rgba(251,191,36,0.26)', borderRadius: 11, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={15} style={{ color: T.gold, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.gold, margin: '0 0 2px' }}>No departments found</p>
            <p style={{ fontSize: 12, color: T.textBody, margin: 0 }}>Create departments first before assigning courses to specific departments.</p>
          </div>
        </div>
      )}

      {/* ── No courses assigned to this company ── */}
      {courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <BookOpen size={24} style={{ color: T.textMuted }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, margin: '0 0 5px' }}>No courses assigned to your company</p>
          <p style={{ fontSize: 13, color: T.textMuted }}>Ask the platform admin to assign courses to your company first.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {courses.map((course, idx) => {
            // Use company-specific dept map, NOT course.department_ids
            const assigned  = courseDeptMap[course.id] ?? [];
            const isAll     = assigned.length === 0;
            const isBusy    = saving === course.id;
            const stats     = getStats(course.id);
            const ringColor = stats.avg >= 80 ? T.green : stats.avg >= 40 ? T.blue : T.textMuted;

            return (
              <div key={course.id} className={`aw-crsa-card aw-fade-up`} style={{ animationDelay: `${idx * 0.04}s` }}>

                {/* Card header */}
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(200,255,0,0.07)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookOpen size={17} style={{ color: T.accent }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {course.title}
                    </h3>
                    <p style={{ fontSize: 12, color: T.textMuted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {course.description || 'No description'}
                    </p>
                  </div>

                  {stats.total > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <Ring pct={stats.avg} color={ringColor} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.white, lineHeight: '16px' }}>
                          {stats.completed}
                          <span style={{ fontSize: 11, fontWeight: 400, color: T.textMuted }}>/{stats.total}</span>
                        </div>
                        <div style={{ fontSize: 10, color: T.textMuted }}>completed</div>
                      </div>
                    </div>
                  )}

                  {isBusy && (
                    <Loader2 size={13} style={{ color: T.accent, animation: 'aw-spin 0.8s linear infinite', flexShrink: 0 }} />
                  )}

                  <button className="aw-crsa-dl" onClick={() => handleDownload(course.id)} title="Export progress CSV">
                    <Download size={13} />
                  </button>
                </div>

                {/* Department section */}
                <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${T.borderFaint}`, background: 'rgba(255,255,255,0.008)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Users size={11} style={{ color: T.textMuted }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        Departments
                      </span>
                    </div>
                    <button
                      className={`aw-crsa-all ${isAll ? 'on' : 'off'}`}
                      onClick={() => assignToAll(course.id)}
                      disabled={isBusy}
                    >
                      {isAll
                        ? <><CheckCircle size={11} /> All Departments</>
                        : <><Users size={11} /> Assign to All</>
                      }
                    </button>
                  </div>

                  {/* Dept pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {departments.length === 0 && (
                      <span style={{ fontSize: 12, color: T.textMuted }}>No departments yet — create them in the Employees section.</span>
                    )}
                    {departments.map(dept => {
                      const isOn = isAll || assigned.includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          className={`aw-crsa-dept ${isOn ? 'on' : 'off'}`}
                          onClick={() => toggleDepartment(course.id, dept.id)}
                          disabled={isBusy}
                        >
                          {isOn ? <X size={10} /> : <Plus size={10} />}
                          {dept.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Status note */}
                  <div style={{ marginTop: 10, fontSize: 11, color: isAll ? T.green : assigned.length > 0 ? T.textMuted : T.red }}>
                    {isAll
                      ? `✓ Available to all ${departments.length} department${departments.length !== 1 ? 's' : ''}`
                      : assigned.length > 0
                      ? `Assigned to ${assigned.length} of ${departments.length} department${departments.length !== 1 ? 's' : ''}`
                      : '⚠ Not assigned to any department — no employees will see this course'
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
