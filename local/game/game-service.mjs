import { createHash } from 'node:crypto';
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

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function sanitizeSourceFileName(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const fileName = value.split(/[\\/]/).at(-1)?.trim() ?? '';
  return fileName ? fileName.slice(0, 255) : null;
}

function normalizePgnSourceMetadata(pgn, sourceMetadata = {}) {
  const sourceType = sourceMetadata.sourceType === 'file' ? 'file' : 'text';
  const byteSize = Number.isInteger(sourceMetadata.byteSize) && sourceMetadata.byteSize >= 0
    ? sourceMetadata.byteSize
    : Buffer.byteLength(pgn, 'utf8');

  return {
    sourceType,
    fileName: sourceType === 'file' ? sanitizeSourceFileName(sourceMetadata.fileName) : null,
    mimeType: typeof sourceMetadata.mimeType === 'string' && sourceMetadata.mimeType.trim()
      ? sourceMetadata.mimeType.trim().slice(0, 120)
      : null,
    byteSize,
    pgnSha256: sha256(pgn),
  };
}

const SUFFIX_TO_NAG = {
  '!': '$1',
  '?': '$2',
  '!!': '$3',
  '??': '$4',
  '!?': '$5',
  '?!': '$6',
};

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

function removeVariations(input) {
  let depth = 0;
  let output = '';
  for (const character of input) {
    if (character === '(') {
      depth += 1;
      output += ' ';
      continue;
    }
    if (character === ')') {
      depth = Math.max(0, depth - 1);
      output += ' ';
      continue;
    }
    if (depth === 0) {
      output += character;
    }
  }
  return output;
}

function tokenizeMainLinePgn(pgn) {
  return removeVariations(pgn)
    .replace(/^\s*\[[^\]]+\]\s*$/gm, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\r\n]*/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizePgnToken(token) {
  if (!token || ['1-0', '0-1', '1/2-1/2', '*'].includes(token) || /^\$\d+$/.test(token)) {
    return null;
  }
  const suffix = token.match(/(!!|\?\?|!\?|\?!|!|\?)$/)?.[0] ?? null;
  return suffix ? token.slice(0, -suffix.length) : token;
}

function parseNagAnnotations(pgn) {
  const chess = new Chess();
  const annotations = [];
  let currentFen = null;
  let currentPly = null;

  for (const token of tokenizeMainLinePgn(pgn)) {
    if (['1-0', '0-1', '1/2-1/2', '*'].includes(token)) {
      continue;
    }

    if (/^\$\d+$/.test(token)) {
      if (currentFen && currentPly !== null) {
        annotations.push({ fen: currentFen, ply: currentPly, value: token });
      }
      continue;
    }

    const suffix = token.match(/(!!|\?\?|!\?|\?!|!|\?)$/)?.[0] ?? null;
    const san = normalizePgnToken(token);
    if (!san) {
      continue;
    }
    let applied = null;
    try {
      applied = chess.move(san);
    } catch {
      applied = null;
    }
    if (!applied) {
      continue;
    }

    currentFen = chess.fen();
    currentPly = chess.history().length;
    if (suffix) {
      annotations.push({ fen: currentFen, ply: currentPly, value: SUFFIX_TO_NAG[suffix] });
    }
  }

  return annotations;
}

