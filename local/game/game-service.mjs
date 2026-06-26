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

  getGameState(gameId) {
    const timeline = this.games.getGameTimeline(gameId);
    if (!timeline.game) {
      return null;
    }

    const chess = replayGame(timeline.game, timeline.moves);
    return {
      ...timeline,
      fen: chess.fen(),
      pgn: chess.pgn(),
      turn: sideToMove(chess.turn()),
      legalMoves: chess.moves(),
      result: resultFromChess(chess),
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
