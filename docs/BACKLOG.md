# Backlog

## MVP 0 - Technical Spike
- Create desktop app skeleton.
- Add chessboard and legal move validation.
- Export FEN and PGN.
- Connect to UCI engine.
- Store games and moves in SQLite.
- Add tutor panel with provider abstraction.
- Draw basic educational overlays.

## MVP 1 - Post-Game Tutor
- Import PGN.
- Replay game move by move.
- Run engine analysis on critical positions.
- Classify mistakes.
- Generate post-game report.
- Suggest targeted exercises.
- Store learning events.
- Link every learning event to game, move and position.
- Search lessons by opening, theme, mistake and position.

## MVP 1.5 - Traceability And Search
- Normalize PGN metadata.
- Store FEN and position hashes.
- Tag moves and positions by phase, theme and mistake type.
- Add FTS search for tutor explanations and notes.
- Add review queue from learning events.
- Build "where did I learn this?" retrieval.

## MVP 2 - Local Training Game
- Play against engine inside the app.
- Configure engine strength.
- Enable tutor modes: off, silent, hint, tactical, strategic, full lesson.
- Track every move and tutor intervention.
- Show candidate lines and "what if" branches.

## MVP 2.5 - Local Human Training Session Model
- Model sessions with participants and event logs.
- Add match policies for allowed assistance.
- Simulate a human-vs-human session locally.
- Track tutor visibility: private, shared, symmetric, post-game only.
- Mark exported games as training-assisted when applicable.
- Add station roles: player client, moderator server, hybrid.
- Add moderator-controlled policy state.

## MVP 3 - Learning Dashboard
- Student profile.
- Weakness map.
- Training calendar draft.
- Weekly report.
- Puzzle review queue.
- Progress by theme: tactics, endings, openings, strategy, calculation.

## MVP 4 - Connectors
- Lichess import.
- Chess.com public archive import.
- Local PGN folder watcher.
- Scid/Lucas Chess/Arena/PyChess compatibility research.
- Connector contracts and tests.

## MVP 4.5 - Networked Human Training Matches
- Lobby for training sessions.
- Consent screen for tutor mode.
- Authoritative WebSocket room.
- Moderator server role.
- Player client role.
- Policy change events.
- Reconnection support.
- Shared board state.
- Private local tutor panels.
- Shared class-mode tutor panel.
- Post-game individual reports.

## MVP 5 - Private Study Coach
- Local private material registry.
- Private puzzle bank import.
- Study plan from local resources.
- Strict public/private separation.
- Optional local model support.

## Design Backlog
- Professional default theme.
- Board theme selector.
- Piece theme selector.
- Arrow and highlight palette.
- Variation tree view.
- Tutor tone and verbosity controls.
- Accessible color modes.

## Safety And Privacy Backlog
- Anti-cheating mode policy.
- Disable live tutor for online human games.
- Local-first data storage.
- Opt-in external data export.
- User data export/delete.
- Dependency license report.

## Documentation Backlog
- Installation guide.
- Engine setup guide.
- LLM provider setup guide.
- Privacy guide.
- Contribution guide.
- License and third-party notices.
