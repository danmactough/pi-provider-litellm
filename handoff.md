# Handoff: Add multiple credentials/providers to pi-provider-litellm

## Next session focus

Add support to `pi-provider-litellm` for multiple LiteLLM provider registrations against the same or different LiteLLM proxy URLs, each with its own API key/credential source. Intended use case: Dan has one LiteLLM virtual key for OpenAI/GPT models and a separate key for Anthropic/Claude models; Pi currently exposes only one hardcoded `litellm` provider and one credential.

## Repository / paths

- Working repo: `/Users/dmactough/code/pi-provider-litellm`
- Current Pi config references this package from source via:
  - `/Users/dmactough/.pi/agent/settings.json`
  - package entry: `git:git@github.com-personal:danmactough/pi-provider-litellm.git`
- Extension README: `/Users/dmactough/code/pi-provider-litellm/README.md`
- Main implementation file: `/Users/dmactough/code/pi-provider-litellm/src/index.ts`

## What happened in this session

- Confirmed current LiteLLM auth:
  - `~/.pi/agent/auth.json` has a `litellm` entry with `baseUrl: https://llmproxy.ai.rocketmoney.dev`
  - Env has:
    - `LITELLM_BASE_URL=https://llmproxy.ai.rocketmoney.dev`
    - `LITELLM_API_KEY=...`
    - `LITELLM_HEADERS={"x-litellm-customer-id": "danmactough@rocketmoney.com"}`
- Listed models via `/v1/models`; current key only has GPT models:
  - `gpt-5.4`, `gpt-5`, `gpt-5-nano`, `gpt-5-mini`, `gpt-4.1`, `gpt-5.4-mini`, `gpt-5.2`, `gpt-5.3-codex`, `gpt-5.5`, `gpt-5.1`
- Tested Anthropic-compatible endpoints:
  - `POST /v1/messages` exists on the proxy but returned `401 key_model_access_denied` for a Claude model with the GPT key.
  - `POST /messages` returned `404`.
  - `POST /anthropic/v1/messages` also routed but returned model access denied.
- Conclusion given to Dan: the extension does not need Anthropic-specific endpoints for normal Pi usage; LiteLLM can call Claude models through the OpenAI-compatible `/v1/chat/completions` endpoint if the key can access those models. The missing capability is multiple credential/provider registrations, not Anthropic endpoint support.

## Current implementation facts

In `src/index.ts`:

- Provider name is hardcoded as `PROVIDER_NAME = "litellm"`.
- Credentials are resolved by `resolveCredentials()` from one of:
  - saved `/login litellm` OAuth/auth entry
  - `LITELLM_GCLOUD_TOKEN_AUTH`
  - `LITELLM_API_KEY_HELPER`
  - `LITELLM_API_KEY`
- Saved `/login` credentials take precedence over env vars.
- `registerProvider()` registers exactly one provider:
  - `pi.registerProvider(PROVIDER_NAME, { ... })`
  - `baseUrl: ${baseUrl}/v1`
  - `api: "openai-completions"`
  - `apiKey: apiKeyConfig`
  - `headers: parseCustomHeaders(process.env.LITELLM_HEADERS)`
- Model cache is a single file:
  - `~/.pi/agent/litellm-models.json`
  - keyed by `baseUrl + apiKeyFingerprint` via cache validation/fingerprint logic.
- `/login litellm` handles one credential only.
- `/litellm-refresh`, MCP tools, Skills Gateway, and cost tracking are currently built around one provider/base URL/key.

## Desired capability

Support something like multiple configured LiteLLM provider aliases:

```json
{
  "litellm": {
    "providers": {
      "litellm": {
        "baseUrl": "https://llmproxy.ai.rocketmoney.dev",
        "apiKeyEnv": "LITELLM_API_KEY",
        "headersEnv": "LITELLM_HEADERS"
      },
      "litellm-anthropic": {
        "baseUrl": "https://llmproxy.ai.rocketmoney.dev",
        "apiKeyEnv": "LITELLM_ANTHROPIC_API_KEY",
        "headersEnv": "LITELLM_HEADERS"
      }
    }
  }
}
```

Exact config shape is not decided. Keep it simple and compatible with existing user-facing single-provider behavior.

Important product behavior:

- Existing env vars and `/login litellm` should continue working unchanged for the default `litellm` provider.
- Additional providers should show separately in Pi model names, e.g.:
  - `litellm/gpt-5`
  - `litellm-anthropic/claude-...`
- Each provider alias needs separate:
  - provider registration name
  - API key config
  - model discovery
  - cache identity/file or keyed cache entry
  - optional headers
- Prefer OpenAI-compatible API for all registered providers (`api: "openai-completions"`). No need to implement Anthropic `/v1/messages` unless separately requested.

## Suggested implementation approach

Use TDD. Existing package has Vitest tests.

1. Read package docs/tests first:
   - `README.md`
   - `src/index.ts`
   - `tests/index.test.ts`
   - any cache/discovery tests
2. Add tests describing:
   - backward-compatible single-provider env behavior
   - registering two provider aliases from config/env
   - each alias gets its own API key value/config and discovered model list
   - model cache separation between aliases
   - refresh behavior for multiple providers, if `/litellm-refresh` should refresh all aliases
3. Implement minimal config reader.
   - Need to inspect Pi extension API/settings access. Search existing code/tests for how extensions read config.
   - If Pi package config access is awkward, consider env-only first, e.g. `LITELLM_PROVIDERS_JSON`, but ask Dan before choosing a public interface.
4. Refactor credential/model registration flow from single global `creds/models/registerProvider` into per-provider config objects.
5. Preserve `/login litellm` as default-provider login only unless expanding login UX is explicitly requested.
6. Update README with config examples.
7. Run:
   - `npm run check`
   - `npm run clean && npm run build`

## Open questions / ask Dan before changing public interface

- Preferred configuration surface:
  - Pi settings JSON?
  - env var JSON?
  - both?
- Should `/login litellm` remain only for default `litellm`, or should there be login flows for aliases?
- Should `/litellm-refresh` refresh all configured aliases or accept an alias argument?
- Should MCP tools and Skills Gateway use only the default provider, or register per alias?

## Skills suggested for next session

- `tdd` — this is a behavior change in an existing package with tests; use red-green-refactor.
- `diagnose` — if Pi extension API/config behavior is unclear or tests fail unexpectedly.
- `pi-subagents` — useful for parallel codebase reconnaissance/review before implementation.
