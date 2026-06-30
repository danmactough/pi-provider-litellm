// Parses the LITELLM_HEADERS env var into a header map handed to registerProvider.
//
// Values are returned verbatim on purpose: Pi resolves `$ENV_VAR`, `${ENV_VAR}`,
// `!command`, `$$`, and `$!` per request via the same config-value resolver used for
// `apiKey`. Resolving here would duplicate that logic and diverge from chat behavior.

function warn(message: string): void {
  process.stderr.write(`LiteLLM: ${message}\n`);
}

/** Parse LITELLM_HEADERS (a JSON object of header name -> string) into a header map. */
export function parseCustomHeaders(raw: string | undefined): Record<string, string> | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    warn(`ignoring LITELLM_HEADERS (invalid JSON: ${error instanceof Error ? error.message : String(error)})`);
    return undefined;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    warn("ignoring LITELLM_HEADERS (expected a JSON object of header name -> string value)");
    return undefined;
  }

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (name === "") {
      warn("ignoring LITELLM_HEADERS entry with empty name");
      continue;
    }
    if (typeof value !== "string") {
      warn(`ignoring LITELLM_HEADERS entry "${name}" (value is not a string)`);
      continue;
    }
    headers[name] = value;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}
