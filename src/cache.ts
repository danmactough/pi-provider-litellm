import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CacheFile } from "./types.js";

export function fingerprint(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function isCacheValid(
  cache: CacheFile | null,
  baseUrl: string,
  apiKey: string,
): boolean {
  if (!cache) return false;
  return cache.baseUrl === baseUrl && cache.apiKeyFingerprint === fingerprint(apiKey);
}

export async function readCache(path: string): Promise<CacheFile | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isCacheFileShape(parsed)) return null;
  return parsed;
}

function isCacheFileShape(value: unknown): value is CacheFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.baseUrl === "string" &&
    typeof v.apiKeyFingerprint === "string" &&
    typeof v.fetchedAt === "number" &&
    (v.source === "model_info" || v.source === "models_list") &&
    Array.isArray(v.models)
  );
}
