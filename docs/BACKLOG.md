# Backlog

## MVP 0 - Technical Spike
- Create desktop app skeleton.
- Add chessboard and legal move validation.
- Export FEN and PGN.
- Import FEN.
- Import basic PGN main line.
- Preserve standard PGN headers.
- Preserve main-line PGN comments.
- Preserve main-line PGN NAGs and suffix annotations.
- Preserve imported PGN variation text with main-line anchors.
- Preserve nested PGN variation parent-child structure.
- Import browser-read `.pgn` files with sanitized source metadata.
- Add temporary PGN variation playback.
- Open a PGN variation as a derived study session.
- Export enriched PGN with headers, annotations, NAGs and variations.
- Store games and moves in SQLite.
- Add tutor panel with provider abstraction.
- Add provider-agnostic LLM contract.
- Draw basic educational overlays.

## MVP 1 - Post-Game Tutor
- Add PGN variation editing and promotion/replacement of the source main line.
- Replay game move by move.
- Run engine analysis on critical positions.
- Classify mistakes.
- Generate first post-game report summary.
- Store first learning event from post-game report.
- Generate directed review exercise prompts from saved positions.
- Link every learning event to game, move and position.
- Search lessons by opening, theme, mistake and position.

## MVP 1.5 - Traceability And Search
- Normalize richer PGN source metadata.
- Store FEN and position hashes.
- Tag moves and positions by phase, theme and mistake type.
- Add FTS search for tutor explanations and notes.
- Add review queue from learning events.
- Record basic review results, written attempts and lightweight answer alignment.
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
- Audit responsive layout and resource distribution after the functional MVP is complete; current panels can exceed the visible window in some viewports.
- Redesign the top-right ANASKAI creator credit; current implementation is stacked and poorly formatted, but remains deferred until the functional build is complete.
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
- Expand user guide after advanced PGN import.
- Expand developer guide after tutor and import services stabilize.
- LLM provider setup guide.
- Sponsor and citation setup.
- Contribution guide.
- License and third-party notices.
