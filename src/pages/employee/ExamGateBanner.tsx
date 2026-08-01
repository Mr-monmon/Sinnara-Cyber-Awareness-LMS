import { AlertTriangle, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import type { MandatoryExamGate } from "../../hooks/useMandatoryExamGate";

/**
 * Explains why the rest of the employee area is unavailable.
 *
 * Without this the lock is silent — nav items simply stop responding — so the
 * banner states the reason, the count, and the nearest deadline. It also
 * surfaces the one case the gate deliberately does not block on: mandatory
 * assessments with no attempts left, which only an administrator can clear.
 */
export const ExamGateBanner = ({ gate }: { gate: MandatoryExamGate }) => {
  const { tokens: T } = useTheme();
  const { t, i18n } = useTranslation("employee");

  if (gate.loading) return null;
  if (!gate.blocked && gate.exhausted.length === 0) return null;

  const nearestDue = gate.blocking
    .map((e) => e.due_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.resolvedLanguage === "ar" ? "ar-SA" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <>
      {gate.blocked && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 16px",
            marginBottom: 20,
            borderRadius: 10,
            background: `${T.accent}14`,
            border: `1px solid ${T.accent}40`,
          }}
        >
          <Lock size={18} style={{ color: T.accent, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.white }}>
              {t("exams.gate.title")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textBody, lineHeight: 1.6 }}>
              {t("exams.gate.body", { count: gate.blocking.length })}
              {nearestDue && ` · ${t("exams.gate.dueOn", { date: formatDate(nearestDue) })}`}
            </p>
          </div>
        </div>
      )}

      {gate.exhausted.length > 0 && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 16px",
            marginBottom: 20,
            borderRadius: 10,
            background: `${T.red}14`,
            border: `1px solid ${T.red}40`,
          }}
        >
          <AlertTriangle size={18} style={{ color: T.red, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.white }}>
              {t("exams.gate.exhaustedTitle")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textBody, lineHeight: 1.6 }}>
              {t("exams.gate.exhaustedBody", { count: gate.exhausted.length })}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ExamGateBanner;
