import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled endpoint that prepares tomorrow's explainer + quiz question.
 * Call it once a day (e.g. pg_cron) with:
 *   Authorization: Bearer <SB_SERVICE_ROLE_KEY>
 */
/**
 * Accepts the call when the bearer token matches the env secret
 * (PREWARM_SECRET / SB_SERVICE_ROLE_KEY) or the database-generated token the
 * daily pg_cron job sends (verified via the service-role-only
 * `verify_cron_token` function — see DAILY_SCHEDULER_SETUP.sql).
 */
async function isAuthorized(provided: string): Promise<boolean> {
  if (!provided) return false;
  const secret = process.env["PREWARM_SECRET"] ?? process.env["SB_SERVICE_ROLE_KEY"] ?? "";
  if (secret && provided === secret) return true;
  try {
    const { dbAdmin } = await import("@/lib/db.server");
    const { data, error } = await dbAdmin.rpc("verify_cron_token", {
      p_name: "prewarm",
      p_token: provided,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

async function handle(request: Request): Promise<Response> {
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!(await isAuthorized(provided))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { prewarmTomorrow } = await import("@/lib/prewarm.server");
    const result = await prewarmTomorrow();
    return new Response(JSON.stringify(result), {
      status: result.errors.length > 0 ? 207 : 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("prewarm failed", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

/**
 * Route: `GET|POST /api/public/prewarm` — server-only API endpoint (no UI).
 * Not authenticated via Supabase user sessions; instead requires a bearer
 * secret (PREWARM_SECRET or the service role key) in the Authorization
 * header, intended to be called by a scheduled job (e.g. pg_cron). On
 * success it generates/persists tomorrow's fact + quiz question via
 * `prewarmTomorrow()`.
 */
export const Route = createFileRoute("/api/public/prewarm")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
