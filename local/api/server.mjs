import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase, openAteromanteDatabase } from '../persistence/database.mjs';
import { EngineEvaluationRepository, LearningRepository, TutorEventRepository } from '../persistence/repositories.mjs';
import { GameService, IllegalMoveError, InvalidFenError, InvalidPgnError } from '../game/game-service.mjs';
import {
  UciEngineInputError,
  UciEngineProtocolError,
  UciEngineService,
  UciEngineUnavailableError,
} from '../engine/uci-engine-service.mjs';
import { TutorProviderUnavailableError, TutorService } from '../tutor/tutor-service.mjs';

const DEFAULT_PORT = Number.parseInt(process.env.ATEROMANTE_API_PORT ?? '4174', 10);
const DEFAULT_DB_PATH = process.env.ATEROMANTE_DB_PATH
  ?? resolve(fileURLToPath(new URL('../../data/ateromante.db', import.meta.url)));

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  response.end(JSON.stringify(body));
}

function sendNoContent(response) {
  response.writeHead(204, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  response.end();
}

function sendText(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function serializeMove(move) {
  return {
    id: move.id,
    ply: move.ply,
    san: move.san,
    uci: move.uci,
    from: move.from_square,
    to: move.to_square,
    promotion: move.promotion,
    classification: move.classification,
  };
}

function serializeState(state) {
  return {
    sessionId: state.game.session_id,
    gameId: state.game.id,
    fen: state.fen,
    pgn: state.pgn,
    pgnHeaders: state.pgnHeaders?.headers ?? {},
    pgnSource: state.pgnSource ? {
      sourceType: state.pgnSource.source_type,
      fileName: state.pgnSource.file_name,
      mimeType: state.pgnSource.mime_type,
      byteSize: state.pgnSource.byte_size,
      pgnSha256: state.pgnSource.pgn_sha256,
      createdAt: state.pgnSource.created_at,
    } : null,
    pgnAnnotations: state.pgnAnnotations.map((annotation) => ({
      id: annotation.id,
      positionId: annotation.position_id,
      fen: annotation.fen,
      ply: annotation.ply,
      annotationType: annotation.annotation_type,
      value: annotation.value,
    })),
    pgnVariations: state.pgnVariations.map((variation) => ({
      id: variation.id,
      parentPly: variation.parent_ply,
      parentFen: variation.parent_fen,
      parentVariationIndex: variation.parent_variation_index,
      variationIndex: variation.variation_index,
      depth: variation.depth,
      sanLine: variation.san_line,
      rawPgn: variation.raw_pgn,
    })),
    turn: state.turn,
    result: state.result,
    legalMoves: state.legalMoves,
    moves: state.moves.map(serializeMove),
    events: state.events.map((event) => ({
      sequence: event.sequence,
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      payload: event.payload,
    })),
  };
}

function serializeSessionSummary(session) {
  return {
    sessionId: session.sessionId,
    gameId: session.gameId,
    mode: session.mode,
    stationRole: session.stationRole,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    moveCount: session.moveCount,
    turn: session.turn,
    result: session.result,
    lastMove: session.lastMove,
  };
}

function serializeEvaluation(row, perspective = 'side-to-move') {
  const score = row.score_mate !== null
    ? { type: 'mate', value: row.score_mate }
    : { type: 'cp', value: row.score_cp };

  return {
    id: row.id,
    gameId: row.game_id,
    moveId: row.move_id,
    positionId: row.position_id,
    engineName: row.engine_name,
    depth: row.depth,
    multipv: row.multipv,
    score,
    bestMove: row.best_move,
    principalVariation: JSON.parse(row.pv_json),
    perspective,
    createdAt: row.created_at,
  };
}

function serializeTutorEvent(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    moveId: row.move_id,
    positionId: row.position_id,
    providerId: row.llm_provider_id,
    tutorMode: row.tutor_mode,
    visibility: row.visibility,
    summary: row.summary,
    teachingFocus: row.teaching_focus,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

function serializeLearningEvent(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    moveId: row.move_id,
    positionId: row.position_id,
    tutorEventId: row.tutor_event_id,
    eventType: row.event_type,
    theme: row.theme,
    skill: row.skill,
    summary: row.summary,
    explanation: row.explanation,
    studentAction: row.student_action,
    confidence: row.confidence,
    masteryState: row.mastery_state,
    createdAt: row.created_at,
  };
}

function serializeReviewItem(row) {
  return {
    id: row.id,
    learningEventId: row.learning_event_id,
    gameId: row.game_id,
    moveId: row.move_id,
    positionId: row.position_id,
    theme: row.theme,
    skill: row.skill,
    summary: row.summary,
    masteryState: row.mastery_state,
    confidence: row.confidence,
    dueAt: row.due_at,
    intervalDays: row.interval_days,
    ease: row.ease,
    lastResult: row.last_result,
    nextPromptType: row.next_prompt_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function scoreToLabel(evaluation) {
  if (!evaluation) {
    return 'Sin evaluacion';
  }
  if (evaluation.score_mate !== null) {
    return `Mate ${evaluation.score_mate}`;
  }
  if (evaluation.score_cp === null || evaluation.score_cp === undefined) {
    return 'Sin score';
  }
  const pawns = evaluation.score_cp / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

function buildPostGameReport({
  state,
  evaluations,
  tutorEventRows,
  learningEventRows = [],
  reviewItemRows = [],
}) {
  const focusCounts = new Map();
  for (const event of tutorEventRows) {
    for (const focus of event.teaching_focus) {
      focusCounts.set(focus, (focusCounts.get(focus) ?? 0) + 1);
    }
  }

  const tutorEvents = tutorEventRows.map(serializeTutorEvent);
  const latestEvaluation = evaluations[0] ?? null;
  const recommendations = [];

  if (evaluations.length === 0) {
    recommendations.push('Analiza al menos una posicion critica con el motor.');
  }
  if (tutorEvents.length === 0) {
    recommendations.push('Genera una explicacion del tutor para registrar el primer aprendizaje.');
  }
  if (focusCounts.size > 0) {
    const [mainFocus] = [...focusCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    recommendations.push(`Revisar el tema recurrente: ${mainFocus}.`);
  }
  if (state.moves.length > 0 && evaluations.length > 0 && tutorEvents.length > 0) {
    recommendations.push('Convertir esta revision en un evento de aprendizaje o ejercicio dirigido.');
  }

  return {
    gameId: state.game.id,
    sessionId: state.game.session_id,
    generatedAt: new Date().toISOString(),
    summary: {
      moveCount: state.moves.length,
      result: state.result,
      analyzedPositions: evaluations.length,
      tutorExplanations: tutorEvents.length,
      learningEvents: learningEventRows.length,
      reviewItems: reviewItemRows.length,
      eventCount: state.events.length,
    },
    latestEngine: latestEvaluation
      ? {
          engineName: latestEvaluation.engine_name,
          depth: latestEvaluation.depth,
          bestMove: latestEvaluation.best_move,
          scoreLabel: scoreToLabel(latestEvaluation),
          createdAt: latestEvaluation.created_at,
        }
      : null,
    tutorFocus: [...focusCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count })),
    recentTutorEvents: tutorEvents.slice(0, 3),
    recentLearningEvents: learningEventRows.slice(0, 3).map(serializeLearningEvent),
    reviewQueue: reviewItemRows.slice(0, 3).map(serializeReviewItem),
    recommendations,
  };
}

export function createAteromanteApiServer({
  dbPath = DEFAULT_DB_PATH,
  engineService = new UciEngineService(),
  tutorService: injectedTutorService = null,
} = {}) {
  const db = openAteromanteDatabase(dbPath);
  const service = new GameService({ db });
  const engineEvaluations = new EngineEvaluationRepository(db, service.eventLog);
  const tutorEvents = new TutorEventRepository(db, service.eventLog);
  const learningEvents = new LearningRepository(db, service.eventLog);
  const tutorService = injectedTutorService ?? new TutorService({ eventRepository: tutorEvents });

  const server = createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') {
        sendNoContent(response);
        return;
      }

      const url = new URL(request.url ?? '/', 'http://127.0.0.1');

      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/engine/status') {
        const status = typeof engineService.checkAvailability === 'function'
          ? await engineService.checkAvailability()
          : {
              available: false,
              configured: false,
              engineName: null,
              defaultDepth: null,
              timeoutMs: null,
            };
        sendJson(response, 200, status);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/tutor/providers') {
        sendJson(response, 200, { providers: tutorService.listProviders() });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/sessions') {
        const limit = Number.parseInt(url.searchParams.get('limit') ?? '8', 10);
        const boundedLimit = Number.isInteger(limit) && limit > 0 && limit <= 25 ? limit : 8;
        sendJson(response, 200, {
          sessions: service.listRecentTrainingGames(boundedLimit).map(serializeSessionSummary),
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/sessions/recover-or-create') {
        const recent = service.listRecentTrainingGames(1);
        if (recent[0]) {
          sendJson(response, 200, serializeState(service.getGameState(recent[0].gameId)));
          return;
        }

        const input = await readJson(request);
        const created = service.createTrainingGame(input);
        sendJson(response, 201, serializeState(service.getGameState(created.game.id)));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/sessions') {
        const input = await readJson(request);
        const created = service.createTrainingGame(input);
        const state = service.getGameState(created.game.id);
        sendJson(response, 201, serializeState(state));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/import/fen') {
        const input = await readJson(request);
        const created = service.createTrainingGame({
          mode: 'fen-study',
          stationRole: 'hybrid',
          initialFen: input.fen,
          source: 'fen-import',
        });
        const state = service.getGameState(created.game.id);
        sendJson(response, 201, serializeState(state));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/import/pgn') {
        const input = await readJson(request);
        const imported = service.importPgn({ pgn: input.pgn, sourceMetadata: input.sourceMetadata });
        const state = service.getGameState(imported.game.id);
        sendJson(response, 201, serializeState(state));
        return;
      }

      const variationStudyMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/variations\/(\d+)\/study$/);
      if (request.method === 'POST' && variationStudyMatch) {
        const imported = service.createStudyFromVariation({
          gameId: variationStudyMatch[1],
          variationIndex: variationStudyMatch[2],
        });
        const state = service.getGameState(imported.game.id);
        sendJson(response, 201, serializeState(state));
        return;
      }

      const variationMainLineMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/variations\/(\d+)\/mainline$/);
      if (request.method === 'POST' && variationMainLineMatch) {
        const promoted = service.promoteVariationToMainLine({
          gameId: variationMainLineMatch[1],
          variationIndex: variationMainLineMatch[2],
        });
        const state = service.getGameState(promoted.game.id);
        sendJson(response, 201, serializeState(state));
        return;
      }

      const exportPgnMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/export\/pgn$/);
      if (request.method === 'GET' && exportPgnMatch) {
        sendText(response, 200, service.exportPgn(exportPgnMatch[1]), 'application/x-chess-pgn; charset=utf-8');
        return;
      }

      const gameMatch = url.pathname.match(/^\/api\/games\/([^/]+)$/);
      if (request.method === 'GET' && gameMatch) {
        const state = service.getGameState(gameMatch[1]);
        if (!state) {
          sendJson(response, 404, { error: 'game_not_found' });
          return;
        }
        sendJson(response, 200, serializeState(state));
        return;
      }

      const reportMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/report$/);
      if (request.method === 'GET' && reportMatch) {
        const state = service.getGameState(reportMatch[1]);
        if (!state) {
          sendJson(response, 404, { error: 'game_not_found' });
          return;
        }

        sendJson(response, 200, buildPostGameReport({
          state,
          evaluations: engineEvaluations.listByGame(reportMatch[1]),
          tutorEventRows: tutorEvents.listByGame(reportMatch[1]),
          learningEventRows: learningEvents.listByGame(reportMatch[1]),
          reviewItemRows: learningEvents.listReviewItems({ gameId: reportMatch[1], limit: 10 }),
        }));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/reviews') {
        const gameId = url.searchParams.get('gameId');
        const limit = Number.parseInt(url.searchParams.get('limit') ?? '10', 10);
        sendJson(response, 200, {
          reviewItems: learningEvents.listReviewItems({ gameId, limit }).map(serializeReviewItem),
        });
        return;
      }

      const learningFromReportMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/learning\/from-report$/);
      if (request.method === 'POST' && learningFromReportMatch) {
        const gameId = learningFromReportMatch[1];
        const state = service.getGameState(gameId);
        if (!state) {
          sendJson(response, 404, { error: 'game_not_found' });
          return;
        }
        if (state.moves.length === 0) {
          sendJson(response, 400, {
            error: 'learning_source_required',
            message: 'Registra al menos una jugada antes de crear un aprendizaje.',
          });
          return;
        }

        const evaluations = engineEvaluations.listByGame(gameId);
        const tutorEventRows = tutorEvents.listByGame(gameId);
        const report = buildPostGameReport({
          state,
          evaluations,
          tutorEventRows,
          learningEventRows: learningEvents.listByGame(gameId),
          reviewItemRows: learningEvents.listReviewItems({ gameId, limit: 10 }),
        });
        const latestMove = state.moves.at(-1) ?? null;
        const latestPosition = state.positions.at(-1) ?? null;
        const latestTutorEvent = tutorEventRows[0] ?? null;
        const topFocus = report.tutorFocus[0]?.label ?? 'revision-general';
        const latestEvaluation = evaluations[0] ?? null;
        const summary = report.recommendations[0] ?? `Revisar la posicion tras ${latestMove.san}.`;
        const explanationParts = [
          latestTutorEvent?.summary,
          latestEvaluation ? `Motor: ${latestEvaluation.best_move} (${scoreToLabel(latestEvaluation)}).` : null,
        ].filter(Boolean);

        const learningEvent = learningEvents.createLearningEvent({
          sessionId: state.game.session_id,
          gameId,
          moveId: latestMove?.id ?? null,
          positionId: latestPosition?.id ?? null,
          tutorEventId: latestTutorEvent?.id ?? null,
          eventType: 'post_game_review',
          theme: topFocus,
          skill: latestTutorEvent?.tutor_mode ?? 'analysis',
          summary,
          explanation: explanationParts.join(' '),
          studentAction: 'Convertido desde reporte post-partida.',
          confidence: latestTutorEvent?.confidence ?? 'medium',
          masteryState: 'new',
          tags: [
            { name: topFocus, category: 'tutor-focus' },
            { name: 'post-game-report', category: 'source' },
          ],
        });
        const reviewItem = learningEvents.createReviewItem({
          learningEventId: learningEvent.id,
          intervalDays: 1,
          nextPromptType: 'position-recall',
        });
        const reviewQueue = learningEvents.listReviewItems({ gameId, limit: 10 });
        const serializedReviewItem = reviewQueue.find((item) => item.id === reviewItem.id) ?? {
          ...reviewItem,
          game_id: learningEvent.game_id,
          move_id: learningEvent.move_id,
          position_id: learningEvent.position_id,
          theme: learningEvent.theme,
          skill: learningEvent.skill,
          summary: learningEvent.summary,
          mastery_state: learningEvent.mastery_state,
          confidence: learningEvent.confidence,
        };

        sendJson(response, 201, {
          learningEvent: serializeLearningEvent(learningEvent),
          reviewItem: serializeReviewItem(serializedReviewItem),
          report: buildPostGameReport({
            state,
            evaluations,
            tutorEventRows,
            learningEventRows: learningEvents.listByGame(gameId),
            reviewItemRows: reviewQueue,
          }),
        });
        return;
      }

      const moveMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/moves$/);
      if (request.method === 'POST' && moveMatch) {
        const gameId = moveMatch[1];
        const current = service.getGameState(gameId);
        if (!current) {
          sendJson(response, 404, { error: 'game_not_found' });
          return;
        }

        const input = await readJson(request);
        service.applyMove({
          sessionId: current.game.session_id,
          gameId,
          from: input.from,
          to: input.to,
          promotion: input.promotion,
        });
        sendJson(response, 200, serializeState(service.getGameState(gameId)));
        return;
      }

      const analysisMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/analysis$/);
      if (request.method === 'POST' && analysisMatch) {
        const gameId = analysisMatch[1];
        const current = service.getGameState(gameId);
        if (!current) {
          sendJson(response, 404, { error: 'game_not_found' });
          return;
        }

        const input = await readJson(request);
        const analysis = await engineService.analyze({ fen: current.fen, depth: input.depth });
        const currentPosition = current.positions.at(-1) ?? null;
        const currentMove = current.moves.at(-1) ?? null;
        const stored = engineEvaluations.recordEvaluation({
          sessionId: current.game.session_id,
          gameId,
          moveId: currentMove?.id ?? null,
          positionId: currentPosition?.id ?? null,
          ...analysis,
        });

        sendJson(response, 201, serializeEvaluation(stored, analysis.perspective));
        return;
      }

      const tutorMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/tutor\/explain$/);
      if (request.method === 'POST' && tutorMatch) {
        const gameId = tutorMatch[1];
        const current = service.getGameState(gameId);
        if (!current) {
          sendJson(response, 404, { error: 'game_not_found' });
          return;
        }

        const input = await readJson(request);
        const latestEvaluation = engineEvaluations.listByGame(gameId)[0] ?? null;
        const explanation = await tutorService.explain({
          state: current,
          engineEvaluation: latestEvaluation,
          tutorDepth: input.tutorDepth,
          language: input.language,
          providerId: input.providerId,
        });

        sendJson(response, 201, explanation);
        return;
      }

      sendJson(response, 404, { error: 'not_found' });
    } catch (error) {
      if (error instanceof IllegalMoveError) {
        sendJson(response, 400, { error: 'illegal_move', message: error.message });
        return;
      }

      if (error instanceof InvalidFenError) {
        sendJson(response, 400, { error: 'invalid_fen', message: error.message });
        return;
      }

      if (error instanceof InvalidPgnError) {
        sendJson(response, 400, { error: 'invalid_pgn', message: error.message });
        return;
      }

      if (error instanceof UciEngineInputError) {
        sendJson(response, 400, { error: 'invalid_analysis_request', message: error.message });
        return;
      }
      if (error instanceof UciEngineUnavailableError) {
        sendJson(response, 503, {
          error: 'engine_unavailable',
          message: 'Motor UCI no disponible. Configura ATEROMANTE_UCI_ENGINE_PATH.',
        });
        return;
      }
      if (error instanceof UciEngineProtocolError) {
        sendJson(response, 502, {
          error: 'engine_protocol_error',
          message: 'El motor UCI no completo el analisis correctamente.',
        });
        return;
      }
      if (error instanceof TutorProviderUnavailableError) {
        sendJson(response, 503, {
          error: 'tutor_provider_unavailable',
          message: 'Proveedor de tutor no disponible. Revisa ATEROMANTE_LLM_PROVIDER.',
        });
        return;
      }

      sendJson(response, 500, { error: 'internal_error', message: error.message });
    }
  });

  server.on('close', () => closeDatabase(db));
  return server;
}

export function startAteromanteApiServer({ port = DEFAULT_PORT, dbPath = DEFAULT_DB_PATH } = {}) {
  const server = createAteromanteApiServer({ dbPath });
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const resolvedPort = typeof address === 'object' && address ? address.port : port;
    console.log(`ateromante_api=http://127.0.0.1:${resolvedPort}`);
    console.log(`ateromante_db=${dbPath}`);
  });
  return server;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  startAteromanteApiServer();
}
