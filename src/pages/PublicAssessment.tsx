import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ExamQuestion } from '../types';

/* ─────────────────────────────────────────
   DESIGN TOKENS
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
  border:      'rgba(255,255,255,0.10)',
  borderFaint: 'rgba(255,255,255,0.05)',
  cardBg:      'rgba(255,255,255,0.03)',
} as const;

/* ─────────────────────────────────────────
   GLOBAL CSS — injected once into <head>
   Uses :focus pseudo-class → NO JS state
   for focus, so typing never causes
   re-render / focus-loss.
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── inputs ── */
  .aw-input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 8px;
    font-size: 14px;
    color: #ffffff;
    outline: none;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    font-family: 'Inter', sans-serif;
    display: block;
  }
  .aw-input:focus {
    background: rgba(255,255,255,0.08);
    border-color: rgba(200,255,0,0.50);
    box-shadow: 0 0 0 3px rgba(200,255,0,0.10);
  }
  .aw-input::placeholder {
    color: rgba(148,163,184,0.40);
  }

  /* autofill dark override */
  .aw-input:-webkit-autofill,
  .aw-input:-webkit-autofill:hover,
  .aw-input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px #1a1e0e inset !important;
    -webkit-text-fill-color: #ffffff !important;
    caret-color: #ffffff;
    border-color: rgba(200,255,0,0.50) !important;
    transition: background-color 9999s ease-in-out 0s;
  }

  /* hide number spinners */
  input[type=number].aw-input::-webkit-inner-spin-button,
  input[type=number].aw-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }

  /* ── animations ── */
  @keyframes aw-spin {
    to { transform: rotate(360deg); }
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-pa-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-pa-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface PublicAssessmentProps {
  onNavigate: (page: string) => void;
}

interface VisitorInfo {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  job_title: string;
}

/* ─────────────────────────────────────────
   PAGE STYLE (stable object, defined once)
───────────────────────────────────────── */
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: T.bg,
  padding: '48px 16px',
  fontFamily: "'Inter', sans-serif",
};

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const PublicAssessment: React.FC<PublicAssessmentProps> = ({ onNavigate }) => {
  const [step, setStep]               = useState<'info' | 'test' | 'results'>('info');
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo>({
    full_name: '', email: '', phone: '', company_name: '', job_title: '',
  });
  const [questions, setQuestions]     = useState<ExamQuestion[]>([]);
  const [currentQ, setCurrentQ]       = useState(0);
  const [answers, setAnswers]         = useState<Record<string, string>>({});
  const [loading, setLoading]         = useState(true);
  const [score, setScore]             = useState(0);
  const [total, setTotal]             = useState(0);

  useEffect(() => { loadQuestions(); }, []);

  const loadQuestions = async () => {
    try {
      const { data: examData } = await supabase
        .from('exams').select('id')
        .eq('exam_type', 'GENERAL').maybeSingle();
      if (examData) {
        const { data: qData } = await supabase
          .from('exam_questions').select('*')
          .eq('exam_id', examData.id).order('order_index');
        if (qData) { setQuestions(qData); setTotal(qData.length); }
      }
    } catch (err) {
      console.error('Error loading questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) =>
    setAnswers(prev => ({ ...prev, [questions[currentQ].id]: answer }));

  const handleNext     = () => setCurrentQ(q => Math.min(q + 1, questions.length - 1));
  const handlePrevious = () => setCurrentQ(q => Math.max(q - 1, 0));

  const handleSubmit = async () => {
    let correctCount = 0;
    const detail = questions.map(q => {
      const ok = answers[q.id] === q.correct_answer;
      if (ok) correctCount++;
      return { question: q.question, selected_answer: answers[q.id] || 'Not answered', correct_answer: q.correct_answer, is_correct: ok };
    });
    setScore(correctCount);
    try {
      await supabase.from('public_assessments').insert([{
        ...visitorInfo, score: correctCount, total_questions: questions.length, answers: detail,
      }]);
    } catch (err) { console.error('Error saving assessment:', err); }
    setStep('results');
  };

  const getPerf = () => {
    const pct = (score / total) * 100;
    if (pct >= 90) return { level: 'Excellent',         color: T.accent,  bg: 'rgba(200,255,0,0.10)',   bdr: 'rgba(200,255,0,0.25)'   };
    if (pct >= 70) return { level: 'Good',              color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  bdr: 'rgba(96,165,250,0.25)'  };
    if (pct >= 50) return { level: 'Fair',              color: '#facc15', bg: 'rgba(250,204,21,0.10)',  bdr: 'rgba(250,204,21,0.25)'  };
    return           { level: 'Needs Improvement',     color: '#f87171', bg: 'rgba(248,113,113,0.10)', bdr: 'rgba(248,113,113,0.25)' };
  };

  /* ══════════ LOADING ══════════ */
  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${T.borderFaint}`, borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
          <p style={{ fontSize: 14, color: T.textBody }}>Loading assessment…</p>
        </div>
      </div>
    );
  }

  /* ══════════ INFO STEP ══════════ */
  if (step === 'info') {
    const fields: Array<{ key: keyof VisitorInfo; label: string; type: string; autoComplete: string; required?: boolean }> = [
      { key: 'full_name',    label: 'Full Name',    type: 'text',  autoComplete: 'name',               required: true },
      { key: 'email',        label: 'Email',        type: 'email', autoComplete: 'email',              required: true },
      { key: 'phone',        label: 'Phone Number', type: 'tel',   autoComplete: 'tel' },
      { key: 'company_name', label: 'Company Name', type: 'text',  autoComplete: 'organization' },
      { key: 'job_title',    label: 'Job Title',    type: 'text',  autoComplete: 'organization-title' },
    ];

    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {/* Back */}
          <button
            onClick={() => onNavigate('landing')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: T.textBody, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 24px', transition: 'color 0.2s', fontFamily: 'inherit' }}
            onMouseEnter={e => (e.currentTarget.style.color = T.white)}
            onMouseLeave={e => (e.currentTarget.style.color = T.textBody)}
          >
            <ArrowLeft size={16} /> Back to Home
          </button>

          {/* Card */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: '40px', boxShadow: '0 25px 60px rgba(0,0,0,0.45)' }}>
            <div style={{ width: 40, height: 3, background: T.accent, borderRadius: 9999, marginBottom: 28 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(200,255,0,0.10)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={22} style={{ color: T.accent }} />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: T.white, letterSpacing: '-0.4px', lineHeight: 1.25 }}>
                Free Cybersecurity<br />Awareness Test
              </h1>
            </div>

            <p style={{ fontSize: 15, color: T.textBody, lineHeight: '24px', marginBottom: 32 }}>
              Discover your current level of cybersecurity awareness. This quick assessment will help you understand your strengths and areas for improvement.
            </p>

            <form
              onSubmit={e => { e.preventDefault(); setStep('test'); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
              autoComplete="on"
            >
              {fields.map(({ key, label, type, autoComplete, required }) => (
                <div key={key}>
                  <label htmlFor={`info-${key}`} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textLabel, marginBottom: 6 }}>
                    {label}{required && <span style={{ color: T.accent, marginLeft: 3 }}>*</span>}
                  </label>
                  <input
                    id={`info-${key}`}
                    className="aw-input"
                    type={type}
                    required={required}
                    autoComplete={autoComplete}
                    value={visitorInfo[key]}
                    onChange={e => {
                      const val = e.target.value;
                      setVisitorInfo(prev => ({ ...prev, [key]: val }));
                    }}
                  />
                </div>
              ))}

              <button
                type="submit"
                style={{ marginTop: 8, width: '100%', padding: '14px 24px', background: T.accent, color: T.accentDark, fontSize: 15, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(200,255,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.2s, transform 0.15s', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
              >
                Start Assessment <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════ TEST STEP ══════════ */
  if (step === 'test' && questions.length > 0) {
    const question = questions[currentQ];
    const progress = ((currentQ + 1) / questions.length) * 100;
    const answered = !!answers[question.id];
    const isLast   = currentQ === questions.length - 1;

    const navBtnStyle = (active: boolean): React.CSSProperties => ({
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '12px 24px', fontSize: 14, fontWeight: 700,
      background: active ? T.accent : 'rgba(200,255,0,0.20)',
      color: T.accentDark, borderRadius: 10, border: 'none',
      cursor: active ? 'pointer' : 'not-allowed',
      boxShadow: active ? '0 0 16px rgba(200,255,0,0.25)' : 'none',
      opacity: active ? 1 : 0.5,
      transition: 'opacity 0.2s, transform 0.15s',
      fontFamily: 'inherit',
    });

    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Progress */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textMuted, marginBottom: 8 }}>
              <span>Question {currentQ + 1} of {questions.length}</span>
              <span style={{ color: T.accent, fontWeight: 600 }}>{Math.round(progress)}% Complete</span>
            </div>
            <div style={{ width: '100%', height: 4, background: T.borderFaint, borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: T.accent, borderRadius: 9999, transition: 'width 0.4s ease', boxShadow: '0 0 10px rgba(200,255,0,0.40)' }} />
            </div>
          </div>

          {/* Card */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: 40, boxShadow: '0 25px 60px rgba(0,0,0,0.40)' }}>
            {/* Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', borderRadius: 9999, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Question {currentQ + 1}</span>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.white, lineHeight: '30px', marginBottom: 28 }}>
              {question.question}
            </h2>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {question.options.map((option: string, idx: number) => {
                const sel = answers[question.id] === option;
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(option)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '14px 16px',
                      background: sel ? 'rgba(200,255,0,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sel ? 'rgba(200,255,0,0.40)' : T.borderFaint}`,
                      borderRadius: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'background 0.2s, border-color 0.2s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { if (!sel) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = T.border; } }}
                    onMouseLeave={e => { if (!sel) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = T.borderFaint; } }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${sel ? T.accent : T.border}`, background: sel ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s, border-color 0.2s' }}>
                      {sel && <Check size={11} style={{ color: T.accentDark }} strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 14, color: sel ? T.white : T.textBody, fontWeight: sel ? 600 : 400, lineHeight: '22px', transition: 'color 0.2s' }}>
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Nav */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button
                onClick={handlePrevious}
                disabled={currentQ === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: 14, fontWeight: 600, color: currentQ === 0 ? T.textMuted : T.textBody, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`, borderRadius: 10, cursor: currentQ === 0 ? 'not-allowed' : 'pointer', opacity: currentQ === 0 ? 0.45 : 1, transition: 'background 0.2s', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (currentQ > 0) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              >
                <ArrowLeft size={16} /> Previous
              </button>

              {isLast ? (
                <button onClick={handleSubmit} disabled={!answered} style={navBtnStyle(answered)}
                  onMouseEnter={e => { if (answered) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = answered ? '1' : '0.5'; e.currentTarget.style.transform = 'none'; }}
                >
                  Submit Assessment <Check size={16} strokeWidth={3} />
                </button>
              ) : (
                <button onClick={handleNext} disabled={!answered} style={navBtnStyle(answered)}
                  onMouseEnter={e => { if (answered) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = answered ? '1' : '0.5'; e.currentTarget.style.transform = 'none'; }}
                >
                  Next <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24, flexWrap: 'wrap' }}>
            {questions.map((q, i) => (
              <div key={i} style={{ width: i === currentQ ? 20 : 8, height: 8, borderRadius: 9999, background: answers[q.id] ? T.accent : i === currentQ ? 'rgba(200,255,0,0.40)' : T.borderFaint, transition: 'all 0.3s ease', boxShadow: answers[q.id] ? '0 0 6px rgba(200,255,0,0.35)' : 'none' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════ RESULTS ══════════ */
  if (step === 'results') {
    const perf       = getPerf();
    const percentage = Math.round((score / total) * 100);
    const recs =
      percentage >= 90
        ? ['Excellent knowledge! Help train others in your organization', 'Stay current with the evolving MENA security landscape', 'Consider specialized certifications (CISSP, CEH)']
        : percentage >= 70
          ? ['Good foundation! Consider advanced training modules', 'Focus on emerging threats and regional attack trends', 'Practice identifying phishing and social engineering attempts']
          : ['Consider enrolling in comprehensive cybersecurity training', 'Review basic security concepts and best practices', 'Stay updated on the latest regional security threats'];

    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: '44px 40px', boxShadow: '0 25px 60px rgba(0,0,0,0.45)', textAlign: 'center' }}>
            <div style={{ width: 40, height: 3, background: T.accent, borderRadius: 9999, margin: '0 auto 32px' }} />

            {/* Score circle */}
            <div style={{ width: 120, height: 120, borderRadius: '50%', margin: '0 auto 28px', background: perf.bg, border: `2px solid ${perf.bdr}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 32px ${perf.bg}` }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: perf.color, lineHeight: 1 }}>{percentage}%</span>
              <span style={{ fontSize: 11, color: T.textMuted, marginTop: 4, letterSpacing: '0.5px' }}>CORRECT</span>
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 900, color: T.white, letterSpacing: '-0.4px', margin: '0 0 8px' }}>
              Assessment Complete!
            </h1>
            <p style={{ fontSize: 15, color: T.textBody, margin: '0 0 20px' }}>
              You scored <strong style={{ color: T.white }}>{score}</strong> out of <strong style={{ color: T.white }}>{total}</strong> correctly.
            </p>

            {/* Level badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 20px', borderRadius: 9999, background: perf.bg, border: `1px solid ${perf.bdr}`, marginBottom: 32 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: perf.color }}>{perf.level}</span>
            </div>

            {/* Recommendations */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`, borderRadius: 12, padding: '20px 24px', marginBottom: 28, textAlign: 'left' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Recommendations</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recs.map((rec, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: T.textBody, lineHeight: '20px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, marginTop: 7, flexShrink: 0, boxShadow: '0 0 6px rgba(200,255,0,0.50)' }} />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => onNavigate('landing')}
                style={{ width: '100%', padding: '14px 24px', fontSize: 15, fontWeight: 700, background: T.accent, color: T.accentDark, borderRadius: 10, border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(200,255,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.2s, transform 0.15s', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
              >
                Request a Demo to Improve Your Skills <ArrowRight size={16} />
              </button>
              <button
                onClick={() => onNavigate('landing')}
                style={{ width: '100%', padding: '14px 24px', fontSize: 15, fontWeight: 600, background: 'rgba(255,255,255,0.04)', color: T.textBody, border: `1px solid ${T.borderFaint}`, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s, color 0.2s', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = T.white; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = T.textBody; }}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
