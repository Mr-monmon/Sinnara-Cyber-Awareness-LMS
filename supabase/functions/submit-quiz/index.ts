/**
 * submit-quiz — server-side quiz scoring for course sections (CRIT-03)
 *
 * The browser submits only { sectionId, answers: { [questionIndex]: option } }.
 * The correct answers live in course_sections.content_data(_ar) and are read
 * only here with the service role. On pass, the section is marked complete
 * (same upsert the client used to do directly).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "./sentry.ts";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
}

interface SubmitQuizBody {
  sectionId: string;
  // language picks which content_data variant supplies the answer key
  lang?: "ar" | "en";
  answers: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const { sectionId, lang, answers } = await req.json() as SubmitQuizBody;
    if (!sectionId || typeof answers !== "object" || answers === null) {
      return new Response(JSON.stringify({ error: "sectionId and answers are required" }), { status: 400, headers: corsHeaders });
    }

    // ── Load the section + answer key (service role only) ──
    const { data: section, error: secErr } = await admin
      .from("course_sections")
      .select("id, course_id, section_type, content_data, content_data_ar")
      .eq("id", sectionId)
      .maybeSingle<{
        id: string;
        course_id: string;
        section_type: string;
        content_data: { questions?: QuizQuestion[]; passing_score?: number } | null;
        content_data_ar: { questions?: QuizQuestion[]; passing_score?: number } | null;
      }>();

    if (secErr) throw secErr;
    if (!section || section.section_type !== "QUIZ") {
      return new Response(JSON.stringify({ error: "Quiz section not found" }), { status: 404, headers: corsHeaders });
    }

    // Mirror the client's language selection: Arabic falls back to default.
    const cd = lang === "ar" ? (section.content_data_ar ?? section.content_data) : section.content_data;
    const questions = cd?.questions ?? [];
    if (questions.length === 0) {
      return new Response(JSON.stringify({ error: "Quiz has no questions" }), { status: 400, headers: corsHeaders });
    }

    // ── Score server-side (answers keyed by question index, as in the UI) ──
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[String(i)] === q.correct_answer) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    const passingScore = (cd?.passing_score as number | undefined) ?? 60;
    const passed = score >= passingScore;

    // ── On pass, mark the section complete (idempotent upsert) ──
    if (passed) {
      const { error: upErr } = await admin.from("course_section_progress").upsert(
        {
          employee_id: user.id,
          course_id: section.course_id,
          section_id: section.id,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "employee_id,section_id" },
      );
      if (upErr) throw upErr;
    }

    return new Response(
      JSON.stringify({ score, passed, passing_score: passingScore, total: questions.length, correct }),
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    await captureException(error, { function: "submit-quiz", userId: user.id });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to submit quiz" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
