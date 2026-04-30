import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck, Plus, Edit2, Trash2, List,
  X, Save, Loader2, Clock, Target, CheckCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Exam, ExamQuestion } from '../../lib/types';

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
  gold:        '#fbbf24',
  goldBg:      'rgba(251,191,36,0.08)',
  goldBorder:  'rgba(251,191,36,0.22)',
} as const;

/* ─────────────────────────────────────────
   EXAM TYPE CONFIG
───────────────────────────────────────── */
const EXAM_TYPE_CFG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  PRE_ASSESSMENT:  { color: T.gold,  bg: T.goldBg,   border: T.goldBorder,   label: 'Pre-Assessment'  },
  POST_ASSESSMENT: { color: T.green, bg: T.greenBg,  border: T.greenBorder,  label: 'Post-Assessment' },
  GENERAL:         { color: T.blue,  bg: T.blueBg,   border: T.blueBorder,   label: 'General'         },
};
const getTypeCfg = (t: string) => EXAM_TYPE_CFG[t] ?? EXAM_TYPE_CFG['GENERAL'];

/* ─────────────────────────────────────────
   CSS  — id = "aw-exp-styles" (unique)
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-exp-card {
    background: #1a1e0e; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden; font-family: 'Inter', sans-serif;
    display: flex; flex-direction: column;
    transition: border-color 0.2s, transform 0.18s;
  }
  .aw-exp-card:hover { border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }

  .aw-exp-icon-btn {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid transparent; cursor: pointer;
    transition: all 0.18s; background: none; flex-shrink: 0;
  }
  .aw-exp-icon-btn.edit { color: #60a5fa; border-color: rgba(96,165,250,0.22); background: rgba(96,165,250,0.08); }
  .aw-exp-icon-btn.edit:hover { background: rgba(96,165,250,0.18); }
  .aw-exp-icon-btn.del  { color: #f87171; border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.07); }
  .aw-exp-icon-btn.del:hover  { background: rgba(248,113,113,0.16); }

  .aw-exp-q-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
    padding: 9px 12px; border-radius: 9px; cursor: pointer;
    font-size: 12px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.22);
    color: #a78bfa; transition: all 0.18s;
  }
  .aw-exp-q-btn:hover { background: rgba(167,139,250,0.18); }

  .aw-exp-input, .aw-exp-select, .aw-exp-textarea {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; font-size: 14px; color: #ffffff;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .aw-exp-input   { padding: 11px 14px; }
  .aw-exp-textarea { padding: 11px 14px; resize: vertical; }
  .aw-exp-select  {
    padding: 11px 36px 11px 14px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .aw-exp-input:focus, .aw-exp-select:focus, .aw-exp-textarea:focus {
    border-color: rgba(200,255,0,0.45);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.07);
    background: rgba(255,255,255,0.06);
  }
  .aw-exp-input::placeholder, .aw-exp-textarea::placeholder { color: rgba(148,163,184,0.35); }
  .aw-exp-select option { background: #1a1e0e; color: #ffffff; }
  input[type="number"].aw-exp-input::-webkit-inner-spin-button { filter: invert(1) opacity(0.3); }

  .aw-exp-label {
    display: block; font-size: 12px; font-weight: 600; color: #94a3b8;
    margin-bottom: 7px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif;
  }

  .aw-exp-opt-radio {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 12px; border-radius: 8px; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02); transition: all 0.18s;
  }
  .aw-exp-opt-radio.correct { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.28); }
  .aw-exp-opt-radio:hover:not(.correct) { background: rgba(255,255,255,0.04); }

  .aw-exp-q-card {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 13px 15px;
  }

  .aw-exp-save-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-exp-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .aw-exp-save-btn:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  .aw-exp-cancel-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 12px 20px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: all 0.18s;
  }
  .aw-exp-cancel-btn:hover { background: rgba(255,255,255,0.08); color: #ffffff; }

  .aw-exp-add-q-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 11px 16px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: rgba(200,255,0,0.08); border: 1px solid rgba(200,255,0,0.22);
    color: #c8ff00; transition: all 0.18s;
  }
  .aw-exp-add-q-btn:hover { background: rgba(200,255,0,0.14); }
  .aw-exp-add-q-btn:disabled { opacity: 0.40; cursor: not-allowed; }

  .aw-exp-scroll::-webkit-scrollbar { width: 4px; }
  .aw-exp-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-exp-scroll::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.20); border-radius: 9999px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aw-modal-in { from { opacity:0; transform:scale(0.97) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .aw-fade-up  { animation: aw-fade-up  0.4s ease both; }
  .aw-modal-in { animation: aw-modal-in 0.28s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-exp-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-exp-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   DEFAULTS
───────────────────────────────────────── */
const defaultExamForm = {
  title: '', description: '',
  exam_type: 'GENERAL' as 'PRE_ASSESSMENT' | 'POST_ASSESSMENT' | 'GENERAL',
  passing_score: 70, time_limit_minutes: 30,
};

