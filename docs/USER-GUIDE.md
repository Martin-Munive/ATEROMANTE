# User Guide

## What ATEROMANTE Does Today
ATEROMANTE is currently a local technical spike for chess training. It lets you:

- open a local training board;
- move pieces with legal-move validation;
- persist sessions, games, positions and moves in SQLite;
- reopen recent sessions from the sidebar history;
- paste a FEN position and open it as a new study session;
- paste a basic PGN main line and open it as a persisted study session;
- preserve standard PGN headers, main-line comments, main-line NAG annotations, imported PGN variations and PGN source metadata;
- promote an imported PGN variation into a separate main-line study;
- export the current study as enriched PGN;
- request a first local tutor explanation through the API-backed tutor panel;
- view a first post-game report summary from moves, engine analysis and tutor explanations;
- save the current report recommendation as a persisted learning event;
- request engine analysis through a configured external UCI engine;
- see the engine score, best move, principal variation and a visual best-move arrow;
- run local QA commands to verify the app.

It does not yet include in-place PGN variation editing, full diagnostic reports, online connectors or networked training rooms.

## Install And Run
Install dependencies from the project root:

```powershell
npm install
```

Run the full local development flow with UI, API and SQLite:

```powershell
npm run dev:local
```

Open:

```text
http://127.0.0.1:5173
```

Run only the UI when you do not need persistence or the API:

```powershell
npm run dev
```

Run only the local API:

```powershell
npm run api
```

## First Session
When the app opens, it tries to recover the most recent saved game. If no saved game exists, it creates a new local training session.

Use the board by clicking:

1. the piece square;
2. a highlighted legal target square.

Illegal moves are rejected by the deterministic chess service, not by the tutor panel.

## Session History
The sidebar history lists recent persisted games.

Each item shows:

- training mode;
- move count;
- last move or `Inicio`.

Click a history item to reopen that saved game. This reloads the position, PGN, move list and legal move state from the local API.

## Import FEN
Use the `Importar FEN` panel in the sidebar to paste a single-line FEN position.

Click `Abrir posición` to create a new `fen-study` session from that position.

The app validates the FEN before writing to SQLite. Invalid FEN input is rejected and does not create a game.

## Import PGN
Use the `Importar PGN` panel in the sidebar to paste a basic PGN main line or select a local `.pgn` file.

Click `Abrir PGN` to import pasted text. Selecting a `.pgn` file imports it immediately.

The current importer validates moves with `chess.js`, persists every move and position, stores PGN headers such as event, site, players and result, preserves main-line comments and NAGs by position, stores imported PGN variations, stores non-sensitive source metadata, and refreshes the session history. Invalid PGN input is rejected before creating a game.

For file imports, ATEROMANTE stores the file name, size, MIME type when available and a SHA-256 hash of the PGN text. It does not store the local filesystem path.

Supported NAG input includes numeric annotations such as `$1` and common suffix annotations such as `!`, `?`, `!!`, `??`, `!?` and `?!`.

The current PGN slice is intentionally main-line first. Imported variations and nested subvariations are preserved and shown in the variation panel. Click a PGN variation to open it as a temporary branch, then use the variation arrows to step forward or backward without changing the saved main line.

Use the play button in the variation playback controls to open the selected branch as a new `variation-study` session. Use the branch-plus button to promote the selected branch into a new `mainline-replacement` study. Both actions create separate study lines and keep the original imported game unchanged.

Use the `Exportar` button in the top bar to download the current study as PGN. The exported PGN includes headers, main-line moves, comments, NAGs and preserved variations/subvariations.

## Engine Analysis
The engine panel can analyze the current persisted position.

Before using real analysis, configure an external UCI engine. ATEROMANTE does not bundle Stockfish.

See [Engine Setup](ENGINE-SETUP.md).

If no engine is configured, the UI shows an engine-unavailable message. That is expected during the spike.

## Tutor Panel
The tutor panel can request an explanation for the current position from the local API. The default provider is `mock-local`, a deterministic local tutor used to validate the contract. A local HTTP provider is also available for local model servers.

