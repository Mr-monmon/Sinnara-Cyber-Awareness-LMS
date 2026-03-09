import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ExamQuestion } from '../types';

/* ── Design Tokens ── */
const T = {
  bg:           '#12140a',
  bgCard:       '#1a1e0e',
  bgInput:      'rgba(255,255,255,0.05)',
  bgInputFocus: 'rgba(255,255,255,0.08)',
  accent:       '#c8ff00',
  accentDark:   '#12140a',
  white:        '#ffffff',
  textBody:     '#94a3b8',
  textLabel:    '#cbd5e1',
  textMuted:    '#64748b',
  border:       'rgba(255,255,255,0.10)',
  borderFaint:  'rgba(255,255,255,0.05)',
  borderFocus:  'rgba(200,255,0,0.50)',
  cardBg:       'rgba(255,255,255,0.03)',
};

/* ── Shared input style ── */
const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  fontSize: 14,
  color: T.white,
  outline: 'none',
  transition: 'background 0.2s, border-color 0.2s',
  fontFamily: 'inherit',
};

/* ── Types ── */
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

/* ════════════════════════════════════════
   COMPONENT
════════════════════════════════════════ */
export const PublicAssessment: React.FC<PublicAssessmentProps> = ({ onNavigate }) => {
  const [step, setStep]                 = useState<'info' | 'test' | 'results'>('info');
  const [visitorInfo, setVisitorInfo]   = useState<VisitorInfo>({
    full_name: '', email: '', phone: '', company_name: '', job_title: '',
  });
  const [questions, setQuestions]       = useState<ExamQuestion[]>([]);
  const [currentQuestion, setCurrentQ] = useState(0);
  const [answers, setAnswers]           = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);
  const [score, setScore]               = useState(0);
  const [totalQuestions, setTotal]      = useState(0);
  const [focused, setFocused]           = useState<string | null>(null);

  useEffect(() => { loadQuestions(); }, []);

  const loadQuestions = async () => {
    try {
      const { data: examData } = await supabase
        .from('exams').select('id')
        .eq('exam_type', 'GENERAL').maybeSingle();

      if (examData) {
        const { data: questionsData } = await supabase
          .from('exam_questions').select('*')
          .eq('exam_id', examData.id).order('order_index');
        if (questionsData) { setQuestions(questionsData); setTotal(questionsData.length); }
      }
    } catch (err) {
      console.error('Error loading questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInfoSubmit = (e: React.FormEvent) => { e.preventDefault(); setStep('test'); };

  const handleAnswerSelect = (answer: string) =>
    setAnswers({ ...answers, [questions[currentQuestion].id]: answer });

  const handleNext     = () => currentQuestion < questions.length - 1 && setCurrentQ(currentQuestion + 1);
  const handlePrevious = () => currentQuestion > 0 && setCurrentQ(currentQuestion - 1);

  const handleSubmit = async () => {
    let correctCount = 0;
    const detailedAnswers = questions.map(q => {
      const isCorrect = answers[q.id] === q.correct_answer;
      if (isCorrect) correctCount++;
      return { question: q.question, selected_answer: answers[q.id] || 'Not answered', correct_answer: q.correct_answer, is_correct: isCorrect };
    });
    setScore(correctCount);
    try {
      await supabase.from('public_assessments').insert([{
        ...visitorInfo, score: correctCount,
        total_questions: questions.length, answers: detailedAnswers,
      }]);
    } catch (err) { console.error('Error saving assessment:', err); }
    setStep('results');
  };

  const getPerformance = () => {
    const pct = (score / totalQuestions) * 100;
    if (pct >= 90) return { level: 'Excellent',          color: T.accent,    bgAlpha: 'rgba(200,255,0,0.10)',   borderAlpha: 'rgba(200,255,0,0.25)' };
    if (pct >= 70) return { level: 'Good',               color: '#60a5fa',   bgAlpha: 'rgba(96,165,250,0.10)',  borderAlpha: 'rgba(96,165,250,0.25)' };
    if (pct >= 50) return { level: 'Fair',               color: '#facc15',   bgAlpha: 'rgba(250,204,21,0.10)',  borderAlpha: 'rgba(250,204,21,0.25)' };
    return          { level: 'Needs Improvement',        color: '#f87171',   bgAlpha: 'rgba(248,113,113,0.10)', borderAlpha: 'rgba(248,113,113,0.25)' };
  };

  /* ── Shared page wrapper ── */
  const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '48px 16px', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input:-webkit-autofill, input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #1a1e0e inset !important;
          -webkit-text-fill-color: #ffffff !important;
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        ::placeholder { color: rgba(148,163,184,0.45); }
      `}</style>
      {children}
    </div>
  );

  /* ════════════
     LOADING
  ════════════ */
  if (loading) {
    return (
      <Page>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: `3px solid ${T.borderFaint}`,
            borderTopColor: T.accent,
            animation: 'aw-spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 14, color: T.textBody }}>Loading assessment…</p>
          <style>{`@keyframes aw-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Page>
    );
  }

  /* ════════════
     INFO STEP
  ════════════ */
  if (step === 'info') {
    const fields: Array<{ key: keyof VisitorInfo; label: string; type: string; required?: boolean }> = [
      { key: 'full_name',    label: 'Full Name',    type: 'text',  required: true },
      { key: 'email',        label: 'Email',        type: 'email', required: true },
      { key: 'phone',        label: 'Phone Number', type: 'tel'  },
      { key: 'company_name', label: 'Company Name', type: 'text' },
      { key: 'job_title',    label: 'Job Title',    type: 'text' },
    ];

    return (
      <Page>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {/* Back */}
          <button
            onClick={() => onNavigate('landing')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: T.textBody, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 24px', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = T.white)}
            onMouseLeave={e => (e.currentTarget.style.color = T.textBody)}
          >
            <ArrowLeft size={16} /> Back to Home
          </button>

          {/* Card */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: '40px 40px 44px', boxShadow: '0 25px 60px rgba(0,0,0,0.45)' }}>
            {/* Accent bar */}
            <div style={{ width: 40, height: 3, background: T.accent, borderRadius: 9999, marginBottom: 28 }} />

            {/* Icon + heading */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(200,255,0,0.10)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={22} style={{ color: T.accent }} />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: T.white, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
                Free Cybersecurity<br />Awareness Test
              </h1>
            </div>

            <p style={{ fontSize: 15, color: T.textBody, lineHeight: '24px', marginBottom: 32 }}>
              Discover your current level of cybersecurity awareness. This quick assessment will help you understand your strengths and areas for improvement.
            </p>

            <form onSubmit={handleInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {fields.map(({ key, label, type, required }) => (
                <div key={key}>
                  <label htmlFor={`info-${key}`} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textLabel, marginBottom: 6 }}>
                    {label}{required && <span style={{ color: T.accent, marginLeft: 3 }}>*</span>}
                  </label>
                  <input
                    id={`info-${key}`}
                    type={type}
                    required={required}
                    value={visitorInfo[key]}
                    onChange={e => setVisitorInfo({ ...visitorInfo, [key]: e.target.value })}
                    onFocus={() => setFocused(key)}
                    onBlur={() => setFocused(null)}
                    style={{
                      ...inputBase,
                      borderColor: focused === key ? T.borderFocus : T.border,
                      background: focused === key ? T.bgInputFocus : T.bgInput,
                    }}
                  />
                </div>
              ))}

              <button
                type="submit"
                style={{
                  marginTop: 8, width: '100%', padding: '14px 24px',
                  background: T.accent, color: T.accentDark,
                  fontSize: 15, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(200,255,0,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.2s, transform 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
              >
                Start Assessment <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </Page>
    );
  }

  /* ════════════
     TEST STEP
  ════════════ */
  if (step === 'test' && questions.length > 0) {
    const question  = questions[currentQuestion];
    const progress  = ((currentQuestion + 1) / questions.length) * 100;
    const answered  = !!answers[question.id];
    const isLast    = currentQuestion === questions.length - 1;

    return (
      <Page>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textMuted, marginBottom: 8 }}>
              <span>Question {currentQuestion + 1} of {questions.length}</span>
              <span style={{ color: T.accent, fontWeight: 600 }}>{Math.round(progress)}% Complete</span>
            </div>
            <div style={{ width: '100%', height: 4, background: T.borderFaint, borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: T.accent, borderRadius: 9999, transition: 'width 0.4s ease', boxShadow: '0 0 10px rgba(200,255,0,0.40)' }} />
            </div>
          </div>

          {/* Question card */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: '40px', boxShadow: '0 25px 60px rgba(0,0,0,0.40)' }}>
            {/* Question number badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', borderRadius: 9999, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Question {currentQuestion + 1}
              </span>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.white, lineHeight: '30px', marginBottom: 28 }}>
              {question.question}
            </h2>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {question.options.map((option, idx) => {
                const selected = answers[question.id] === option;
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(option)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '14px 16px',
                      background: selected ? 'rgba(200,255,0,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selected ? 'rgba(200,255,0,0.40)' : T.borderFaint}`,
                      borderRadius: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'background 0.2s, border-color 0.2s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => {
                      if (!selected) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                        (e.currentTarget as HTMLElement).style.borderColor = T.border;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!selected) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                        (e.currentTarget as HTMLElement).style.borderColor = T.borderFaint;
                      }
                    }}
                  >
                    {/* Radio circle */}
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${selected ? T.accent : T.border}`,
                      background: selected ? T.accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s, border-color 0.2s',
                    }}>
                      {selected && <Check size={12} style={{ color: T.accentDark }} strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 14, color: selected ? T.white : T.textBody, fontWeight: selected ? 600 : 400, transition: 'color 0.2s', lineHeight: '22px' }}>
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Nav buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 20px', fontSize: 14, fontWeight: 600,
                  color: currentQuestion === 0 ? T.textMuted : T.textBody,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderFaint}`,
                  borderRadius: 10, cursor: currentQuestion === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentQuestion === 0 ? 0.45 : 1,
                  transition: 'background 0.2s, color 0.2s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (currentQuestion > 0) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              >
                <ArrowLeft size={16} /> Previous
              </button>

              {isLast ? (
                <button
                  onClick={handleSubmit}
                  disabled={!answered}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '12px 24px', fontSize: 14, fontWeight: 700,
                    background: answered ? T.accent : 'rgba(200,255,0,0.25)',
                    color: T.accentDark, borderRadius: 10, border: 'none',
                    cursor: answered ? 'pointer' : 'not-allowed',
                    boxShadow: answered ? '0 0 16px rgba(200,255,0,0.25)' : 'none',
                    transition: 'opacity 0.2s, transform 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (answered) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  Submit Assessment <Check size={16} strokeWidth={3} />
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!answered}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '12px 24px', fontSize: 14, fontWeight: 700,
                    background: answered ? T.accent : 'rgba(200,255,0,0.25)',
                    color: T.accentDark, borderRadius: 10, border: 'none',
                    cursor: answered ? 'pointer' : 'not-allowed',
                    boxShadow: answered ? '0 0 16px rgba(200,255,0,0.25)' : 'none',
                    transition: 'opacity 0.2s, transform 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (answered) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  Next <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Dots indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24, flexWrap: 'wrap' }}>
            {questions.map((q, i) => (
              <div key={i} style={{
                width: i === currentQuestion ? 20 : 8, height: 8, borderRadius: 9999,
                background: answers[q.id]
                  ? T.accent
                  : i === currentQuestion
                    ? 'rgba(200,255,0,0.40)'
                    : T.borderFaint,
                transition: 'all 0.3s ease',
                boxShadow: answers[q.id] ? '0 0 6px rgba(200,255,0,0.35)' : 'none',
              }} />
            ))}
          </div>
        </div>
      </Page>
    );
  }

  /* ════════════
     RESULTS
  ════════════ */
  if (step === 'results') {
    const perf       = getPerformance();
    const percentage = Math.round((score / totalQuestions) * 100);

    const recommendations: Record<string, string[]> = {
      low: [
        'Consider enrolling in comprehensive cybersecurity training',
        'Review basic security concepts and best practices',
        'Stay updated on the latest security threats in your region',
      ],
      mid: [
        'Good foundation! Consider advanced training modules',
        'Focus on emerging threats and regional attack trends',
        'Practice identifying phishing attempts and social engineering',
      ],
      high: [
        'Excellent knowledge! Help train others in your organization',
        'Stay current with the evolving MENA security landscape',
        'Consider specialized security certifications (CISSP, CEH)',
      ],
    };
    const recs = percentage >= 90 ? recommendations.high : percentage >= 70 ? recommendations.mid : recommendations.low;

    return (
      <Page>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: '44px 40px', boxShadow: '0 25px 60px rgba(0,0,0,0.45)', textAlign: 'center' }}>
            {/* Accent bar */}
            <div style={{ width: 40, height: 3, background: T.accent, borderRadius: 9999, margin: '0 auto 32px' }} />

            {/* Score circle */}
            <div style={{
              width: 120, height: 120, borderRadius: '50%', margin: '0 auto 28px',
              background: `${perf.bgAlpha}`,
              border: `2px solid ${perf.borderAlpha}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 32px ${perf.bgAlpha}`,
            }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: perf.color, lineHeight: 1 }}>{percentage}%</span>
              <span style={{ fontSize: 11, color: T.textMuted, marginTop: 4, letterSpacing: '0.5px' }}>CORRECT</span>
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 900, color: T.white, letterSpacing: '-0.4px', margin: '0 0 8px' }}>
              Assessment Complete!
            </h1>
            <p style={{ fontSize: 15, color: T.textBody, margin: '0 0 20px' }}>
              You scored <strong style={{ color: T.white }}>{score}</strong> out of <strong style={{ color: T.white }}>{totalQuestions}</strong> questions correctly.
            </p>

            {/* Level badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 20px', borderRadius: 9999, background: perf.bgAlpha, border: `1px solid ${perf.borderAlpha}`, marginBottom: 32 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: perf.color }}>{perf.level}</span>
            </div>

            {/* Recommendations */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderFaint}`,
              borderRadius: 12, padding: '20px 24px', marginBottom: 28, textAlign: 'left',
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Recommendations
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recs.map((rec, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: T.textBody, lineHeight: '20px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, marginTop: 7, flexShrink: 0, boxShadow: '0 0 6px rgba(200,255,0,0.50)' }} />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => onNavigate('landing')}
                style={{
                  width: '100%', padding: '14px 24px', fontSize: 15, fontWeight: 700,
                  background: T.accent, color: T.accentDark, borderRadius: 10, border: 'none', cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(200,255,0,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.2s, transform 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
              >
                Request a Demo to Improve Your Skills
                <ArrowRight size={16} />
              </button>

              <button
                onClick={() => onNavigate('landing')}
                style={{
                  width: '100%', padding: '14px 24px', fontSize: 15, fontWeight: 600,
                  background: 'rgba(255,255,255,0.04)', color: T.textBody,
                  border: `1px solid ${T.borderFaint}`, borderRadius: 10, cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = T.white; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = T.textBody; }}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  return null;
};
