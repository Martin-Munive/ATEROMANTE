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
GET  /api/games/:gameId
POST /api/games/:gameId/moves
POST /api/games/:gameId/analysis
```

`recover-or-create` is intentionally idempotent for startup. It prevents duplicate initial sessions in React StrictMode.

### Game Service
`local/game/game-service.mjs` owns deterministic chess state.

Responsibilities:

- create training games;
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
- map missing or broken engines to controlled errors.

The executable path comes from server configuration, never from HTTP input.

### Persistence
`local/persistence/schema.sql` defines the current SQLite schema.

Important tables:

- `study_sessions`
- `match_policies`
- `games`
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

## Adding Features

### PGN/FEN Import
Add this behind the local API, not directly in React.

Recommended path:

1. parse input in a local service;
2. validate with `chess.js`;
3. create a session/game;
4. persist positions and moves;
5. return a normal `ApiGameState`.

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

- API session creation, movement, recovery and analysis;
- illegal move rejection;
- persistence migration and repositories;
- learning-event traceability;
- UCI handshake, validation, depth bounds and missing engine errors.

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
