import { boardFiles, boardRanks } from '../../data/session';
import type { useChessGame } from '../../hooks/useChessGame';

interface ChessBoardProps {
  game: ReturnType<typeof useChessGame>;
}

function arrowCoordinates(bestMove: string | undefined) {
  if (!bestMove || !/^[a-h][1-8][a-h][1-8]/.test(bestMove)) {
    return null;
  }

  const center = (square: string) => ({
    x: ((square.charCodeAt(0) - 97) + 0.5) * 12.5,
    y: ((8 - Number.parseInt(square[1], 10)) + 0.5) * 12.5,
  });

  return { from: center(bestMove.slice(0, 2)), to: center(bestMove.slice(2, 4)) };
}

export function ChessBoard({ game }: ChessBoardProps) {
  const suggestionArrow = arrowCoordinates(game.analysis?.bestMove);

  return (
    <section className="board-shell" aria-label="Tablero educativo">
      <div className="board">
        {boardFiles.map((file, row) =>
          boardRanks.map((rank, col) => {
            const square = `${rank}${file}`;
            const isLight = (row + col) % 2 === 0;
            const selected = game.selectedSquare === square;
            const legalTarget = game.selectedLegalTargets.has(square);
            const lastMoveSquare = game.lastMove?.from === square || game.lastMove?.to === square;
            return (
              <button
                aria-label={`Casilla ${square}${game.pieces[square] ? ` ${game.pieces[square]}` : ''}`}
                className={[
                  'square',
                  isLight ? 'light' : 'dark',
                  selected ? 'selected-square' : '',
                  legalTarget ? 'legal-target' : '',
                  lastMoveSquare ? 'last-move-square' : '',
                ].join(' ')}
                key={square}
                onClick={() => game.handleSquare(square)}
                type="button"
              >
                {col === 0 && <span className="rank">{file}</span>}
                {row === 7 && <span className="file">{rank}</span>}
                {game.pieces[square] && <span className="piece">{game.pieces[square]}</span>}
              </button>
            );
          }),
        )}
        {suggestionArrow && (
          <svg className="analysis-arrow" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <marker id="analysis-arrowhead" markerHeight="3" markerWidth="3" orient="auto" refX="2.4" refY="1.5">
                <path d="M0,0 L3,1.5 L0,3 Z" />
              </marker>
            </defs>
            <line
              x1={suggestionArrow.from.x}
              y1={suggestionArrow.from.y}
              x2={suggestionArrow.to.x}
              y2={suggestionArrow.to.y}
            />
          </svg>
        )}
      </div>
    </section>
  );
}
