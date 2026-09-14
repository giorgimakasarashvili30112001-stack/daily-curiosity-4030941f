/**
 * Server functions (TanStack Start `createServerFn`) exposing the public
 * "explainer" (fact) content to the client: today's fact, the archive of
 * past facts, and lookup by slug. All handlers are read-only from the
 * client's point of view, though `getTodayFact` may trigger background
 * generation of new facts when the library is running low.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** One step in the "how it works" walkthrough of an explainer. */
export type FactStep = { heading: string; body: string };

/** Shape of a single daily explainer as sent to the client. */
export type Fact = {
  id: string;
  title: string;
  slug: string;
  category: string;
  hook: string;
  intro: string;
  steps: FactStep[];
  surprising_detail: string;
};

/** A row in the public archive list (facts already featured on a past date). */
export type ArchiveEntry = {
  pick_date: string;
  slug: string;
  title: string;
  category: string;
  hook: string;
};

/**
 * Returns today's featured explainer, generating/backfilling the fact
 * library in the background if it's running low.
 *
 * How it works:
 * - Computes today's UTC date and asks `ensureDailyPick` for the fact
 *   assigned to that date (assigning one if none exists yet).
 * - If no fact could be picked (library exhausted), it eagerly calls
 *   `topUpFacts` to generate more, then retries the pick once, without
 *   ever throwing to the caller.
 * - If a fact was found but the unused pool is getting low (<15), it
 *   kicks off `topUpFacts` in the background ("fire and forget") so the
 *   next call isn't blocked.
 *
 * Params: none.
 * Returns: `{ date, fact }` where `fact` is `null` only if generation
 * failed and there really is nothing to show.
 * Side effects: may write new fact rows to the DB via `topUpFacts`/
 * `ensureDailyPick`; logs (does not throw) on generation failure.
 */
export const getTodayFact = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ date: string; fact: Fact | null }> => {
    const { ensureDailyPick, todayUtc, topUpFacts, countUnusedFacts } = await import(
      "./facts.server"
    );
    const date = todayUtc();

    let fact = await ensureDailyPick(date);
    if (!fact) {
      // Library exhausted: try to generate before serving, but never fail the page.
      try {
        await topUpFacts(15, 8);
        fact = await ensureDailyPick(date);
      } catch (error) {
        console.error("fact generation failed", error);
      }
    } else if ((await countUnusedFacts()) < 15) {
      // Warm the library in the background; failures are non-fatal.
      void topUpFacts(15, 8).catch((error) => console.error("fact top-up failed", error));
    }

    return { date, fact };
  },
);

/**
 * Returns up to 120 past explainers (most recent first) that have already
 * been featured (i.e. have a `pick_date` on or before today), for the
 * public archive page.
 *
 * Params: none.
 * Returns: array of `ArchiveEntry`, empty if the query returns nothing.
 * Side effects: read-only DB query against `facts` via the admin client.
 */
export const getArchive = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArchiveEntry[]> => {
    const { dbAdmin: supabaseAdmin } = await import("./db.server");
    const { todayUtc } = await import("./facts.server");

    const { data } = await supabaseAdmin
      .from("facts")
      .select("pick_date, slug, title, category, hook")
      .not("pick_date", "is", null)
      .lte("pick_date", todayUtc())
      .order("pick_date", { ascending: false })
      .limit(120);

    return (data ?? []).map((row) => ({
      pick_date: String(row.pick_date),
      slug: row.slug,
      title: row.title,
      category: row.category,
      hook: row.hook,
    }));
  },
);

/**
 * Looks up a single explainer by its slug, for the fact detail page.
 *
 * Params: `{ slug }` — validated non-empty string.
 * Returns: `{ fact, pickDate }` if the fact exists and has already been
 * featured (pick_date set and not in the future); otherwise `null`.
 * Side effects: read-only DB query via the admin client. Only explainers
 * that have already appeared as "today's fact" are publicly readable —
 * this hides unpublished/future facts from direct slug lookup.
 */
export const getFactBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<{ fact: Fact; pickDate: string | null } | null> => {
    const { dbAdmin: supabaseAdmin } = await import("./db.server");
    const { FACT_COLUMNS, toFact, todayUtc } = await import("./facts.server");

    const { data: row } = await supabaseAdmin
      .from("facts")
      .select(`${FACT_COLUMNS}, pick_date`)
      .eq("slug", data.slug)
      .not("pick_date", "is", null)
      .lte("pick_date", todayUtc())
      .maybeSingle();

    // Only explainers that have already been featured are publicly readable.
    if (!row) return null;

    const record = row as Record<string, unknown>;
    return { fact: toFact(record), pickDate: String(record["pick_date"]) };
  });
