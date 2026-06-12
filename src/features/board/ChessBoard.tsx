import { boardFiles, boardRanks, highlightedSquares, pieces } from '../../data/session';

export function ChessBoard() {
  return (
    <section className="board-shell" aria-label="Tablero educativo">
      <div className="board">
        <div className="arrow primary" />
        <div className="arrow secondary" />
        {boardFiles.map((file, row) =>
          boardRanks.map((rank, col) => {
            const square = `${rank}${file}`;
            const isLight = (row + col) % 2 === 0;
            const active = highlightedSquares.has(square);
            return (
              <div className={`square ${isLight ? 'light' : 'dark'} ${active ? 'active-square' : ''}`} key={square}>
                {col === 0 && <span className="rank">{file}</span>}
                {row === 7 && <span className="file">{rank}</span>}
                {pieces[square] && <span className="piece">{pieces[square]}</span>}
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}