The tutor must not validate chess legality. Legal moves, FEN and PGN come from `chess.js` through the local game service.

Use `Explicar` to ask for a short explanation. The API stores the tutor event so future reports and learning memory can reference it.

The same panel shows an initial `Reporte post-partida` block. It summarizes move count, analyzed positions, tutor explanations, saved learning events, latest engine recommendation, prioritized critical positions with category/severity, repeated tutor focus and the next review suggestion. Use `Guardar aprendizaje` to convert the current report recommendation into a persisted learning event linked to the game, highest-priority critical move/position and latest tutor event when available.

When the report has review items, ATEROMANTE shows a directed exercise prompt tied to the saved position. Write what you remember or calculate in the review box before grading yourself with `Repetir`, `Difícil`, `Bien` or `Fácil`. ATEROMANTE stores that written attempt, gives a lightweight alignment signal, can compare the answer against the saved engine candidate when one exists, updates the next review interval and updates the mastery state for that learning event.

Use `Buscar aprendizaje` to recover saved learning traces by theme, tutor explanation text, SAN move, FEN fragment, full FEN, position hash, engine candidate, PGN ECO/opening, tags or written review attempts. This is the first local answer to "where did I learn this?" and searches the local SQLite learning memory through a local FTS index.

When you search with a full FEN or a 64-character position hash, ATEROMANTE can also recover compatible position-family results from the same local database. The current family model uses phase, material signature, pawn structure, tactical motifs and strategic themes. Exact matches score `100`; family matches receive a smaller score based on shared traits.

This is the first reporting and learning-memory layer; it is not yet a full weakness map or exercise generator.

The tutor panel lets you choose an enabled provider and an explanation mode before requesting the explanation. Provider availability is controlled by server environment variables. The default implemented provider is:

```text
ATEROMANTE_LLM_PROVIDER=mock-local
```

To use a local HTTP model server, configure:

```text
ATEROMANTE_LLM_PROVIDER=local-http-default
ATEROMANTE_LOCAL_LLM_URL=http://127.0.0.1:11434/api/generate
ATEROMANTE_LOCAL_LLM_MODEL=your-local-model
```

To use a remote or self-hosted chat completions API, configure:

```text
ATEROMANTE_LLM_PROVIDER=chat-completions-compatible
ATEROMANTE_CHAT_BASE_URL=https://your-provider.example/v1
ATEROMANTE_CHAT_MODEL=your-chat-model
ATEROMANTE_CHAT_API_KEY=your-secret-key
```

## Local Data
By default, runtime data is stored under:

```text
data/ateromante.db
```

Generated local database files are ignored by Git.

You can override the database path:

```powershell
$env:ATEROMANTE_DB_PATH="C:\path\to\ateromante.db"
npm run dev:local
```

## Verification
Run:

```powershell
npm test
npm run build
npm run lint
npm run qa:visual
npm run qa:interaction
```

`qa:visual` writes desktop and mobile screenshots to `qa-artifacts/`.

`qa:interaction` opens the app, plays `e2-e4`, requests a tutor explanation, imports FEN and PGN positions, checks the resulting board state and stores interaction screenshots.

## Current Limits
- No Stockfish binary is included.
- Stockfish 18 has been validated on the current Windows development machine, but broad platform validation is still pending.
- PGN import/export currently supports pasted text or local `.pgn` files, a basic main line, standard headers, comments, NAG annotations, source metadata, preserved nested variation text, temporary variation playback, opening a branch as a new study and promoting a branch into a separate main-line study.
- Position-family search is a conservative first pass; it is useful for recall and traceability, not yet a full chess similarity engine.
- `mock-local`, `local-http-default` and `chat-completions-compatible` are implemented; provider quality depends on the configured model.
- The post-game report is currently a compact local summary with first learning-event persistence, not a complete training diagnosis.
- Human-vs-human training rooms are design-stage only.
- ATEROMANTE must not be used as hidden live assistance in competitive games.
