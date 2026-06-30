import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase, openAteromanteDatabase } from '../persistence/database.mjs';
import { EngineEvaluationRepository } from '../persistence/repositories.mjs';
import { GameService, IllegalMoveError, InvalidFenError, InvalidPgnError } from '../game/game-service.mjs';
import {
  UciEngineInputError,
  UciEngineProtocolError,
  UciEngineService,
  UciEngineUnavailableError,
} from '../engine/uci-engine-service.mjs';

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

export function createAteromanteApiServer({
  dbPath = DEFAULT_DB_PATH,
  engineService = new UciEngineService(),
} = {}) {
  const db = openAteromanteDatabase(dbPath);
  const service = new GameService({ db });
  const engineEvaluations = new EngineEvaluationRepository(db, service.eventLog);

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
