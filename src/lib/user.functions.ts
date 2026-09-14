/**
 * Server functions (TanStack Start `createServerFn`) for the signed-in
 * user's profile and saved-facts ("favorites") features: reading profile
 * state (which also settles streak bookkeeping), updating the display
 * name, and listing/toggling saved facts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";


/** Profile summary shown on the account/profile screen. */
export type ProfileState = {
  displayName: string | null;
  streak: number;
  longestStreak: number;
  lastSeenDate: string | null;
  coins: number;
  streakSaved?: boolean;
  streakLost?: boolean;
};


/** A fact the user has bookmarked, with the timestamp it was saved. */
export type SavedFact = {
  slug: string;
  title: string;
  category: string;
  hook: string;
  savedAt: string;
};

/**
 * Loads the signed-in user's profile state, settling any missed streak
 * days as a side effect (via `settleStreak`), and counts their saved
 * facts.
 *
 * Params: none (auth required).
 * Returns: `ProfileState & { savedCount }`.
 * Side effects: `settleStreak` may auto-spend coins to save a missed day
 * and update `profiles` (streak_count, coins, saved_days, etc.).
 */
export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileState & { savedCount: number }> => {
    const { supabase, userId } = context;
    const { todayUtc } = await import("./facts.server");
    const { settleStreak } = await import("./streak.server");

    const today = todayUtc();
    const [settlement, { count }] = await Promise.all([
      settleStreak(supabase, userId, today),
      supabase.from("favorites").select("fact_id", { count: "exact", head: true }),
    ]);

    return {
      displayName: settlement.profile.display_name ?? null,
      streak: settlement.streak,
      longestStreak: settlement.longestStreak,
      lastSeenDate: settlement.anchor ?? settlement.profile.last_seen_date ?? null,
      coins: settlement.coins,
      streakSaved: settlement.streakSaved,
      streakLost: settlement.streakLost,
      savedCount: count ?? 0,
    };
  });



/**
 * Updates (or clears) the signed-in user's display name.
 *
 * Params: `{ displayName }` — trimmed; an empty string clears the name
 * (stored as `null`).
 * Returns: `{ ok: true }`.
 * Side effects: upserts a row in `profiles` (display_name, updated_at).
 */
export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ displayName: z.string().max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const name = data.displayName.trim();
    const { error } = await context.supabase
      .from("profiles")
      .upsert(
        { id: context.userId, display_name: name || null, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (error) throw error;
    return { ok: true };
  });

/**
 * Lists the signed-in user's saved facts, most recently saved first.
 *
 * Params: none (auth required).
 * Returns: `SavedFact[]` (rows whose joined fact is missing are dropped).
 * Side effects: read-only DB query joining `favorites` to `facts`.
 */
export const getSavedFacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedFact[]> => {
    const { data } = await context.supabase
      .from("favorites")
      .select("created_at, facts:fact_id (slug, title, category, hook)")
      .order("created_at", { ascending: false });

    return (data ?? [])
      .map((row) => {
        const fact = row.facts as
          | { slug: string; title: string; category: string; hook: string }
          | null;
        if (!fact) return null;
        return { ...fact, savedAt: row.created_at };
      })
      .filter((row): row is SavedFact => row !== null);
  });

/**
 * Checks whether a given fact is already saved by the signed-in user.
 *
 * Params: `{ factId }` (auth required).
 * Returns: `{ saved: boolean }`.
 * Side effects: read-only DB query against `favorites`.
 */
export const isFactSaved = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ factId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("favorites")
      .select("fact_id")
      .eq("fact_id", data.factId)
      .maybeSingle();
    return { saved: !!row };
  });

/**
 * Saves or un-saves a fact for the signed-in user (toggle behavior based
 * on current state).
 *
 * Params: `{ factId }` (auth required).
 * Returns: `{ saved: boolean }` reflecting the new state.
 * Side effects: inserts into or deletes from `favorites`.
 */
export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ factId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("favorites")
      .select("fact_id")
      .eq("fact_id", data.factId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("fact_id", data.factId)
        .eq("user_id", userId);
      if (error) throw error;
      return { saved: false };
    }

    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: userId, fact_id: data.factId });
    if (error) throw error;
    return { saved: true };
  });
