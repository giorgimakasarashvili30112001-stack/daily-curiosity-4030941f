/**
 * Server functions (TanStack Start `createServerFn`) powering the daily
 * quiz feature: fetching today's/follow-up questions, grading answers,
 * persisting attempts for signed-in users, and reporting streak/coin/
 * calendar stats. Answer submission also drives the streak and coin
 * economy (via `streak.server`) and writes to `quiz_attempts`/`profiles`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";


/** Hard cap on follow-up questions generated per explainer. */
export const MAX_QUESTION_INDEX = 9;

/** Today's quiz question plus the explainer it's derived from. */
export type DailyQuiz = {
  quizDate: string;
  factDate: string;
  factId: string;
  factSlug: string;
  factTitle: string;
  questionIndex: number;
  prompt: string;
  options: string[];
};

/** A single multiple-choice quiz question tied to a fact. */
export type QuizQuestion = {
  factId: string;
  questionIndex: number;
  prompt: string;
  options: string[];
};

/** Outcome of grading a quiz answer, optionally including streak/coin deltas. */
export type QuizResult = {
  questionIndex: number;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
  streak?: number;
  longestStreak?: number;
  streakExtended?: boolean;
  coins?: number;
  coinsEarned?: number;
  streakSaved?: boolean;
};

/** Zod validator/parser shared by the grade/submit answer endpoints. */
const answerInput = (input: unknown) =>
  z
    .object({
      factId: z.string().uuid(),
      selectedIndex: z.number().int().min(0).max(3),
      questionIndex: z.number().int().min(0).max(MAX_QUESTION_INDEX).default(0),
    })
    .parse(input);

/**
 * Yesterday's explainer turned into one multiple-choice question. Public
 * (no auth required).
 *
 * How it works: resolves the "fact date" the quiz is based on
 * (`quizFactDate`) from today's UTC date, then loads (or generates)
 * question index 0 for that fact via `getQuestionForDate`.
 * Params: none.
 * Returns: `DailyQuiz` or `null` if no fact/question is available yet.
 * Side effects: may write a new question row via `getQuestionForDate`.
 */
export const getDailyQuiz = createServerFn({ method: "GET" }).handler(
  async (): Promise<DailyQuiz | null> => {
    const { todayUtc } = await import("./facts.server");
    const { quizFactDate, getQuestionForDate } = await import("./quiz.server");

    const quizDate = todayUtc();
    const factDate = quizFactDate(quizDate);
    const result = await getQuestionForDate(factDate, 0);
    if (!result) return null;

    return {
      quizDate,
      factDate,
      factId: result.fact.id,
      factSlug: result.fact.slug,
      factTitle: result.fact.title,
      questionIndex: result.question.question_index,
      prompt: result.question.prompt,
      options: result.question.options,
    };
  },
);

/**
 * A follow-up question for the same explainer. Shared by everyone: the first
 * request generates and stores it, parallel requests converge on the same row.
 *
 * Params: `{ factId, questionIndex }` (questionIndex bounded by
 * `MAX_QUESTION_INDEX`).
 * Returns: `QuizQuestion` or `null` if it couldn't be found/generated.
 * Side effects: may insert a new question row via `getQuestionForFact`.
 */
export const getQuizQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        factId: z.string().uuid(),
        questionIndex: z.number().int().min(0).max(MAX_QUESTION_INDEX),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<QuizQuestion | null> => {
    const { getQuestionForFact } = await import("./quiz.server");
    const question = await getQuestionForFact(data.factId, data.questionIndex);
    if (!question) return null;
    return {
      factId: question.fact_id,
      questionIndex: question.question_index,
      prompt: question.prompt,
      options: question.options,
    };
  });

/**
 * Grades an answer without persisting it — used for signed-out play so
 * guests can still see whether they were right.
 *
 * Params: `{ factId, selectedIndex, questionIndex }`.
 * Returns: `QuizResult` (without streak/coins fields) or `null` if the
 * question can't be loaded.
 * Side effects: none (no DB writes).
 */
