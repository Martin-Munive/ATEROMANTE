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
POST /api/games/:gameId/moves
POST /api/games/:gameId/analysis
GET  /api/engine/status
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
- `learning_events`
- `tags`
- `review_items`

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
10. Imported PGN variations are stored in `pgn_variations` with their raw text, normalized SAN line and main-line anchor.
11. React loads the imported game, shows available player/event/source metadata, renders comments and NAGs in the tutor panel, shows imported variation lines, supports temporary variation playback, and refreshes recent sessions.

Current scope:

- basic main-line PGN;
- standard headers such as Event, Site, Date, Round, White, Black and Result;
- text and browser-read `.pgn` file imports;
- sanitized PGN source metadata;
- main-line comments by FEN/position;
- main-line NAGs by FEN/position;
- preserved variation text anchored to the main line;
- temporary interactive variation playback in the browser;
- no recursive variation editing yet.

## Adding Features

### PGN/FEN Import
Add this behind the local API, not directly in React.

Recommended path:

1. keep FEN validation in `GameService`;
2. expand PGN source metadata if connector-specific fields are needed;
3. expand variation playback into recursive branch navigation and editing when the UI model is ready;
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
- browser interaction for `e2-e4`, FEN import and PGN import.

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
