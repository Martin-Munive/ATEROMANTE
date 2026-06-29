import { Chess } from 'chess.js';
import {
  EventLogRepository,
  GameRepository,
  SessionRepository,
} from '../persistence/repositories.mjs';
import { STANDARD_STARTING_FEN } from '../persistence/database.mjs';

export class IllegalMoveError extends Error {
  constructor({ from, to, promotion }) {
    super(`Illegal chess move: ${from}${to}${promotion ?? ''}`);
    this.name = 'IllegalMoveError';
    this.from = from;
    this.to = to;
    this.promotion = promotion;
  }
}

export class InvalidFenError extends Error {
  constructor(message = 'FEN is not a valid chess position') {
    super(message);
    this.name = 'InvalidFenError';
  }
}

export class InvalidPgnError extends Error {
  constructor(message = 'PGN is not a valid chess game') {
    super(message);
    this.name = 'InvalidPgnError';
  }
}

function sideToMove(turn) {
  return turn === 'w' ? 'white' : 'black';
}

function resultFromChess(chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? '0-1' : '1-0';
  }
  if (chess.isDraw()) {
    return '1/2-1/2';
  }
  return '*';
}

function normalizedResult(value) {
  return ['1-0', '0-1', '1/2-1/2', '*'].includes(value) ? value : '*';
}

function replayGame(game, moves) {
  const chess = new Chess(game.initial_fen);
  for (const move of moves) {
    chess.move({ from: move.from_square, to: move.to_square, promotion: move.promotion ?? undefined });
  }
  return chess;
}

function normalizeFen(fen) {
  if (typeof fen !== 'string' || fen.trim() === '' || fen.includes('\n') || fen.includes('\r')) {
    throw new InvalidFenError('FEN must be a single line chess position');
  }

  try {
    return new Chess(fen.trim()).fen();
  } catch {
    throw new InvalidFenError();
  }
}

function parsePgn(pgn) {
  if (typeof pgn !== 'string' || pgn.trim() === '') {
    throw new InvalidPgnError('PGN input is required');
  }

  try {
    const chess = new Chess();
    chess.loadPgn(pgn.trim(), { strict: false });
    const moves = chess.history();
    if (moves.length === 0) {
      throw new InvalidPgnError('PGN must contain at least one move');
    }
    return {
      headers: chess.getHeaders(),
      comments: chess.getComments(),
      moves,
    };
  } catch (error) {
    if (error instanceof InvalidPgnError) {
      throw error;
    }
    throw new InvalidPgnError();
  }
}

export class GameService {
  constructor({
    db,
    eventLog = new EventLogRepository(db),
    sessions = new SessionRepository(db, eventLog),
    games = new GameRepository(db, eventLog),
  }) {
    this.db = db;
    this.eventLog = eventLog;
    this.sessions = sessions;
    this.games = games;
  }

  createTrainingGame({
    studentId = null,
    mode = 'solo-practice',
    stationRole = 'hybrid',
    initialFen = STANDARD_STARTING_FEN,
    source = 'local',
    externalId = null,
  } = {}) {
    const normalizedFen = normalizeFen(initialFen);
    const session = this.sessions.createSession({ studentId, mode, stationRole });
    const game = this.games.createGame({
      sessionId: session.id,
      initialFen: normalizedFen,
      source,
      externalId,
    });
    const chess = new Chess(normalizedFen);
    const position = this.games.recordPosition({
      sessionId: session.id,
      gameId: game.id,
      fen: chess.fen(),
      ply: 0,
      sideToMove: sideToMove(chess.turn()),
      phase: 'opening',
    });

    return {
      session,
      game,
      currentPosition: position,
      fen: chess.fen(),
      pgn: chess.pgn(),
      legalMoves: chess.moves(),
    };
  }

