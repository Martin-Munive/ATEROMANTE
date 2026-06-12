# MITNICK Gates

## Active Gates For The Spike

### Environment Gate
Status: in progress.

Criteria:
- no global dependency installation;
- dependencies installed in local `node_modules/`;
- lockfile committed;
- generated build artifacts ignored;
- commands documented.

### Architecture Gate
Status: in progress.

Criteria:
- app shell separated from feature components;
- data fixtures separated from UI;
- engine, tutor and persistence boundaries named;
- no irreversible choice before spike evidence.

### Frontend Gate
Status: in progress.

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
Status: pending.

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

### Supply Chain Gate
Status: pending.

Criteria:
- dependency licenses reviewed;
- `npm audit` reviewed when dependencies are installed;
- GPL dependencies intentionally accepted or isolated.

## Current Decision
The first implementation is a web spike because Node/npm are available and Rust/Cargo are not.

Tauri remains the preferred desktop target after the spike, but it should not block early validation of the chessboard, tutor panel and training workflow.