function normalizeVariationText(input) {
  return input
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\r\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function variationSanLine(input) {
  return normalizeVariationText(removeVariations(input))
    .split(/\s+/)
    .filter((token) => token && !/^\d+\.(\.\.)?$/.test(token))
    .map(normalizePgnToken)
    .filter(Boolean)
    .join(' ');
}

function variationTokensFromSanLine(sanLine) {
  return sanLine.split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

function sanMovesToPgn(sanMoves) {
  const turns = [];
  for (let index = 0; index < sanMoves.length; index += 2) {
    const moveNumber = Math.floor(index / 2) + 1;
    const white = sanMoves[index] ?? '';
    const black = sanMoves[index + 1] ?? '';
    turns.push(`${moveNumber}. ${white}${black ? ` ${black}` : ''}`);
  }
  return turns.join(' ');
}

function collectVariationBody(source, startIndex) {
  let depth = 1;
  let raw = '';
  let index = startIndex;
  for (; index < source.length && depth > 0; index += 1) {
    const inner = source[index];
    if (inner === '(') {
      depth += 1;
    } else if (inner === ')') {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    }
    raw += inner;
  }
  return { raw, endIndex: index };
}

function parseNestedPgnVariations({
  source,
  parentFen,
  parentPly,
  parentVariationIndex,
  depth,
  variations,
}) {
  const chess = new Chess(parentFen);
  let token = '';
  let currentFen = parentFen;
  let currentPly = parentPly;
  let previousFen = currentFen;
  let previousPly = currentPly;
  let inComment = false;
  let inSemicolonComment = false;

  function applyBranchToken() {
    const rawToken = token.trim();
    token = '';
    if (!rawToken || /^\d+\.(\.\.)?$/.test(rawToken)) {
      return;
    }
    const san = normalizePgnToken(rawToken);
    if (!san) {
      return;
    }
    try {
      previousFen = currentFen;
      previousPly = currentPly;
      const move = chess.move(san);
      if (move) {
        currentFen = chess.fen();
        currentPly += 1;
      }
    } catch {
      // Nested branch preservation is best-effort after the root PGN is accepted.
    }
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inSemicolonComment) {
      if (character === '\n' || character === '\r') {
        inSemicolonComment = false;
      }
      continue;
    }
    if (inComment) {
      if (character === '}') {
        inComment = false;
      }
      continue;
    }
    if (character === ';') {
      applyBranchToken();
      inSemicolonComment = true;
      continue;
    }
    if (character === '{') {
      applyBranchToken();
      inComment = true;
      continue;
    }
    if (character === '(') {
      applyBranchToken();
      const collected = collectVariationBody(source, index + 1);
      index = collected.endIndex;
      const rawPgn = normalizeVariationText(collected.raw);
      if (rawPgn) {
        const variationIndex = variations.length;
        variations.push({
          parentFen: previousFen,
          parentPly: previousPly,
          parentVariationIndex,
          variationIndex,
          depth,
          sanLine: variationSanLine(rawPgn),
          rawPgn,
        });
        parseNestedPgnVariations({
          source: collected.raw,
          parentFen: previousFen,
          parentPly: previousPly,
          parentVariationIndex: variationIndex,
          depth: depth + 1,
          variations,
        });
      }
      continue;
    }
    if (/\s/.test(character)) {
      applyBranchToken();
      continue;
    }
    token += character;
  }
  applyBranchToken();
}

function parsePgnVariations(pgn) {
  const source = pgn.replace(/^\s*\[[^\]]+\]\s*$/gm, ' ');
  const chess = new Chess();
  const variations = [];
  let token = '';
  let currentFen = chess.fen();
  let currentPly = 0;
  let previousFen = currentFen;
  let previousPly = currentPly;
  let inComment = false;
  let inSemicolonComment = false;

  function applyMainToken() {
    const rawToken = token.trim();
    token = '';
    if (!rawToken || /^\d+\.(\.\.)?$/.test(rawToken)) {
      return;
    }
    const san = normalizePgnToken(rawToken);
    if (!san) {
      return;
    }
    try {
      previousFen = currentFen;
      previousPly = currentPly;
      const move = chess.move(san);
      if (move) {
        currentFen = chess.fen();
        currentPly = chess.history().length;
      }
    } catch {
      // Main-line legality is validated by chess.js loadPgn before persistence.
    }
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inSemicolonComment) {
      if (character === '\n' || character === '\r') {
        inSemicolonComment = false;
      }
      continue;
    }
    if (inComment) {
      if (character === '}') {
        inComment = false;
      }
      continue;
    }
    if (character === ';') {
      applyMainToken();
      inSemicolonComment = true;
      continue;
    }
    if (character === '{') {
      applyMainToken();
      inComment = true;
      continue;
    }
    if (character === '(') {
      applyMainToken();
      const collected = collectVariationBody(source, index + 1);
      index = collected.endIndex;
      const raw = collected.raw;
      const rawPgn = normalizeVariationText(raw);
      if (rawPgn) {
        const variationIndex = variations.length;
        variations.push({
          parentFen: previousFen,
          parentPly: previousPly,
          parentVariationIndex: null,
          variationIndex,
          depth: 1,
          sanLine: variationSanLine(rawPgn),
          rawPgn,
        });
        parseNestedPgnVariations({
          source: raw,
          parentFen: previousFen,
          parentPly: previousPly,
          parentVariationIndex: variationIndex,
          depth: 2,
          variations,
        });
      }
      continue;
    }
    if (/\s/.test(character)) {
      applyMainToken();
      continue;
    }

    token += character;
  }
  applyMainToken();

  return variations;
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
      nags: parseNagAnnotations(pgn),
      variations: parsePgnVariations(pgn),
      moves,
    };
  } catch (error) {
    if (error instanceof InvalidPgnError) {
      throw error;
    }
    throw new InvalidPgnError();
  }
}

