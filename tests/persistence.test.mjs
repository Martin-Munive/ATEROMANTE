import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  closeDatabase,
  hashFen,
  openAteromanteDatabase,
  STANDARD_STARTING_FEN,
} from '../local/persistence/database.mjs';
import {
  EventLogRepository,
  GameRepository,
  LearningRepository,
  SessionRepository,
} from '../local/persistence/repositories.mjs';

function tempDbPath() {
  const dir = join(tmpdir(), `ateromante-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return { dir, dbPath: join(dir, 'test.db') };
}

test('migration creates the normalized persistence core', () => {
  const db = openAteromanteDatabase(':memory:');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name
  `).all().map((row) => row.name);

  for (const table of [
    'event_log',
    'games',
    'learning_events',
    'match_policies',
    'moves',
    'pgn_annotations',
    'pgn_headers',
    'pgn_sources',
    'pgn_variations',
    'review_attempts',
    'positions',
    'review_items',
    'study_sessions',
    'tutor_events',
  ]) {
    assert.ok(tables.includes(table), `${table} should exist`);
  }

  const migration = db.prepare('SELECT version FROM schema_migrations WHERE version = 1').get();
  assert.equal(migration.version, 1);
  closeDatabase(db);
});

test('repositories persist a session, game, positions, move and timeline events', () => {
  const db = openAteromanteDatabase(':memory:');
  const events = new EventLogRepository(db);
  const sessions = new SessionRepository(db, events);
  const games = new GameRepository(db, events);

  const student = sessions.createStudent({ displayName: 'Adult learner' });
  const session = sessions.createSession({
    studentId: student.id,
    mode: 'solo-practice',
    stationRole: 'hybrid',
  });
  const game = games.createGame({ sessionId: session.id, initialFen: STANDARD_STARTING_FEN });
  const before = games.recordPosition({
    sessionId: session.id,
    gameId: game.id,
    fen: STANDARD_STARTING_FEN,
    ply: 0,
    sideToMove: 'white',
    phase: 'opening',
  });
  const move = games.appendMove({
    sessionId: session.id,
    gameId: game.id,
    positionBeforeId: before.id,
    ply: 1,
    san: 'e4',
    uci: 'e2e4',
    fromSquare: 'e2',
    toSquare: 'e4',
    piece: 'pawn',
    classification: 'good',
  });
  const after = games.recordPosition({
    sessionId: session.id,
    gameId: game.id,
    moveId: move.id,
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    ply: 1,
    sideToMove: 'black',
    phase: 'opening',
  });
  const headers = games.recordPgnHeaders({
    gameId: game.id,
    headers: {
      Event: 'Training Match',
      Site: 'Bogota',
      White: 'Alice',
      Black: 'Bob',
      Result: '*',
    },
  });
  const annotations = games.recordPgnAnnotations({
    gameId: game.id,
    annotations: [{
      positionId: after.id,
      fen: after.fen,
      ply: 1,
      annotationType: 'comment',
      value: 'Central space advantage.',
    }, {
      positionId: after.id,
      fen: after.fen,
      ply: 1,
      annotationType: 'nag',
      value: '$1',
    }],
  });
  const variations = games.recordPgnVariations({
    gameId: game.id,
    variations: [{
      parentPly: 1,
      parentFen: after.fen,
      parentVariationIndex: null,
      variationIndex: 0,
      depth: 1,
      sanLine: '1... c5',
      rawPgn: '1... c5',
    }],
  });
  const source = games.recordPgnSource({
    gameId: game.id,
    sourceType: 'file',
    fileName: 'training-game.pgn',
    mimeType: 'application/x-chess-pgn',
    byteSize: 128,
    pgnSha256: 'a'.repeat(64),
  });

  const timeline = games.getGameTimeline(game.id);
  assert.equal(timeline.game.id, game.id);
  assert.equal(headers.headers.Event, 'Training Match');
  assert.equal(timeline.pgnHeaders.headers.White, 'Alice');
  assert.equal(annotations[0].value, 'Central space advantage.');
  assert.equal(timeline.pgnAnnotations[0].position_id, after.id);
  assert.equal(timeline.pgnAnnotations[1].annotation_type, 'nag');
  assert.equal(timeline.pgnAnnotations[1].value, '$1');
  assert.equal(variations[0].san_line, '1... c5');
  assert.equal(timeline.pgnVariations[0].parent_ply, 1);
  assert.equal(timeline.pgnVariations[0].parent_variation_index, null);
  assert.equal(source.file_name, 'training-game.pgn');
  assert.equal(timeline.pgnSource.source_type, 'file');
  assert.equal(timeline.moves[0].san, 'e4');
  assert.equal(timeline.positions.length, 2);
  assert.equal(timeline.events.map((event) => event.event_type).join(','), [
    'game.created',
    'position.recorded',
    'move.accepted',
    'position.recorded',
  ].join(','));
  assert.equal(after.fen_hash, hashFen(after.fen));
  closeDatabase(db);
});

test('learning events can be traced back to the source position', () => {
  const db = openAteromanteDatabase(':memory:');
  const events = new EventLogRepository(db);
  const sessions = new SessionRepository(db, events);
  const games = new GameRepository(db, events);
  const learning = new LearningRepository(db, events);

  const session = sessions.createSession();
  const game = games.createGame({ sessionId: session.id });
  const position = games.recordPosition({
    sessionId: session.id,
    gameId: game.id,
    fen: STANDARD_STARTING_FEN,
    ply: 0,
    sideToMove: 'white',
    phase: 'opening',
    strategicThemes: ['center-control'],
  });

  const lesson = learning.createLearningEvent({
    sessionId: session.id,
    gameId: game.id,
    positionId: position.id,
    eventType: 'opening_idea',
    theme: 'center-control',
    skill: 'opening',
    summary: 'Occupy the center before launching flank play.',
    explanation: 'The first lesson links a teaching idea to the exact starting position.',
    tags: [{ name: 'center-control', category: 'strategy' }],
  });

  const found = learning.findLearningEvents({ theme: 'center-control', positionId: position.id });
  assert.equal(found.length, 1);
  assert.equal(found[0].id, lesson.id);

  const review = learning.createReviewItem({
    learningEventId: lesson.id,
    gameId: game.id,
    positionId: position.id,
    nextPromptType: 'position-recall',
  });
  const result = learning.recordReviewResult({
    reviewItemId: review.id,
    result: 'good',
    answerText: 'Debo ocupar el centro antes de jugar por el flanco.',
  });
  assert.equal(result.position_fen, STANDARD_STARTING_FEN);
  assert.equal(result.position_ply, 0);
  assert.equal(result.side_to_move, 'white');
  assert.equal(result.latest_answer, 'Debo ocupar el centro antes de jugar por el flanco.');
  assert.equal(result.last_result, 'good');

  const sessionEvents = events.listEventsBySession(session.id);
  assert.ok(sessionEvents.some((event) => event.event_type === 'learning.event.created'));
  assert.ok(sessionEvents.some((event) => event.event_type === 'review.item.answered'));
  closeDatabase(db);
});

test('file-backed databases persist across reopen', () => {
  const { dir, dbPath } = tempDbPath();
  try {
    let db = openAteromanteDatabase(dbPath);
    const sessions = new SessionRepository(db);
    const session = sessions.createSession({ mode: 'solo-practice' });
    closeDatabase(db);

    db = openAteromanteDatabase(dbPath);
    const reopened = new SessionRepository(db).getSession(session.id);
    assert.equal(reopened.id, session.id);
    closeDatabase(db);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
