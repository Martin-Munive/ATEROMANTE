# Data Traceability

## Purpose
ATEROMANTE must make chess learning retrievable.

If a student learns an opening idea, tactical pattern, endgame principle or strategic plan from a game, the system must preserve enough context to find it later.

## Core Principle
A game is not only a PGN file. It is a learning container.

The database should connect:
- the original game;
- every position;
- every move;
- engine evaluations;
- tutor feedback;
- themes;
- mistakes;
- exercises;
- review schedule;
- source material;
- reports.

## Query Examples

The user should be able to ask:
- Where did I learn this Sicilian Najdorf idea?
- Show my recurring mistakes in isolated queen pawn positions.
- Which games produced exercises about knight outposts?
- What opening lines led to my worst evaluations?
- Which tutor explanations should I review this week?
- Show every position tagged as `king-safety` and `dark-square-weakness`.
- Which post-game lessons came from human training matches?

## Minimum Search Dimensions

### Game Metadata
- players;
- colors;
- date;
- source;
- event/session;
- time control;
- result;
- ECO/opening;
- assisted training flag;
- tutor policy;
- engine policy.

### Position Metadata
- FEN;
- normalized position hash;
- side to move;
- ply;
- material signature;
- pawn structure tags;
- king safety tags;
- phase: opening, middlegame, endgame;
- ECO/opening family when known.

### Move Metadata
- SAN;
- UCI;
- from/to;
- move number;
- captured piece;
- promotion;
- check/mate;
- NAG;
- engine delta;
- classification: best, inaccuracy, mistake, blunder, brilliant, forced.

### Learning Metadata
- theme;
- skill;
- explanation;
- source game;
- source position;
- confidence;
- student response;
- review interval;
- next review date.

## Retrieval Model

Use three complementary retrieval paths:

1. Exact retrieval:
   - game id;
   - move id;
   - FEN;
   - position hash.

2. Structured search:
   - opening;
   - theme;
   - phase;
   - mistake type;
   - engine delta;
   - tutor event type.

3. Semantic search:
   - tutor explanations;
   - user notes;
   - lesson summaries;
   - imported study material metadata.

## Indexes
Recommended indexes:
- `games(source, external_id)`
- `games(opening_eco, result)`
- `positions(fen_hash)`
- `positions(phase)`
- `moves(game_id, ply)`
- `moves(classification)`
- `engine_evaluations(move_id, depth)`
- `learning_events(theme)`
- `learning_events(skill)`
- `reviews(next_review_at)`
- `tags(name)`

## Persistence Slice v0.1
The first implementation uses a local Node persistence layer with `node:sqlite`.

The database is intentionally separated from React so it can later be exposed through a local API, Tauri command, or moderator server without rewriting the schema.

The first slice stores:
- sessions;
- match policies;
- games;
- positions;
- moves;
- event log entries;
- learning events;
- tags;
- review items.

`event_log` is the audit and reconstruction source. Normalized tables make search, metrics and dashboard queries efficient.

## Position Families
Persisted positions include a deterministic first-pass family description:

- phase: opening, middlegame, endgame or unknown;
- normalized FEN hash;
- material signature;
- pawn-structure tags;
- tactical motif tags;
- strategic theme tags.

The first classifier is intentionally conservative. It gives the retrieval layer enough structure to connect a lesson to exact positions and to compatible families without pretending to be a full chess understanding engine.

`GET /api/learning/search?q=<fen-or-hash>` accepts a FEN or a 64-character position hash. When the hash exists in local storage, search expands from the exact position to compatible positions with the same phase/material signature or overlapping family tags.

## Export
When exporting PGN, preserve:
- standard PGN tags;
- comments;
- NAGs;
- variations;
- training-assistance metadata where appropriate.

Private tutor notes should not be exported unless the user explicitly requests it.
