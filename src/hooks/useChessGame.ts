import { useMemo, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';

export type BoardPieces = Record<string, string>;

const pieceGlyphs: Record<string, string> = {
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
};

function buildChess(history: Move[]) {
  const chess = new Chess();
  for (const move of history) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  }
  return chess;
}

function boardPieces(chess: Chess): BoardPieces {
  const pieces: BoardPieces = {};

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) {
        continue;
      }
      pieces[piece.square] = pieceGlyphs[`${piece.color}${piece.type}`];
    }
  }

  return pieces;
}

function resultLabel(chess: Chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? '0-1' : '1-0';
  }
  if (chess.isDraw()) {
    return '1/2-1/2';
  }
  return '*';
}

function turnLabel(chess: Chess) {
  return chess.turn() === 'w' ? 'Blancas' : 'Negras';
}

function toSquare(square: string) {
  return square as Square;
}

export function useChessGame() {
  const [history, setHistory] = useState<Move[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const chess = useMemo(() => buildChess(history), [history]);
  const selectedLegalTargets = useMemo(() => {
    if (!selectedSquare) {
      return new Set<string>();
    }
    return new Set(chess.moves({ square: toSquare(selectedSquare), verbose: true }).map((move) => move.to));
  }, [chess, selectedSquare]);

  const lastMove = history.at(-1) ?? null;

  function handleSquare(square: string) {
    setLastError(null);

    if (!selectedSquare) {
      if (chess.get(toSquare(square))) {
        setSelectedSquare(square);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    try {
      const next = new Chess();
      for (const move of history) {
        next.move({ from: move.from, to: move.to, promotion: move.promotion });
      }
      const move = next.move({ from: selectedSquare, to: square, promotion: 'q' });
      setHistory(next.history({ verbose: true }));
      setSelectedSquare(null);
      setLastError(null);
      return move;
    } catch {
      if (chess.get(toSquare(square))?.color === chess.turn()) {
        setSelectedSquare(square);
      } else {
        setLastError(`${selectedSquare}-${square} no es legal en la posicion actual.`);
        setSelectedSquare(null);
      }
      return null;
    }
  }

  function resetGame() {
    setHistory([]);
    setSelectedSquare(null);
    setLastError(null);
  }

  return {
    pieces: boardPieces(chess),
    selectedSquare,
    selectedLegalTargets,
    lastMove,
    lastError,
    history,
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: turnLabel(chess),
    result: resultLabel(chess),
    legalMoveCount: chess.moves().length,
    inCheck: chess.inCheck(),
    isGameOver: chess.isGameOver(),
    handleSquare,
    resetGame,
  };
}
