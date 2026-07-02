# LLM Providers

## Purpose
ATEROMANTE should let users connect the tutor to different model providers without changing the training, board or persistence code.

## Current Contract
The API-side contract lives in:

- `local/tutor/tutor-service.mjs`
- `local/api/server.mjs`
- `local/persistence/repositories.mjs`

Earlier browser-side type files remain useful as design references, but provider execution belongs behind the local API so secrets and remote calls do not enter the browser bundle.

The tutor provider receives:

- language;
- tutor depth;
- current FEN;
- PGN or move history;
- last move;
- engine lines;
- student profile summary;
- match policy.

The provider returns:

- educational summary;
- optional candidate move;
- teaching focus;
- board annotations;
- follow-up exercise;
- confidence level.

## Provider Families

- `mock`: implemented local placeholder for development, tests and offline QA.
- `local-http`: implemented local model server integration through HTTP.
- `openai-compatible`: remote chat/completion APIs with OpenAI-style endpoints.
- `anthropic-compatible`: remote message APIs with Anthropic-style endpoints.

The default active provider is:

```text
ATEROMANTE_LLM_PROVIDER=mock-local
```

For a local HTTP model server:

```text
ATEROMANTE_LLM_PROVIDER=local-http-default
ATEROMANTE_LOCAL_LLM_URL=http://127.0.0.1:11434/api/generate
ATEROMANTE_LOCAL_LLM_MODEL=your-local-model
ATEROMANTE_LOCAL_LLM_TIMEOUT_MS=15000
```

The local provider sends prepared context and asks for strict JSON. It also accepts plain text responses and normalizes them into the tutor response contract.

## Secrets
API keys must stay outside Git.

Use `.env` or the operating system credential store. `.env.example` shows expected variable names without real values.

## Design Rule
Provider code must remain replaceable. The core tutor service should depend on the `LlmTutorProvider` interface, not on a vendor SDK.
