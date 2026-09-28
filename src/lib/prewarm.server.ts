import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/** Loosely typed client: generated types predate the `facts.pick_date` column. */
const supabaseAdmin = supabase as unknown as SupabaseClient;

import { ensureDailyPick, todayUtc, topUpFacts, countUnusedFacts } from "./facts.server";
import { loadQuestion, getQuestionForFact } from "./quiz.server";

export type PrewarmResult = {
  date: string;
  tomorrow: string;
  factsGenerated: number;
  tomorrowFactSlug: string | null;
  questionsGenerated: number;
  skipped: string[];
  errors: string[];
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Prepares tomorrow's content ahead of time: keeps the explainer library
 * stocked, reserves tomorrow's daily pick, and generates the quiz questions
 * that tomorrow's quiz will need (the quiz always asks about the previous
 * day's explainer, so both today's and tomorrow's facts get a question).
 *
 * Nothing here changes what the app shows: every read path filters picks to
 * `pick_date <= today`, so tomorrow's row stays invisible until tomorrow.
 *
 * Bounded by design — at most one top-up batch, one pick, and two questions
 * per run — and fully idempotent: already-prepared work is skipped.
 */
export async function prewarmTomorrow(): Promise<PrewarmResult> {
  const date = todayUtc();
  const tomorrow = addDays(date, 1);
  const result: PrewarmResult = {
    date,
    tomorrow,
    factsGenerated: 0,
    tomorrowFactSlug: null,
    questionsGenerated: 0,
    skipped: [],
    errors: [],
  };

  // 1. Keep the unused library stocked so a pick is always available.
  try {
    if ((await countUnusedFacts()) < 15) {
      result.factsGenerated = await topUpFacts(15, 8);
    } else {
      result.skipped.push("library-stocked");
    }
  } catch (error) {
    result.errors.push(`facts: ${(error as Error).message}`);
  }

  // 2. Reserve today's and tomorrow's picks (idempotent upserts).
  try {
    await ensureDailyPick(date);
    const fact = await ensureDailyPick(tomorrow);
    result.tomorrowFactSlug = fact?.slug ?? null;
  } catch (error) {
    result.errors.push(`pick: ${(error as Error).message}`);
  }

  // 3. Generate the quiz questions those picks will need.
  for (const pickDate of [date, tomorrow]) {
    try {
      const { data: pick } = await supabaseAdmin
        .from("facts")
        .select("id")
        .eq("pick_date", pickDate)
        .maybeSingle();
      if (!pick?.id) {
        result.skipped.push(`no-pick-${pickDate}`);
        continue;
      }
      if (await loadQuestion(pick.id, 0)) {
        result.skipped.push(`question-ready-${pickDate}`);
        continue;
      }
      const question = await getQuestionForFact(pick.id, 0);

      if (question) result.questionsGenerated += 1;
    } catch (error) {
      result.errors.push(`quiz ${pickDate}: ${(error as Error).message}`);
    }
  }

  return result;
}
