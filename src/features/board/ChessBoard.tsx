import { boardFiles, boardRanks } from '../../data/session';
import type { useChessGame } from '../../hooks/useChessGame';

interface ChessBoardProps {
  game: ReturnType<typeof useChessGame>;
}

export function ChessBoard({ game }: ChessBoardProps) {
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
      </div>
    </section>
  );
}
