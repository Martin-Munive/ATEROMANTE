# Developer Guide

## Purpose
This guide explains the current technical structure of ATEROMANTE so a developer can understand where code lives, how the main flow works and where to add the next features.

## Runtime Shape

```text
React UI
  -> local HTTP API
    -> GameService
    -> UciEngineService
    -> SQLite repositories
      -> event_log and normalized tables
```

The browser bundle must not import Node-only modules such as `node:sqlite` or `child_process`.

## Main Folders

```text
src/
  App.tsx
  components/
  features/
  hooks/
  services/
  domain/

local/
  api/
  engine/
  game/
  persistence/
  tutor/

tests/
  *.test.mjs
  fixtures/

scripts/
  visual-check.mjs
  interaction-check.mjs
```

## Core Components

### React UI
The UI is the training surface.

Current important files:

- `src/App.tsx`: composes the main shell.
- `src/hooks/useChessGame.ts`: owns UI-facing game state, API calls, session recovery, move submission and analysis requests.
- `src/features/board/ChessBoard.tsx`: renders the board, legal target highlights, last move and analysis arrow.
- `src/components/Sidebar.tsx`: renders navigation, profile stub and recent persisted sessions.
- `src/features/analysis/AnalysisPanels.tsx`: renders move list, engine panel and variation tree.

### Local API
`local/api/server.mjs` exposes deterministic app functions to the UI.

Current endpoints:

```text
GET  /api/health
GET  /api/sessions
POST /api/sessions
POST /api/sessions/recover-or-create
POST /api/import/fen
POST /api/import/pgn
GET  /api/games/:gameId
GET  /api/games/:gameId/report
GET  /api/games/:gameId/export/pgn
GET  /api/reviews
POST /api/games/:gameId/learning/from-report
POST /api/reviews/:reviewItemId/result
POST /api/games/:gameId/variations/:variationIndex/study
POST /api/games/:gameId/variations/:variationIndex/mainline
POST /api/games/:gameId/moves
POST /api/games/:gameId/analysis
GET  /api/engine/status
GET  /api/tutor/providers
POST /api/games/:gameId/tutor/explain
```

`recover-or-create` is intentionally idempotent for startup. It prevents duplicate initial sessions in React StrictMode.

### Game Service
`local/game/game-service.mjs` owns deterministic chess state.

Responsibilities:

- create training games;
- create FEN study sessions from validated initial positions;
- create PGN study sessions from parsed main-line moves;
- replay persisted moves;
- validate and apply legal moves;
- derive FEN, PGN, side to move and result;
- list recent games for visual recovery.

The LLM tutor must never replace this layer for legality, FEN or PGN.

### Engine Service
`local/engine/uci-engine-service.mjs` starts an external UCI executable.

Responsibilities:

- validate FEN input;
- bound depth and timeout;
- run UCI handshake;
- parse score, best move and principal variation;
- check external engine availability through a bounded depth-1 probe;
- map missing or broken engines to controlled errors.

The executable path comes from server configuration, never from HTTP input.

### Tutor Service
`local/tutor/tutor-service.mjs` owns the API-side tutor provider contract.

Current responsibilities:

- list provider configurations without exposing API keys;
- build tutor context from deterministic game state;
- optionally include the latest stored engine evaluation;
- call the active provider;
- persist each explanation in `tutor_events` and `event_log`.

The current implemented providers are `mock-local`, `local-http-default` and `chat-completions-compatible`.

### Persistence
`local/persistence/schema.sql` defines the current SQLite schema.

Important tables:

- `study_sessions`
- `match_policies`
- `games`
- `pgn_headers`
- `pgn_annotations`
- `positions`
- `moves`
- `event_log`
- `engine_evaluations`
- `tutor_events`
- `learning_events`
- `tags`
- `review_items`
- `review_attempts`

`event_log` preserves replay and audit context. Normalized tables support search, reports and future retrieval.

## Main Flow

### Startup
1. React calls `POST /api/sessions/recover-or-create`.
2. API returns the latest persisted game or creates one.
3. React refreshes `GET /api/sessions`.
4. Sidebar shows recent sessions.

### Move
1. User clicks source and target squares.
2. React posts to `POST /api/games/:gameId/moves`.
3. `GameService` replays the game, validates the move with `chess.js` and records move/position/events.
4. React receives the new state and clears stale analysis.

### Analysis
1. User clicks `Analizar posicion`.
2. React posts to `POST /api/games/:gameId/analysis`.
3. API reconstructs the persisted current FEN.
4. `UciEngineService` sends the FEN to the external engine.
5. API stores the result in `engine_evaluations` and `event_log`.
6. React renders score, best move, principal variation and arrow.

### Tutor Explanation
1. User clicks `Explicar`.
2. React posts to `POST /api/games/:gameId/tutor/explain`.
3. API reconstructs deterministic game state and reads the latest stored engine evaluation when available.
4. `TutorService` calls the configured provider, currently `mock-local`.
5. API persists the explanation in `tutor_events` and logs `tutor.explanation.created`.
6. React renders summary, provider, confidence, candidate move and teaching focus.
7. The UI can send a per-request `providerId` and `tutorDepth`; provider selection remains server-validated.

