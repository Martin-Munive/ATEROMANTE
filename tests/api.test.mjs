import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAteromanteApiServer } from '../local/api/server.mjs';
import { UciEngineUnavailableError } from '../local/engine/uci-engine-service.mjs';

async function withServer(run, options = {}) {
  const server = createAteromanteApiServer({ dbPath: ':memory:', ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function readJson(response) {
  return response.json();
}

test('local API creates a session and persists a legal move', async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await readJson(health), { ok: true });

    const createdResponse = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'solo-practice', stationRole: 'hybrid' }),
    });
    assert.equal(createdResponse.status, 201);

    const created = await readJson(createdResponse);
    assert.equal(created.turn, 'white');
    assert.equal(created.moves.length, 0);
    assert.ok(created.gameId);

    const movedResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/moves`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e4', promotion: 'q' }),
    });
    assert.equal(movedResponse.status, 200);

    const moved = await readJson(movedResponse);
    assert.equal(moved.turn, 'black');
    assert.equal(moved.moves.length, 1);
    assert.equal(moved.moves[0].san, 'e4');
    assert.equal(moved.fen, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');

    const fetchedResponse = await fetch(`${baseUrl}/api/games/${created.gameId}`);
    assert.equal(fetchedResponse.status, 200);
    const fetched = await readJson(fetchedResponse);
    assert.equal(fetched.moves[0].uci, 'e2e4');
  });
});

test('local API rejects illegal moves without mutating the game', async () => {
  await withServer(async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'solo-practice', stationRole: 'hybrid' }),
    });
    const created = await readJson(createdResponse);

    const rejectedResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/moves`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e5', promotion: 'q' }),
    });
    assert.equal(rejectedResponse.status, 400);
    assert.equal((await readJson(rejectedResponse)).error, 'illegal_move');

    const fetchedResponse = await fetch(`${baseUrl}/api/games/${created.gameId}`);
    const fetched = await readJson(fetchedResponse);
    assert.equal(fetched.moves.length, 0);
    assert.equal(fetched.turn, 'white');
  });
});

test('local API analyzes the persisted position and stores the engine result', async () => {
  const engineService = {
    async analyze({ fen, depth }) {
      assert.match(fen, / w KQkq /);
      assert.equal(depth, 10);
      return {
        engineName: 'Injected UCI Engine',
        depth: 10,
        multipv: 1,
        scoreCp: 34,
        scoreMate: null,
        bestMove: 'e2e4',
        principalVariation: ['e2e4', 'e7e5', 'g1f3'],
        perspective: 'side-to-move',
      };
    },
  };

  await withServer(async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'solo-practice', stationRole: 'hybrid' }),
    });
    const created = await readJson(createdResponse);

    const analysisResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/analysis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ depth: 10 }),
    });
    assert.equal(analysisResponse.status, 201);

    const analysis = await readJson(analysisResponse);
    assert.equal(analysis.engineName, 'Injected UCI Engine');
    assert.deepEqual(analysis.score, { type: 'cp', value: 34 });
    assert.equal(analysis.bestMove, 'e2e4');
    assert.deepEqual(analysis.principalVariation, ['e2e4', 'e7e5', 'g1f3']);
    assert.ok(analysis.positionId);

    const fetchedResponse = await fetch(`${baseUrl}/api/games/${created.gameId}`);
    const fetched = await readJson(fetchedResponse);
    assert.ok(fetched.events.some((event) => event.eventType === 'engine.analysis.completed'));
  }, { engineService });
});

test('local API reports an unavailable UCI engine without leaking process details', async () => {
  const engineService = {
    async analyze() {
      throw new UciEngineUnavailableError('C:\\private\\stockfish.exe was not found');
    },
  };

  await withServer(async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'solo-practice', stationRole: 'hybrid' }),
    });
    const created = await readJson(createdResponse);

    const analysisResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/analysis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ depth: 12 }),
    });
    assert.equal(analysisResponse.status, 503);
    const payload = await readJson(analysisResponse);
    assert.equal(payload.error, 'engine_unavailable');
    assert.doesNotMatch(payload.message, /private|stockfish\.exe/i);
  }, { engineService });
});