export const gradeQuizAnswer = createServerFn({ method: "POST" })
  .inputValidator(answerInput)
  .handler(async ({ data }): Promise<QuizResult | null> => {
    const { loadQuestion } = await import("./quiz.server");
    const question = await loadQuestion(data.factId, data.questionIndex);
    if (!question) return null;
    return {
      questionIndex: data.questionIndex,
      selectedIndex: data.selectedIndex,
      correctIndex: question.correct_index,
      isCorrect: data.selectedIndex === question.correct_index,
      explanation: question.explanation,
    };
  });

/**
 * Grades and records today's attempt for the signed-in user. This is the
 * main entry point that drives the streak/coin economy.
 *
 * How it works:
 * 1. Loads the question and computes correctness.
 * 2. Calls `settleStreak` first (based on pre-answer state) to settle any
 *    missed days — this may auto-spend coins to "save" a missed day.
 * 3. Inserts a row into `quiz_attempts`; a unique-constraint violation
 *    (23505) means the user already answered this question today, in
 *    which case the previously stored attempt is returned instead.
 * 4. On a fresh correct answer: awards 1 coin, and — only once per day,
 *    on the first correct answer — extends the streak (or resets it to 1
 *    if the previous day wasn't answered), updating `longestStreak` too.
 * 5. Persists the updated streak/coin/anchor state back to `profiles` via
 *    `saveProfileRow`.
 *
 * Params: `{ factId, selectedIndex, questionIndex }` (auth required).
 * Returns: `QuizResult` with streak/coin fields populated, or `null` if
 * the question can't be loaded.
 * Side effects: inserts into `quiz_attempts`; may update `profiles`
 * (streak_count, longest_streak, last_seen_date, streak_anchor, coins,
 * saved_days). Awards coins and grows/resets the streak.
 */
export const submitQuizAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(answerInput)
  .handler(async ({ data, context }): Promise<QuizResult | null> => {
    const { loadQuestion } = await import("./quiz.server");
    const { todayUtc } = await import("./facts.server");

    const question = await loadQuestion(data.factId, data.questionIndex);
    if (!question) return null;

    const isCorrect = data.selectedIndex === question.correct_index;
    const quizDate = todayUtc();

    const { settleStreak, saveProfileRow, shiftDay } = await import("./streak.server");

    // Settle missed days from the pre-answer state, before today's attempt is stored.
    const settlement = await settleStreak(context.supabase, context.userId, quizDate);

    const { error } = await context.supabase.from("quiz_attempts").insert({
      user_id: context.userId,
      quiz_date: quizDate,
      fact_id: data.factId,
      quiz_question_id: question.id,
      question_index: data.questionIndex,
      selected_index: data.selectedIndex,
      is_correct: isCorrect,
    });
    // A duplicate means they already answered this question today; keep the stored attempt.
    if (error && error.code !== "23505") throw error;

    let streak = settlement.streak;
    let longestStreak = settlement.longestStreak;
    let coins = settlement.coins;
    let streakExtended = false;
    const streakSaved = settlement.streakSaved;
    let coinsEarned = 0;


    if (error) {
      // Duplicate insert: re-fetch and return the attempt that already exists
      // for this question/date rather than double-counting rewards.
      const { data: existing } = await context.supabase
        .from("quiz_attempts")
        .select("selected_index, is_correct")
        .eq("quiz_date", quizDate)
        .eq("question_index", data.questionIndex)
        .maybeSingle();
      if (existing) {
        return {
          questionIndex: data.questionIndex,
          selectedIndex: existing.selected_index,
          correctIndex: question.correct_index,
          isCorrect: existing.is_correct,
          explanation: question.explanation,
          streak,
          longestStreak,
          coins,
        };
      }
    }

    if (isCorrect) {
      // One coin for every newly recorded correct answer.
      coinsEarned = 1;
      coins = Math.max(0, coins + 1);

      // The streak grows once per day, on the first correct answer of the day.
      const alreadyCountedToday =
        settlement.lastCorrect === quizDate || settlement.anchor === quizDate;
      if (!alreadyCountedToday) {
        streak = settlement.anchor === shiftDay(quizDate, -1) ? streak + 1 : 1;
        longestStreak = Math.max(longestStreak, streak);
        streakExtended = true;
      }

      await saveProfileRow(context.supabase, context.userId, {
        streak_count: streak,
        longest_streak: longestStreak,
        last_seen_date: quizDate,
        streak_anchor: quizDate,
        coins,
        saved_days: settlement.savedDays,
      });

    }


    return {
      questionIndex: data.questionIndex,
      selectedIndex: data.selectedIndex,
      correctIndex: question.correct_index,
      isCorrect,
      explanation: question.explanation,
      streak,
      longestStreak,
      streakExtended,
      coins,
      coinsEarned,
      streakSaved,
    };
  });

