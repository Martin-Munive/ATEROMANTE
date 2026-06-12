PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_policies (
  id TEXT PRIMARY KEY,
  tutor_visibility TEXT NOT NULL CHECK (tutor_visibility IN ('none', 'private', 'shared', 'symmetric')),
  assistance_timing TEXT NOT NULL CHECK (assistance_timing IN ('live', 'post-game', 'paused-only')),
  engine_permission TEXT NOT NULL CHECK (engine_permission IN ('disabled', 'evaluation-only', 'best-moves')),
  allow_study_branches INTEGER NOT NULL CHECK (allow_study_branches IN (0, 1)),
  mark_exports_as_assisted INTEGER NOT NULL CHECK (mark_exports_as_assisted IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  mode TEXT NOT NULL,
  station_role TEXT NOT NULL CHECK (station_role IN ('player-client', 'moderator-server', 'hybrid')),
  match_policy_id TEXT NOT NULL REFERENCES match_policies(id),
  status TEXT NOT NULL CHECK (status IN ('lobby', 'ready', 'playing', 'paused', 'study-branch', 'ended', 'review', 'abandoned')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT CHECK (color IN ('white', 'black', 'observer', 'coach')),
  role TEXT NOT NULL CHECK (role IN ('student', 'opponent', 'coach', 'moderator', 'engine')),
  is_local INTEGER NOT NULL CHECK (is_local IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  external_id TEXT,
  initial_fen TEXT NOT NULL,
  pgn TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '*',
  opening_eco TEXT,
  opening_name TEXT,
  assisted_training INTEGER NOT NULL CHECK (assisted_training IN (0, 1)),
  tutor_policy TEXT NOT NULL,
  engine_policy TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_id TEXT,
  fen TEXT NOT NULL,
  fen_hash TEXT NOT NULL,
  ply INTEGER NOT NULL CHECK (ply >= 0),
  side_to_move TEXT NOT NULL CHECK (side_to_move IN ('white', 'black')),
  phase TEXT NOT NULL CHECK (phase IN ('opening', 'middlegame', 'endgame', 'unknown')),
  material_signature TEXT,
  pawn_structure_tags TEXT NOT NULL DEFAULT '[]',
  tactical_motifs TEXT NOT NULL DEFAULT '[]',
  strategic_themes TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moves (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position_before_id TEXT REFERENCES positions(id) ON DELETE SET NULL,
  position_after_id TEXT REFERENCES positions(id) ON DELETE SET NULL,
  ply INTEGER NOT NULL CHECK (ply >= 1),
  san TEXT NOT NULL,
  uci TEXT NOT NULL,
  from_square TEXT,
  to_square TEXT,
  piece TEXT,
  captured_piece TEXT,
  promotion TEXT,
  is_check INTEGER NOT NULL CHECK (is_check IN (0, 1)),
  is_mate INTEGER NOT NULL CHECK (is_mate IN (0, 1)),
  nag TEXT,
  classification TEXT CHECK (classification IN ('best', 'good', 'inaccuracy', 'mistake', 'blunder', 'brilliant', 'forced', 'unknown')),
  engine_delta REAL,
  created_at TEXT NOT NULL,
  UNIQUE (game_id, ply)
);

CREATE TABLE IF NOT EXISTS event_log (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  session_id TEXT REFERENCES study_sessions(id) ON DELETE CASCADE,
  game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  move_id TEXT REFERENCES moves(id) ON DELETE SET NULL,
  position_id TEXT REFERENCES positions(id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS engine_evaluations (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_id TEXT REFERENCES moves(id) ON DELETE SET NULL,
  position_id TEXT REFERENCES positions(id) ON DELETE SET NULL,
  engine_name TEXT NOT NULL,
  depth INTEGER,
  multipv INTEGER NOT NULL DEFAULT 1,
  score_cp INTEGER,
  score_mate INTEGER,
  best_move TEXT,
  pv_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tutor_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  move_id TEXT REFERENCES moves(id) ON DELETE SET NULL,
  position_id TEXT REFERENCES positions(id) ON DELETE SET NULL,
  llm_provider_id TEXT NOT NULL,
  tutor_mode TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('none', 'private', 'shared', 'symmetric')),
  summary TEXT NOT NULL,
  teaching_focus_json TEXT NOT NULL DEFAULT '[]',
  annotations_json TEXT NOT NULL DEFAULT '[]',
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  move_id TEXT REFERENCES moves(id) ON DELETE SET NULL,
  position_id TEXT REFERENCES positions(id) ON DELETE SET NULL,
  tutor_event_id TEXT REFERENCES tutor_events(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  theme TEXT NOT NULL,
  skill TEXT NOT NULL,
  summary TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  student_action TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  mastery_state TEXT NOT NULL CHECK (mastery_state IN ('new', 'learning', 'reviewing', 'stable', 'weak')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general'
);

CREATE TABLE IF NOT EXISTS learning_event_tags (
  learning_event_id TEXT NOT NULL REFERENCES learning_events(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (learning_event_id, tag_id)
);

CREATE TABLE IF NOT EXISTS review_items (
  id TEXT PRIMARY KEY,
  learning_event_id TEXT NOT NULL REFERENCES learning_events(id) ON DELETE CASCADE,
  due_at TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease REAL NOT NULL DEFAULT 2.5,
  last_result TEXT,
  next_prompt_type TEXT NOT NULL DEFAULT 'position-recall',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_games_source_external ON games(source, external_id);
CREATE INDEX IF NOT EXISTS idx_games_opening_result ON games(opening_eco, result);
CREATE INDEX IF NOT EXISTS idx_positions_fen_hash ON positions(fen_hash);
CREATE INDEX IF NOT EXISTS idx_positions_phase ON positions(phase);
CREATE INDEX IF NOT EXISTS idx_moves_game_ply ON moves(game_id, ply);
CREATE INDEX IF NOT EXISTS idx_moves_classification ON moves(classification);
CREATE INDEX IF NOT EXISTS idx_events_session_sequence ON event_log(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_events_game_sequence ON event_log(game_id, sequence);
CREATE INDEX IF NOT EXISTS idx_engine_move_depth ON engine_evaluations(move_id, depth);
CREATE INDEX IF NOT EXISTS idx_learning_theme ON learning_events(theme);
CREATE INDEX IF NOT EXISTS idx_learning_skill ON learning_events(skill);
CREATE INDEX IF NOT EXISTS idx_reviews_due ON review_items(due_at);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
