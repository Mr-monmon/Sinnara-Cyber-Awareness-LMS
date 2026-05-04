import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  AlertCircle,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { formatLocalizedNumber } from "../../i18n/utils";

/* ─────────────────────────────────────────
   TOKENS
───────────────────────────────────────── */
const T = {
  bg: "#12140a",
  bgCard: "#1a1e0e",
  accent: "#c8ff00",
  accentDark: "#12140a",
  white: "#ffffff",
  textBody: "#94a3b8",
  textLabel: "#cbd5e1",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.09)",
  borderFaint: "rgba(255,255,255,0.05)",
  green: "#34d399",
  greenBg: "rgba(52,211,153,0.08)",
  greenBorder: "rgba(52,211,153,0.22)",
  red: "#f87171",
} as const;

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Option button ── */
  .aw-option-btn {
    width: 100%; display: flex; align-items: center; gap: 14px;
    padding: 14px 18px; border-radius: 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.08);
    cursor: pointer; text-align: left; font-family: 'Inter', sans-serif;
    font-size: 14px; color: #cbd5e1;
    transition: background 0.18s, border-color 0.18s, transform 0.12s;
  }
  .aw-option-btn:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.14); }
  .aw-option-btn.selected {
    background: rgba(200,255,0,0.08);
    border-color: rgba(200,255,0,0.40);
    color: #ffffff;
  }

  /* ── Nav dot ── */
  .aw-nav-dot {
    aspect-ratio: 1; border-radius: 7px; font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: all 0.18s;
    font-family: 'Inter', sans-serif;
  }
  .aw-nav-dot.current  { background: #c8ff00; color: #12140a; }
  .aw-nav-dot.answered { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.30); }
  .aw-nav-dot.unanswered { background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.07); }
  .aw-nav-dot.unanswered:hover { background: rgba(255,255,255,0.08); color: #cbd5e1; }

  /* ── Primary btn ── */
  .aw-btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px 28px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
    background: #c8ff00; color: #12140a;
    box-shadow: 0 0 20px rgba(200,255,0,0.22);
    transition: opacity 0.2s, transform 0.15s;
  }
  .aw-btn-primary:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  .aw-btn-primary:disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed; box-shadow: none; }

  /* ── Ghost btn ── */
  .aw-btn-ghost {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 22px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
    color: #94a3b8; transition: background 0.18s, color 0.18s, transform 0.15s;
  }
  .aw-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #ffffff; transform: translateY(-1px); }
  .aw-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Tip row ── */
  .aw-tip-row { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: #94a3b8; line-height: 22px; }

  @keyframes aw-spin    { to { transform: rotate(360deg); } }
  @keyframes aw-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .aw-fade-up { animation: aw-fade-up 0.4s ease both; }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("aw-exam-styles")
) {
  const tag = document.createElement("style");
  tag.id = "aw-exam-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface ExamQuestion {
  id: string;
  exam_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  order_index: number;
}
interface ExamViewerProps {
  examId: string;
  examTitle: string;
  examType: string;
  timeLimit: number;
  passingScore: number;
  onBack: () => void;
}
interface ExamAccessResponse {
  assignment_id: string | null;
  attempts_used: number;
  can_take_exam: boolean;
  has_passed: boolean;
  max_attempts: number;
}

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */
export const ExamViewerPage: React.FC<ExamViewerProps> = ({
  examId,
  examTitle,
  examType,
  timeLimit,
  passingScore,
  onBack,
}) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(["common", "employee"]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(timeLimit * 60);
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(0);
  const currentLanguage = i18n.resolvedLanguage;
  const isRtl = i18n.dir() === "rtl";

  useEffect(() => {
    checkAccessAndLoad();
  }, [examId, user]);

  const checkAccessAndLoad = async () => {
    if (!user?.id || !examId) return;
    try {
      const { data, error } = await supabase
        .rpc("employee_has_exam_access", {
          p_employee_id: user.id,
          p_exam_id: examId,
        })
        .maybeSingle<ExamAccessResponse>();
      if (error || !data) {
        alert(t("examViewer.accessError", { ns: "employee" }));
        onBack();
        return;
      }
      if (!data.can_take_exam) {
        alert(
          data.has_passed
            ? t("examViewer.alreadyPassed", { ns: "employee" })
            : t("examViewer.noAttemptsLeft", { ns: "employee" })
        );
        onBack();
        return;
      }
      setAssignmentId(data.assignment_id);
      setAttemptsRemaining(data.max_attempts - data.attempts_used);
      await loadQuestions();
    } catch {
      alert(t("examViewer.accessError", { ns: "employee" }));
      onBack();
    }
  };

  useEffect(() => {
    if (examStarted && !examSubmitted && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [examStarted, examSubmitted, timeRemaining]);

  const loadQuestions = async () => {
    try {
      const { data } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("exam_id", examId)
        .order("order_index");
      if (data) setQuestions(data);
    } catch (err) {
      console.error("Error loading questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) =>
    setAnswers({ ...answers, [questions[currentQuestionIndex].id]: answer });

  const handleAutoSubmit = () => handleSubmit();

  const handleSubmit = async () => {
    if (!user) return;
    let correctCount = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correct_answer) correctCount++;
    });
    const finalScore = Math.round((correctCount / questions.length) * 100);
    const didPass = finalScore >= passingScore;
    setExamSubmitted(true);
    try {
      await supabase.from("exam_results").insert([
        {
          employee_id: user.id,
          exam_id: examId,
          assignment_id: assignmentId,
          score: correctCount,
          total_questions: questions.length,
          percentage: finalScore,
          passed: didPass,
          answers: questions.map((q) => ({
            question: q.question,
            selected_answer: answers[q.id] || "Not answered",
            correct_answer: q.correct_answer,
            is_correct: answers[q.id] === q.correct_answer,
          })),
          started_at: new Date(
            Date.now() - (timeLimit * 60 - timeRemaining) * 1000
          ).toISOString(),
          completed_at: new Date().toISOString(),
        },
      ]);

      await supabase
        .from("assigned_exams")
        .update({
          status: "completed",
        })
        .eq("id", assignmentId)
        .eq("assigned_to_employee", user.id);
    } catch (err) {
      console.error("Error saving exam result:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAnsweredCount = () => Object.keys(answers).length;

  /* ── STAT BOX ── */
  const StatBox = ({
    value,
    label,
    color = T.accent,
  }: {
    value: string | number;
    label: string;
    color?: string;
  }) => (
    <div
      style={{
        padding: "16px",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${T.borderFaint}`,
        borderRadius: 10,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: T.textMuted }}>{label}</div>
    </div>
  );

  /* ── LOADING ── */
  if (loading)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 14,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.06)",
            borderTopColor: T.accent,
            animation: "aw-spin 0.8s linear infinite",
          }}
        />
        <p style={{ fontSize: 14, color: T.textBody }}>
          {t("examViewer.loading", { ns: "employee" })}
        </p>
      </div>
    );

  /* ── NO QUESTIONS ── */
  if (questions.length === 0)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 16,
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "rgba(248,113,113,0.10)",
            border: "1px solid rgba(248,113,113,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlertCircle size={26} style={{ color: T.red }} />
        </div>
        <h2
          style={{ fontSize: 18, fontWeight: 700, color: T.white, margin: 0 }}
        >
          {t("examViewer.noQuestionsTitle", { ns: "employee" })}
        </h2>
        <p style={{ fontSize: 14, color: T.textBody, margin: 0 }}>
          {t("examViewer.noQuestionsDescription", { ns: "employee" })}
        </p>
        <button className="aw-btn-ghost" onClick={onBack}>
          {t("actions.goBack", { ns: "common" })}
        </button>
      </div>
    );

  /* ══════════════════════════════════════
     START SCREEN
  ══════════════════════════════════════ */
  if (!examStarted)
    return (
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Back */}
        <button
          className="aw-btn-ghost"
          onClick={onBack}
          style={{ marginBottom: 28, padding: "8px 16px" }}
        >
          <ArrowLeft
            size={15}
            style={{ transform: isRtl ? "rotate(180deg)" : "none" }}
          />
          {t("examViewer.backToAssessments", { ns: "employee" })}
        </button>

        <div
          className="aw-fade-up"
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {/* Accent bar */}
          <div
            style={{
              height: 3,
              background:
                "linear-gradient(90deg, #c8ff00, rgba(200,255,0,0.20))",
            }}
          />

          {/* Header */}
          <div style={{ padding: "36px 36px 28px", textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "rgba(200,255,0,0.08)",
                border: "1px solid rgba(200,255,0,0.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
              }}
            >
              <ClipboardCheck size={24} style={{ color: T.accent }} />
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: T.white,
                letterSpacing: "-0.3px",
                margin: "0 0 10px",
              }}
            >
              {examTitle}
            </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 14px",
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
                background:
                  examType === "PRE_ASSESSMENT"
                    ? "rgba(251,191,36,0.10)"
                    : T.greenBg,
                border: `1px solid ${
                  examType === "PRE_ASSESSMENT"
                    ? "rgba(251,191,36,0.28)"
                    : T.greenBorder
                }`,
                color: examType === "PRE_ASSESSMENT" ? "#fbbf24" : T.green,
              }}
            >
              {examType === "PRE_ASSESSMENT"
                ? t("exams.types.pre", { ns: "employee" })
                : t("exams.types.post", { ns: "employee" })}
            </span>
          </div>

          {/* Stats grid */}
          <div
            style={{
              padding: "0 36px",
              display: "grid",
              gridTemplateColumns: `repeat(${
                attemptsRemaining > 0 ? 4 : 3
              }, 1fr)`,
              gap: 10,
              marginBottom: 24,
            }}
          >
            <StatBox
              value={formatLocalizedNumber(questions.length, currentLanguage)}
              label={t("examViewer.questions", { ns: "employee" })}
            />
            <StatBox
              value={formatLocalizedNumber(timeLimit, currentLanguage)}
              label={t("labels.minutes", { ns: "common" })}
            />
            <StatBox
              value={`${formatLocalizedNumber(passingScore, currentLanguage)}%`}
              label={t("examViewer.passingScore", { ns: "employee" })}
            />
            {attemptsRemaining > 0 && (
              <StatBox
                value={formatLocalizedNumber(
                  attemptsRemaining,
                  currentLanguage
                )}
                label={t("exams.summary.attemptsRemaining", { ns: "employee" })}
                color="#60a5fa"
              />
            )}
          </div>

          {/* Instructions */}
          <div
            style={{
              margin: "0 36px 28px",
              padding: "20px",
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${T.borderFaint}`,
              borderRadius: 12,
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.textMuted,
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              {t("examViewer.instructionsTitle", { ns: "employee" })}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  icon: <Check size={14} />,
                  text: t("examViewer.tipAnswerAll", { ns: "employee" }),
                  color: T.green,
                },
                {
                  icon: <Check size={14} />,
                  text: t("examViewer.tipNavigate", { ns: "employee" }),
                  color: T.green,
                },
                {
                  icon: <Check size={14} />,
                  text: t("examViewer.tipAutoSubmit", { ns: "employee" }),
                  color: T.green,
                },
                {
                  icon: <AlertCircle size={14} />,
                  text: t("examViewer.tipCannotPause", { ns: "employee" }),
                  color: "#fbbf24",
                },
              ].map(({ icon, text, color }, i) => (
                <div key={i} className="aw-tip-row">
                  <span style={{ color, flexShrink: 0, marginTop: 3 }}>
                    {icon}
                  </span>
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Start button */}
          <div style={{ padding: "0 36px 32px" }}>
            <button
              className="aw-btn-primary"
              style={{ width: "100%", fontSize: 15 }}
              onClick={() => setExamStarted(true)}
            >
              {t("examViewer.startAssessment", { ns: "employee" })}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );

  /* ══════════════════════════════════════
     SUBMITTED SCREEN
  ══════════════════════════════════════ */
  if (examSubmitted)
    return (
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          className="aw-fade-up"
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            overflow: "hidden",
            textAlign: "center",
          }}
        >
          <div
            style={{
              height: 3,
              background:
                "linear-gradient(90deg, #34d399, rgba(52,211,153,0.20))",
            }}
          />
          <div style={{ padding: "40px 36px 32px" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: T.greenBg,
                border: `1px solid ${T.greenBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 0 24px rgba(52,211,153,0.12)",
              }}
            >
              <Check size={28} style={{ color: T.green }} />
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: T.white,
                margin: "0 0 20px",
                letterSpacing: "-0.3px",
              }}
            >
              {t("examViewer.submittedTitle", { ns: "employee" })}
            </h1>

            <div
              style={{
                padding: "18px 20px",
                background: T.greenBg,
                border: `1px solid ${T.greenBorder}`,
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  color: T.green,
                  fontWeight: 700,
                  margin: "0 0 6px",
                }}
              >
                {t("examViewer.submittedRecorded", { ns: "employee" })}
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: T.textBody,
                  margin: 0,
                  lineHeight: "20px",
                }}
              >
                {t("examViewer.submittedDescription", { ns: "employee" })}
              </p>
            </div>

            <div
              style={{
                padding: "18px 20px",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${T.borderFaint}`,
                borderRadius: 12,
                marginBottom: 24,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.textMuted,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                {t("examViewer.nextStepsTitle", { ns: "employee" })}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  t("examViewer.nextStepsReview", { ns: "employee" }),
                  t("examViewer.nextStepsHistory", { ns: "employee" }),
                  t("examViewer.nextStepsFeedback", { ns: "employee" }),
                ].map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: T.textBody,
                      justifyContent: "center",
                    }}
                  >
                    <Check
                      size={13}
                      style={{ color: T.green, flexShrink: 0 }}
                    />
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="aw-btn-primary"
              style={{ width: "100%" }}
              onClick={onBack}
            >
              {t("examViewer.returnToAssessments", { ns: "employee" })}
            </button>
          </div>
        </div>
      </div>
    );

  /* ══════════════════════════════════════
     EXAM IN PROGRESS
  ══════════════════════════════════════ */
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLowTime = timeRemaining < 300;
  const allAnswered = getAnsweredCount() === questions.length;
  const isLast = currentQuestionIndex === questions.length - 1;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* ── Sticky top bar ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(18,20,10,0.95)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: `1px solid ${T.border}`,
          padding: "12px 0",
          marginBottom: 24,
        }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            {/* Progress text */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 13, color: T.textMuted }}>
                {t("examViewer.questionOf", {
                  ns: "employee",
                  current: formatLocalizedNumber(
                    currentQuestionIndex + 1,
                    currentLanguage
                  ),
                  total: formatLocalizedNumber(
                    questions.length,
                    currentLanguage
                  ),
                })}
              </span>
              <span style={{ fontSize: 12, color: T.textMuted }}>
                {t("examViewer.answered", {
                  ns: "employee",
                  answered: formatLocalizedNumber(
                    getAnsweredCount(),
                    currentLanguage
                  ),
                  total: formatLocalizedNumber(
                    questions.length,
                    currentLanguage
                  ),
                })}
              </span>
            </div>

            {/* Timer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 14px",
                borderRadius: 8,
                background: isLowTime
                  ? "rgba(248,113,113,0.10)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  isLowTime ? "rgba(248,113,113,0.30)" : T.borderFaint
                }`,
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: 14,
                color: isLowTime ? T.red : T.white,
                transition: "all 0.3s",
              }}
            >
              <Clock
                size={14}
                style={{ color: isLowTime ? T.red : T.textMuted }}
              />
              {formatTime(timeRemaining)}
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 9999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: T.accent,
                borderRadius: 9999,
                boxShadow: "0 0 8px rgba(200,255,0,0.40)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 40px" }}>
        {/* ── Question card ── */}
        <div
          className="aw-fade-up"
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: "28px",
            marginBottom: 16,
          }}
        >
          {/* Question number badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px",
              background: "rgba(200,255,0,0.07)",
              border: "1px solid rgba(200,255,0,0.18)",
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 700,
              color: T.accent,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Question {currentQuestionIndex + 1} / {questions.length}
          </div>

          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: T.white,
              lineHeight: "28px",
              marginBottom: 24,
              letterSpacing: "-0.2px",
            }}
          >
            {currentQuestion.question}
          </h2>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {currentQuestion.options.map((option, index) => {
              const isSelected = answers[currentQuestion.id] === option;
              return (
                <button
                  key={index}
                  className={`aw-option-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => handleAnswerSelect(option)}
                  style={{ textAlign: isRtl ? "right" : "left" }}
                >
                  {/* Radio circle */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      flexShrink: 0,
                      border: `2px solid ${
                        isSelected ? T.accent : "rgba(255,255,255,0.20)"
                      }`,
                      background: isSelected ? T.accent : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.18s",
                    }}
                  >
                    {isSelected && (
                      <Check size={11} style={{ color: T.accentDark }} />
                    )}
                  </div>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Navigation ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <button
            className="aw-btn-ghost"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQ((prev) => prev - 1)}
          >
            <ArrowLeft
              size={15}
              style={{ transform: isRtl ? "rotate(180deg)" : "none" }}
            />
            {t("actions.previous", { ns: "common" })}
          </button>

          {isLast ? (
            <button
              className="aw-btn-primary"
              disabled={!allAnswered}
              onClick={handleSubmit}
            >
              <Check size={15} />
              {t("examViewer.submitAssessment", { ns: "employee" })}
            </button>
          ) : (
            <button
              className="aw-btn-primary"
              onClick={() => setCurrentQ((prev) => prev + 1)}
            >
              {t("actions.next", { ns: "common" })}
              <ArrowRight
                size={15}
                style={{ transform: isRtl ? "rotate(180deg)" : "none" }}
              />
            </button>
          )}
        </div>

        {/* ── Quick navigation ── */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "18px 20px",
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.textMuted,
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            {t("examViewer.quickNavigation", { ns: "employee" })}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(38px, 1fr))",
              gap: 6,
            }}
          >
            {questions.map((_, index) => {
              const isCurrent = index === currentQuestionIndex;
              const isAnswered = !!answers[questions[index].id];
              return (
                <button
                  key={index}
                  className={`aw-nav-dot ${
                    isCurrent
                      ? "current"
                      : isAnswered
                      ? "answered"
                      : "unanswered"
                  }`}
                  style={{ padding: "8px 0" }}
                  onClick={() => setCurrentQ(index)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Current", color: T.accent, bg: T.accent },
              { label: "Answered", color: T.green, bg: T.greenBg },
              {
                label: "Unanswered",
                color: T.textMuted,
                bg: "rgba(255,255,255,0.04)",
              },
            ].map(({ label, color, bg }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: T.textMuted,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: bg,
                  }}
                />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
