# Spike Plan

## Goal
Validate the core training loop before building the full application.

The first spike must prove that the app can own the chessboard, track game state, analyze positions with an engine, persist events, and show educational feedback.

## Scope
- Local desktop-first prototype.
- Controlled educational chessboard.
- Local session model prepared for future human-human training matches.
- Legal move validation.
- FEN/PGN state generation.
- UCI engine analysis.
- Local persistence.
- Tutor panel with placeholder or configurable LLM provider.
- Visual overlays for at least one suggested move.

## Recommended Stack
- First spike shell: React + Vite.
- Desktop shell target: Tauri after Rust/Cargo are available.
- Rules and notation: chess.js.
- Board: React chessboard component plus custom overlay layer.
- Engine: Stockfish through UCI.
- Persistence: SQLite.
- Tutor: provider-agnostic adapter.

## Environment Rule
Dependencies must be installed locally in the project. Do not install global packages for the spike.

See `docs/ENVIRONMENT.md`.

## Spike Milestones

### 1. Board And Rules
Acceptance:
- A user can move pieces on a board.
- Illegal moves are rejected.
- The current position can be exported as FEN.
- The current game can be exported as PGN.

Implementation note:
- `GameService` owns this deterministic logic through `chess.js`.
- The LLM must not be used for legal move validation, FEN generation or PGN generation.

### 2. Engine Analysis
Acceptance:
- The app can send a FEN position to a UCI engine.
- The engine returns at least one candidate line.
- The UI displays evaluation and best move.

### 3. Persistence
Acceptance:
- A local database stores sessions, games, moves and engine evaluations.
- Restarting the app does not lose a saved game.

### 4. Tutor Feedback
Acceptance:
- The tutor panel receives position, move and engine context.
- It can produce a concise educational explanation.
- The tutor can be disabled, silent, or explanatory.

### 5. Visual Teaching Layer
Acceptance:
- The board can show at least one arrow.
- The board can highlight at least one square.
- The UI can compare the user's move with the engine recommendation.

## Out Of Scope
- Online live-game assistance.
- Networked human-human matches.
- Full account system.
- Private study-material ingestion.
- Large PGN corpus indexing.
- MCP server.
- Advanced theme gallery.

## Multiplayer-Aware Constraint
The spike should avoid naming core code as if every game is single-player.

Preferred vocabulary:
- session;
- participant;
- match policy;
- station role;
- moderator server;
- player client;
- tutor visibility;
- event log.

This keeps the architecture ready for future consent-based human training matches without building networking in the first spike.

## Risks To Validate
- UCI integration and process management on Windows.
- License implications of bundling Stockfish or board libraries.
- Board overlay flexibility.
- Tauri filesystem and process permissions.
- Performance of engine analysis without freezing the UI.

## Exit Decision
After the spike, decide one of:
- continue with Tauri stack;
- switch to Electron for easier Node/process integration;
- accept GPL stack for stronger board features;
- keep permissive stack and build overlays internally.
