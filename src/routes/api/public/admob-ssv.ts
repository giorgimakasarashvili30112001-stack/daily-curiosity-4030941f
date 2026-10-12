import { createFileRoute } from "@tanstack/react-router";

/** Coins granted for one watched rewarded ad, and the per-user daily limit. */
const REWARD_COINS = 3;
const DAILY_CAP = 10;

/**
 * AdMob server-side verification callback. Set this URL on the rewarded ad unit in AdMob:
 *   https://YOUR-DOMAIN/api/public/admob-ssv
 * Google calls it (GET, signed) after a user finishes watching; we verify the signature
 * and credit REWARD_COINS once per transaction.
 */
export const Route = createFileRoute("/api/public/admob-ssv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { verifyAdMobSsv } = await import("@/lib/admob-ssv.server");
          const { userId, transactionId } = await verifyAdMobSsv(new URL(request.url));
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
          const { data, error } = await db.rpc("grant_ad_reward", {
            p_user: userId,
            p_tx: transactionId,
            p_coins: REWARD_COINS,
            p_daily_cap: DAILY_CAP,
          });
          if (error) throw new Error(error.message);
          return new Response(String(data), { status: 200 });
        } catch (e) {
          console.error("admob ssv rejected:", (e as Error).message);
          return new Response("invalid", { status: 400 });
        }
      },
    },
  },
});
