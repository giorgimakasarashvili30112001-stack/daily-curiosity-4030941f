import { createFileRoute } from "@tanstack/react-router";

/**
 * Public, cacheable endpoint consumed by the native home-screen widgets
 * (Android AppWidget / iOS WidgetKit). Returns only today's fact title.
 */
async function handle(): Promise<Response> {
  const headers = {
    "content-type": "application/json",
    "cache-control": "public, max-age=300, s-maxage=300",
    "access-control-allow-origin": "*",
  };

  try {
    const { dbAdmin } = await import("@/lib/db.server");
    const date = new Date().toISOString().slice(0, 10);

    const { data, error } = await dbAdmin
      .from("facts")
      .select("title, category, slug, pick_date")
      .eq("pick_date", date)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return new Response(
        JSON.stringify({ title: null, message: "Today's fact is still being prepared." }),
        { status: 200, headers },
      );
    }

    return new Response(
      JSON.stringify({
        title: data.title,
        category: data.category ?? null,
        slug: data.slug ?? null,
        date: data.pick_date ?? date,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("today-title failed", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers,
    });
  }
}

/**
 * Route: `GET /api/public/today-title` — public, unauthenticated, CORS-open
 * JSON API endpoint (no UI). Consumed by native home-screen widgets
 * (Android AppWidget / iOS WidgetKit) that can't run the full web app.
 * Data: queries today's fact (title/category/slug) directly via the
 * server-only admin Supabase client (`dbAdmin`, bypasses RLS). Response is
 * cached for 5 minutes (`cache-control: public, max-age=300`).
 */
export const Route = createFileRoute("/api/public/today-title")({
  server: {
    handlers: {
      GET: () => handle(),
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,OPTIONS",
          },
        }),
    },
  },
});