const defaultQForm = {
  question: '', option1: '', option2: '', option3: '', option4: '',
  correct_answer: '', explanation: '',
};

/* ─────────────────────────────────────────
   OPTION FIELDS CONFIG — ← Fixed array syntax
───────────────────────────────────────── */
const OPTION_FIELDS: Array<{ key: keyof typeof defaultQForm; label: string; required: boolean }> = [
  { key: 'option1', label: 'Option 1', required: true  },
  { key: 'option2', label: 'Option 2', required: true  },
  { key: 'option3', label: 'Option 3', required: false },
  { key: 'option4', label: 'Option 4', required: false },
];

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const ExamsPage: React.FC = () => {
  const [exams, setExams]               = useState<Exam[]>([]);
  const [showModal, setShowModal]       = useState(false);
  const [showQModal, setShowQModal]     = useState(false);
  const [editingExam, setEditingExam]   = useState<Exam | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [questions, setQuestions]       = useState<ExamQuestion[]>([]);
  const [form, setForm]                 = useState({ ...defaultExamForm });
  const [qForm, setQForm]               = useState({ ...defaultQForm });
  const [saving, setSaving]             = useState(false);
  const [addingQ, setAddingQ]           = useState(false);

  useEffect(() => { loadExams(); }, []);

  const loadExams = async () => {
    const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
    if (data) setExams(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingExam) {
        const { error } = await supabase.from('exams').update(form).eq('id', editingExam.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('exams').insert([form]);
        if (error) throw error;
      }
      setShowModal(false); setEditingExam(null); setForm({ ...defaultExamForm });
      await loadExams();
    } catch { alert('Failed to save exam'); }
    finally { setSaving(false); }
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setForm({
      title: exam.title, description: exam.description,
      exam_type: exam.exam_type, passing_score: exam.passing_score,
      time_limit_minutes: exam.time_limit_minutes || 30,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this exam?')) return;
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) { alert('Failed to delete exam'); return; }
    await loadExams();
  };

  const handleManageQ = async (exam: Exam) => {
    setSelectedExam(exam);
    const { data } = await supabase.from('exam_questions').select('*').eq('exam_id', exam.id).order('order_index');
    if (data) setQuestions(data);
    setShowQModal(true);
  };

  const reloadQuestions = async (examId: string) => {
    const { data } = await supabase.from('exam_questions').select('*').eq('exam_id', examId).order('order_index');
    if (data) setQuestions(data);
  };

  const handleAddQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    const options = [qForm.option1, qForm.option2, qForm.option3, qForm.option4].filter(o => o.trim());
    if (options.length < 2) { alert('At least 2 options are required'); return; }
    if (!options.includes(qForm.correct_answer)) { alert('Correct answer must match one of the options'); return; }
    setAddingQ(true);
    try {
      const { error } = await supabase.from('exam_questions').insert([{
        exam_id: selectedExam.id,
        question: qForm.question,
        options,
        correct_answer: qForm.correct_answer,
        explanation: qForm.explanation,
        order_index: questions.length,
      }]);
      if (error) throw error;
      setQForm({ ...defaultQForm });
      await reloadQuestions(selectedExam.id);
    } catch { alert('Failed to add question'); }
    finally { setAddingQ(false); }
  };

  const handleDeleteQ = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await supabase.from('exam_questions').delete().eq('id', id);
    if (selectedExam) await reloadQuestions(selectedExam.id);
  };

  /* Available options for the correct answer selector */
  const availableOptions = [qForm.option1, qForm.option2, qForm.option3, qForm.option4].filter(o => o.trim());

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardCheck size={18} style={{ color: T.blue }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
              Exams & Assessments
            </h1>
          </div>
          <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>Manage exam templates and question banks.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: '7px 14px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: T.blue }}>{exams.length}</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>exams</span>
          </div>
          <button
            onClick={() => { setEditingExam(null); setForm({ ...defaultExamForm }); setShowModal(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark, boxShadow: '0 0 18px rgba(200,255,0,0.20)' }}
          >
            <Plus size={14} /> Add Exam
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {exams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ClipboardCheck size={26} style={{ color: T.textMuted }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.textBody, margin: '0 0 6px' }}>No exams yet</p>
          <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 20px' }}>Click "Add Exam" to create your first assessment.</p>
          <button onClick={() => { setEditingExam(null); setForm({ ...defaultExamForm }); setShowModal(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: T.accent, color: T.accentDark }}>
            <Plus size={14} /> Add Exam
          </button>
        </div>
      ) : (
        /* ── Grid ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {exams.map((exam, idx) => {
            const cfg = getTypeCfg(exam.exam_type);
            return (
              <div key={exam.id} className={`aw-exp-card aw-fade-up`} style={{ animationDelay: `${idx * 0.04}s` }}>
                {/* Color bar */}
                <div style={{ height: 2, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}40)` }} />

                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ClipboardCheck size={17} style={{ color: cfg.color }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="aw-exp-icon-btn edit" title="Edit" onClick={() => handleEdit(exam)}><Edit2 size={13} /></button>
                      <button className="aw-exp-icon-btn del"  title="Delete" onClick={() => handleDelete(exam.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {/* Title + desc */}
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exam.title}
                    </h3>
                    <p style={{ fontSize: 12, color: T.textMuted, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '18px' }}>
                      {exam.description}
                    </p>
                  </div>

                  {/* Meta badges */}
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 'auto' }}>
                    <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 600, background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green }}>
                      <Target size={9} /> {exam.passing_score}% pass
                    </span>
                    {exam.time_limit_minutes ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, color: T.textMuted }}>
                        <Clock size={9} /> {exam.time_limit_minutes} min
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex' }}>
                  <button className="aw-exp-q-btn" onClick={() => handleManageQ(exam)}>
                    <List size={13} /> Manage Questions
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ EXAM FORM MODAL ═══════════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.86)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowModal(false); setEditingExam(null); }}>
          <div className="aw-modal-in aw-exp-scroll"
            style={{ width: '100%', maxWidth: 480, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', overflowY: 'auto', maxHeight: '90vh', boxShadow: '0 40px 100px rgba(0,0,0,0.60)', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' }} />

            {/* Header */}
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: T.blueBg, border: `1px solid ${T.blueBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardCheck size={15} style={{ color: T.blue }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>{editingExam ? 'Edit Exam' : 'Add New Exam'}</h2>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Fill in the exam details</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setEditingExam(null); }}
                style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                <div>
                  <label className="aw-exp-label">Exam Title <span style={{ color: T.accent }}>*</span></label>
                  <input className="aw-exp-input" type="text" required placeholder="e.g. Cybersecurity Awareness Quiz"
                    value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>

                <div>
                  <label className="aw-exp-label">Description <span style={{ color: T.accent }}>*</span></label>
                  <textarea className="aw-exp-textarea" required rows={3} placeholder="Brief exam description"
                    value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>

                {/* Exam type buttons */}
                <div>
                  <label className="aw-exp-label">Exam Type <span style={{ color: T.accent }}>*</span></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(Object.entries(EXAM_TYPE_CFG) as Array<[string, typeof EXAM_TYPE_CFG[string]]>).map(([key, cfg]) => {
                      const active = form.exam_type === key;
                      return (
                        <button key={key} type="button"
                          style={{ flex: 1, padding: '10px 6px', borderRadius: 9, border: active ? `1px solid ${cfg.border}` : `1px solid rgba(255,255,255,0.08)`, background: active ? cfg.bg : 'rgba(255,255,255,0.02)', color: active ? cfg.color : T.textMuted, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s' }}
                          onClick={() => setForm(p => ({ ...p, exam_type: key as typeof form.exam_type }))}>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="aw-exp-label">Pass Score (%) <span style={{ color: T.accent }}>*</span></label>
                    <input className="aw-exp-input" type="number" required min="0" max="100"
                      value={form.passing_score} onChange={e => setForm(p => ({ ...p, passing_score: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="aw-exp-label">Time Limit (min) <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                    <input className="aw-exp-input" type="number" min="1"
                      value={form.time_limit_minutes} onChange={e => setForm(p => ({ ...p, time_limit_minutes: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.borderFaint}`, display: 'flex', gap: 10, flexShrink: 0 }}>
                <button type="button" className="aw-exp-cancel-btn" onClick={() => { setShowModal(false); setEditingExam(null); }}>Cancel</button>
                <button type="submit" className="aw-exp-save-btn" disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Saving…</>
                    : <><Save size={14} /> {editingExam ? 'Update Exam' : 'Create Exam'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════ QUESTIONS MODAL ═══════════ */}
      {showQModal && selectedExam && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(10,12,6,0.88)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowQModal(false); setSelectedExam(null); setQuestions([]); }}>
          <div className="aw-modal-in"
            style={{ width: '100%', maxWidth: 900, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden', maxHeight: '94vh', boxShadow: '0 40px 100px rgba(0,0,0,0.65)', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.purple}, ${T.purple}40)` }} />

            {/* Modal header */}
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <List size={16} style={{ color: T.purple }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 900, color: T.white, margin: 0 }}>Question Bank</h2>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{selectedExam.title}</p>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: T.purpleBg, border: `1px solid ${T.purpleBorder}`, color: T.purple }}>
                  {questions.length} questions
                </span>
              </div>
              <button onClick={() => { setShowQModal(false); setSelectedExam(null); setQuestions([]); }}
                style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderFaint}`, color: T.textMuted, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {/* Two-column body */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {/* LEFT: Add question */}
              <div style={{ borderRight: `1px solid ${T.borderFaint}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <Plus size={13} style={{ color: T.accent }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Add Question</span>
                </div>
                <form onSubmit={handleAddQ} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div className="aw-exp-scroll" style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>

                    {/* Question textarea */}
                    <div>
                      <label className="aw-exp-label">Question <span style={{ color: T.accent }}>*</span></label>
                      <textarea className="aw-exp-textarea" required rows={3} placeholder="Enter your question here…"
                        value={qForm.question} onChange={e => setQForm(p => ({ ...p, question: e.target.value }))} />
                    </div>

                    {/* Options grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {OPTION_FIELDS.map(({ key, label, required }) => (
                        <div key={key}>
                          <label className="aw-exp-label">{label}{required ? ' *' : ''}</label>
                          <input
                            className="aw-exp-input"
                            type="text"
                            required={required}
                            style={{ fontSize: 13 }}
                            value={qForm[key] as string}
                            onChange={e => setQForm(p => ({ ...p, [key]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Smart correct answer selector */}
                    <div>
                      <label className="aw-exp-label">Correct Answer <span style={{ color: T.accent }}>*</span></label>
                      {availableOptions.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {availableOptions.map((opt, i) => (
                            <div key={i}
                              className={`aw-exp-opt-radio${qForm.correct_answer === opt ? ' correct' : ''}`}
                              onClick={() => setQForm(p => ({ ...p, correct_answer: opt }))}>
                              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${qForm.correct_answer === opt ? T.green : 'rgba(255,255,255,0.20)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {qForm.correct_answer === opt && <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green }} />}
                              </div>
                              <span style={{ fontSize: 12, color: qForm.correct_answer === opt ? T.green : T.textBody }}>{opt}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: T.textMuted, padding: '8px 0', margin: 0 }}>
                          Fill in the options above to select the correct answer
                        </p>
                      )}
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="aw-exp-label">Explanation <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span></label>
                      <textarea className="aw-exp-textarea" rows={2} placeholder="Why is this the correct answer?"
                        value={qForm.explanation} onChange={e => setQForm(p => ({ ...p, explanation: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.borderFaint}`, flexShrink: 0 }}>
                    <button type="submit" className="aw-exp-add-q-btn" disabled={addingQ}>
                      {addingQ
                        ? <><Loader2 size={13} style={{ animation: 'aw-spin 0.8s linear infinite' }} /> Adding…</>
                        : <><Plus size={13} /> Add Question</>
                      }
                    </button>
                  </div>
                </form>
              </div>

              {/* RIGHT: Questions list */}
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.borderFaint}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <List size={13} style={{ color: T.purple }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Questions</span>
                  <span style={{ fontSize: 11, color: T.purple, fontWeight: 700, marginLeft: 'auto' }}>{questions.length}</span>
                </div>
                <div className="aw-exp-scroll" style={{ overflowY: 'auto', flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {questions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted, fontSize: 13 }}>
                      <ClipboardCheck size={32} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 12px', display: 'block' }} />
                      No questions yet.<br />Add the first one on the left.
                    </div>
                  ) : (
                    questions.map((q, idx) => (
                      <div key={q.id} className="aw-exp-q-card">
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.white, lineHeight: '20px' }}>
                            <span style={{ color: T.textMuted, fontWeight: 400, marginRight: 5 }}>{idx + 1}.</span>
                            {q.question}
                          </span>
                          <button onClick={() => handleDeleteQ(q.id)}
                            style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red, cursor: 'pointer', flexShrink: 0 }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {q.options.map((opt: string, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 9px', borderRadius: 7, background: opt === q.correct_answer ? T.greenBg : 'rgba(255,255,255,0.02)', border: `1px solid ${opt === q.correct_answer ? T.greenBorder : T.borderFaint}`, fontSize: 12, color: opt === q.correct_answer ? T.green : T.textBody }}>
                              {opt === q.correct_answer && <CheckCircle size={10} style={{ flexShrink: 0 }} />}
                              {opt}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <p style={{ fontSize: 11, color: T.textMuted, margin: '8px 0 0', padding: '6px 9px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, borderLeft: `3px solid ${T.textMuted}` }}>
                            💡 {q.explanation}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
