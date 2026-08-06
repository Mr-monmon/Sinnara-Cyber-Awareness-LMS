import { supabase } from "./supabase";

/**
 * Course ratings — client side of `20260806130000_course_ratings.sql`.
 *
 * Employees rate a course they finished; only the platform admin can read the
 * results. Every restriction here is a mirror of an RLS policy, never the
 * enforcement itself.
 */

export const MAX_STARS = 5;

export interface MyCourseRating {
  id: string;
  stars: number;
  comment: string | null;
  updatedAt: string;
}

export interface CourseRatingSummary {
  courseId: string;
  count: number;
  average: number;
  /** Index 0 is one star. */
  histogram: [number, number, number, number, number];
  commentCount: number;
}

export interface CourseRatingComment {
  stars: number;
  comment: string;
  companyName: string | null;
  ratedAt: string;
}

export async function loadMyRating(courseId: string, employeeId: string): Promise<MyCourseRating | null> {
  const { data, error } = await supabase
    .from("course_ratings")
    .select("id, stars, comment, updated_at")
    .eq("course_id", courseId)
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) {
    console.error("[ratings] could not load own rating:", error.message);
    return null;
  }
  if (!data) return null;
  return { id: data.id, stars: data.stars, comment: data.comment, updatedAt: data.updated_at };
}

/**
 * Save or replace this employee's rating.
 *
 * An upsert on the (course, employee) unique key rather than a read-then-branch:
 * two tabs, or a double-tapped Submit, would otherwise race into a duplicate-key
 * error the user cannot act on.
 */
export async function saveRating(args: {
  courseId: string;
  employeeId: string;
  companyId: string | null;
  stars: number;
  comment: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const comment = args.comment.trim();
  const { error } = await supabase.from("course_ratings").upsert(
    {
      course_id: args.courseId,
      employee_id: args.employeeId,
      company_id: args.companyId,
      stars: args.stars,
      comment: comment.length ? comment : null,
    },
    { onConflict: "course_id,employee_id" },
  );
  if (error) {
    /*
     * The most likely refusal by far is the WITH CHECK on "have you finished
     * this course", and Postgres reports that as a bare policy violation. Saying
     * so is the difference between a user retrying usefully and one concluding
     * the feature is broken.
     */
    const message = error.code === "42501" || /row-level security/i.test(error.message)
      ? "You can only rate a course after you have completed it."
      : error.message;
    return { ok: false, error: message };
  }
  return { ok: true };
}

export async function loadRatingSummary(): Promise<Map<string, CourseRatingSummary>> {
  const map = new Map<string, CourseRatingSummary>();
  const { data, error } = await supabase.rpc("get_course_rating_summary");
  if (error) {
    console.error("[ratings] could not load rating summary:", error.message);
    return map;
  }
  for (const row of (data ?? []) as Array<{
    course_id: string; rating_count: number; average_stars: number | string;
    stars_1: number; stars_2: number; stars_3: number; stars_4: number; stars_5: number;
    comment_count: number;
  }>) {
    map.set(row.course_id, {
      courseId: row.course_id,
      count: row.rating_count,
      // Postgres `numeric` arrives as a string over PostgREST; Number() here
      // keeps every consumer from having to remember that.
      average: Number(row.average_stars) || 0,
      histogram: [row.stars_1, row.stars_2, row.stars_3, row.stars_4, row.stars_5],
      commentCount: row.comment_count,
    });
  }
  return map;
}

export async function loadRatingComments(courseId: string): Promise<CourseRatingComment[]> {
  const { data, error } = await supabase.rpc("get_course_rating_comments", { p_course_id: courseId });
  if (error) {
    console.error("[ratings] could not load comments:", error.message);
    return [];
  }
  return ((data ?? []) as Array<{ stars: number; comment: string; company_name: string | null; rated_at: string }>)
    .map(r => ({ stars: r.stars, comment: r.comment, companyName: r.company_name, ratedAt: r.rated_at }));
}

/**
 * How confident the average is worth sounding.
 *
 * A 5.0 from one person is not a better course than a 4.6 from thirty, and a
 * list sorted on the raw average puts it on top. Callers use this to mark thin
 * samples rather than to hide them — the count is data too.
 */
export const THIN_SAMPLE_THRESHOLD = 5;

export function isThinSample(count: number): boolean {
  return count > 0 && count < THIN_SAMPLE_THRESHOLD;
}
