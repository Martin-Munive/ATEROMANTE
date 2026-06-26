import assert from 'node:assert/strict';
import test from 'node:test';
import { closeDatabase, openAteromanteDatabase } from '../local/persistence/database.mjs';
import { GameService, IllegalMoveError, InvalidFenError } from '../local/game/game-service.mjs';

test('GameService creates a persisted training game with initial legal moves', () => {
  const db = openAteromanteDatabase(':memory:');
  const service = new GameService({ db });

  const created = service.createTrainingGame();

  assert.equal(created.fen, created.currentPosition.fen);
  assert.ok(created.legalMoves.includes('e4'));

  const timeline = service.getGameState(created.game.id);
  assert.equal(timeline.positions.length, 1);
  assert.equal(timeline.moves.length, 0);
  assert.equal(timeline.events.map((event) => event.event_type).join(','), [
    'game.created',
    'position.recorded',
  ].join(','));

  closeDatabase(db);
});

test('GameService creates a training game from an imported FEN', () => {
  const db = openAteromanteDatabase(':memory:');
  const service = new GameService({ db });
  const importedFen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 3';

  const created = service.createTrainingGame({
    initialFen: importedFen,
    source: 'fen-import',
    mode: 'fen-study',
  });
  const timeline = service.getGameState(created.game.id);

  assert.equal(created.game.source, 'fen-import');
  assert.equal(timeline.game.source, 'fen-import');
  assert.equal(timeline.fen, importedFen);
  assert.equal(timeline.turn, 'black');
  assert.equal(timeline.positions.length, 1);
  assert.equal(timeline.positions[0].ply, 0);
  assert.ok(timeline.legalMoves.includes('Nf6'));

  closeDatabase(db);
});

test('GameService rejects invalid FEN before creating a game', () => {
  const db = openAteromanteDatabase(':memory:');
  const service = new GameService({ db });

  assert.throws(
    () => service.createTrainingGame({ initialFen: 'not-a-fen', source: 'fen-import' }),
    InvalidFenError,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM games').get().total, 0);

  closeDatabase(db);
});

test('GameService accepts a legal move and persists FEN, PGN and event order', () => {
  const db = openAteromanteDatabase(':memory:');
  const service = new GameService({ db });
  const created = service.createTrainingGame();

  const result = service.applyMove({
    sessionId: created.session.id,
    gameId: created.game.id,
    from: 'e2',
    to: 'e4',
  });

  assert.equal(result.move.san, 'e4');
  assert.equal(result.move.uci, 'e2e4');
  assert.equal(result.fen, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
  assert.match(result.pgn, /1\. e4/);

  const timeline = service.getGameState(created.game.id);
  assert.equal(timeline.positions.length, 2);
  assert.equal(timeline.moves.length, 1);
  assert.equal(timeline.moves[0].position_after_id, result.positionAfter.id);
  assert.equal(timeline.events.map((event) => event.event_type).join(','), [
    'game.created',
    'position.recorded',
    'move.accepted',
    'position.recorded',
  ].join(','));

  closeDatabase(db);
});

test('GameService rejects illegal moves without adding timeline events', () => {
  const db = openAteromanteDatabase(':memory:');
  const service = new GameService({ db });
  const created = service.createTrainingGame();

  assert.throws(
    () => service.applyMove({
      sessionId: created.session.id,
      gameId: created.game.id,
      from: 'e2',
      to: 'e5',
    }),
    IllegalMoveError,
  );

  const timeline = service.getGameState(created.game.id);
  assert.equal(timeline.moves.length, 0);
  assert.equal(timeline.positions.length, 1);
  assert.equal(timeline.events.length, 2);

  closeDatabase(db);
});

test('GameService rebuilds state from persisted moves', () => {
  const db = openAteromanteDatabase(':memory:');
  const service = new GameService({ db });
  const created = service.createTrainingGame();

  service.applyMove({ sessionId: created.session.id, gameId: created.game.id, from: 'e2', to: 'e4' });
  service.applyMove({ sessionId: created.session.id, gameId: created.game.id, from: 'e7', to: 'e5' });
  service.applyMove({ sessionId: created.session.id, gameId: created.game.id, from: 'g1', to: 'f3' });

  const rebuilt = service.getGameState(created.game.id);
  assert.equal(rebuilt.moves.length, 3);
  assert.equal(rebuilt.turn, 'black');
  assert.match(rebuilt.pgn, /1\. e4 e5 2\. Nf3/);
  assert.equal(rebuilt.fen, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');

  closeDatabase(db);
});
