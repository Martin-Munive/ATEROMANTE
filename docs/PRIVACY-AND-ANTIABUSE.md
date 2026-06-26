# Privacy And Anti-Abuse

## Core Rule
ATEROMANTE is a training lab. It must not be used for hidden live assistance in competitive games against humans.

## Local-First Data
The current app stores data locally in SQLite.

Current local data may include:

- training sessions;
- games;
- positions;
- moves;
- engine evaluations;
- event log entries;
- future learning events and review items.

Generated databases are ignored by Git.

## Private Study Material
Private books, PDFs, RAR files, personal notes and proprietary chess material must not be committed to the public repository.

Future private-study features must keep private material local unless the user explicitly exports or shares it.

## External Services
Future integrations may include:

- LLM providers;
- Lichess imports;
- Chess.com public archive imports;
- local UCI engines;
- optional local model servers.

Before any external data transfer, the app should show:

- what data is sent;
- why it is needed;
- which provider receives it;
- whether it is optional;
- how the user can disable it.

## Human-Vs-Human Training
Human-vs-human modes are allowed only as consent-based training.

The app must visibly declare:

- whether tutor assistance is active;
- whether help is private, shared or symmetric;
- whether engine analysis is live or post-game only;
- whether the session is training, class, correspondence or evaluation.

Exports from assisted sessions should be marked as training-assisted when applicable.

## Online Competitive Play
Do not use ATEROMANTE to receive hidden live help during online competitive games.

The product should not provide a workflow that encourages:

- covert engine recommendations;
- hidden LLM coaching;
- bypassing platform fair-play rules;
- masking assisted games as unaided rated games.

## Logs And Errors
Client-facing errors should avoid exposing:

- local executable paths;
- secrets;
- personal file paths;
- provider API keys;
- private study material names.

Developer logs may include more detail locally, but must not be uploaded or published by default.

## Secrets
LLM provider keys and other secrets must live in `.env` or OS credential storage.

Never commit:

- `.env`;
- API keys;
- access tokens;
- private account identifiers;
- private database files.

## User Controls Required Before Release
Before broader user release, ATEROMANTE should provide:

- data export;
- data deletion;
- clear local data path;
- opt-in external provider use;
- provider disable controls;
- assisted-game labeling.
