import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Plus, Edit2, Trash2, Video,
  FileText, ClipboardCheck, GripVertical, Save, Loader2,
  BookOpen, Clock, AlertCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Course } from "../../lib/types";
import { CourseContentForm, CourseSection } from "./CourseContentForm";

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
} as const;

/* ─────────────────────────────────────────
   SECTION TYPE CONFIG
───────────────────────────────────────── */
const TYPE_CFG: Record<string, { icon: typeof Video; color: string; bg: string; border: string; label: string }> = {
  VIDEO:   { icon: Video,          color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   label: 'Video'   },
  ARTICLE: { icon: FileText,       color: T.green,  bg: T.greenBg,  border: T.greenBorder,  label: 'Article' },
  QUIZ:    { icon: ClipboardCheck, color: T.purple, bg: T.purpleBg, border: T.purpleBorder, label: 'Quiz'    },
};
const getTypeCfg = (t: string) => TYPE_CFG[t] ?? TYPE_CFG['ARTICLE'];

/* ─────────────────────────────────────────
   CSS  — id = "aw-ccm-styles" (unique)
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Section card ── */
  .aw-ccm-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden;
    font-family: 'Inter', sans-serif;
    transition: border-color 0.18s, box-shadow 0.18s;
    user-select: none;
  }
  .aw-ccm-card:hover { border-color: rgba(255,255,255,0.14); }
  .aw-ccm-card.dragging { opacity: 0.45; border-color: rgba(200,255,0,0.30); }
  .aw-ccm-card.drag-over { border-color: rgba(200,255,0,0.50); box-shadow: 0 0 0 2px rgba(200,255,0,0.15); }

  /* ── Grip handle ── */
  .aw-ccm-grip {
    cursor: grab; display: flex; align-items: center; padding: 0 4px;
    color: rgba(255,255,255,0.18); transition: color 0.18s;
  }
  .aw-ccm-grip:hover { color: rgba(200,255,0,0.60); }
  .aw-ccm-grip:active { cursor: grabbing; }

  /* ── Action icon buttons ── */
  .aw-ccm-icon-btn {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none; flex-shrink: 0;
  }
  .aw-ccm-icon-btn.edit { color: #60a5fa; border-color: rgba(96,165,250,0.22); background: rgba(96,165,250,0.08); }
  .aw-ccm-icon-btn.edit:hover { background: rgba(96,165,250,0.18); }
  .aw-ccm-icon-btn.del  { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-ccm-icon-btn.del:hover  { background: rgba(248,113,113,0.18); }

  /* ── Save order button ── */
  .aw-ccm-save-order {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 16px rgba(200,255,0,0.18);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-ccm-save-order:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-ccm-save-order:disabled { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.20); cursor: not-allowed; box-shadow: none; }

  /* ── Add section button ── */
  .aw-ccm-add-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 18px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(200,255,0,0.08); border: 1px solid rgba(200,255,0,0.22);
    color: #c8ff00; transition: all 0.18s;
  }
  .aw-ccm-add-btn:hover { background: rgba(200,255,0,0.14); }

  /* ── Back button ── */
  .aw-ccm-back {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    color: #64748b; background: none; border: none; cursor: pointer;
    padding: 0; transition: color 0.18s;
  }
  .aw-ccm-back:hover { color: #c8ff00; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-ccm-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-ccm-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   PROPS
───────────────────────────────────────── */
interface CourseContentManagerProps {
  course: Course;
  onBack: () => void;
}

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CourseContentManager: React.FC<CourseContentManagerProps> = ({ course, onBack }) => {
  const [sections, setSections]           = useState<CourseSection[]>([]);
  const [showModal, setShowModal]         = useState(false);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [savedOrderIds, setSavedOrderIds]   = useState<string[]>([]);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [draggingId, setDraggingId]         = useState<string | null>(null);
  const [dragOverId, setDragOverId]         = useState<string | null>(null);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  useEffect(() => { loadSections(); }, [course.id]);

  const loadSections = async () => {
    const { data } = await supabase.from("course_sections").select("*").eq("course_id", course.id).order("order_index");
    if (data) { setSections(data); setSavedOrderIds(data.map(s => s.id)); setHasOrderChanged(false); }
  };

  const hasSameOrder = (next: CourseSection[]) =>
    savedOrderIds.length === next.length && next.every((s, i) => s.id === savedOrderIds[i]);

  /* Drag handlers */
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move";
    setDraggingId(id); setDragOverId(null);
  };
  const handleDragOver  = (e: React.DragEvent) => { if (!draggingId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDragEnter = (e: React.DragEvent, id: string) => { if (!draggingId) return; e.preventDefault(); setDragOverId(id); };
  const handleDrop      = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggingId || e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) { setDraggingId(null); setDragOverId(null); return; }
    const si = sections.findIndex(s => s.id === sourceId);
    const ti = sections.findIndex(s => s.id === targetId);
    if (si === -1 || ti === -1) { setDraggingId(null); return; }
    const next = [...sections];
    const [moved] = next.splice(si, 1);
    next.splice(ti, 0, moved);
    setSections(next); setHasOrderChanged(!hasSameOrder(next));
    setDraggingId(null); setDragOverId(null);
  };

  const handleUpdateOrder = async () => {
    if (!hasOrderChanged || sections.length <= 1) return;
    setIsUpdatingOrder(true);
    try {
      const results = await Promise.all(
        sections.map((s, i) => supabase.from("course_sections").update({ order_index: i }).eq("id", s.id))
      );
      if (results.find(r => r.error)?.error) throw new Error("Failed to update order");
      const next = sections.map((s, i) => ({ ...s, order_index: i }));
      setSections(next); setSavedOrderIds(next.map(s => s.id)); setHasOrderChanged(false);
    } catch { alert("Failed to update section order"); }
    finally { setIsUpdatingOrder(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this section?")) return;
    try {
      await supabase.from("course_sections").delete().eq("id", id);
      await loadSections();
    } catch { alert("Failed to delete section"); }
  };

  /* Stats */
  const totalMins    = sections.reduce((s, sec) => s + (sec.duration_minutes || 0), 0);
  const quizCount    = sections.filter(s => s.section_type === 'QUIZ').length;
  const videoCount   = sections.filter(s => s.section_type === 'VIDEO').length;
  const articleCount = sections.filter(s => s.section_type === 'ARTICLE').length;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Back ── */}
      <div className="aw-fade-up">
        <button className="aw-ccm-back" onClick={onBack}>
          <ArrowLeft size={15} /> Back to Courses
        </button>
      </div>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ animationDelay: '0.04s', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} style={{ color: T.accent }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>Course Content</h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>{course.title}</p>
        </div>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button
            className="aw-ccm-save-order"
            onClick={handleUpdateOrder}
            disabled={!hasOrderChanged || sections.length <= 1 || isUpdatingOrder}
          >
            {isUpdatingOrder
              ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
              : <><Save size={13} /> Save Order</>
            }
          </button>
          <button className="aw-ccm-add-btn" onClick={() => { setEditingSection(null); setShowModal(true); }}>
            <Plus size={14} /> Add Section
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      {sections.length > 0 && (
        <div className="aw-fade-up" style={{ animationDelay: '0.07s', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Sections', value: sections.length,  color: T.accent  },
            { label: `${totalMins} min`,       value: null,           color: T.textMuted, icon: Clock    },
            { label: 'Videos',         value: videoCount,       color: T.blue    },
            { label: 'Articles',       value: articleCount,     color: T.green   },
            { label: 'Quizzes',        value: quizCount,        color: T.purple  },
          ].map(s => (
            <div key={s.label} style={{ padding: '7px 14px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
              {s.icon && <s.icon size={11} style={{ color: T.textMuted }} />}
              {s.value !== null && <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</span>}
              <span style={{ fontSize: 11, color: T.textMuted }}>{s.label}</span>
            </div>
          ))}

          {/* Order changed hint */}
          {hasOrderChanged && (
            <div style={{ padding: '7px 14px', background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.22)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.accent }}>
              <AlertCircle size={11} /> Order changed — click Save Order
            </div>
          )}
        </div>
      )}

      {/* ── Sections list ── */}
      {sections.length === 0 ? (
        <div className="aw-fade-up" style={{ animationDelay: '0.09s', textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={26} style={{ color: T.textMuted }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, margin: '0 0 6px' }}>No sections yet</p>
          <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 20px' }}>Click "Add Section" to create course content.</p>
          <button className="aw-ccm-add-btn" onClick={() => { setEditingSection(null); setShowModal(true); }}>
            <Plus size={13} /> Add First Section
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {sections.map((section, idx) => {
            const cfg = getTypeCfg(section.section_type);
            const Icon = cfg.icon;
            const isDragging  = draggingId === section.id;
            const isDragOver  = dragOverId === section.id && draggingId !== section.id;
            const questionCount = section.section_type === 'QUIZ' && section.content_data?.questions
              ? section.content_data.questions.length : 0;

            return (
              <div
                key={section.id}
                className={`aw-ccm-card aw-fade-up ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                style={{ animationDelay: `${idx * 0.04}s` }}
                onDragOver={handleDragOver}
                onDragEnter={e => handleDragEnter(e, section.id)}
                onDrop={e => handleDrop(e, section.id)}
              >
                {/* Type bar */}
                <div style={{ height: 2, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}40)` }} />

                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>

                  {/* Drag handle */}
                  {sections.length > 1 ? (
                    <div
                      className="aw-ccm-grip"
                      draggable
                      onDragStart={e => handleDragStart(e, section.id)}
                      onDragEnd={() => setDraggingId(null)}
                    >
                      <GripVertical size={16} />
                    </div>
                  ) : (
                    <div style={{ width: 24 }} />
                  )}

                  {/* Index badge */}
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: T.textMuted, flexShrink: 0 }}>
                    {idx + 1}
                  </div>

                  {/* Type icon */}
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} style={{ color: cfg.color }} />
                  </div>

                  {/* Content info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {section.title}
                      </span>
                      {/* Type badge */}
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, flexShrink: 0 }}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: T.textMuted, flexWrap: 'wrap' }}>
                      {section.duration_minutes > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} /> {section.duration_minutes} min
                        </span>
                      )}
                      {questionCount > 0 && (
                        <span>{questionCount} question{questionCount !== 1 ? 's' : ''}</span>
                      )}
                      {section.section_type === 'VIDEO' && section.content && (
                        <a href={section.content} target="_blank" rel="noopener noreferrer"
                          style={{ color: T.blue, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}
                          onClick={e => e.stopPropagation()}>
                          {section.content}
                        </a>
                      )}
                      {section.section_type === 'ARTICLE' && section.content && (
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                          {section.content.slice(0, 100)}{section.content.length > 100 ? '…' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                    <button className="aw-ccm-icon-btn edit" onClick={() => { setEditingSection(section); setShowModal(true); }} title="Edit section">
                      <Edit2 size={13} />
                    </button>
                    <button className="aw-ccm-icon-btn del" onClick={() => handleDelete(section.id)} title="Delete section">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Drag tip ── */}
      {sections.length > 1 && (
        <p className="aw-fade-up" style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', margin: 0 }}>
          ⠿ Drag sections to reorder, then click <strong style={{ color: T.accent }}>Save Order</strong>
        </p>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <CourseContentForm
          course={course}
          sectionsCount={sections.length}
          editingSection={editingSection}
          open={showModal}
          onClose={() => { setShowModal(false); setEditingSection(null); }}
          onSaved={loadSections}
        />
      )}
    </div>
  );
};
