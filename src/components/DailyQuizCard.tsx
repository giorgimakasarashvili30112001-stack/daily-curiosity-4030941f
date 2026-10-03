/**
 * DailyQuizCard
 * -------------
 * File-level: Renders the "yesterday's check" daily quiz widget shown on the
 * home page — a multiple-choice question about the previous day's fact,
 * with answer grading, streak/coin rewards, and follow-up questions.
 * The quiz is for signed-in users only: signed-out visitors see a short
 * message asking them to sign in, and no quiz data is requested for them.
 */
import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Coins, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { readReminderPref, syncDailyReminders } from "@/lib/notifications";
import {
  getDailyQuiz,
  getQuizAttempt,
  getQuizQuestion,
  submitQuizAnswer,
  MAX_QUESTION_INDEX,
  type QuizQuestion,
  type QuizResult,
} from "@/lib/quiz.functions";
import { STREAK_SAVE_COST } from "@/lib/quiz.constants";

/**
 * DailyQuizCard
 * Shows the daily quiz question (and any answered follow-up questions) as
 * a set of selectable options; after answering, reveals correctness,
 * an explanation, coin/streak rewards, and a "try another question" or
 * "revisit fact" action.
 *
 * Props:
 * - isSignedIn: whether the current user is authenticated. When false, a
 *   "sign in to take the quiz" message is shown instead of the quiz and
 *   no quiz data is fetched.
 *
 * State:
 * - questionIndex: which question (0 = main daily quiz, >0 = follow-ups) is showing.
 * - result: the graded QuizResult for the current question, or null if unanswered.
 * - busy: true while an answer submission/grading request is in flight.
 * - loadingNext: true while fetching the next follow-up question.
 *
 * Data fetching:
 * - useQuery(["daily-quiz"]) loads today's quiz via getDailyQuiz (signed-in only).
 * - useQuery(["quiz-question", factId, questionIndex]) lazily loads
 *   follow-up questions (index > 0) via getQuizQuestion, shared across users.
 * - Prefetches the next question in the background for snappier "try
 *   another question" transitions.
 * - On mount, restores prior progress via getQuizAttempt.
 *
 * User interactions:
 * - Selecting an option submits the answer (submitQuizAnswer) and shows the
 *   result, invalidating profile/quiz-stats/streak-calendar queries and
 *   syncing reminders.
 * - "Try another question" (shown after a wrong, non-final answer) loads
 *   the next follow-up question.
 * - "Revisit {fact title}" links back to the full fact page.
 */
