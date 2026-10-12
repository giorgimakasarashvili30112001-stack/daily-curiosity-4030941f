/**
 * ai.server.ts
 * ------------
 * File-level: Server-only wrapper around Google's Gemini API for structured
 * (JSON) generation. Reads GEMINI_API_KEY from the environment. Keep
 * provider-specific code here so swapping providers only touches this file.
 *
 * Reliability: Gemini regularly answers 503 "model is currently experiencing
 * high demand" (and sometimes 429/500). Each request is retried with backoff,
 * and if a model stays unavailable the next model in the fallback chain is
 * tried, so a temporary overload no longer stops content generation.
 */

/** Tried in order. Override the first with GEMINI_MODEL, the whole list with GEMINI_MODELS (comma separated). */
const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"];

/** Attempts per model for temporary failures (1 try + retries). */
const ATTEMPTS_PER_MODEL = 3;

/** HTTP statuses worth retrying: overload, rate limit and transient server errors. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

type JsonSchema = Record<string, unknown>;

/** Sleeps for `ms` milliseconds (overridable in tests via GEMINI_RETRY_BASE_MS=0). */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Builds the model chain: `preferred` (if given) first, then GEMINI_MODEL, then
 * the defaults; GEMINI_MODELS replaces everything. Duplicates are removed.
 */
export function modelChain(preferred?: string[]): string[] {
  const fromEnv = (process.env["GEMINI_MODELS"] ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const single = process.env["GEMINI_MODEL"]?.trim();
  const base = fromEnv.length ? fromEnv : [...(single ? [single] : []), ...DEFAULT_MODELS];
  return [...new Set([...(preferred ?? []), ...base])];
}

/**
 * Asks Gemini for a JSON response that conforms to `schema`.
 *
 * Params: `system` — system instruction; `user` — the prompt; `schema` — a
 * Gemini/OpenAPI-style response schema; `models` — optional models to try first.
 * Returns: the raw JSON string produced by the model, or null when the model
 * returned no content.
 * Side effects: HTTPS requests to the Gemini API (up to 3 attempts per model,
 * across several models). Throws on a missing API key, a non-retryable error
 * (e.g. 400/401/403), or when every model and attempt has failed; the error
 * message lists what happened for each model.
 */
export async function generateJson(opts: {
  system: string;
  user: string;
  schema: JsonSchema;
  models?: string[];
}): Promise<string | null> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const baseDelay = Number(process.env["GEMINI_RETRY_BASE_MS"] ?? 1500);
  const failures: string[] = [];

  for (const model of modelChain(opts.models)) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: opts.system }] },
              contents: [{ role: "user", parts: [{ text: opts.user }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: opts.schema,
              },
            }),
          },
        );
      } catch (error) {
        // Network error: treat like a temporary failure.
        failures.push(`${model}: network error (${(error as Error).message})`);
        if (attempt < ATTEMPTS_PER_MODEL) await sleep(baseDelay * attempt * attempt);
        continue;
      }

      if (response.ok) {
        const payload = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        return payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") || null;
      }

      const body = (await response.text()).replace(/\s+/g, " ").slice(0, 300);
      failures.push(`${model}: HTTP ${response.status} ${body}`);

      // Model name unknown to this API key: skip straight to the next model.
      if (response.status === 404) break;
      // Bad request / bad key / forbidden: retrying or switching models cannot help.
      if (!RETRYABLE.has(response.status)) {
        throw new Error(`AI request failed (${response.status}): ${body}`);
      }
      if (attempt < ATTEMPTS_PER_MODEL) await sleep(baseDelay * attempt * attempt);
    }
  }

  throw new Error(
    `AI request failed after retries on every model. ${failures.slice(-6).join(" | ")}`,
  );
}
