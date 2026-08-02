/**
 * submit-exam — server-side exam scoring (CRIT-02)
 *
 * The browser submits only { examId, answers: { [questionId]: selectedOption } }.
 * The correct answers never leave the database: this function reads them with
 * the service role, computes the score, and persists the result.
 *
 * Access is re-validated server-side (active assignment + attempts remaining +
 * not already passed) so a tampered client cannot bypass the gate.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Inlined Sentry reporter (kept in-file so the function deploys as a single module). */
async function captureException(
  error: unknown,
  context: { function: string; [key: string]: unknown } = { function: "unknown" },
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;
  const m = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!m) return;
  const [, key, host, projectId] = m;
  const err = error instanceof Error ? error : new Error(String(error));
  try {
    await fetch(`https://${host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}`,
      },
      body: JSON.stringify({
        event_id: crypto.randomUUID().replace(/-/g, ""),
        timestamp: new Date().toISOString(),
        platform: "node",
        level: "error",
        server_name: "supabase-edge",
        tags: { function: context.function },
        extra: context,
        exception: { values: [{ type: err.name, value: err.message }] },
      }),
    });
  } catch {
    // Never let Sentry reporting break the function
  }
}

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

interface SubmitExamBody {
  examId: string;
  answers: Record<string, string>;
  startedAt?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  // Authenticate caller via their session JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const { examId, answers, startedAt } = await req.json() as SubmitExamBody;
    if (!examId || typeof answers !== "object" || answers === null) {
      return new Response(JSON.stringify({ error: "examId and answers are required" }), { status: 400, headers: corsHeaders });
    }

    // ── Re-validate access server-side ──
    const { data: access, error: accessErr } = await admin
      .rpc("employee_has_exam_access", { p_employee_id: user.id, p_exam_id: examId })
      .maybeSingle<{
        assignment_id: string | null;
        max_attempts: number;
        attempts_used: number;
        can_take_exam: boolean;
        has_passed: boolean;
      }>();

    if (accessErr || !access) {
      return new Response(JSON.stringify({ error: "No active assignment for this exam" }), { status: 403, headers: corsHeaders });
    }
    if (!access.can_take_exam) {
      return new Response(
        JSON.stringify({ error: access.has_passed ? "Exam already passed" : "No attempts remaining" }),
        { status: 403, headers: corsHeaders },
      );
    }

    // ── Load the answer key (service role only) ──
    const { data: questions, error: qErr } = await admin
      .from("exam_questions")
      .select("id, question, correct_answer, options, options_ar")
      .eq("exam_id", examId)
      .order("order_index");

    if (qErr) throw qErr;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: "Exam has no questions" }), { status: 400, headers: corsHeaders });
    }

    // ── Score server-side ──
    //
    // Exams are bilingual, and the viewer submits the TEXT of the option that
    // was clicked. An employee taking the Arabic version therefore submits
    // Arabic text, which never equals the English answer key. Comparing them
    // directly would mark every answer wrong — silently, and only for the
    // population the translation exists to serve.
    //
    // English stays the single answer key. `options_ar` is a parallel array in
    // the same order as `options` (enforced by a length CHECK in the database),
    // so a submitted answer is mapped back to its English counterpart by
    // position before it is compared.
    const toCanonical = (
      selected: string | null,
      options: unknown,
      optionsAr: unknown,
    ): string | null => {
      if (selected === null || selected === undefined) return null;
      const en = Array.isArray(options) ? (options as string[]) : [];
      if (en.includes(selected)) return selected;
      const ar = Array.isArray(optionsAr) ? (optionsAr as string[]) : [];
      const idx = ar.indexOf(selected);
      // A mismatched length means the mapping is unreliable, so fall through
      // to the raw value rather than guessing at a position that may not exist.
      if (idx >= 0 && idx < en.length) return en[idx];
      return selected;
    };

    let correctCount = 0;
    const detail = questions.map((q) => {
      const selected = answers[q.id] ?? null;
      const canonical = toCanonical(selected, q.options, q.options_ar);
      const isCorrect = canonical !== null && canonical === q.correct_answer;
      if (isCorrect) correctCount++;
      return {
        question: q.question,
        // Recorded in English so results and reports stay comparable whichever
        // language the exam was sat in; `selected_as_shown` keeps what the
        // employee actually picked, for reviewing their own attempt.
        selected_answer: canonical ?? "Not answered",
        selected_as_shown: selected ?? "Not answered",
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
      };
    });

    const total = questions.length;
    const percentage = Math.round((correctCount / total) * 100);

    // Fetch passing score from the exam record
    const { data: exam } = await admin
      .from("exams")
      .select("passing_score")
      .eq("id", examId)
      .maybeSingle<{ passing_score: number }>();
    const passingScore = exam?.passing_score ?? 70;
    const passed = percentage >= passingScore;

    // ── Persist result ──
    const startedIso = startedAt && !Number.isNaN(Date.parse(startedAt))
      ? new Date(startedAt).toISOString()
      : new Date().toISOString();

    const { error: insertErr } = await admin.from("exam_results").insert([{
      employee_id: user.id,
      exam_id: examId,
      assignment_id: access.assignment_id,
      score: correctCount,
      total_questions: total,
      percentage,
      passed,
      answers: detail,
      started_at: startedIso,
      completed_at: new Date().toISOString(),
    }]);
    if (insertErr) throw insertErr;

    if (passed && access.assignment_id) {
      await admin
        .from("assigned_exams")
        .update({ status: "completed" })
        .eq("id", access.assignment_id)
        .eq("assigned_to_employee", user.id);
    }

    // Never return the answer key — only the computed outcome.
    return new Response(
      JSON.stringify({ score: correctCount, total, percentage, passed, passing_score: passingScore }),
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    await captureException(error, { function: "submit-exam", userId: user.id });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to submit exam" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
