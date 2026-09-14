import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled endpoint that prepares tomorrow's explainer + quiz question.
 * Call it once a day (e.g. pg_cron) with:
 *   Authorization: Bearer <SB_SERVICE_ROLE_KEY>
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env["PREWARM_SECRET"] ?? process.env["SB_SERVICE_ROLE_KEY"] ?? "";
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
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
