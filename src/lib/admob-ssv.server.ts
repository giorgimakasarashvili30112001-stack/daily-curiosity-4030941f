/**
 * Verifies AdMob rewarded-ad "server-side verification" (SSV) callbacks.
 * Google calls our endpoint with a signed query string; we check the ECDSA signature
 * against Google's published keys before crediting anything.
 * https://developers.google.com/admob/android/ssv
 */
import { createPublicKey, verify } from "node:crypto";

const KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
let cache: { at: number; keys: Map<string, string> } | null = null;

async function getKey(keyId: string, forceRefresh = false): Promise<string | undefined> {
  if (!cache || forceRefresh || Date.now() - cache.at > 24 * 3600_000) {
    const res = await fetch(KEYS_URL);
    if (!res.ok) throw new Error(`could not load AdMob verifier keys (${res.status})`);
    const json = (await res.json()) as { keys: { keyId: number; base64: string }[] };
    cache = { at: Date.now(), keys: new Map(json.keys.map((k) => [String(k.keyId), k.base64])) };
  }
  return cache.keys.get(keyId);
}

export type SsvResult = { userId: string; transactionId: string; adUnit: string | null };

/** Returns the verified callback details, or throws if the signature is not valid. */
export async function verifyAdMobSsv(url: URL): Promise<SsvResult> {
  const raw = url.search.slice(1);
  const idx = raw.indexOf("&signature=");
  if (idx < 0) throw new Error("missing signature");
  const message = raw.slice(0, idx);
  const params = new URLSearchParams(raw);
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  if (!signature || !keyId) throw new Error("missing signature or key_id");

  let pem = await getKey(keyId);
  if (!pem) pem = await getKey(keyId, true); // Google may have rotated keys
  if (!pem) throw new Error("unknown key_id");

  const key = createPublicKey({ key: Buffer.from(pem, "base64"), format: "der", type: "spki" });
  const sig = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (!verify("sha256", Buffer.from(message), key, sig)) throw new Error("bad signature");

  const userId = params.get("user_id") ?? "";
  const transactionId = params.get("transaction_id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !transactionId)
    throw new Error("missing user_id or transaction_id");
  return { userId, transactionId, adUnit: params.get("ad_unit") };
}
