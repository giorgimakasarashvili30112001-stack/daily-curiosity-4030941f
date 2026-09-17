/**
 * facts.server.ts
 * ---------------
 * File-level: Server-only helpers for the explainer ("fact") library. Owns the
 * shared Fact shape, the row -> Fact mapper, the daily-pick scheduler, and the
 * AI top-up routine that keeps the unused-fact pool stocked. Uses the Supabase
 * admin client, so it must never be imported by client code.
 */
import { dbAdmin as supabaseAdmin } from "./db.server";

/** One numbered step of an explainer: a short heading plus its explanation. */
export type FactStep = { heading: string; body: string };

/** A single explainer as the UI consumes it (already normalized from a DB row). */
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

/**
 * The exact column list every fact read requests — keeps queries narrow so the
 * database never ships columns the UI does not render.
 */
export const FACT_COLUMNS =
  "id, title, slug, category, hook, intro, steps, surprising_detail";

/**
 * Today's date in UTC as `YYYY-MM-DD`. UTC (not device time) is the scheduling
 * key so every user worldwide is served the same daily explainer.
 */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Coerces the JSON `steps` column into a clean FactStep[]: drops non-objects,
 * stringifies heading/body, and removes entries that are entirely empty.
 */
function normalizeSteps(value: unknown): FactStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ heading: String(s["heading"] ?? ""), body: String(s["body"] ?? "") }))
    .filter((s) => s.heading || s.body);
}

/**
 * Maps a raw `facts` table row to the strongly typed `Fact` used by routes and
 * components, normalizing the JSON steps array along the way.
 */
export function toFact(row: Record<string, unknown>): Fact {
  return {
    id: String(row["id"]),
    title: String(row["title"]),
    slug: String(row["slug"]),
    category: String(row["category"]),
    hook: String(row["hook"]),
    intro: String(row["intro"]),
    steps: normalizeSteps(row["steps"]),
    surprising_detail: String(row["surprising_detail"]),
  };
}

/**
 * Builds a URL-safe slug from a title: lowercased, non-alphanumerics collapsed
 * to dashes, trimmed of edge dashes, capped at 80 characters.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Counts facts that have never been scheduled (`pick_date IS NULL`) — the size
 * of the pool still available for future days. Drives `topUpFacts`.
 */
export async function countUnusedFacts(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("facts")
    .select("id", { count: "exact", head: true })
    .is("pick_date", null);
  return count ?? 0;
}


/** Returns the fact scheduled for `date`, scheduling one if none exists yet. */
export async function ensureDailyPick(date: string): Promise<Fact | null> {
  const existing = await supabaseAdmin
    .from("facts")
    .select(FACT_COLUMNS)
    .eq("pick_date", date)
    .maybeSingle();
  if (existing.data) return toFact(existing.data as Record<string, unknown>);

  // Avoid two days in a row from the same category.
  const yesterday = new Date(`${date}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const prev = await supabaseAdmin
    .from("facts")
    .select("category")
    .eq("pick_date", yesterday.toISOString().slice(0, 10))
    .maybeSingle();
  const prevCategory = (prev.data as { category?: string } | null)?.category ?? null;

  const pickCandidate = async (excludeCategory: string | null) => {
    let q = supabaseAdmin.from("facts").select(FACT_COLUMNS).is("pick_date", null).limit(1);
    if (excludeCategory) q = q.neq("category", excludeCategory);
    // Rotate deterministically by date so the same fact is served to everyone.
    const seed = Number(date.replace(/-/g, "")) % 2 === 0;
    q = q.order("created_at", { ascending: seed }).order("id", { ascending: seed });
    const { data } = await q;
    return data?.[0] ?? null;
  };

  let candidate = await pickCandidate(prevCategory);
  if (!candidate) candidate = await pickCandidate(null);
  if (!candidate) return null;

  const row = candidate as Record<string, unknown>;
  // Only claim the row if it is still unscheduled; a parallel request may have won.
  await supabaseAdmin
    .from("facts")
    .update({ pick_date: date })
    .eq("id", String(row["id"]))
    .is("pick_date", null);

  // Re-read so concurrent requests converge on the stored pick.
  const settled = await supabaseAdmin
    .from("facts")
    .select(FACT_COLUMNS)
    .eq("pick_date", date)
    .maybeSingle();
  return settled.data ? toFact(settled.data as Record<string, unknown>) : null;
}


type GeneratedFact = {
  title: string;
  category: string;
  hook: string;
  intro: string;
  steps: FactStep[];
  surprising_detail: string;
};

const CATEGORIES = [
  "Everyday Objects",
  "Vehicles",
  "Money",
  "Space",
  "Body",
  "Technology",
  "Nature",
  "Society",
  "General Knowledge",
];

/** Generates new explainers with Lovable AI when the unused library runs low. */
export async function topUpFacts(minUnused = 15, batchSize = 8): Promise<number> {
  const unused = await countUnusedFacts();
  if (unused >= minUnused) return 0;

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const { data: existing } = await supabaseAdmin.from("facts").select("title").limit(1000);
  const existingTitles = (existing ?? []).map((r) => r.title);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      reasoning_effort: "none",
      messages: [
        {
          role: "system",
          content:
            "You write short, factually accurate general-knowledge explainers for The Daily How app. Voice: sharp, warm, concrete, no fluff, no emoji.",
        },
        {
          role: "user",
          content: `Write ${batchSize} new explainers. Each title is either "How X works" or "What X means". Categories must come from: ${CATEGORIES.join(", ")}. hook = one punchy sentence under 90 characters. intro = two sentences of plain-language setup. steps = exactly 4 items, heading under 6 words, body 1-2 sentences explaining the real mechanism. surprising_detail = one genuinely surprising true fact. Topics must be concrete everyday curiosities. Do NOT reuse any of these existing titles: ${existingTitles.join(" | ")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "facts_batch",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              facts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    category: { type: "string", enum: CATEGORIES },
                    hook: { type: "string" },
                    intro: { type: "string" },
                    steps: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: { heading: { type: "string" }, body: { type: "string" } },
                        required: ["heading", "body"],
                      },
                    },
                    surprising_detail: { type: "string" },
                  },
                  required: [
                    "title",
                    "category",
                    "hook",
                    "intro",
                    "steps",
                    "surprising_detail",
                  ],
                },
              },
            },
            required: ["facts"],
          },
        },
      },
    }),
  });

  if (response.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
  if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return 0;

  let parsed: { facts?: GeneratedFact[] };
  try {
    parsed = JSON.parse(content) as { facts?: GeneratedFact[] };
  } catch {
    return 0;
  }

  const rows = (parsed.facts ?? [])
    .filter(
      (f) =>
        f &&
        typeof f.title === "string" &&
        f.title.length > 3 &&
        Array.isArray(f.steps) &&
        f.steps.length > 0 &&
        CATEGORIES.includes(f.category),
    )
    .map((f) => ({
      title: f.title.trim(),
      slug: slugify(f.title),
      category: f.category,
      hook: f.hook,
      intro: f.intro,
      steps: normalizeSteps(f.steps),
      surprising_detail: f.surprising_detail,
    }))
    .filter((f) => f.slug.length > 0);

  // Drop titles that already exist (or repeat within the batch) so the daily
  // rotation can never serve the same explainer twice under a different slug.
  const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const seen = new Set(existingTitles.map(normalize));
  const fresh = rows.filter((f) => {
    const key = normalize(f.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (fresh.length === 0) return 0;

  const { error } = await supabaseAdmin.from("facts").upsert(fresh, { onConflict: "slug" });
  if (error) throw error;
  return fresh.length;

}
