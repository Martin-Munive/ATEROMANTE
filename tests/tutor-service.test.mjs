import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { LocalHttpTutorProvider, TutorService } from '../local/tutor/tutor-service.mjs';

async function withHttpTutor(run) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push(payload);

    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      response: JSON.stringify({
        summary: 'Tutor local HTTP: mejora el centro antes de atacar.',
        candidateMove: 'Nf3',
        teachingFocus: ['centro', 'desarrollo'],
        visualAnnotations: [{ kind: 'square', square: 'd4', color: 'green', label: 'centro' }],
        followUpExercise: 'Encuentra dos formas de desarrollar una pieza menor.',
        confidence: 'medium',
      }),
    }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl, requests);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function createState() {
  return {
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    pgn: '1. e4',
    game: {
      id: 'gam_test',
      session_id: 'ses_test',
      tutor_policy: 'private-live',
      engine_policy: 'evaluation-only',
    },
    moves: [{ id: 'mov_test', san: 'e4' }],
    positions: [{ id: 'pos_test' }],
  };
}

test('LocalHttpTutorProvider normalizes a local model response and stores a tutor event', async () => {
  await withHttpTutor(async (baseUrl, requests) => {
    const storedEvents = [];
    const provider = new LocalHttpTutorProvider({
      config: {
        id: 'local-http-default',
        label: 'Local HTTP model',
        kind: 'local-http',
        model: 'ateromante-test-model',
        enabled: true,
        baseUrl,
        supportsStreaming: false,
      },
      timeoutMs: 5000,
    });
    const service = new TutorService({
      providerId: 'local-http-default',
      providers: new Map([['local-http-default', provider]]),
      eventRepository: {
        recordTutorEvent(event) {
          storedEvents.push(event);
          return { id: 'tut_test', created_at: '2026-07-02T00:00:00.000Z' };
        },
      },
    });

    const explanation = await service.explain({
      state: createState(),
      tutorDepth: 'strategic',
      language: 'es',
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].model, 'ateromante-test-model');
    assert.match(requests[0].prompt, /FEN:/);
    assert.equal(explanation.provider.id, 'local-http-default');
    assert.equal(explanation.summary, 'Tutor local HTTP: mejora el centro antes de atacar.');
    assert.equal(explanation.candidateMove, 'Nf3');
    assert.deepEqual(explanation.teachingFocus, ['centro', 'desarrollo']);
    assert.equal(explanation.confidence, 'medium');
    assert.equal(storedEvents[0].llmProviderId, 'local-http-default');
    assert.equal(storedEvents[0].tutorMode, 'strategic');
  });
});
