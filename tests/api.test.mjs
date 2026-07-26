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
      '[ECO "C60"]',
      '[Opening "Ruy Lopez"]',
      '',
      '1. e4! {Claims central space.} e5 (1... c5 (1... e6) 2. Nf3) 2. Nf3 $1 Nc6 3. Bb5 a6',
    ].join('\n');
    const importResponse = await fetch(`${baseUrl}/api/import/pgn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pgn,
        sourceMetadata: {
          sourceType: 'file',
          fileName: 'C:\\private\\training-match.pgn',
          mimeType: 'application/x-chess-pgn',
          byteSize: 256,
        },
      }),
    });
    assert.equal(importResponse.status, 201);
    const imported = await readJson(importResponse);
    assert.equal(imported.moves.length, 6);
    assert.equal(imported.moves[0].san, 'e4');
    assert.equal(imported.moves[5].san, 'a6');
    assert.equal(imported.pgnHeaders.Event, 'Training Match');
    assert.equal(imported.pgnHeaders.White, 'Alice');
    assert.equal(imported.pgnHeaders.Black, 'Bob');
    assert.equal(imported.opening.eco, 'C60');
    assert.equal(imported.opening.name, 'Ruy Lopez');
    assert.equal(imported.pgnSource.sourceType, 'file');
    assert.equal(imported.pgnSource.fileName, 'training-match.pgn');
    assert.equal(imported.pgnSource.byteSize, 256);
    assert.equal(imported.pgnAnnotations.length, 3);
    assert.ok(imported.pgnAnnotations.some((annotation) => annotation.value === 'Claims central space.'));
    assert.ok(imported.pgnAnnotations.some((annotation) => annotation.annotationType === 'nag' && annotation.value === '$1'));
    assert.equal(imported.pgnVariations.length, 2);
    assert.equal(imported.pgnVariations[0].sanLine, 'c5 Nf3');
    assert.equal(imported.pgnVariations[1].parentVariationIndex, 0);
    assert.equal(imported.pgnVariations[1].sanLine, 'e6');
    assert.match(imported.pgn, /1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6/);

    const sessionsResponse = await fetch(`${baseUrl}/api/sessions?limit=1`);
    const sessions = await readJson(sessionsResponse);
    assert.equal(sessions.sessions[0].mode, 'pgn-study');
    assert.equal(sessions.sessions[0].moveCount, 6);
    assert.equal(sessions.sessions[0].gameId, imported.gameId);

    const variationStudyResponse = await fetch(`${baseUrl}/api/games/${imported.gameId}/variations/0/study`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(variationStudyResponse.status, 201);
    const variationStudy = await readJson(variationStudyResponse);
    assert.deepEqual(variationStudy.moves.map((move) => move.san), ['e4', 'c5', 'Nf3']);

    const mainLineResponse = await fetch(`${baseUrl}/api/games/${imported.gameId}/variations/0/mainline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(mainLineResponse.status, 201);
    const mainLine = await readJson(mainLineResponse);
    assert.notEqual(mainLine.gameId, imported.gameId);
    assert.deepEqual(mainLine.moves.map((move) => move.san), ['e4', 'c5', 'Nf3']);
    assert.equal(mainLine.pgnHeaders.Event, 'Training Match - promoted variation 0');

    const exportResponse = await fetch(`${baseUrl}/api/games/${imported.gameId}/export/pgn`);
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get('content-type') ?? '', /application\/x-chess-pgn/);
    const exported = await exportResponse.text();
    assert.match(exported, /\[Event "Training Match"\]/);
    assert.match(exported, /\(1\.\.\. c5 \(1\.\.\. e6\) 2\. Nf3\)/);
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

