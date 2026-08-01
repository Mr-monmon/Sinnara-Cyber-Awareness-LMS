import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { captureException } from '../lib/sentry';
import type { EmployeeAvailableExam } from '../lib/types';

/**
 * useMandatoryExamGate — decides whether an employee must sit an assessment
 * before doing anything else in the platform.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * This covers *only* the assessments on "My Assessments": rows of the `exams`
 * table surfaced through the `employee_available_exams` view, which is the exact
 * same source that screen reads. The quizzes embedded in training courses are a
 * different thing entirely — they are `course_sections` rows of type QUIZ, never
 * touch `exams`, and are deliberately left to the employee's own pace.
 *
 * Compliance assessments are assigned with a deadline and are the point of the
 * training, so once one is outstanding the employee is held on the assessments
 * screen rather than being free to browse courses. The gate is a UI escort, not
 * an authorisation boundary: exam and course data are already protected by RLS,
 * and this only removes the temptation to wander off before finishing.
 *
 * ── What does not block ──────────────────────────────────────────────────────
 * An assigned assessment blocks only when the employee can actually sit it right
 * now. These cases are deliberately let through:
 *
 *   - Non-mandatory assignments. Optional assessments are, by definition,
 *     optional.
 *   - Assessments gated behind a course the employee hasn't completed. Blocking
 *     those would deadlock: the assessment demands a course, and the gate
 *     forbids the course. Such an assessment starts blocking as soon as its
 *     prerequisite is completed.
 *   - Pre-assessments whose single attempt has been used. A pre-assessment
 *     measures a starting level, so failing one is an expected outcome and not
 *     a problem to escalate — once it has been sat, its job is done.
 *   - Post-assessments with no attempts left and no pass, and assignments whose
 *     `max_attempts` is missing or non-positive. Nothing the employee does can
 *     clear either, so holding them hostage would lock them out of the platform
 *     permanently. They are surfaced as needing an administrator instead (see
 *     `exhausted`).
 */

/** The view exposes more than the shared type declares; these are the extra columns used here. */
type AvailableExamRow = EmployeeAvailableExam & {
  assignment_id: string;
  due_date: string | null;
  prerequisite_course_id: string | null;
};

export interface MandatoryExamGate {
  loading: boolean;
  /**
   * False only until the first evaluation completes. Callers should gate their
   * shell on this rather than on `loading`: `refresh()` sets `loading` on every
   * call, so blanking the page on it would tear the whole dashboard down and
   * rebuild it every time an assessment is finished.
   */
  settled: boolean;
  /** Mandatory assessments the employee must sit now — non-empty means the UI is locked. */
  blocking: AvailableExamRow[];
  /**
   * Mandatory post-assessments that are out of attempts and unpassed. Only an
   * administrator can clear these, so they are shown as a warning rather than
   * used to lock the account.
   */
  exhausted: AvailableExamRow[];
  blocked: boolean;
  /** Set when the gate could not be evaluated. The gate fails open in this case. */
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * A pre-assessment is a one-shot measurement of starting level. Once the
 * attempt is spent the assessment has served its purpose whatever the score, so
 * it must neither block nor be reported as a problem.
 */
function isPreAssessment(exam: AvailableExamRow): boolean {
  return exam.exam_type === 'PRE_ASSESSMENT';
}

/**
 * Whether the employee can actually start this assessment right now.
 *
 * This must agree exactly with MyExamsPage's `attempts_used < max_attempts`,
 * because that screen is the only place the gate lets them reach. Disagreeing
 * is a lockout: `assigned_exams.max_attempts` is nullable (and an admin can set
 * it to 0), and treating a null as "unlimited" here while the exams screen
 * renders a disabled button would hold the employee on a page that offers them
 * nothing to do, with no state transition that could ever release them.
 *
 * So a missing or non-positive limit means "cannot be taken", not "unlimited".
 * Such an assignment is a misconfiguration only an admin can fix, and is
 * reported through `exhausted` rather than used to lock the account.
 */
function canBeTakenNow(exam: AvailableExamRow): boolean {
  const max = Number(exam.max_attempts);
  const used = Number(exam.attempts_used);
  if (!Number.isFinite(max) || max <= 0) return false;
  if (!Number.isFinite(used)) return false;
  return used < max;
}

export function useMandatoryExamGate(employeeId: string | undefined): MandatoryExamGate {
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState<AvailableExamRow[]>([]);
  const [exhausted, setExhausted] = useState<AvailableExamRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setBlocking([]);
      setExhausted([]);
      setError(null);
      setLoading(false);
      setSettled(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // The view already excludes assessments the employee has passed and
      // assignments that aren't active, so everything returned is outstanding.
      const { data, error: examsError } = await supabase
        .from('employee_available_exams')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_mandatory', true)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (examsError) throw new Error(`employee_available_exams: ${examsError.message}`);

      const rows = (data ?? []) as AvailableExamRow[];
      if (rows.length === 0) {
        setBlocking([]);
        setExhausted([]);
        return;
      }

      // Resolve prerequisites in one round trip rather than per assessment.
      const prereqIds = Array.from(
        new Set(rows.map((r) => r.prerequisite_course_id).filter((id): id is string => Boolean(id))),
      );

      let completedCourseIds = new Set<string>();
      if (prereqIds.length > 0) {
        const { data: progress, error: progressError } = await supabase
          .from('employee_courses')
          .select('course_id, status')
          .eq('employee_id', employeeId)
          .in('course_id', prereqIds)
          .eq('status', 'COMPLETED');

        if (progressError) throw new Error(`employee_courses: ${progressError.message}`);
        completedCourseIds = new Set((progress ?? []).map((p) => p.course_id as string));
      }

      const prereqMet = rows.filter(
        (r) => !r.prerequisite_course_id || completedCourseIds.has(r.prerequisite_course_id),
      );

      setBlocking(prereqMet.filter(canBeTakenNow));
      setExhausted(
        prereqMet.filter((r) => !canBeTakenNow(r) && !isPreAssessment(r)),
      );
    } catch (err) {
      // A failed lookup must not lock an employee out of their training, so the
      // gate fails open. It is still reported loudly: silently unlocking the
      // platform is exactly the kind of regression that goes unnoticed until an
      // audit, so it needs to reach the logs and Sentry.
      const message = err instanceof Error ? err.message : String(err);
      console.error('[examGate] failed to evaluate mandatory assessments:', message, err);
      captureException(err, { scope: 'useMandatoryExamGate', employeeId });
      setError(message);
      setBlocking([]);
      setExhausted([]);
    } finally {
      setLoading(false);
      setSettled(true);
    }
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, settled, blocking, exhausted, blocked: blocking.length > 0, error, refresh };
}
