import React, { useEffect, useRef, useState } from 'react';
import {
  Trash2, Plus, Video, FileText, ClipboardCheck,
  X, Save, Loader2, CheckCircle, ChevronDown,
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
    width:100%; background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.09); border-radius:10px;
    font-size:14px; color:#fff; font-family:'Inter',sans-serif; outline:none;
    transition:border-color .2s, box-shadow .2s, background .2s;
  }
  .aw-ccf-input   { padding:11px 14px; }
  .aw-ccf-textarea { padding:11px 14px; resize:vertical; }
  .aw-ccf-select  {
    padding:11px 36px 11px 14px; cursor:pointer; appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 12px center;
  }
  .aw-ccf-input:focus,.aw-ccf-select:focus,.aw-ccf-textarea:focus {
    border-color:rgba(200,255,0,.45); box-shadow:0 0 0 3px rgba(200,255,0,.07); background:rgba(255,255,255,.06);
  }
  .aw-ccf-input::placeholder,.aw-ccf-textarea::placeholder { color:rgba(148,163,184,.35); }
  .aw-ccf-select option { background:#1a1e0e; color:#fff; }
  input[type="number"].aw-ccf-input::-webkit-inner-spin-button { filter:invert(1) opacity(.3); }
  .aw-ccf-label { display:block; font-size:12px; font-weight:600; color:#94a3b8; margin-bottom:7px; letter-spacing:.3px; font-family:'Inter',sans-serif; }

  .aw-ccf-type-btn {
    flex:1; display:flex; align-items:center; justify-content:center; gap:8px;
    padding:12px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.08);
    background:rgba(255,255,255,.02); cursor:pointer; font-size:13px; font-weight:600;
    font-family:'Inter',sans-serif; color:#64748b; transition:all .18s;
  }
  .aw-ccf-type-btn:hover { background:rgba(255,255,255,.05); }

  /* Quill dark */
  .aw-ccf-editor-wrap .ql-toolbar {
    background:rgba(255,255,255,.04) !important; border-color:rgba(255,255,255,.09) !important;
    border-radius:10px 10px 0 0 !important;
  }
  .aw-ccf-editor-wrap .ql-toolbar .ql-stroke { stroke:#94a3b8 !important; }
  .aw-ccf-editor-wrap .ql-toolbar .ql-fill   { fill:  #94a3b8 !important; }
  .aw-ccf-editor-wrap .ql-toolbar .ql-picker-label { color:#94a3b8 !important; }
  .aw-ccf-editor-wrap .ql-toolbar button:hover .ql-stroke { stroke:#c8ff00 !important; }
  .aw-ccf-editor-wrap .ql-toolbar button:hover .ql-fill   { fill:  #c8ff00 !important; }
  .aw-ccf-editor-wrap .ql-toolbar .ql-active .ql-stroke { stroke:#c8ff00 !important; }
  .aw-ccf-editor-wrap .ql-toolbar .ql-active .ql-fill   { fill:  #c8ff00 !important; }
  .aw-ccf-editor-wrap .ql-container {
    background:#fff !important; border-color:rgba(255,255,255,.09) !important;
    border-radius:0 0 10px 10px !important; font-family:'Inter',sans-serif !important;
    font-size:14px !important; min-height:200px;
  }
  .aw-ccf-editor-wrap .ql-editor { min-height:200px; color:#1a1a1a !important; }
  .aw-ccf-editor-wrap .ql-editor.ql-blank::before { color:#9ca3af !important; font-style:normal !important; }

  /* Quiz lang tabs */
  .aw-ccf-lang-tab {
    flex:1; padding:9px 14px; border-radius:8px; border:1px solid rgba(255,255,255,.08);
    background:rgba(255,255,255,.02); cursor:pointer; font-size:12px; font-weight:700;
    font-family:'Inter',sans-serif; color:#64748b; transition:all .18s;
    display:flex; align-items:center; justify-content:center; gap:6px;
  }
  .aw-ccf-lang-tab.active { background:rgba(200,255,0,.08); border-color:rgba(200,255,0,.28); color:#c8ff00; }
  .aw-ccf-lang-tab:hover:not(.active) { background:rgba(255,255,255,.05); }

  /* Question card */
  .aw-ccf-q-card {
    background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.07);
    border-radius:10px; padding:11px 13px; font-family:'Inter',sans-serif;
  }

  /* Option radio */
  .aw-ccf-opt { display:flex; align-items:center; gap:8px; padding:7px 11px; border-radius:8px; cursor:pointer; border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.02); transition:all .15s; }
  .aw-ccf-opt.correct { background:rgba(52,211,153,.08); border-color:rgba(52,211,153,.28); }
  .aw-ccf-opt:hover:not(.correct) { background:rgba(255,255,255,.04); }

  /* Buttons */
  .aw-ccf-save-btn {
    flex:1; display:flex; align-items:center; justify-content:center; gap:8px;
    padding:13px 20px; border-radius:10px; border:none; cursor:pointer;
    font-size:14px; font-weight:700; font-family:'Inter',sans-serif;
    background:#c8ff00; color:#12140a; box-shadow:0 0 18px rgba(200,255,0,.20);
    transition:opacity .2s, transform .15s;
  }
  .aw-ccf-save-btn:hover { opacity:.88; transform:translateY(-1px); }
  .aw-ccf-save-btn:disabled { background:rgba(255,255,255,.08); color:rgba(255,255,255,.25); cursor:not-allowed; box-shadow:none; }
  .aw-ccf-cancel-btn {
    display:inline-flex; align-items:center; justify-content:center; gap:7px;
    padding:13px 20px; border-radius:10px; cursor:pointer; font-size:14px; font-weight:600;
    font-family:'Inter',sans-serif; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
    color:#94a3b8; transition:all .18s;
  }
  .aw-ccf-cancel-btn:hover { background:rgba(255,255,255,.08); color:#fff; }
  .aw-ccf-add-q-btn {
    width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
    padding:10px 16px; border-radius:9px; cursor:pointer; font-size:13px; font-weight:700;
    font-family:'Inter',sans-serif; background:rgba(52,211,153,.10);
    border:1px solid rgba(52,211,153,.25); color:#34d399; transition:all .18s;
  }
  .aw-ccf-add-q-btn:hover { background:rgba(52,211,153,.18); }

  /* Scrollbars */
  .aw-ccf-scroll {
    scrollbar-width:thin; scrollbar-color:rgba(200,255,0,.28) rgba(255,255,255,.03);
  }
  .aw-ccf-scroll::-webkit-scrollbar { width:6px; }
  .aw-ccf-scroll::-webkit-scrollbar-track { background:rgba(255,255,255,.03); border-radius:9999px; margin:4px 0; }
  .aw-ccf-scroll::-webkit-scrollbar-thumb { background:rgba(200,255,0,.28); border-radius:9999px; }
  .aw-ccf-scroll::-webkit-scrollbar-thumb:hover { background:rgba(200,255,0,.50); }

  .aw-ccf-qscroll { scrollbar-width:thin; scrollbar-color:rgba(200,255,0,.20) transparent; }
  .aw-ccf-qscroll::-webkit-scrollbar { width:4px; }
  .aw-ccf-qscroll::-webkit-scrollbar-track { background:transparent; }
  .aw-ccf-qscroll::-webkit-scrollbar-thumb { background:rgba(200,255,0,.20); border-radius:9999px; }

  @keyframes aw-spin    { to { transform:rotate(360deg); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(.97) translateY(14px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-modal-in { animation:aw-modal-in .28s ease both; }
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
   SECTION BLOCK WRAPPER
───────────────────────────────────────── */
const SectionBlock: React.FC<{
  title: string; icon?: React.ElementType; color?: string; children: React.ReactNode;
}> = ({ title, icon: Icon, color = T.accent, children }) => (
  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8 }}>
      {Icon && (
        <div style={{ width: 22, height: 22, borderRadius: 5, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={11} style={{ color }} />
        </div>
      )}
      <span style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{title}</span>
    </div>
    <div style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
  const [quizLang, setQuizLang]       = useState<'en' | 'ar'>('en');
  const [addQOpen, setAddQOpen]       = useState(true);

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
    setQuizLang('en'); setAddQOpen(true);
  }, [editingSection, open]);

  useEffect(() => {
    if (open && form.section_type === 'ARTICLE') return;
    quillInst.current = null; quillArInst.current = null;
    setArticlePt(''); setArticlePtAr('');
  }, [form.section_type, open]);

  useEffect(() => {
    if (!open || form.section_type !== 'ARTICLE' || !quillRef.current) return;
    if (!quillInst.current) {
      quillInst.current = new Quill(quillRef.current, {
        theme: 'snow', placeholder: 'Write article content in English…',
        modules: { toolbar: [[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'blockquote'], ['clean']] }
      });
      quillInst.current.on('text-change', () => {
        const html = quillInst.current!.root.innerHTML;
        setForm(p => p.content === html ? p : { ...p, content: html });
        setArticlePt(quillInst.current!.getText().trim());
      });
    }
    const q = quillInst.current;
    const inc = form.content || '';
    if (inc && inc !== q.root.innerHTML) { q.clipboard.dangerouslyPasteHTML(inc); setArticlePt(q.getText().trim()); }
    else if (!inc && q.root.innerHTML !== '<p><br></p>') { q.setText(''); setArticlePt(''); }
  }, [form.content, form.section_type, open]);

  useEffect(() => {
    if (!open || form.section_type !== 'ARTICLE' || !quillArRef.current) return;
    if (!quillArInst.current) {
      quillArInst.current = new Quill(quillArRef.current, {
        theme: 'snow', placeholder: 'اكتب محتوى المقال بالعربية…',
        modules: { toolbar: [[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'blockquote'], ['clean']] }
      });
      quillArInst.current.root.setAttribute('dir', 'rtl');
      quillArInst.current.root.style.textAlign = 'right';
      quillArInst.current.on('text-change', () => {
        const html = quillArInst.current!.root.innerHTML;
        setForm(p => p.content_ar === html ? p : { ...p, content_ar: html });
        setArticlePtAr(quillArInst.current!.getText().trim());
      });
    }
    const q = quillArInst.current;
    const inc = form.content_ar || '';
    if (inc && inc !== q.root.innerHTML) { q.clipboard.dangerouslyPasteHTML(inc); setArticlePtAr(q.getText().trim()); }
    else if (!inc && q.root.innerHTML !== '<p><br></p>') { q.setText(''); setArticlePtAr(''); }
  }, [form.content_ar, form.section_type, open]);

  if (!open) return null;

  /* ── Quiz helpers ── */
  const isAr = quizLang === 'ar';
  const curQState    = isAr ? curQAr : curQ;
  const setCurQState = isAr ? setCurQAr : setCurQ;
  const activeQList  = isAr ? quizQAr : quizQ;
  const removeQ      = (i: number) => isAr
    ? setQuizQAr(p => p.filter((_, j) => j !== i))
    : setQuizQ(p => p.filter((_, j) => j !== i));

  const buildQ = (d: typeof defaultQ): QuizQuestion | null => {
    const opts = [d.option1, d.option2, d.option3, d.option4].filter(o => o.trim());
    if (!d.question.trim())               { alert('Question is required'); return null; }
    if (opts.length < 2)                  { alert('At least 2 options required'); return null; }
    if (!opts.includes(d.correct_answer)) { alert('Correct answer must match one of the options'); return null; }
    return { question: d.question, options: opts, correct_answer: d.correct_answer };
  };

  const handleAddQ = () => {
    const q = buildQ(curQState); if (!q) return;
    if (isAr) setQuizQAr(p => [...p, q]); else setQuizQ(p => [...p, q]);
    setCurQState({ ...defaultQ });
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.section_type === 'ARTICLE' && !articlePt.trim()) { alert('Article content (English) is required'); return; }
    if (form.section_type === 'QUIZ' && quizQ.length === 0)   { alert('At least one English question required'); return; }
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
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.86)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="aw-modal-in"
        dir="ltr"
        style={{ width: '100%', maxWidth: 740, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 18, maxHeight: '94vh', boxShadow: '0 40px 100px rgba(0,0,0,0.60)', fontFamily: "'Inter',sans-serif", display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,#c8ff00,rgba(200,255,0,0.20))', borderRadius: '18px 18px 0 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: typeCfg.bg, border: `1px solid ${typeCfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <typeCfg.icon size={15} style={{ color: typeCfg.color }} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 900, color: T.white, margin: 0 }}>{editingSection ? 'Edit Section' : 'Add New Section'}</h2>
              <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{course.title}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
            <X size={13} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="aw-ccf-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Type selector */}
            <div>
              <label className="aw-ccf-label">Section Type <span style={{ color: T.accent }}>*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                {TYPES.map(({ key, icon: Icon, color, bg, border, label }) => {
                  const active = form.section_type === key;
                  return (
                    <button key={key} type="button" className="aw-ccf-type-btn"
                      style={{ background: active ? bg : 'rgba(255,255,255,.02)', borderColor: active ? border : 'rgba(255,255,255,.08)', color: active ? color : T.textMuted }}
                      onClick={() => { setForm(p => ({ ...p, section_type: key as SectionType })); setQuizQ([]); setQuizQAr([]); }}>
                      <Icon size={14} style={{ color: active ? color : T.textMuted }} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Basic Info */}
            <SectionBlock title="Basic Info" icon={FileText} color={T.accent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="aw-ccf-label">Title (English) <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-ccf-input" type="text" required placeholder="Section title…" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <label className="aw-ccf-label">Title (Arabic) <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                  <input className="aw-ccf-input" type="text" dir="rtl" placeholder="العنوان بالعربي" value={form.title_ar} onChange={e => setForm(p => ({ ...p, title_ar: e.target.value }))} />
                </div>
              </div>
              <div style={{ maxWidth: 180 }}>
                <label className="aw-ccf-label">Duration (minutes) <span style={{ color: T.accent }}>*</span></label>
                <input className="aw-ccf-input" type="number" required min="1" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 1 }))} />
              </div>
            </SectionBlock>

            {/* ══ VIDEO ══ */}
            {form.section_type === 'VIDEO' && (
              <SectionBlock title="Video Links" icon={Video} color={T.blue}>
                <div>
                  <label className="aw-ccf-label">Video URL (English) <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-ccf-input" type="url" required placeholder="https://youtube.com/watch?v=…" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
                </div>
                <div>
                  <label className="aw-ccf-label">Video URL (Arabic) <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                  <input className="aw-ccf-input" type="url" placeholder="Falls back to English" value={form.content_ar} onChange={e => setForm(p => ({ ...p, content_ar: e.target.value }))} />
                </div>
              </SectionBlock>
            )}

            {/* ══ ARTICLE ══ */}
            {form.section_type === 'ARTICLE' && (
              <SectionBlock title="Article Content" icon={FileText} color={T.green}>
                <div>
                  <label className="aw-ccf-label">English Content <span style={{ color: T.accent }}>*</span></label>
                  <div className="aw-ccf-editor-wrap"><div ref={quillRef} /></div>
                </div>
                <div>
                  <label className="aw-ccf-label">Arabic Content <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                  <div className="aw-ccf-editor-wrap"><div ref={quillArRef} dir="rtl" /></div>
                </div>
              </SectionBlock>
            )}

            {/* ══ QUIZ ══ */}
            {form.section_type === 'QUIZ' && (
              <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>

                {/* Quiz header */}
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ClipboardCheck size={11} style={{ color: T.purple }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.white }}>Quiz Questions</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, display: 'flex', gap: 10 }}>
                    <span style={{ color: T.blue }}>EN: {quizQ.length}</span>
                    <span style={{ color: T.purple }}>AR: {quizQAr.length}</span>
                  </div>
                </div>

                <div style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* Language tabs */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className={`aw-ccf-lang-tab ${quizLang === 'en' ? 'active' : ''}`} onClick={() => setQuizLang('en')}>
                      🇬🇧 English {quizQ.length > 0 && <span style={{ background: 'rgba(200,255,0,.12)', padding: '1px 7px', borderRadius: 9999, fontSize: 10 }}>{quizQ.length}</span>}
                    </button>
                    <button type="button" className={`aw-ccf-lang-tab ${quizLang === 'ar' ? 'active' : ''}`} onClick={() => setQuizLang('ar')}>
                      🇸🇦 Arabic {quizQAr.length > 0 && <span style={{ background: 'rgba(200,255,0,.12)', padding: '1px 7px', borderRadius: 9999, fontSize: 10 }}>{quizQAr.length}</span>}
                    </button>
                  </div>

                  {isAr && (
                    <p style={{ fontSize: 11, color: T.purple, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, borderRadius: 7, padding: '7px 11px', margin: 0 }}>
                      Arabic questions are optional — falls back to English if left empty.
                    </p>
                  )}

                  {/* Questions list — scrollable */}
                  {activeQList.length > 0 && (
                    <div className="aw-ccf-qscroll" style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7, paddingRight: 3 }}>
                      {activeQList.map((q, idx) => (
                        <div key={idx} className="aw-ccf-q-card">
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.white, direction: isAr ? 'rtl' : 'ltr', flex: 1, lineHeight: '18px' }}>
                              {idx + 1}. {q.question}
                            </span>
                            <button type="button" onClick={() => removeQ(idx)}
                              style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', flexShrink: 0 }}>
                              <Trash2 size={10} />
                            </button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, direction: isAr ? 'rtl' : 'ltr' }}>
                            {q.options.map((opt, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 6, background: opt === q.correct_answer ? T.greenBg : 'rgba(255,255,255,.02)', border: `1px solid ${opt === q.correct_answer ? T.greenBorder : T.borderFaint}`, fontSize: 12, color: opt === q.correct_answer ? T.green : T.textBody }}>
                                {opt === q.correct_answer && <CheckCircle size={9} style={{ flexShrink: 0 }} />}
                                {opt}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeQList.length === 0 && (
                    <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '12px 0', margin: 0 }}>
                      No {isAr ? 'Arabic' : 'English'} questions yet
                    </p>
                  )}

                  {/* Add question collapsible */}
                  <div style={{ border: `1px solid rgba(255,255,255,.07)`, borderRadius: 10, overflow: 'hidden' }}>
                    <button type="button"
                      onClick={() => setAddQOpen(p => !p)}
                      style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: addQOpen ? 'rgba(200,255,0,.04)' : 'rgba(255,255,255,.02)', border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: addQOpen ? T.accent : T.textMuted }}>+ New Question</span>
                      <ChevronDown size={13} style={{ color: T.textMuted, transform: addQOpen ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }} />
                    </button>

                    {addQOpen && (
                      <div style={{ padding: '12px 14px', borderTop: `1px solid rgba(255,255,255,.06)`, display: 'flex', flexDirection: 'column', gap: 10 }}>

                        {/* Question text */}
                        <div>
                          <label className="aw-ccf-label">Question <span style={{ color: T.accent }}>*</span></label>
                          <textarea className="aw-ccf-textarea" rows={2} dir={isAr ? 'rtl' : 'ltr'}
                            placeholder={isAr ? 'اكتب السؤال هنا…' : 'Enter question here…'}
                            style={{ minHeight: 52 }}
                            value={curQState.question}
                            onChange={e => setCurQState({ ...curQState, question: e.target.value })} />
                        </div>

                        {/* Options */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                          {([['option1','Option 1 *'],['option2','Option 2 *'],['option3','Option 3'],['option4','Option 4']] as [keyof typeof defaultQ, string][]).map(([key, label]) => (
                            <div key={key}>
                              <label className="aw-ccf-label">{label}</label>
                              <input className="aw-ccf-input" type="text" style={{ fontSize: 13 }}
                                dir={isAr ? 'rtl' : 'ltr'}
                                value={curQState[key] as string}
                                onChange={e => setCurQState({ ...curQState, [key]: e.target.value })} />
                            </div>
                          ))}
                        </div>

                        {/* Correct answer */}
                        <div>
                          <label className="aw-ccf-label">Correct Answer <span style={{ color: T.accent }}>*</span></label>
                          {[curQState.option1, curQState.option2, curQState.option3, curQState.option4].filter(o => o.trim()).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {[curQState.option1, curQState.option2, curQState.option3, curQState.option4]
                                .filter(o => o.trim())
                                .map((opt, i) => (
                                  <div key={i} className={`aw-ccf-opt ${curQState.correct_answer === opt ? 'correct' : ''}`}
                                    onClick={() => setCurQState({ ...curQState, correct_answer: opt })}>
                                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${curQState.correct_answer === opt ? T.green : 'rgba(255,255,255,.20)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      {curQState.correct_answer === opt && <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.green }} />}
                                    </div>
                                    <span style={{ fontSize: 13, color: curQState.correct_answer === opt ? T.green : T.textBody, direction: isAr ? 'rtl' : 'ltr' }}>{opt}</span>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Fill in options above first</p>
                          )}
                        </div>

                        <button type="button" className="aw-ccf-add-q-btn" onClick={handleAddQ}>
                          <Plus size={13} /> Add Question
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0, background: T.bgCard }}>
            <button type="button" className="aw-ccf-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="aw-ccf-save-btn" disabled={saving}>
              {saving
                ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
                : <><Save size={14} /> {editingSection ? 'Update Section' : 'Save Section'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