/**
 * Returns the user's latest recorded attempt for today's fact, if any,
 * used to restore quiz UI state on reload.
 *
 * Params: `{ factId }` (auth required).
 * Returns: `QuizResult` (with current streak/coins from `profiles`) or
 * `null` if no attempt exists yet today.
 * Side effects: read-only DB queries (quiz_attempts, profiles).
 */
export const getQuizAttempt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ factId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<QuizResult | null> => {
    const { loadQuestion } = await import("./quiz.server");
    const { todayUtc } = await import("./facts.server");

    const { data: attempt } = await context.supabase
      .from("quiz_attempts")
      .select("selected_index, is_correct, question_index")
      .eq("quiz_date", todayUtc())
      .eq("fact_id", data.factId)
      .order("question_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!attempt) return null;

    const question = await loadQuestion(data.factId, attempt.question_index);
    if (!question) return null;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("streak_count, longest_streak, coins")
      .eq("id", context.userId)
      .maybeSingle();

    return {
      questionIndex: attempt.question_index,
      selectedIndex: attempt.selected_index,
      correctIndex: question.correct_index,
      isCorrect: attempt.is_correct,
      explanation: question.explanation,
      streak: profile?.streak_count ?? 0,
      longestStreak: profile?.longest_streak ?? 0,
      coins: profile?.coins ?? 0,
    };
  });

/**
 * Returns which days in a given month had a correct answer and which
 * days were auto-saved with coins, for the streak calendar UI.
 *
 * Params: `{ month }` — "YYYY-MM" string (auth required).
 * Returns: `{ correct: string[], saved: string[] }` — deduplicated date
 * strings within the month.
 * Side effects: read-only DB queries (quiz_attempts, profiles.saved_days).
 */
export const getStreakCalendar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ month: z.string().regex(/^\d{4}-\d{2}$/) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ correct: string[]; saved: string[] }> => {
    const [year, month] = data.month.split("-").map(Number);
    const start = `${data.month}-01`;
    const endDate = new Date(Date.UTC(year!, month!, 1));
    const end = endDate.toISOString().slice(0, 10);

    const [{ data: rows }, { data: profile }] = await Promise.all([
      context.supabase
        .from("quiz_attempts")
        .select("quiz_date")
        .eq("is_correct", true)
        .gte("quiz_date", start)
        .lt("quiz_date", end),
      context.supabase
        .from("profiles")
        .select("saved_days")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);

    const saved = ((profile?.saved_days ?? []) as string[])
      .map((d) => String(d).slice(0, 10))
      .filter((d) => d >= start && d < end);

    return {
      correct: [...new Set((rows ?? []).map((r) => r.quiz_date))],
      saved: [...new Set(saved)],
    };
  });


/**
 * Returns lifetime quiz stats (answered/correct counts plus current
 * streak/coin state) for the signed-in user, used on the profile page.
 *
 * Params: none (auth required).
 * Returns: `{ answered, correct, streak, longestStreak, coins }`.
 * Side effects: read-only DB queries (quiz_attempts, profiles).
 */
export const getQuizStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      answered: number;
      correct: number;
      streak: number;
      longestStreak: number;
      coins: number;
    }> => {
      const [{ data }, { data: profile }] = await Promise.all([
        context.supabase.from("quiz_attempts").select("is_correct"),
        context.supabase
          .from("profiles")
          .select("streak_count, longest_streak, coins")
          .eq("id", context.userId)
          .maybeSingle(),
      ]);
      const rows = data ?? [];
      return {
        answered: rows.length,
        correct: rows.filter((r) => r.is_correct).length,
        streak: profile?.streak_count ?? 0,
        longestStreak: profile?.longest_streak ?? 0,
        coins: profile?.coins ?? 0,
      };
    },
  );