export function DailyQuizCard({ isSignedIn }: { isSignedIn: boolean }) {
  const fetchQuiz = useServerFn(getDailyQuiz);
  const fetchAttempt = useServerFn(getQuizAttempt);
  const fetchQuestion = useServerFn(getQuizQuestion);
  const submit = useServerFn(submitQuizAnswer);
  const queryClient = useQueryClient();

  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);

  // Signed-out visitors never fetch the quiz (the server also requires sign-in).
  const { data: quiz } = useQuery({
    queryKey: ["daily-quiz"],
    enabled: isSignedIn,
    queryFn: () => fetchQuiz({}),
  });

  // Follow-up questions (index > 0) are fetched on demand and shared by all users.
  const { data: followUp } = useQuery({
    queryKey: ["quiz-question", quiz?.factId, questionIndex],
    enabled: !!quiz && questionIndex > 0,
    staleTime: Infinity,
    queryFn: (): Promise<QuizQuestion | null> =>
      fetchQuestion({ data: { factId: quiz!.factId, questionIndex } }),
  });

  // Prefetch the next question for instant display (improves perceived performance)
  const prefetchNextQuestion = useCallback(() => {
    if (!quiz?.factId || questionIndex >= MAX_QUESTION_INDEX) return;
    const nextIndex = questionIndex + 1;
    void queryClient.prefetchQuery({
      queryKey: ["quiz-question", quiz.factId, nextIndex],
      queryFn: (): Promise<QuizQuestion | null> =>
        fetchQuestion({ data: { factId: quiz.factId, questionIndex: nextIndex } }),
      staleTime: Infinity,
    });
  }, [quiz?.factId, questionIndex, queryClient, fetchQuestion]);

  useEffect(() => {
    if (!quiz) return;
    // Prefetch question 1 immediately after quiz loads
    if (questionIndex === 0) {
      void queryClient.prefetchQuery({
        queryKey: ["quiz-question", quiz.factId, 1],
        queryFn: (): Promise<QuizQuestion | null> =>
          fetchQuestion({ data: { factId: quiz.factId, questionIndex: 1 } }),
        staleTime: Infinity,
      });
    }
  }, [quiz, questionIndex, queryClient, fetchQuestion]);

  useEffect(() => {
    if (!quiz || !isSignedIn) return;
    void fetchAttempt({ data: { factId: quiz.factId } })
      .then((r) => {
        if (!r) return;
        setQuestionIndex(r.questionIndex);
        setResult(r);
      })
      .catch(() => undefined);
  }, [quiz, isSignedIn, fetchAttempt]);

  // Signed-out: don't show the quiz, just explain why and how to get it.
  if (!isSignedIn) {
    return (
      <section className="mb-5 overflow-hidden rounded-3xl border border-border bg-card px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Yesterday&apos;s check</p>
        <h2 className="mt-2 text-display text-[19px] leading-snug text-foreground">
          Sign in to take the daily quiz
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Sign in to answer a quick question about yesterday&apos;s explainer, check what you
          remember, and earn coins to keep your streak going.
        </p>
        <Link
          to="/auth"
          className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </section>
    );
  }

  if (!quiz) return null;

  const current =
    questionIndex === 0
      ? { prompt: quiz.prompt, options: quiz.options }
      : followUp
        ? { prompt: followUp.prompt, options: followUp.options }
        : null;

  // Handles selecting an answer option: submits/grades it, updates result
  // state, and (signed-in) triggers cache invalidation + reminder sync.
  const onAnswer = async (index: number) => {
    if (result || busy) return;
    setBusy(true);
    try {
      const payload = { factId: quiz.factId, selectedIndex: index, questionIndex };
      const outcome = await submit({ data: payload });
      if (!outcome) return;
      setResult(outcome);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["quiz-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["streak-calendar"] });
      if (outcome.isCorrect && readReminderPref()) {
        // Today's streak is earned — drop the remaining reminders for today.
        const today = new Date();
        const key = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
        void syncDailyReminders({ enabled: true, lastCorrectDate: key });
      }
    } catch {
      toast.error("Could not submit your answer");
    } finally {
      setBusy(false);
    }
  };

  // Handles the "Try another question" click: fetches (or reuses a
  // prefetched) follow-up question and resets the answer state for it.
  const onNextQuestion = async () => {
    if (loadingNext || questionIndex >= MAX_QUESTION_INDEX) return;
    const nextIndex = questionIndex + 1;
    setLoadingNext(true);
    try {
      const next = await queryClient.fetchQuery({
        queryKey: ["quiz-question", quiz.factId, nextIndex],
        staleTime: Infinity,
        queryFn: (): Promise<QuizQuestion | null> =>
          fetchQuestion({ data: { factId: quiz.factId, questionIndex: nextIndex } }),
      });
      if (!next) {
        toast.error("No more questions right now");
        return;
      }
      setQuestionIndex(nextIndex);
      setResult(null);
      // Prefetch the next one for instant display
      prefetchNextQuestion();
    } catch {
      toast.error("Could not load another question");
    } finally {
      setLoadingNext(false);
    }
  };

  // Only offer a retry via a new question when the current answer was wrong
  // and there are more follow-up questions available.
  const canRetry = !!result && !result.isCorrect && questionIndex < MAX_QUESTION_INDEX;

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-border bg-card">
      <div className="border-b border-border px-6 pt-5 pb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary">
          Yesterday&apos;s check{questionIndex > 0 ? ` · question ${questionIndex + 1}` : ""}
        </p>
        <h2 className="mt-2 text-display text-[19px] leading-snug text-foreground">
          {current ? current.prompt : "Loading another question…"}
        </h2>
      </div>

      <div className="space-y-2 px-6 py-5">
        {current ? (
          current.options.map((option, index) => {
            const isCorrect = result?.correctIndex === index;
            const isPicked = result?.selectedIndex === index;
            const tone = !result
              ? "border-border bg-secondary text-secondary-foreground hover:bg-muted"
              : isCorrect
                ? "border-primary/50 bg-primary/15 text-foreground"
                : isPicked
                  ? "border-destructive/50 bg-destructive/10 text-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground";

            return (
              <button
                key={option}
                type="button"
                disabled={!!result || busy}
                onClick={() => void onAnswer(index)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14px] leading-snug transition-colors disabled:cursor-default ${tone}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-semibold">
                  {result && isCorrect ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : result && isPicked ? (
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    String.fromCharCode(65 + index)
                  )}
                </span>
                {option}
              </button>
            );
          })
        ) : (
          <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Writing a fresh question…
          </div>
        )}

        {result ? (
          <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
            <p className="text-[13px] font-semibold text-foreground">
              {result.isCorrect ? "Correct" : "Not quite"}
            </p>
            {result.streakSaved ? (
              <p className="mt-1 text-[12px] text-muted-foreground">
                You missed a day — {STREAK_SAVE_COST} coins were spent to keep your progress.
              </p>
            ) : null}

            {result.isCorrect && typeof result.coins === "number" ? (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <Coins className="h-4 w-4 text-primary" aria-hidden="true" />
                {result.coins} coins
                {result.coinsEarned ? (
                  <span className="font-normal text-muted-foreground">
                    (+{result.coinsEarned} earned)
                  </span>
                ) : null}
              </p>
            ) : null}
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {result.explanation}
            </p>

            {canRetry ? (
              <button
                type="button"
                disabled={loadingNext}
                onClick={() => void onNextQuestion()}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground disabled:opacity-60"
              >
                {loadingNext ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                Try another question
              </button>
            ) : null}

            <Link
              to="/fact/$slug"
              params={{ slug: quiz.factSlug }}
              className="mt-3 block text-xs uppercase tracking-[0.16em] text-primary underline-offset-4 hover:underline"
            >
              Revisit {quiz.factTitle}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