test('local API lists tutor providers and stores tutor explanations', async () => {
  await withServer(async (baseUrl) => {
    const providersResponse = await fetch(`${baseUrl}/api/tutor/providers`);
    assert.equal(providersResponse.status, 200);
    const providers = await readJson(providersResponse);
    assert.ok(providers.providers.some((provider) => provider.id === 'mock-local' && provider.active));

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

    const tutorResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/tutor/explain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: 'mock-local', tutorDepth: 'hint', language: 'es' }),
    });
    assert.equal(tutorResponse.status, 201);
    const explanation = await readJson(tutorResponse);
    assert.equal(explanation.provider.id, 'mock-local');
    assert.equal(explanation.tutorMode, 'hint');
    assert.match(explanation.summary, /pista breve/i);
    assert.ok(explanation.teachingFocus.includes('centro'));
    assert.ok(explanation.id);

    const fetchedResponse = await fetch(`${baseUrl}/api/games/${created.gameId}`);
    const fetched = await readJson(fetchedResponse);
    assert.ok(fetched.events.some((event) => event.eventType === 'tutor.explanation.created'));
  });
});

test('local API builds a post-game report from engine and tutor events', async () => {
  let analysisCount = 0;
  const engineService = {
    async analyze() {
      analysisCount += 1;
      if (analysisCount === 2) {
        return {
          engineName: 'Report Engine',
          depth: 9,
          multipv: 1,
          scoreCp: 320,
          scoreMate: null,
          bestMove: 'd2d4',
          principalVariation: ['d2d4', 'e5d4'],
          perspective: 'side-to-move',
        };
      }

      return {
        engineName: 'Report Engine',
        depth: 8,
        multipv: 1,
        scoreCp: 42,
        scoreMate: null,
        bestMove: 'g1f3',
        principalVariation: ['g1f3', 'b8c6'],
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

    await fetch(`${baseUrl}/api/games/${created.gameId}/moves`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e4', promotion: 'q' }),
    });

    const analysisResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/analysis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ depth: 8 }),
    });
    assert.equal(analysisResponse.status, 201);

    const tutorResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/tutor/explain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: 'mock-local', tutorDepth: 'strategic', language: 'es' }),
    });
    assert.equal(tutorResponse.status, 201);

    const secondMoveResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/moves`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'e7', to: 'e5', promotion: 'q' }),
    });
    assert.equal(secondMoveResponse.status, 200);

    const secondAnalysisResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/analysis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ depth: 9 }),
    });
    assert.equal(secondAnalysisResponse.status, 201);

    const reportResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/report`);
    assert.equal(reportResponse.status, 200);
    const report = await readJson(reportResponse);

    assert.equal(report.summary.moveCount, 2);
    assert.equal(report.summary.analyzedPositions, 2);
    assert.equal(report.summary.tutorExplanations, 1);
    assert.equal(report.latestEngine.engineName, 'Report Engine');
    assert.equal(report.latestEngine.bestMove, 'd2d4');
    assert.equal(report.latestEngine.scoreLabel, '+3.20');
    assert.equal(report.criticalPosition.san, 'e5');
    assert.equal(report.criticalPosition.bestMove, 'd2d4');
    assert.equal(report.criticalPosition.scoreLabel, '+3.20');
    assert.equal(report.criticalPosition.category, 'decisive-engine-signal');
    assert.equal(report.criticalPosition.severity, 'high');
    assert.equal(report.criticalPositions.length, 2);
    assert.equal(report.criticalPositions[1].san, 'e4');
    assert.ok(report.criticalPosition.signals.some((signal) => signal.includes('d2d4')));
    assert.equal(report.summary.learningEvents, 0);
    assert.ok(report.tutorFocus.some((focus) => focus.label === 'centro'));
    assert.ok(report.recommendations.some((recommendation) => /centro|aprendizaje|ejercicio/i.test(recommendation)));

    const learningResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/learning/from-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(learningResponse.status, 201);
    const learning = await readJson(learningResponse);
    assert.equal(learning.learningEvent.gameId, created.gameId);
    assert.equal(learning.learningEvent.eventType, 'post_game_review');
    assert.equal(learning.learningEvent.theme, 'centro');
    assert.equal(learning.learningEvent.skill, 'strategic');
    assert.ok(learning.learningEvent.moveId);
    assert.ok(learning.learningEvent.positionId);
    assert.equal(learning.learningEvent.positionId, report.criticalPosition.positionId);
    assert.ok(learning.learningEvent.tutorEventId);
    assert.equal(learning.reviewItem.learningEventId, learning.learningEvent.id);
    assert.equal(learning.reviewItem.gameId, created.gameId);
    assert.equal(learning.reviewItem.nextPromptType, 'position-recall');
    assert.match(learning.reviewItem.exercisePrompt, /Ejercicio dirigido/i);
    assert.equal(learning.reviewItem.positionFen, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    assert.equal(learning.reviewItem.sideToMove, 'white');
    assert.equal(learning.reviewItem.expectedBestMove, 'd2d4');
    assert.equal(learning.reviewItem.expectedScoreLabel, '+3.20');
    assert.equal(learning.reviewItem.expectedDepth, 9);
    assert.equal(learning.report.summary.learningEvents, 1);
    assert.equal(learning.report.summary.reviewItems, 1);

    const updatedReportResponse = await fetch(`${baseUrl}/api/games/${created.gameId}/report`);
    assert.equal(updatedReportResponse.status, 200);
    const updatedReport = await readJson(updatedReportResponse);
    assert.equal(updatedReport.summary.learningEvents, 1);
    assert.equal(updatedReport.summary.reviewItems, 1);
    assert.equal(updatedReport.recentLearningEvents[0].id, learning.learningEvent.id);
    assert.equal(updatedReport.reviewQueue[0].id, learning.reviewItem.id);

    const reviewsResponse = await fetch(`${baseUrl}/api/reviews?gameId=${created.gameId}`);
    assert.equal(reviewsResponse.status, 200);
    const reviews = await readJson(reviewsResponse);
    assert.equal(reviews.reviewItems.length, 1);
    assert.equal(reviews.reviewItems[0].learningEventId, learning.learningEvent.id);

    const answerText = 'Recorde que el centro y la seguridad del rey ordenan la posicion; candidata d2d4.';
    const reviewResultResponse = await fetch(`${baseUrl}/api/reviews/${learning.reviewItem.id}/result`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ result: 'easy', answerText }),
    });
    assert.equal(reviewResultResponse.status, 200);
    const reviewResult = await readJson(reviewResultResponse);
    assert.equal(reviewResult.reviewItem.id, learning.reviewItem.id);
    assert.equal(reviewResult.reviewItem.lastResult, 'easy');
    assert.equal(reviewResult.reviewItem.masteryState, 'stable');
    assert.equal(reviewResult.reviewItem.latestAnswer, answerText);
    assert.equal(reviewResult.reviewItem.latestAnswerAssessment.label, 'alineada');
    assert.equal(reviewResult.reviewItem.latestAnswerAssessment.candidateSignal.expectedMove, 'd2d4');
    assert.equal(reviewResult.reviewItem.latestAnswerAssessment.candidateSignal.matched, true);
    assert.ok(reviewResult.reviewItem.intervalDays >= 2);

    const refreshedReviewsResponse = await fetch(`${baseUrl}/api/reviews?gameId=${created.gameId}`);
    const refreshedReviews = await readJson(refreshedReviewsResponse);
    assert.equal(refreshedReviews.reviewItems[0].lastResult, 'easy');
    assert.equal(refreshedReviews.reviewItems[0].masteryState, 'stable');
    assert.equal(refreshedReviews.reviewItems[0].latestAnswer, answerText);

    const traceResponse = await fetch(`${baseUrl}/api/learning/search?gameId=${created.gameId}&q=d2d4`);
    assert.equal(traceResponse.status, 200);
    const trace = await readJson(traceResponse);
    assert.equal(trace.query, 'd2d4');
    assert.equal(trace.results.length, 1);
    assert.equal(trace.results[0].id, learning.learningEvent.id);
    assert.equal(trace.results[0].expectedBestMove, 'd2d4');
    assert.equal(trace.results[0].latestAnswer, answerText);
    assert.equal(trace.results[0].positionFen, learning.reviewItem.positionFen);
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
