# Architecture Draft

## System Shape

```text
Desktop App
  React UI
    Chessboard
    Tutor Panel
    Variation Explorer
    Dashboard
  Local App Layer
    Game Service
    Session Service
    Match Policy Service
    Engine Service
    Tutor Service
    Metrics Service
    Connector Service
    Moderator Service
    Network Adapter
  Local Storage
    SQLite
    User files
  Local Backend
    Local HTTP API
    node:sqlite persistence
    repositories
    event log
  External Services
    UCI engine
    Optional LLM provider
    Optional chess-platform APIs
```

## Core Modules

### Game Service
Owns legal game state, move history, FEN, PGN, branches and current position.

The first implementation lives under `local/game` and uses `chess.js` as the deterministic rules engine. It validates moves, generates FEN/PGN and persists accepted moves through the local repositories.

The tutor provider must not validate chess legality. The LLM receives prepared chess context after deterministic services have produced it.

### Local API
Exposes deterministic app capabilities to the React runtime without importing Node-only modules into the browser bundle.

The first implementation lives under `local/api` and provides:
- `GET /api/health`;
- `POST /api/sessions`;
- `GET /api/games/:gameId`;
- `POST /api/games/:gameId/moves`.

This bridge is intentionally small. It can later be replaced or wrapped by Tauri commands, a local moderator server, or a networked training-room server without changing the React components around chess rules.

### Session Service
Owns training sessions, participants, shared state and event logs.

### Match Policy Service
Decides what tutor assistance is allowed in each mode: post-game only, symmetric hints, private tutor, shared class or silent logging.

### Moderator Service
Owns room creation, participant approval, policy changes, pause/resume control and session-level audit events.

### Engine Service
Manages UCI engine lifecycle and analysis requests.

The first implementation lives under `local/engine` and starts an external UCI executable for each requested analysis. The local API exposes `POST /api/games/:gameId/analysis`, analyzes the persisted current FEN, stores the result in `engine_evaluations` and returns score, best move and principal variation to React.

Security and portability constraints:
- the executable path comes from server environment, never from the HTTP request;
- FEN is reconstructed from the persisted game and validated before entering the UCI protocol;
- depth and timeout are bounded;
- Stockfish is not bundled in the repository.

### Tutor Service
Transforms board state, engine lines, student profile and learning goals into educational feedback.

The service must call providers through the `LlmTutorProvider` interface so public users can choose remote APIs or local HTTP models.

### Metrics Service
Builds progress data from games, moves, mistakes, puzzles and reviews.

### Connector Service
Imports or syncs games from external sources. It must be optional and isolated.

### Privacy Service
Keeps private material local and prevents accidental export.

## Data Model Draft
- students
- study_sessions
- games
- moves
- positions
- engine_evaluations
- tutor_events
- mistakes
- puzzles
- review_items
- learning_goals
- reports
- connectors
- training_matches
- participants
- match_events
- match_policies
- tags
- learning_events
- review_items
- study_material_refs

## Human Training Matches
Human-vs-human play is allowed only as a consent-based training mode.

Both players may use the same application, but the shared session must clearly declare:
- whether tutor assistance is enabled;
- whether help is private, symmetric or shared;
- whether engine analysis is live or post-game only;
- whether the game is training, class, correspondence or evaluation.

The first implementation should not add networking. It should model sessions and events locally so multiplayer can be added later without rewriting the core.

## Networking Options
- Authoritative WebSocket server: preferred first network option.
- WebRTC DataChannel: possible later for peer-to-peer sessions, with signaling and privacy warnings.
- LAN host mode: future local classroom/home option.
- Asynchronous correspondence: strong educational option for adults.

## Delivery Roles
The same codebase should support:
- player client;
- moderator server;
- hybrid local training station.

The first implementation keeps this as configuration. Later builds can package separate client and moderator applications.

See `docs/CLIENT-SERVER-MODEL.md`.

## LLM Provider Contract
A provider must accept:
- language;
- tutor mode;
- current FEN;
- move history;
- last move;
- engine evaluation;
- student profile summary;
- requested teaching depth.

It must return:
- short explanation;
- suggested focus;
- optional candidate move;
- optional visual annotations;
- follow-up exercise suggestion.

See `docs/LLM-PROVIDERS.md` for the current provider families and environment policy.

## Future MCP Layer
MCP can be added later to expose app tools to LLM clients:
- current position;
- legal moves;
- engine analysis;
- student weaknesses;
- next review item;
- report generation.

The app must not require MCP for normal use.

## Learning Traceability
The database must preserve enough structure to reopen any important lesson from the original board position.

See `docs/DATA-TRACEABILITY.md`.

## Persistence v0.1
The first persistence implementation lives outside the React runtime under `local/persistence`.

It provides:
- a SQLite schema migration;
- repositories for sessions, games, event logs and learning events;
- file-backed and in-memory database support for tests.

This keeps the frontend portable while preparing the app for Tauri, a local HTTP service, or a moderator server.
