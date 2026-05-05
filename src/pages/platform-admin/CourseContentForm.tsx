import React, { useEffect, useRef, useState } from 'react';
import {
  Trash2, Plus, Video, FileText, ClipboardCheck,
  X, Save, Loader2, CheckCircle,
} from 'lucide-react';
import Quill from 'quill';
import { supabase } from '../../lib/supabase';
import { Course } from '../../lib/types';

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
type SectionType = 'VIDEO' | 'ARTICLE' | 'QUIZ';
type QuizQuestion = { question: string; options: string[]; correct_answer: string; };
type CourseSectionContentData = { questions?: QuizQuestion[]; [k: string]: unknown; };

export interface CourseSection {
  id: string; course_id: string; title: string;
  section_type: SectionType; content: string;
  content_data: CourseSectionContentData;
  content_data_ar: CourseSectionContentData | null;
  title_ar: string | null; content_ar: string | null;
  duration_minutes: number; order_index: number; created_at: string;
}

interface CourseContentFormProps {
  course: Course; sectionsCount: number;
  editingSection: CourseSection | null;
  open: boolean; onClose: () => void; onSaved: () => void;
}

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
} as const;

const TYPES = [
  { key: 'VIDEO',   icon: Video,          color: T.blue,   bg: T.blueBg,   border: T.blueBorder,   label: 'Video'   },
  { key: 'ARTICLE', icon: FileText,       color: T.green,  bg: T.greenBg,  border: T.greenBorder,  label: 'Article' },
  { key: 'QUIZ',    icon: ClipboardCheck, color: T.purple, bg: T.purpleBg, border: T.purpleBorder, label: 'Quiz'    },
] as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-ccf-input, .aw-ccf-select, .aw-ccf-textarea {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-ccf-input   { padding: 11px 14px; }
  .aw-ccf-textarea { padding: 11px 14px; resize: vertical; min-height: 70px; }
  .aw-ccf-select  {
    padding: 11px 36px 11px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-ccf-input:focus, .aw-ccf-select:focus, .aw-ccf-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-ccf-input::placeholder, .aw-ccf-textarea::placeholder { color: rgba(148,163,184,0.35); }
  .aw-ccf-select option { background: #1a1e0e; color: #ffffff; }
  input[type="number"].aw-ccf-input::-webkit-inner-spin-button { filter: invert(1) opacity(0.3); }

  .aw-ccf-label {
    display: block; font-size: 12px; font-weight: 600; color: #94a3b8;
    margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif;
  }

  .aw-ccf-type-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.02); cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
    color: #64748b; transition: all 0.18s;
  }
  .aw-ccf-type-btn:hover { background: rgba(255,255,255,0.05); }

  .aw-ccf-q-card {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 14px 16px; font-family: 'Inter', sans-serif;
  }

  .aw-ccf-q-box {
    background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 18px; font-family: 'Inter', sans-serif;
  }

  /* ── Quill dark ── */
  .aw-ccf-editor-wrap .ql-toolbar {
    background: rgba(255,255,255,0.04) !important;
    border-color: rgba(255,255,255,0.09) !important;
    border-radius: 10px 10px 0 0 !important;
  }
  .aw-ccf-editor-wrap .ql-toolbar .ql-stroke { stroke: #94a3b8 !important; }
  .aw-ccf-editor-wrap .ql-toolbar .ql-fill   { fill:   #94a3b8 !important; }
  .aw-ccf-editor-wrap .ql-toolbar .ql-picker-label { color: #94a3b8 !important; }
  .aw-ccf-editor-wrap .ql-toolbar button:hover .ql-stroke { stroke: #c8ff00 !important; }
  .aw-ccf-editor-wrap .ql-toolbar button:hover .ql-fill   { fill:   #c8ff00 !important; }
  .aw-ccf-editor-wrap .ql-toolbar .ql-active .ql-stroke { stroke: #c8ff00 !important; }
  .aw-ccf-editor-wrap .ql-toolbar .ql-active .ql-fill   { fill:   #c8ff00 !important; }
  .aw-ccf-editor-wrap .ql-container {
    background: #ffffff !important;
    border-color: rgba(255,255,255,0.09) !important;
    border-radius: 0 0 10px 10px !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 14px !important; min-height: 180px;
  }
  .aw-ccf-editor-wrap .ql-editor { min-height: 180px; color: #1a1a1a !important; }
  .aw-ccf-editor-wrap .ql-editor.ql-blank::before { color: #9ca3af !important; font-style: normal !important; }

  /* ── Buttons ── */
  .aw-ccf-save-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-ccf-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-ccf-cancel-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 13px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-ccf-cancel-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  .aw-ccf-add-q-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 11px 16px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.25);
    color: #34d399; transition: all 0.18s;
  }
  .aw-ccf-add-q-btn:hover { background: rgba(52,211,153,0.18); }

  .aw-ccf-opt-radio {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 13px; border-radius: 8px; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02); transition: all 0.18s;
  }
  .aw-ccf-opt-radio.correct { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.28); }
  .aw-ccf-opt-radio:hover:not(.correct) { background: rgba(255,255,255,0.04); }

  /* ════════════════════════════════════
     SCROLLBAR — visible, mouse-friendly
  ════════════════════════════════════ */
  .aw-ccf-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(200,255,0,0.30) rgba(255,255,255,0.04);
  }
  .aw-ccf-scroll::-webkit-scrollbar { width: 6px; }
  .aw-ccf-scroll::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.03);
    border-radius: 9999px;
    margin: 4px 0;
  }
  .aw-ccf-scroll::-webkit-scrollbar-thumb {
    background: rgba(200,255,0,0.28);
    border-radius: 9999px;
    border: 1px solid rgba(200,255,0,0.10);
  }
  .aw-ccf-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(200,255,0,0.50);
  }

  /* Same for the questions list scroll */
  .aw-ccf-qlist-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(200,255,0,0.25) transparent;
  }
  .aw-ccf-qlist-scroll::-webkit-scrollbar { width: 5px; }
  .aw-ccf-qlist-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-ccf-qlist-scroll::-webkit-scrollbar-thumb {
    background: rgba(200,255,0,0.25);
    border-radius: 9999px;
  }
  .aw-ccf-qlist-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(200,255,0,0.45);
  }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(14px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-ccf-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-ccf-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   DEFAULTS
───────────────────────────────────────── */
const defaultForm = {
  title: '', title_ar: '',
  section_type: 'VIDEO' as SectionType,
  content: '', content_ar: '',
  duration_minutes: 10,
};
const defaultQ = { question: '', option1: '', option2: '', option3: '', option4: '', correct_answer: '' };

/* ─────────────────────────────────────────
   SECTION BLOCK
───────────────────────────────────────── */
const SectionBlock: React.FC<{
  title: string; subtitle?: string;
  icon?: React.ElementType; color?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, color = T.accent, children }) => (
  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 9 }}>
      {Icon && (
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} style={{ color }} />
        </div>
      )}
      <div>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{subtitle}</span>}
      </div>
    </div>
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      {children}
    </div>
  </div>
);

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const CourseContentForm: React.FC<CourseContentFormProps> = ({
  course, sectionsCount, editingSection, open, onClose, onSaved,
}) => {
  const [form, setForm]               = useState({ ...defaultForm });
  const [quizQ, setQuizQ]             = useState<QuizQuestion[]>([]);
  const [quizQAr, setQuizQAr]         = useState<QuizQuestion[]>([]);
  const [curQ, setCurQ]               = useState({ ...defaultQ });
  const [curQAr, setCurQAr]           = useState({ ...defaultQ });
  const [articlePt, setArticlePt]     = useState('');
  const [articlePtAr, setArticlePtAr] = useState('');
  const [saving, setSaving]           = useState(false);

  const quillRef    = useRef<HTMLDivElement | null>(null);
  const quillInst   = useRef<Quill | null>(null);
  const quillArRef  = useRef<HTMLDivElement | null>(null);
  const quillArInst = useRef<Quill | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingSection) {
      setForm({
        title: editingSection.title, title_ar: editingSection.title_ar || '',
        section_type: editingSection.section_type,
        content: editingSection.content || '', content_ar: editingSection.content_ar || '',
        duration_minutes: editingSection.duration_minutes,
      });
      setQuizQ(editingSection.section_type === 'QUIZ' ? editingSection.content_data?.questions || [] : []);
      setQuizQAr(editingSection.section_type === 'QUIZ' ? editingSection.content_data_ar?.questions || [] : []);
    } else {
      setForm({ ...defaultForm }); setQuizQ([]); setQuizQAr([]);
    }
    setCurQ({ ...defaultQ }); setCurQAr({ ...defaultQ });
  }, [editingSection, open]);

  useEffect(() => {
    if (open && form.section_type === 'ARTICLE') return;
    quillInst.current = null; quillArInst.current = null;
    setArticlePt(''); setArticlePtAr('');
  }, [form.section_type, open]);

  useEffect(() => {
    if (!open || form.section_type !== 'ARTICLE' || !quillRef.current) return;
    if (!quillInst.current) {
      quillInst.current = new Quill(quillRef.current, { theme: 'snow', placeholder: 'Write article content here…', modules: { toolbar: [[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'blockquote', 'code-block'], ['clean']] } });
      quillInst.current.on('text-change', () => {
        const html = quillInst.current!.root.innerHTML;
        const pt   = quillInst.current!.getText().trim();
        setForm(p => p.content === html ? p : { ...p, content: html });
        setArticlePt(pt);
      });
    }
    const q = quillInst.current;
    const incoming = form.content || '';
    if (incoming && incoming !== q.root.innerHTML) { q.clipboard.dangerouslyPasteHTML(incoming); setArticlePt(q.getText().trim()); }
    else if (!incoming && q.root.innerHTML !== '<p><br></p>') { q.setText(''); setArticlePt(''); }
  }, [form.content, form.section_type, open]);

  useEffect(() => {
    if (!open || form.section_type !== 'ARTICLE' || !quillArRef.current) return;
    if (!quillArInst.current) {
      quillArInst.current = new Quill(quillArRef.current, { theme: 'snow', placeholder: 'Write Arabic article content here…', modules: { toolbar: [[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'blockquote', 'code-block'], ['clean']] } });
      quillArInst.current.root.setAttribute('dir', 'rtl');
      quillArInst.current.root.style.textAlign = 'right';
      quillArInst.current.on('text-change', () => {
        const html = quillArInst.current!.root.innerHTML;
        const pt   = quillArInst.current!.getText().trim();
        setForm(p => p.content_ar === html ? p : { ...p, content_ar: html });
        setArticlePtAr(pt);
      });
    }
    const q = quillArInst.current;
    const incoming = form.content_ar || '';
    if (incoming && incoming !== q.root.innerHTML) { q.clipboard.dangerouslyPasteHTML(incoming); setArticlePtAr(q.getText().trim()); }
    else if (!incoming && q.root.innerHTML !== '<p><br></p>') { q.setText(''); setArticlePtAr(''); }
  }, [form.content_ar, form.section_type, open]);

  if (!open) return null;

  const buildQ = (d: typeof defaultQ): QuizQuestion | null => {
    const opts = [d.option1, d.option2, d.option3, d.option4].filter(o => o.trim());
    if (!d.question.trim())             { alert('Question is required'); return null; }
    if (opts.length < 2)                { alert('At least 2 options required'); return null; }
    if (!opts.includes(d.correct_answer)) { alert('Correct answer must match one of the options'); return null; }
    return { question: d.question, options: opts, correct_answer: d.correct_answer };
  };

  const handleAddQ   = () => { const q = buildQ(curQ);   if (!q) return; setQuizQ(prev => [...prev, q]);   setCurQ({ ...defaultQ }); };
  const handleAddQAr = () => { const q = buildQ(curQAr); if (!q) return; setQuizQAr(prev => [...prev, q]); setCurQAr({ ...defaultQ }); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.section_type === 'ARTICLE' && !articlePt.trim()) { alert('Article content is required'); return; }
    if (form.section_type === 'QUIZ' && quizQ.length === 0)   { alert('At least one question required'); return; }
    setSaving(true);
    try {
      const contentData   = form.section_type === 'QUIZ' ? { questions: quizQ } : {};
      const contentDataAr = form.section_type === 'QUIZ' && quizQAr.length > 0 ? { questions: quizQAr } : contentData;
      const contentAr     = form.section_type === 'ARTICLE'
        ? (articlePtAr.trim() ? form.content_ar : form.content)
        : (form.content_ar.trim() || form.content);
      const payload = {
        ...form,
        title_ar: form.title_ar.trim() || form.title.trim(),
        content_ar: contentAr, course_id: course.id,
        content_data: contentData, content_data_ar: contentDataAr,
        order_index: editingSection ? editingSection.order_index : sectionsCount,
      };
      if (editingSection) {
        const { error } = await supabase.from('course_sections').update(payload).eq('id', editingSection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('course_sections').insert([payload]);
        if (error) throw error;
      }
      onClose(); onSaved();
    } catch (err) { console.error(err); alert('Failed to save section'); }
    finally { setSaving(false); }
  };

  const typeCfg = TYPES.find(t => t.key === form.section_type) ?? TYPES[0];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        background: 'rgba(10,12,6,0.86)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      {/*
        ════════════════════════════════════════════════════════
        KEY FIX: The modal is a flex column with maxHeight.
        - overflow: hidden on the outer div (clip sides, allow inner scroll)
        - The form uses flex:1 + minHeight:0 so it can shrink
        - The scrollable body uses flex:1 + minHeight:0 + overflowY:auto
        ════════════════════════════════════════════════════════
      */}
      <div
        className="aw-modal-in"
        style={{
          width: '100%', maxWidth: 760,
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          /* ✅ No overflow:hidden here — let the inner form body scroll */
          maxHeight: '94vh',
          boxShadow: '0 40px 100px rgba(0,0,0,0.60)',
          fontFamily: "'Inter', sans-serif",
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))', borderRadius: '18px 18px 0 0', flexShrink: 0 }} />

        {/* Sticky header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${T.borderFaint}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          background: T.bgCard,
          borderRadius: '0',
          zIndex: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: typeCfg.bg, border: `1px solid ${typeCfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <typeCfg.icon size={16} style={{ color: typeCfg.color }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: T.white, margin: 0 }}>
                {editingSection ? 'Edit Section' : 'Add New Section'}
              </h2>
              <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{course.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Form — flex:1 + minHeight:0 is the critical fix */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            minHeight: 0,          /* ✅ KEY FIX: allows flex child to shrink and scroll */
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Scrollable body — flex:1 + minHeight:0 + overflowY:auto */}
          <div
            className="aw-ccf-scroll"
            style={{
              flex: 1,
              minHeight: 0,         /* ✅ KEY FIX */
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Section Type picker */}
            <div>
              <label className="aw-ccf-label">Section Type <span style={{ color: T.accent }}>*</span></label>
              <div style={{ display: 'flex', gap: 9 }}>
                {TYPES.map(({ key, icon: Icon, color, bg, border, label }) => {
                  const active = form.section_type === key;
                  return (
                    <button key={key} type="button"
                      className="aw-ccf-type-btn"
                      style={{ background: active ? bg : 'rgba(255,255,255,0.02)', borderColor: active ? border : 'rgba(255,255,255,0.08)', color: active ? color : T.textMuted }}
                      onClick={() => { setForm(p => ({ ...p, section_type: key as SectionType })); setQuizQ([]); setQuizQAr([]); }}>
                      <Icon size={14} style={{ color: active ? color : T.textMuted }} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Basic Info */}
            <SectionBlock title="Basic Info" icon={FileText} color={T.accent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                <div>
                  <label className="aw-ccf-label">Title (English) <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-ccf-input" type="text" required placeholder="e.g. Introduction to Cybersecurity" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <label className="aw-ccf-label">Title (Arabic) <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                  <input className="aw-ccf-input" type="text" dir="rtl" placeholder="العنوان بالعربي" value={form.title_ar} onChange={e => setForm(p => ({ ...p, title_ar: e.target.value }))} />
                </div>
                <div>
                  <label className="aw-ccf-label">Duration (minutes) <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-ccf-input" type="number" required min="1" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
            </SectionBlock>

            {/* VIDEO */}
            {form.section_type === 'VIDEO' && (
              <SectionBlock title="Video Links" icon={Video} color={T.blue}>
                <div>
                  <label className="aw-ccf-label">Video URL (English) <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-ccf-input" type="url" required placeholder="https://youtube.com/watch?v=…" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
                </div>
                <div>
                  <label className="aw-ccf-label">Video URL (Arabic) <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                  <input className="aw-ccf-input" type="url" placeholder="Falls back to English URL" value={form.content_ar} onChange={e => setForm(p => ({ ...p, content_ar: e.target.value }))} />
                </div>
              </SectionBlock>
            )}

            {/* ARTICLE */}
            {form.section_type === 'ARTICLE' && (
              <SectionBlock title="Article Content" icon={FileText} color={T.green}>
                <div>
                  <label className="aw-ccf-label">Content (English) <span style={{ color: T.accent }}>*</span></label>
                  <div className="aw-ccf-editor-wrap"><div ref={quillRef} /></div>
                </div>
                <div>
                  <label className="aw-ccf-label">Content (Arabic) <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                  <div className="aw-ccf-editor-wrap"><div ref={quillArRef} dir="rtl" /></div>
                </div>
              </SectionBlock>
            )}

            {/* QUIZ */}
            {form.section_type === 'QUIZ' && (
              <>
                <QuizBuilder
                  title="English Questions" badge={`${quizQ.length} added`} color={T.blue}
                  questions={quizQ} current={curQ} setCurrent={setCurQ}
                  onAdd={handleAddQ} onRemove={i => setQuizQ(prev => prev.filter((_, j) => j !== i))}
                  rtl={false}
                />
                <QuizBuilder
                  title="Arabic Questions" badge={`${quizQAr.length} added`} color={T.purple}
                  questions={quizQAr} current={curQAr} setCurrent={setCurQAr}
                  onAdd={handleAddQAr} onRemove={i => setQuizQAr(prev => prev.filter((_, j) => j !== i))}
                  rtl={true} placeholder="Uses English questions when left blank"
                />
              </>
            )}
          </div>

          {/* Sticky footer */}
          <div style={{
            padding: '14px 24px',
            borderTop: `1px solid ${T.borderFaint}`,
            display: 'flex', gap: 10,
            flexShrink: 0,
            background: T.bgCard,
          }}>
            <button type="button" className="aw-ccf-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="aw-ccf-save-btn" disabled={saving}>
              {saving
                ? <><Loader2 size={15} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
                : <><Save size={15} /> {editingSection ? 'Update Section' : 'Save Section'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   QUIZ BUILDER
───────────────────────────────────────── */
const QuizBuilder: React.FC<{
  title: string; badge: string; color: string;
  questions: QuizQuestion[];
  current: typeof defaultQ;
  setCurrent: (q: typeof defaultQ) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  rtl: boolean;
  placeholder?: string;
}> = ({ title, badge, color, questions, current, setCurrent, onAdd, onRemove, rtl, placeholder }) => (
  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 13, overflow: 'hidden' }}>
    {/* Header */}
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 9 }}>
      <ClipboardCheck size={13} style={{ color }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{title}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color, fontWeight: 700 }}>{badge}</span>
    </div>

    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Questions list — scrollable, max 320px ── */}
      {questions.length > 0 && (
        <div
          className="aw-ccf-qlist-scroll"
          style={{
            maxHeight: 320,        /* ✅ показывает ~3 вопроса, остальные скроллятся */
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingRight: 4,       /* пространство для скроллбара */
          }}
        >
          {questions.map((q, idx) => (
            <div key={idx} className="aw-ccf-q-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.white, direction: rtl ? 'rtl' : 'ltr' }}>
                  {idx + 1}. {q.question}
                </span>
                <button type="button" onClick={() => onRemove(idx)}
                  style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', flexShrink: 0 }}>
                  <Trash2 size={11} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, direction: rtl ? 'rtl' : 'ltr' }}>
                {q.options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 7, background: opt === q.correct_answer ? T.greenBg : 'rgba(255,255,255,0.02)', border: `1px solid ${opt === q.correct_answer ? T.greenBorder : T.borderFaint}`, fontSize: 12, color: opt === q.correct_answer ? T.green : T.textBody }}>
                    {opt === q.correct_answer && <CheckCircle size={11} style={{ flexShrink: 0 }} />}
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add question form — always visible ── */}
      <div className="aw-ccf-q-box">
        <p style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 12 }}>+ New Question</p>

        <div style={{ marginBottom: 10 }}>
          <label className="aw-ccf-label">Question <span style={{ color: T.accent }}>*</span></label>
          <textarea
            className="aw-ccf-textarea" rows={2}
            dir={rtl ? 'rtl' : 'ltr'}
            placeholder={placeholder || 'Enter question here…'}
            value={current.question}
            onChange={e => setCurrent({ ...current, question: e.target.value })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          {([['option1','Option 1 *'],['option2','Option 2 *'],['option3','Option 3'],['option4','Option 4']] as [keyof typeof defaultQ, string][]).map(([key, label]) => (
            <div key={key}>
              <label className="aw-ccf-label">{label}</label>
              <input
                className="aw-ccf-input" type="text"
                dir={rtl ? 'rtl' : 'ltr'}
                value={current[key] as string}
                onChange={e => setCurrent({ ...current, [key]: e.target.value })}
                style={{ fontSize: 13 }}
              />
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="aw-ccf-label">Correct Answer <span style={{ color: T.accent }}>*</span></label>
          {[current.option1, current.option2, current.option3, current.option4].filter(o => o.trim()).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[current.option1, current.option2, current.option3, current.option4]
                .filter(o => o.trim())
                .map((opt, i) => (
                  <div
                    key={i}
                    className={`aw-ccf-opt-radio ${current.correct_answer === opt ? 'correct' : ''}`}
                    onClick={() => setCurrent({ ...current, correct_answer: opt })}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${current.correct_answer === opt ? T.green : 'rgba(255,255,255,0.20)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color 0.18s' }}>
                      {current.correct_answer === opt && <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green }} />}
                    </div>
                    <span style={{ fontSize: 13, color: current.correct_answer === opt ? T.green : T.textBody, direction: rtl ? 'rtl' : 'ltr' }}>{opt}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: T.textMuted, padding: '8px 0' }}>Fill in options above to select the correct answer</p>
          )}
        </div>

        <button type="button" className="aw-ccf-add-q-btn" onClick={onAdd}>
          <Plus size={13} /> Add Question to List
        </button>
      </div>
    </div>
  </div>
);

