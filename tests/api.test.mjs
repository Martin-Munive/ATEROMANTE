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

test('local API lists recent sessions for visual recovery', async () => {
  await withServer(async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'solo-practice', stationRole: 'hybrid' }),
    });
    const created = await readJson(createdResponse);

    await fetch(`${baseUrl}/api/games/${created.gameId}/moves`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e4', promotion: 'q' }),
    });

    const sessionsResponse = await fetch(`${baseUrl}/api/sessions?limit=3`);
    assert.equal(sessionsResponse.status, 200);
    const payload = await readJson(sessionsResponse);
    assert.equal(payload.sessions.length, 1);
    assert.equal(payload.sessions[0].gameId, created.gameId);
    assert.equal(payload.sessions[0].moveCount, 1);
    assert.equal(payload.sessions[0].lastMove, 'e4');
    assert.equal(payload.sessions[0].turn, 'black');
  });
});

test('local API recovers or creates one startup session idempotently', async () => {
  await withServer(async (baseUrl) => {
    const firstResponse = await fetch(`${baseUrl}/api/sessions/recover-or-create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'solo-practice', stationRole: 'hybrid' }),
    });
    assert.equal(firstResponse.status, 201);
    const first = await readJson(firstResponse);

    const secondResponse = await fetch(`${baseUrl}/api/sessions/recover-or-create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'solo-practice', stationRole: 'hybrid' }),
    });
    assert.equal(secondResponse.status, 200);
    const second = await readJson(secondResponse);
    assert.equal(second.gameId, first.gameId);

    const sessionsResponse = await fetch(`${baseUrl}/api/sessions`);
    const payload = await readJson(sessionsResponse);
    assert.equal(payload.sessions.length, 1);
  });
});

test('local API imports a FEN position as a study session', async () => {
  await withServer(async (baseUrl) => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 3';
    const importResponse = await fetch(`${baseUrl}/api/import/fen`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fen }),
    });
    assert.equal(importResponse.status, 201);
    const imported = await readJson(importResponse);
    assert.equal(imported.fen, fen);
    assert.equal(imported.turn, 'black');
    assert.equal(imported.moves.length, 0);
    assert.ok(imported.events.some((event) => event.eventType === 'game.created'));

    const sessionsResponse = await fetch(`${baseUrl}/api/sessions?limit=1`);
    const sessions = await readJson(sessionsResponse);
    assert.equal(sessions.sessions[0].mode, 'fen-study');
    assert.equal(sessions.sessions[0].gameId, imported.gameId);
  });
});

test('local API rejects invalid FEN imports without creating a session', async () => {
  await withServer(async (baseUrl) => {
    const importResponse = await fetch(`${baseUrl}/api/import/fen`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fen: 'not-a-fen' }),
    });
    assert.equal(importResponse.status, 400);
    assert.equal((await readJson(importResponse)).error, 'invalid_fen');

    const sessionsResponse = await fetch(`${baseUrl}/api/sessions`);
    const sessions = await readJson(sessionsResponse);
    assert.equal(sessions.sessions.length, 0);
  });
});

test('local API imports a basic PGN as a study session', async () => {
  await withServer(async (baseUrl) => {
    const pgn = [
      '[Event "Training Match"]',
      '[Site "Bogota"]',
      '[White "Alice"]',
      '[Black "Bob"]',
      '[Result "*"]',
      '',
      '1. e4 {Claims central space.} e5 2. Nf3 Nc6 3. Bb5 a6',
    ].join('\n');
    const importResponse = await fetch(`${baseUrl}/api/import/pgn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pgn }),
    });
    assert.equal(importResponse.status, 201);
    const imported = await readJson(importResponse);
    assert.equal(imported.moves.length, 6);
    assert.equal(imported.moves[0].san, 'e4');
    assert.equal(imported.moves[5].san, 'a6');
    assert.equal(imported.pgnHeaders.Event, 'Training Match');
    assert.equal(imported.pgnHeaders.White, 'Alice');
    assert.equal(imported.pgnHeaders.Black, 'Bob');
    assert.equal(imported.pgnAnnotations.length, 1);
    assert.equal(imported.pgnAnnotations[0].value, 'Claims central space.');
    assert.match(imported.pgn, /1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6/);

    const sessionsResponse = await fetch(`${baseUrl}/api/sessions?limit=1`);
    const sessions = await readJson(sessionsResponse);
    assert.equal(sessions.sessions[0].mode, 'pgn-study');
    assert.equal(sessions.sessions[0].moveCount, 6);
    assert.equal(sessions.sessions[0].gameId, imported.gameId);
  });
});

test('local API rejects invalid PGN imports without creating a session', async () => {
  await withServer(async (baseUrl) => {
    const importResponse = await fetch(`${baseUrl}/api/import/pgn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pgn: '1. e4 e5 2. e5' }),
    });
    assert.equal(importResponse.status, 400);
    assert.equal((await readJson(importResponse)).error, 'invalid_pgn');

    const sessionsResponse = await fetch(`${baseUrl}/api/sessions`);
    const sessions = await readJson(sessionsResponse);
    assert.equal(sessions.sessions.length, 0);
  });
});

test('local API reports external engine status', async () => {
  const engineService = {
    async checkAvailability() {
      return {
        available: true,
        configured: true,
        engineName: 'Injected Status Engine',
        defaultDepth: 14,
        timeoutMs: 5_000,
      };
    },
  };

  await withServer(async (baseUrl) => {
    const statusResponse = await fetch(`${baseUrl}/api/engine/status`);
    assert.equal(statusResponse.status, 200);
    assert.deepEqual(await readJson(statusResponse), {
      available: true,
      configured: true,
      engineName: 'Injected Status Engine',
      defaultDepth: 14,
      timeoutMs: 5_000,
    });
  }, { engineService });
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