### Post-Game Report
1. React calls `GET /api/games/:gameId/report`.
2. The API rebuilds deterministic game state through `GameService`.
3. `EngineEvaluationRepository` returns stored engine analyses for the game.
4. `TutorEventRepository` returns stored tutor explanations for the game.
5. The API returns a compact report with move count, analyzed positions, tutor explanation count, latest engine recommendation, selected critical position, repeated tutor focus and next review suggestions.
6. The tutor panel renders the report as a first local review layer.
7. The UI can call `POST /api/games/:gameId/learning/from-report` to persist the top report recommendation as a `learning_events` row linked to the selected critical move/position and latest tutor event when available.
8. Review items include the linked position FEN, ply, side to move, latest engine candidate when available and an API-built exercise prompt for directed recall.
9. The review queue can call `POST /api/reviews/:reviewItemId/result` with `again`, `hard`, `good` or `easy` plus optional `answerText` to store the learner's written recall before grading.
10. The API updates the next due date, ease and mastery state, stores the written attempt in `review_attempts`, and returns a lightweight answer assessment based on expected theme/summary terms plus optional engine-candidate mention.

### FEN Import
1. User pastes a single-line FEN in the sidebar.
2. React posts to `POST /api/import/fen`.
3. `GameService` validates and normalizes the FEN before creating records.
4. API creates a `fen-study` session and a game with `source='fen-import'`.
5. The initial position is persisted as ply `0`.
6. React loads the imported game and refreshes recent sessions.

### PGN Import
1. User pastes PGN text in the sidebar.
2. React posts to `POST /api/import/pgn`.
3. `GameService` parses the PGN with `chess.js` before creating records.
4. API creates a `pgn-study` session and a game with `source='pgn-import'`.
5. The importer stores standard PGN headers in `pgn_headers`.
6. The importer replays the main line, persists every move and position, and updates generated PGN.
7. Main-line comments from `chess.js#getComments()` are stored in `pgn_annotations` and linked to persisted positions when possible.
8. Main-line NAGs are parsed from numeric `$n` tokens and common suffix annotations, stored in `pgn_annotations` with `annotation_type='nag'`, and linked to persisted positions when possible.
9. PGN source metadata is stored in `pgn_sources`, including source type, sanitized file name, optional MIME type, byte size and SHA-256 hash.
10. Imported PGN variations and subvariations are stored in `pgn_variations` with their raw text, normalized SAN line, main-line anchor, depth and parent variation index.
11. React loads the imported game, shows available player/event/source metadata, renders comments and NAGs in the tutor panel, shows imported variation lines, supports temporary variation playback, can open a branch as a new `variation-study`, can promote a branch into a new `mainline-replacement` study, and refreshes recent sessions.
12. `GameService.promoteVariationToMainLine()` rebuilds the selected variation path as a separate PGN import with source `pgn-variation-mainline`; it does not mutate the source game.
13. `GameService.exportPgn()` rebuilds an enriched PGN from persisted headers, moves, comments, NAGs and top-level variations with nested raw text.

Current scope:

- basic main-line PGN;
- standard headers such as Event, Site, Date, Round, White, Black and Result;
- text and browser-read `.pgn` file imports;
- sanitized PGN source metadata;
- main-line comments by FEN/position;
- main-line NAGs by FEN/position;
- preserved variation text anchored to the main line;
- nested variation depth and parent relation;
- temporary interactive variation playback in the browser;
- branch-to-study creation through `POST /api/games/:gameId/variations/:variationIndex/study`;
- branch-to-main-line promotion through `POST /api/games/:gameId/variations/:variationIndex/mainline`;
- enriched PGN export through `GET /api/games/:gameId/export/pgn`;
- no in-place variation editing yet.

## Adding Features

### PGN/FEN Import
Add this behind the local API, not directly in React.

Recommended path:

1. keep FEN validation in `GameService`;
2. expand PGN source metadata if connector-specific fields are needed;
3. expand variation playback into branch editing when the UI model is ready;
4. validate parsed moves with `chess.js`;
5. create a session/game;
6. persist positions and moves;
7. return a normal `ApiGameState`.

### Tutor LLM
Keep provider integration behind a provider contract.

The tutor receives prepared deterministic context:

- FEN;
- PGN/move history;
- legal moves if needed;
- engine evaluation;
- student profile summary.

It returns educational feedback and optional annotations. It does not control game legality.

Implemented baseline:

- `GET /api/tutor/providers`;
- `POST /api/games/:gameId/tutor/explain`;
- `GET /api/games/:gameId/report`;
- `POST /api/games/:gameId/learning/from-report`;
- `TutorEventRepository`;
- `TutorEventRepository.listByGame()`;
- API-side `mock-local` provider;
- API-side `local-http-default` provider for local model servers;
- API-side `chat-completions-compatible` provider for neutral messages/completions APIs;
- browser panel provider/depth selection, action and rendering.

### Human Training Sessions
Do not add networking before the local event model is solid.

Future services should preserve these concepts:

- `Session`;
- `Participant`;
- `MatchPolicy`;
- `TutorVisibility`;
- `StationRole`;
- `ModeratorServer`;
- `PlayerClient`.

## Tests
Run:

```powershell
npm test
```

Current coverage includes:

- API session creation, FEN import, PGN import, movement, recovery and analysis;
- illegal move rejection;
- persistence migration and repositories;
- learning-event traceability;
- UCI handshake, validation, depth bounds and missing engine errors;
- browser interaction for `e2-e4`, tutor explanation, FEN import, PGN import, PGN export and PGN branch promotion.
- service-level test coverage for `local-http-default` without external network.
- service-level test coverage for `chat-completions-compatible` without external network.

## Visual QA
Run:

```powershell
npm run qa:visual
npm run qa:interaction
```

Use these after any UI, layout, startup, board or interaction change.

## Release Rules
Before release or public demo:

- `npm test`, `npm run build`, `npm run lint`, `qa:visual` and `qa:interaction` must pass;
- public docs must cover install, first run, engine setup, core use and limitations;
- private material and internal planning must stay out of the public repo;
- Stockfish and any LLM provider must be configured as external dependencies or documented integrations.
