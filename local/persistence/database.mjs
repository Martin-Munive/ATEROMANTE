import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_VERSION = 1;

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

  const existing = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(SCHEMA_VERSION);

  if (!existing) {
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(SCHEMA_VERSION, 'initial_event_log_schema', nowIso());
  }
}

function ensureColumn(db, tableName, columnName, alterSql) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(alterSql);
  }
}

export function closeDatabase(db) {
  db.close();
}
