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

const SAVE_FAILURE_MESSAGES: Record<string, string> = {
  not_signed_in: "Your session has expired. Please sign in again.",
  invalid_stars: "Please choose between 1 and 5 stars.",
  not_completed: "You can only rate a course after you have completed it.",
};

/**
 * Save or replace this employee's rating.
 *
 * Goes through `save_course_rating` rather than writing the table. A PostgREST
 * upsert compiles to `ON CONFLICT DO UPDATE SET <every column in the payload>`,
 * and Postgres checks column privileges while planning — so the deliberately
 * narrow `UPDATE (stars, comment)` grant refused the statement outright, on the
 * very first insert, before any conflict could occur. It reported that as
 * 42501, which this function used to read as "the course is not finished": a
 * privilege failure shown to a learner as a workflow failure, pointing at the
 * one explanation they could not check.
 *
 * The RPC returns a named reason, so the two can no longer be confused.
 */
export async function saveRating(args: {
  courseId: string;
  stars: number;
  comment: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("save_course_rating", {
    p_course_id: args.courseId,
    p_stars: args.stars,
    p_comment: args.comment,
  });

  if (error) {
    console.error("[ratings] save failed:", error.code, error.message);
    return { ok: false, error: error.message };
  }

  const result = data as { ok?: boolean; reason?: string } | null;
  if (result?.ok) return { ok: true };

  const reason = result?.reason ?? "unknown";
  console.error("[ratings] save refused:", reason);
  return {
    ok: false,
    error: SAVE_FAILURE_MESSAGES[reason] ?? `Your rating could not be saved (${reason}).`,
  };
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
