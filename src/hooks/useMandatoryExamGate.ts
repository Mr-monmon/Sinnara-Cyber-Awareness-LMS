import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { EmployeeAvailableExam } from '../lib/types';

/**
 * useMandatoryExamGate — decides whether an employee must sit an exam before
 * doing anything else in the platform.
 *
 * Compliance exams are assigned with a deadline and are the point of the
 * training, so once one is outstanding the employee is held on the exams screen
 * rather than being free to browse courses. The gate is a UI escort, not an
 * authorisation boundary: exam and course data are already protected by RLS, and
 * this only removes the temptation to wander off before finishing.
 *
 * An assigned exam blocks only when the employee can actually sit it right now.
 * Three cases are deliberately let through:
 *
 *   - Non-mandatory assignments. Optional exams are, by definition, optional.
 *   - Exams gated behind a course the employee hasn't completed. Blocking those
 *     would deadlock: the exam demands a course, and the gate forbids the course.
 *     Such an exam starts blocking as soon as its prerequisite is completed.
 *   - Exams with no attempts left and no pass. Nothing the employee does can
 *     clear these, so holding them hostage would lock them out of the platform
 *     permanently; they are surfaced to the employee as needing admin help
 *     instead (see `exhausted`).
 */

/** The view exposes more than the shared type declares; these are the extra columns used here. */
type AvailableExamRow = EmployeeAvailableExam & {
  assignment_id: string;
  due_date: string | null;
  prerequisite_course_id: string | null;
};

export interface MandatoryExamGate {
  loading: boolean;
  /** Mandatory exams the employee must sit now — non-empty means the UI is locked. */
  blocking: AvailableExamRow[];
  /** Mandatory exams that are out of attempts and unpassed; shown as a warning. */
  exhausted: AvailableExamRow[];
  blocked: boolean;
  refresh: () => Promise<void>;
}

/** Attempts are unlimited when max_attempts isn't a positive number. */
function hasAttemptsLeft(exam: AvailableExamRow): boolean {
  const max = Number(exam.max_attempts);
  if (!Number.isFinite(max) || max <= 0) return true;
  return Number(exam.attempts_used) < max;
}

export function useMandatoryExamGate(employeeId: string | undefined): MandatoryExamGate {
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState<AvailableExamRow[]>([]);
  const [exhausted, setExhausted] = useState<AvailableExamRow[]>([]);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setBlocking([]);
      setExhausted([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // The view already excludes exams the employee has passed and assignments
      // that aren't active, so everything returned is genuinely outstanding.
      const { data, error } = await supabase
        .from('employee_available_exams')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_mandatory', true)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const rows = (data ?? []) as AvailableExamRow[];
      if (rows.length === 0) {
        setBlocking([]);
        setExhausted([]);
        return;
      }

      // Resolve prerequisites in one round trip rather than per exam.
      const prereqIds = Array.from(
        new Set(rows.map((r) => r.prerequisite_course_id).filter((id): id is string => Boolean(id))),
      );

      let completedCourseIds = new Set<string>();
      if (prereqIds.length > 0) {
        const { data: progress } = await supabase
          .from('employee_courses')
          .select('course_id, status')
          .eq('employee_id', employeeId)
          .in('course_id', prereqIds)
          .eq('status', 'COMPLETED');
        completedCourseIds = new Set((progress ?? []).map((p) => p.course_id as string));
      }

      const takeableNow = rows.filter(
        (r) => !r.prerequisite_course_id || completedCourseIds.has(r.prerequisite_course_id),
      );

      setBlocking(takeableNow.filter(hasAttemptsLeft));
      setExhausted(takeableNow.filter((r) => !hasAttemptsLeft(r)));
    } catch {
      // A failed lookup must not lock an employee out of their training. Fail
      // open: the exams screen still shows what is due.
      setBlocking([]);
      setExhausted([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, blocking, exhausted, blocked: blocking.length > 0, refresh };
}
