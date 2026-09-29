/**
 * ai.server.ts
 * ------------
 * File-level: Server-only wrapper around Google's Gemini API for structured
 * (JSON) generation. Reads GEMINI_API_KEY (and optionally GEMINI_MODEL) from
 * the environment. Keep provider-specific code here so swapping providers
 * only touches this file.
 */

const DEFAULT_MODEL = "gemini-flash-latest";

type JsonSchema = Record<string, unknown>;

/**
 * Asks Gemini for a JSON response that conforms to `schema`.
 *
 * Params: `system` — system instruction; `user` — the prompt; `schema` — a
 * Gemini/OpenAPI-style response schema.
 * Returns: the raw JSON string produced by the model, or null when the model
 * returned no content.
 * Side effects: one HTTPS request to the Gemini API. Throws on missing API
 * key, rate limiting, or any non-2xx response.
 */
export async function generateJson(opts: {
  system: string;
  user: string;
  schema: JsonSchema;
}): Promise<string | null> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const model = process.env["GEMINI_MODEL"] || DEFAULT_MODEL;

  const response = await fetch(
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

  if (response.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") || null;
}
