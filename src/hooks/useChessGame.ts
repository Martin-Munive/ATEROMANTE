import { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';

export type BoardPieces = Record<string, string>;

interface ApiMove {
  id: string;
  ply: number;
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion?: string | null;
  classification?: string | null;
}

interface ApiGameState {
  sessionId: string;
  gameId: string;
  fen: string;
  pgn: string;
  turn: 'white' | 'black';
  result: string;
  legalMoves: string[];
  moves: ApiMove[];
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4174';

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

function toSquare(square: string) {
  return square as Square;
}

function turnLabel(turn: 'white' | 'black') {
  return turn === 'white' ? 'Blancas' : 'Negras';
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? payload.error ?? 'request_failed');
  }
  return payload;
}

export function useChessGame() {
  const [state, setState] = useState<ApiGameState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    postJson<ApiGameState>(`${apiBaseUrl}/api/sessions`, {
      mode: 'solo-practice',
      stationRole: 'hybrid',
    })
      .then((nextState) => {
        if (active) {
          setState(nextState);
          setLastError(null);
        }
      })
      .catch((error) => {
        if (active) {
          setLastError(`No se pudo conectar con la API local: ${error.message}`);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const chess = useMemo(() => new Chess(state?.fen), [state?.fen]);
  const selectedLegalTargets = useMemo(() => {
    if (!selectedSquare) {
      return new Set<string>();
    }
    return new Set(chess.moves({ square: toSquare(selectedSquare), verbose: true }).map((move) => move.to));
  }, [chess, selectedSquare]);

  const lastMove = state?.moves.at(-1) ?? null;

  async function handleSquare(square: string) {
    setLastError(null);

    if (!state) {
      return null;
    }

    if (!selectedSquare) {
      if (chess.get(toSquare(square))) {
        setSelectedSquare(square);
      }
      return null;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return null;
    }

    if (!selectedLegalTargets.has(square)) {
      if (chess.get(toSquare(square))?.color === chess.turn()) {
        setSelectedSquare(square);
      } else {
        setLastError(`${selectedSquare}-${square} no es legal en la posicion actual.`);
        setSelectedSquare(null);
      }
      return null;
    }

    try {
      const nextState = await postJson<ApiGameState>(`${apiBaseUrl}/api/games/${state.gameId}/moves`, {
        from: selectedSquare,
        to: square,
        promotion: 'q',
      });
      setState(nextState);
      setSelectedSquare(null);
      setLastError(null);
      return nextState.moves.at(-1) ?? null;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Movimiento rechazado por la API local.');
      setSelectedSquare(null);
      return null;
    }
  }

  async function resetGame() {
    setLoading(true);
    setSelectedSquare(null);
    setLastError(null);
    try {
      setState(await postJson<ApiGameState>(`${apiBaseUrl}/api/sessions`, {
        mode: 'solo-practice',
        stationRole: 'hybrid',
      }));
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'No se pudo reiniciar la partida.');
    } finally {
      setLoading(false);
    }
  }

  return {
    pieces: boardPieces(chess),
    selectedSquare,
    selectedLegalTargets,
    lastMove,
    lastError,
    history: state?.moves ?? [],
    fen: state?.fen ?? chess.fen(),
    pgn: state?.pgn ?? '',
    turn: state ? turnLabel(state.turn) : 'Cargando',
    result: state?.result ?? '*',
    legalMoveCount: state?.legalMoves.length ?? 0,
    inCheck: chess.inCheck(),
    isGameOver: chess.isGameOver(),
    loading,
    handleSquare,
    resetGame,
  };
}
