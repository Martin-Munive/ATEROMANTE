import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  UciEngineInputError,
  UciEngineService,
  UciEngineUnavailableError,
} from '../local/engine/uci-engine-service.mjs';

const fakeEngine = fileURLToPath(new URL('./fixtures/fake-uci-engine.mjs', import.meta.url));

test('UciEngineService completes the UCI handshake and parses an analysis', async () => {
  const service = new UciEngineService({
    command: process.execPath,
    args: [fakeEngine],
    defaultDepth: 8,
    timeoutMs: 2_000,
  });

  const result = await service.analyze({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  });

  assert.equal(result.engineName, 'Ateromante Test Engine');
  assert.equal(result.depth, 8);
  assert.equal(result.scoreCp, 34);
  assert.equal(result.bestMove, 'e2e4');
  assert.deepEqual(result.principalVariation, ['e2e4', 'e7e5', 'g1f3']);
  assert.equal(result.perspective, 'side-to-move');
});

test('UciEngineService rejects invalid FEN and unsafe multiline input', () => {
  const service = new UciEngineService({ command: process.execPath, args: [fakeEngine] });

  assert.throws(() => service.analyze({ fen: 'not-a-fen' }), UciEngineInputError);
  assert.throws(
    () => service.analyze({ fen: '8/8/8/8/8/8/8/K6k w - - 0 1\ngo depth 99' }),
    UciEngineInputError,
  );
});

test('UciEngineService bounds requested depth', () => {
  const service = new UciEngineService({ command: process.execPath, args: [fakeEngine] });

  assert.throws(
    () => service.analyze({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 99,
    }),
    UciEngineInputError,
  );
});

test('UciEngineService reports a missing external engine', async () => {
  const service = new UciEngineService({
    command: 'ateromante-engine-that-does-not-exist',
    timeoutMs: 1_000,
  });

  await assert.rejects(
    () => service.analyze({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    }),
    UciEngineUnavailableError,
  );
});