  importPgn({
    pgn,
    studentId = null,
    mode = 'pgn-study',
    stationRole = 'hybrid',
    source = 'pgn-import',
    externalId = null,
  } = {}) {
    const parsed = parsePgn(pgn);
    const created = this.createTrainingGame({
      studentId,
      mode,
      stationRole,
      source,
      externalId,
    });
    const chess = new Chess(created.game.initial_fen);
    let positionBefore = created.currentPosition;
    let linkedMove = null;
    const positionsByFen = new Map([[created.currentPosition.fen, created.currentPosition]]);

    this.games.recordPgnHeaders({ gameId: created.game.id, headers: parsed.headers });

    for (const san of parsed.moves) {
      const plyBefore = chess.history().length;
      const applied = chess.move(san);
      if (!applied) {
        throw new InvalidPgnError();
      }
      const plyAfter = plyBefore + 1;
      const move = this.games.appendMove({
        sessionId: created.session.id,
        gameId: created.game.id,
        positionBeforeId: positionBefore.id,
        ply: plyAfter,
        san: applied.san,
        uci: applied.lan,
        fromSquare: applied.from,
        toSquare: applied.to,
        piece: applied.piece,
        capturedPiece: applied.captured,
        promotion: applied.promotion,
        isCheck: chess.inCheck(),
        isMate: chess.isCheckmate(),
        classification: 'unknown',
      });
      const positionAfter = this.games.recordPosition({
        sessionId: created.session.id,
        gameId: created.game.id,
        moveId: move.id,
        fen: chess.fen(),
        ply: plyAfter,
        sideToMove: sideToMove(chess.turn()),
        phase: 'unknown',
      });
      linkedMove = this.games.linkMovePositionAfter({
        moveId: move.id,
        positionAfterId: positionAfter.id,
      });
      positionBefore = positionAfter;
      positionsByFen.set(positionAfter.fen, positionAfter);
    }

    this.games.recordPgnAnnotations({
      gameId: created.game.id,
      annotations: parsed.comments.map((comment) => {
        const position = positionsByFen.get(comment.fen);
        return {
          positionId: position?.id ?? null,
          fen: comment.fen,
          ply: position?.ply ?? null,
          annotationType: 'comment',
          value: comment.comment,
        };
      }),
    });

    const updatedGame = this.games.updateGameNotation({
      gameId: created.game.id,
      pgn: chess.pgn(),
      result: normalizedResult(parsed.headers.Result) !== '*' ? parsed.headers.Result : resultFromChess(chess),
    });

    return {
      session: created.session,
      game: updatedGame,
      lastMove: linkedMove,
      currentPosition: positionBefore,
      fen: chess.fen(),
      pgn: chess.pgn(),
      turn: sideToMove(chess.turn()),
      legalMoves: chess.moves(),
      result: updatedGame.result,
    };
  }

  getGameState(gameId) {
    const timeline = this.games.getGameTimeline(gameId);
    if (!timeline.game) {
      return null;
    }

    const chess = replayGame(timeline.game, timeline.moves);
    const liveResult = resultFromChess(chess);
    return {
      ...timeline,
      fen: chess.fen(),
      pgn: chess.pgn(),
      turn: sideToMove(chess.turn()),
      legalMoves: chess.moves(),
      result: liveResult !== '*' ? liveResult : timeline.game.result,
    };
  }

  listRecentTrainingGames(limit = 8) {
    return this.games.listRecentGames(limit).map((game) => {
      const state = this.getGameState(game.id);
      return {
        sessionId: game.session_id,
        gameId: game.id,
        mode: game.mode,
        stationRole: game.station_role,
        status: game.status,
        createdAt: game.created_at,
        updatedAt: game.updated_at,
        moveCount: game.move_count,
        turn: state?.turn ?? sideToMove(new Chess(game.initial_fen).turn()),
        result: state?.result ?? game.result,
        lastMove: state?.moves.at(-1)?.san ?? null,
      };
    });
  }

  applyMove({ sessionId, gameId, from, to, promotion }) {
    const timeline = this.games.getGameTimeline(gameId);
    if (!timeline.game) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const chess = replayGame(timeline.game, timeline.moves);
    const plyBefore = timeline.moves.length;
    const positionBefore = timeline.positions.find((position) => position.ply === plyBefore)
      ?? this.games.recordPosition({
        sessionId,
        gameId,
        fen: chess.fen(),
        ply: plyBefore,
        sideToMove: sideToMove(chess.turn()),
        phase: 'unknown',
      });

    let applied;
    try {
      applied = chess.move({ from, to, promotion });
    } catch {
      applied = null;
    }

    if (!applied) {
      throw new IllegalMoveError({ from, to, promotion });
    }

    const plyAfter = plyBefore + 1;
    const move = this.games.appendMove({
      sessionId,
      gameId,
      positionBeforeId: positionBefore.id,
      ply: plyAfter,
      san: applied.san,
      uci: applied.lan,
      fromSquare: applied.from,
      toSquare: applied.to,
      piece: applied.piece,
      capturedPiece: applied.captured,
      promotion: applied.promotion,
      isCheck: chess.inCheck(),
      isMate: chess.isCheckmate(),
      classification: 'unknown',
    });

    const positionAfter = this.games.recordPosition({
      sessionId,
      gameId,
      moveId: move.id,
      fen: chess.fen(),
      ply: plyAfter,
      sideToMove: sideToMove(chess.turn()),
      phase: 'unknown',
    });

    const linkedMove = this.games.linkMovePositionAfter({
      moveId: move.id,
      positionAfterId: positionAfter.id,
    });
    const updatedGame = this.games.updateGameNotation({
      gameId,
      pgn: chess.pgn(),
      result: resultFromChess(chess),
    });

    return {
      game: updatedGame,
      move: linkedMove,
      positionBefore,
      positionAfter,
      fen: chess.fen(),
      pgn: chess.pgn(),
      turn: sideToMove(chess.turn()),
      legalMoves: chess.moves(),
      result: resultFromChess(chess),
    };
  }
}
