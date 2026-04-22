import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Clock, TrendingUp, Lock, AlertCircle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { formatLocalizedDate, formatLocalizedNumber } from '../../i18n/utils';
import { supabase } from '../../lib/supabase';
import { ExamViewerPage } from './ExamViewerPage';

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
  yellow:      '#fbbf24',
  yellowBg:    'rgba(251,191,36,0.08)',
  yellowBorder:'rgba(251,191,36,0.22)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  redBorder:   'rgba(248,113,113,0.22)',
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .aw-exam-card {
    background: #1a1e0e;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    overflow: hidden;
    transition: border-color 0.22s, box-shadow 0.22s, transform 0.18s;
    font-family: 'Inter', sans-serif;
  }
  .aw-exam-card.can-take:hover {
    border-color: rgba(200,255,0,0.25);
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    transform: translateY(-2px);
  }
  .aw-exam-card.locked {
    opacity: 0.65;
  }

  .aw-start-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 18px rgba(200,255,0,0.20);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-start-btn:hover { opacity: 0.88; transform: translateY(-1px); }

  .aw-locked-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); color: #64748b; cursor: not-allowed;
  }

  .aw-meta-row {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 12px; padding: 5px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .aw-meta-row:last-child { border-bottom: none; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (typeof document !== 'undefined' && !document.getElementById('aw-exams-styles')) {
  const tag = document.createElement('style');
  tag.id = 'aw-exams-styles';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface ExamWithStatus {
  exam_id: string; assignment_id: string; title: string; description: string;
  time_limit_minutes: number; passing_score: number; exam_type: string;
  prerequisite_course_id: string | null; due_date: string | null;
  max_attempts: number; attempts_used: number; is_mandatory: boolean;
}
type Props = { onExamCompleted: () => void; };

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const MyExamsPage: React.FC<Props> = ({ onExamCompleted }) => {
  const { user }    = useAuth();
  const { t, i18n } = useTranslation(['common', 'employee']);
  const [exams, setExams]           = useState<ExamWithStatus[]>([]);
  const [loading, setLoading]       = useState(true);
  const [viewingExam, setViewingExam] = useState<ExamWithStatus | null>(null);
  const currentLanguage = i18n.resolvedLanguage;

  useEffect(() => { loadExams(); }, [user]);

  const loadExams = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_available_exams').select('*')
        .eq('employee_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) { console.error('Error loading exams:', error); return; }
      setExams(data || []);
    } catch (err) { console.error('Error loading exams:', err); }
    finally { setLoading(false); }
  };

  /* Redirect to exam viewer */
  if (viewingExam) return (
    <ExamViewerPage
      examId={viewingExam.exam_id} examTitle={viewingExam.title}
      examType={viewingExam.exam_type} timeLimit={viewingExam.time_limit_minutes}
      passingScore={viewingExam.passing_score}
      onBack={() => { setViewingExam(null); loadExams(); onExamCompleted(); }}
    />
  );

  /* Loading */
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: T.accent, animation: 'aw-spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 14, color: T.textBody }}>Loading assessments…</p>
    </div>
  );

  /* Stats */
  const totalExams        = exams.length;
  const examsWithAttempts = exams.filter(e => e.attempts_used > 0).length;
  const attemptsRemaining = exams.reduce((sum, e) => sum + (e.max_attempts - e.attempts_used), 0);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <div className="aw-fade-up" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardCheck size={18} style={{ color: T.accent }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: T.white, letterSpacing: '-0.3px', margin: 0 }}>
            {t('exams.title', { ns: 'employee' })}
          </h1>
        </div>
        <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
          {t('exams.subtitle', { ns: 'employee' })}
        </p>

        {/* Banner */}
        {exams.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: T.yellowBg, border: `1px solid ${T.yellowBorder}`, borderRadius: 10 }}>
            <AlertCircle size={15} style={{ color: T.yellow, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: T.yellow, margin: 0, fontWeight: 500 }}>
              {t('exams.assignedBanner', { ns: 'employee' })}
            </p>
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      {totalExams > 0 && (
        <div className="aw-fade-up" style={{ animationDelay: '0.05s', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          {[
            { icon: ClipboardCheck, color: T.accent,   bg: 'rgba(200,255,0,0.08)',   border: 'rgba(200,255,0,0.20)',   label: t('exams.summary.total',            { ns: 'employee' }), value: totalExams        },
            { icon: Clock,          color: T.green,    bg: T.greenBg,               border: T.greenBorder,            label: t('exams.summary.inProgress',       { ns: 'employee' }), value: examsWithAttempts  },
            { icon: TrendingUp,     color: '#60a5fa',  bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.22)', label: t('exams.summary.attemptsRemaining',{ ns: 'employee' }), value: attemptsRemaining  },
          ].map(({ icon: Icon, color, bg, border, label, value }) => (
            <div key={label} style={{ padding: '14px 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, minWidth: 160 }}>
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
      {exams.length === 0 ? (
        <div className="aw-fade-up" style={{ textAlign: 'center', padding: '64px 24px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ClipboardCheck size={26} style={{ color: T.accent }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, marginBottom: 6 }}>
            {t('exams.empty.title', { ns: 'employee' })}
          </h3>
          <p style={{ fontSize: 14, color: T.textBody }}>
            {t('exams.empty.description', { ns: 'employee' })}
          </p>
        </div>
      ) : (
        /* ── Exam cards grid ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {exams.map((exam, idx) => {
            const hasAttempted = exam.attempts_used > 0;
            const canTake      = exam.attempts_used < exam.max_attempts;
            const isPre        = exam.exam_type === 'PRE_ASSESSMENT';

            return (
              <div
                key={exam.exam_id}
                className={`aw-exam-card aw-fade-up ${canTake ? 'can-take' : 'locked'}`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Top accent */}
                <div style={{ height: 3, background: canTake ? 'linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))' : 'rgba(255,255,255,0.06)' }} />

                <div style={{ padding: '20px 22px 22px' }}>

                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: canTake ? 'rgba(200,255,0,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${canTake ? 'rgba(200,255,0,0.20)' : T.borderFaint}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {canTake
                        ? <ClipboardCheck size={18} style={{ color: T.accent }} />
                        : <Lock size={18} style={{ color: T.textMuted }} />
                      }
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: isPre ? T.yellowBg : T.greenBg, border: `1px solid ${isPre ? T.yellowBorder : T.greenBorder}`, color: isPre ? T.yellow : T.green }}>
                        {isPre ? t('exams.types.pre', { ns: 'employee' }) : t('exams.types.post', { ns: 'employee' })}
                      </span>
                      {exam.is_mandatory && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}>
                          {t('labels.mandatory', { ns: 'common' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & description */}
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 6px', lineHeight: '22px' }}>{exam.title}</h3>
                  {exam.description && (
                    <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 14px', lineHeight: '20px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {exam.description}
                    </p>
                  )}

                  {/* Quick meta */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.textMuted }}>
                      <Clock size={12} style={{ color: T.textMuted }} />
                      {formatLocalizedNumber(exam.time_limit_minutes || 30, currentLanguage)} {t('labels.minutes', { ns: 'common' })}
                    </span>
                    <span style={{ fontSize: 12, color: T.textMuted }}>
                      {t('labels.passing', { ns: 'common' })}: <strong style={{ color: T.textLabel }}>{formatLocalizedNumber(exam.passing_score, currentLanguage)}%</strong>
                    </span>
                  </div>

                  {/* Attempts detail */}
                  {hasAttempted && (
                    <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderFaint}`, borderRadius: 10, marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
                        {t('exams.attempts.title', { ns: 'employee' })}
                      </p>
                      <div className="aw-meta-row">
                        <span style={{ color: T.textMuted }}>{t('labels.used', { ns: 'common' })}</span>
                        <span style={{ color: T.textLabel, fontWeight: 600 }}>
                          {formatLocalizedNumber(exam.attempts_used, currentLanguage)} / {formatLocalizedNumber(exam.max_attempts, currentLanguage)}
                        </span>
                      </div>
                      <div className="aw-meta-row">
                        <span style={{ color: T.textMuted }}>{t('labels.remaining', { ns: 'common' })}</span>
                        <span style={{ color: canTake ? T.accent : T.red, fontWeight: 700 }}>
                          {formatLocalizedNumber(exam.max_attempts - exam.attempts_used, currentLanguage)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Due date */}
                  {exam.due_date && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: T.yellowBg, border: `1px solid ${T.yellowBorder}`, borderRadius: 9, marginBottom: 12 }}>
                      <Clock size={13} style={{ color: T.yellow, flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: T.yellow, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('labels.dueDate', { ns: 'common' })}
                        </p>
                        <p style={{ fontSize: 12, color: T.yellow, margin: 0, opacity: 0.80 }}>
                          {formatLocalizedDate(exam.due_date, currentLanguage)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* No attempts left */}
                  {!canTake && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 9, marginBottom: 12 }}>
                      <AlertCircle size={13} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 12, color: T.red, margin: 0, lineHeight: '18px' }}>
                        {t('exams.attempts.exhaustedMessage', { ns: 'employee', value: formatLocalizedNumber(exam.max_attempts, currentLanguage) })}
                      </p>
                    </div>
                  )}

                  {/* CTA button */}
                  {canTake ? (
                    <button className="aw-start-btn" onClick={() => setViewingExam(exam)}>
                      <ClipboardCheck size={15} />
                      {hasAttempted ? t('exams.attempts.retake', { ns: 'employee' }) : t('exams.attempts.start', { ns: 'employee' })}
                      <ChevronRight size={14} style={{ marginLeft: 2 }} />
                    </button>
                  ) : (
                    <button className="aw-locked-btn" disabled>
                      <Lock size={14} />
                      {t('exams.attempts.noneLeft', { ns: 'employee' })}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