function buildVariationMainLine({ mainMoves, variations, variationIndex }) {
  const byIndex = new Map(variations.map((variation) => [variation.variation_index, variation]));
  const selected = byIndex.get(variationIndex);
  if (!selected) {
    throw new InvalidPgnError('PGN variation was not found');
  }

  function prefixFor(variation) {
    if (variation.parent_variation_index === null || variation.parent_variation_index === undefined) {
      return mainMoves.slice(0, variation.parent_ply ?? 0);
    }

    const parent = byIndex.get(variation.parent_variation_index);
    if (!parent) {
      return mainMoves.slice(0, variation.parent_ply ?? 0);
    }
    const parentPrefix = prefixFor(parent);
    const parentAnchorPly = parent.parent_ply ?? parentPrefix.length;
    const branchPliesToAnchor = Math.max(0, (variation.parent_ply ?? parentAnchorPly) - parentAnchorPly);
    return parentPrefix.concat(variationTokensFromSanLine(parent.san_line).slice(0, branchPliesToAnchor));
  }

  return prefixFor(selected).concat(variationTokensFromSanLine(selected.san_line));
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
    sourceMetadata = {},
    studentId = null,
    mode = 'pgn-study',
    stationRole = 'hybrid',
    source = 'pgn-import',
    externalId = null,
  } = {}) {
    const parsed = parsePgn(pgn);
    const normalizedSource = normalizePgnSourceMetadata(pgn.trim(), sourceMetadata);
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
    this.games.recordPgnSource({ gameId: created.game.id, ...normalizedSource });

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
      }).concat(parsed.nags.map((nag) => {
        const position = positionsByFen.get(nag.fen);
        return {
          positionId: position?.id ?? null,
          fen: nag.fen,
          ply: position?.ply ?? nag.ply,
          annotationType: 'nag',
          value: nag.value,
        };
      })),
    });
    this.games.recordPgnVariations({
      gameId: created.game.id,
      variations: parsed.variations,
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

  createStudyFromVariation({ gameId, variationIndex }) {
    const timeline = this.games.getGameTimeline(gameId);
    if (!timeline.game) {
      throw new Error(`Game not found: ${gameId}`);
    }
    const selectedIndex = Number.parseInt(String(variationIndex), 10);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
      throw new InvalidPgnError('PGN variation index is invalid');
    }

    const sanMoves = buildVariationMainLine({
      mainMoves: timeline.moves.map((move) => move.san),
      variations: timeline.pgnVariations,
      variationIndex: selectedIndex,
    });

    return this.importPgn({
      pgn: sanMovesToPgn(sanMoves),
      mode: 'variation-study',
      source: 'pgn-variation',
      externalId: `${gameId}:${selectedIndex}`,
      sourceMetadata: {
        sourceType: 'text',
      },
    });
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
