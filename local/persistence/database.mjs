import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_VERSION = 2;

export const STANDARD_STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeFen(fen) {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

export function hashFen(fen) {
  return createHash('sha256').update(normalizeFen(fen)).digest('hex');
}

export function openAteromanteDatabase(dbPath = ':memory:') {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

export function migrate(db) {
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  db.exec(schema);
  ensureColumn(db, 'pgn_variations', 'parent_variation_index', `
    ALTER TABLE pgn_variations
    ADD COLUMN parent_variation_index INTEGER CHECK (parent_variation_index IS NULL OR parent_variation_index >= 0)
  `);

  ensureLearningTraceFts(db);

  const versionOne = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(1);

  if (!versionOne) {
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(1, 'initial_event_log_schema', nowIso());
  }

  const versionTwo = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(SCHEMA_VERSION);

  if (!versionTwo) {
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(SCHEMA_VERSION, 'learning_trace_fts', nowIso());
  }
}

function ensureColumn(db, tableName, columnName, alterSql) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(alterSql);
  }
}

function ensureLearningTraceFts(db) {
  const table = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name = 'learning_trace_fts'
  `).get();

  if (!table) {
    db.exec(`
      CREATE VIRTUAL TABLE learning_trace_fts USING fts5(
        learning_event_id UNINDEXED,
        game_id UNINDEXED,
        content
      )
    `);
  }

  db.prepare('DELETE FROM learning_trace_fts').run();
  db.prepare(`
    INSERT INTO learning_trace_fts (learning_event_id, game_id, content)
    SELECT
      le.id,
      COALESCE(le.game_id, ''),
      trim(
        COALESCE(le.theme, '') || ' ' ||
        COALESCE(le.skill, '') || ' ' ||
        COALESCE(le.summary, '') || ' ' ||
        COALESCE(le.explanation, '') || ' ' ||
        COALESCE(le.student_action, '') || ' ' ||
        COALESCE(te.summary, '') || ' ' ||
        COALESCE(te.teaching_focus_json, '') || ' ' ||
        COALESCE(m.san, '') || ' ' ||
        COALESCE(m.uci, '') || ' ' ||
        COALESCE(m.classification, '') || ' ' ||
        COALESCE(p.fen, '') || ' ' ||
        COALESCE(p.fen_hash, '') || ' ' ||
        COALESCE(p.phase, '') || ' ' ||
        COALESCE(p.pawn_structure_tags, '') || ' ' ||
        COALESCE(p.tactical_motifs, '') || ' ' ||
        COALESCE(p.strategic_themes, '') || ' ' ||
        COALESCE(ee.best_move, '') || ' ' ||
        COALESCE((
          SELECT group_concat(t.name || ' ' || t.category, ' ')
          FROM learning_event_tags let
          JOIN tags t ON t.id = let.tag_id
          WHERE let.learning_event_id = le.id
        ), '') || ' ' ||
        COALESCE((
          SELECT group_concat(ra.answer_text, ' ')
          FROM review_items ri
          JOIN review_attempts ra ON ra.review_item_id = ri.id
          WHERE ri.learning_event_id = le.id
        ), '')
      )
    FROM learning_events le
    LEFT JOIN tutor_events te ON te.id = le.tutor_event_id
    LEFT JOIN moves m ON m.id = le.move_id
    LEFT JOIN positions p ON p.id = le.position_id
    LEFT JOIN engine_evaluations ee ON ee.id = (
      SELECT latest_ee.id
      FROM engine_evaluations latest_ee
      WHERE latest_ee.game_id = le.game_id
        AND latest_ee.position_id = le.position_id
      ORDER BY latest_ee.created_at DESC
      LIMIT 1
    )
  `).run();
}

export function closeDatabase(db) {
  db.close();
}
