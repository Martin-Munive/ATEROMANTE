# MITNICK Gates

## Active Gates For The Spike

### Environment Gate
Status: PASS.

Criteria:
- no global dependency installation;
- dependencies installed in local `node_modules/`;
- lockfile committed;
- generated build artifacts ignored;
- commands documented.

### Architecture Gate
Status: PASS.

Criteria:
- app shell separated from feature components;
- data fixtures separated from UI;
- engine, tutor and persistence boundaries named;
- no irreversible choice before spike evidence.

### Frontend Gate
Status: PASS_WITH_RISK.

Evidence:
- build and lint pass;
- analysis panel models empty, loading, error and success states;
- best-move arrow derives from the API result;
- visual recovery lists recent persisted sessions and can reopen them from the sidebar;
- rendered browser QA passed in desktop, mobile and interaction flows.

Criteria:
- primary screen is the real tool surface, not a landing page;
- responsive constraints exist;
- controls have clear states;
- typography is explicit;
- visual QA runs before closing the spike.

Command:

```powershell
npm run qa:visual
```

### Security And Privacy Gate
Status: PASS for the local UCI slice.

Evidence:
- engine executable path is server configuration, not request input;
- FEN comes from persisted deterministic game state and is validated;
- depth and timeout are bounded;
- process errors are mapped without leaking local executable paths to the client.
- `GET /api/engine/status` reports availability, engine name and bounded runtime settings without exposing the configured executable path.
- FEN import validates input before persistence and creates `fen-study` sessions without exposing filesystem paths or private material.
- PGN import parses input before persistence and creates `pgn-study` sessions only after the main line is accepted by `chess.js`.
- Standard PGN headers are stored in `pgn_headers` and exposed to the UI without storing external files or private paths.
- Main-line PGN comments are stored in `pgn_annotations` by FEN/position and rendered in the tutor panel.
- Main-line PGN NAGs and suffix annotations are stored in `pgn_annotations` as `annotation_type='nag'` by FEN/position and rendered in the tutor panel.
- Imported PGN variations are stored in `pgn_variations` with raw PGN text, normalized SAN line and main-line anchor, then rendered in the variation panel.
- Browser-read `.pgn` imports store sanitized source metadata in `pgn_sources`; local filesystem paths are stripped and not persisted.
- Variation playback reconstructs temporary board states in the browser from the persisted branch anchor without mutating the saved main line.

Criteria:
- no private material in public project;
- no secrets committed;
- LLM keys excluded;
- anti-cheating policy documented before online connectors.
- human-vs-human tutor mode is explicitly consent-based and non-competitive.
- live engine/tutor assistance must be visibly labeled in assisted games.

### Networking Gate
Status: pending.

Criteria:
- distinguish player client and moderator server roles;
- choose authoritative server, WebRTC or LAN mode intentionally;
- document reconnection and conflict handling;
- define tutor visibility and data boundaries;
- warn about P2P metadata/IP exposure if WebRTC is used;
- avoid network code before the local session/event model exists.

### Documentation Gate
Status: PASS_WITH_RISK for the current technical spike.

Evidence:
- README covers install, current capabilities, verification commands and limitations.
- `docs/ARCHITECTURE-DRAFT.md`, `docs/ENVIRONMENT.md`, `docs/DATA-TRACEABILITY.md` and `docs/SPIKE-PLAN.md` explain the current technical shape.
- `docs/USER-GUIDE.md` covers first run, current board flow, session recovery, FEN import, basic PGN import with files/headers/comments/NAGs/variations/source metadata/playback, engine analysis limits and verification.
- `docs/DEVELOPER-GUIDE.md` covers runtime shape, folders, API endpoints, FEN/PGN import flow, PGN source/header/comment/NAG/variation persistence/playback, services, tests and extension points.
- `docs/ENGINE-SETUP.md` covers external UCI configuration, validation, troubleshooting and license note.
- `docs/PRIVACY-AND-ANTIABUSE.md` covers local-first data, private material, secrets and assisted-play limits.

Residual risk before broader user/developer use:
- user guide must be expanded when recursive variation editing, real LLM tutoring and reports exist;
- developer guide must be expanded when advanced PGN structures, tutor, metrics and connector services stabilize;
- release candidates still need a documentation gate checklist tied to the exact release scope.

Criteria:
- a new user can install and run the primary flow from public docs;
- a new developer can understand the app structure and add a bounded feature without reading internal BRAIN notes;
- public docs do not include prompts, handoffs, private material or internal planning;
- external dependencies such as Stockfish and LLM providers have setup and troubleshooting guidance.

### Supply Chain Gate
Status: PASS_WITH_RISK.

Evidence:
- no new npm dependency was added;
- Stockfish is not bundled;
- Stockfish 18 was installed externally through `winget`;
- `winget` verified the installer hash;
- the app resolves `stockfish` through PATH and reports `Stockfish 18` through `GET /api/engine/status`.

Residual risk:
- platform compatibility beyond the validated Windows machine must be checked before distribution guidance is finalized.

Criteria:
- dependency licenses reviewed;
- `npm audit` reviewed when dependencies are installed;
- GPL dependencies intentionally accepted or isolated.

## Current Decision
The first implementation is a web spike because Node/npm are available and Rust/Cargo are not.

Tauri remains the preferred desktop target after the spike, but it should not block early validation of the chessboard, tutor panel and training workflow.
