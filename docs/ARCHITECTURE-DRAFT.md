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
  External Services
    UCI engine
    Optional LLM provider
    Optional chess-platform APIs
```

## Core Modules

### Game Service
Owns legal game state, move history, FEN, PGN, branches and current position.

### Session Service
Owns training sessions, participants, shared state and event logs.

### Match Policy Service
Decides what tutor assistance is allowed in each mode: post-game only, symmetric hints, private tutor, shared class or silent logging.

### Moderator Service
Owns room creation, participant approval, policy changes, pause/resume control and session-level audit events.

### Engine Service
Manages UCI engine lifecycle and analysis requests.

### Tutor Service
Transforms board state, engine lines, student profile and learning goals into educational feedback.

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
