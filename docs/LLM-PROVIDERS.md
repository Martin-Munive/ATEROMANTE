# LLM Providers

## Purpose
ATEROMANTE should let users connect the tutor to different model providers without changing the training, board or persistence code.

## Current Contract
The public contract lives in:

- `src/domain/llmTypes.ts`
- `src/services/llm/providerRegistry.ts`
- `src/services/llm/mockTutorProvider.ts`

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

- `mock`: local placeholder for development and tests.
- `openai-compatible`: remote chat/completion APIs with OpenAI-style endpoints.
- `anthropic-compatible`: remote message APIs with Anthropic-style endpoints.
- `local-http`: local model server exposed through HTTP.

## Secrets
API keys must stay outside Git.

Use `.env` or the operating system credential store. `.env.example` shows expected variable names without real values.

## Design Rule
Provider code must remain replaceable. The core tutor service should depend on the `LlmTutorProvider` interface, not on a vendor SDK.
