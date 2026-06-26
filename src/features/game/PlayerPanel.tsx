import type { useChessGame } from '../../hooks/useChessGame';

interface PlayerPanelProps {
  game: ReturnType<typeof useChessGame>;
}

export function PlayerPanel({ game }: PlayerPanelProps) {
  const whitePlayer = game.pgnHeaders.White ?? 'Jugador blanco';
  const blackPlayer = game.pgnHeaders.Black ?? 'Jugador negro';
  const eventLabel = game.pgnHeaders.Event ?? 'Entrenamiento asistido';
  const siteLabel = game.pgnHeaders.Site ?? game.pgnHeaders.Date ?? 'Laboratorio local';

  return (
    <section className="players">
      <div className="player-card top">
        <div className="avatar">N</div>
        <div><strong>{blackPlayer}</strong><span>{game.pgnHeaders.BlackElo ?? 'PGN'}</span></div>
      </div>
      <div className="clock active">27:48 <span>+0.3s</span></div>
      <div className="opening">
        <strong>{eventLabel}</strong>
        <span>{siteLabel}</span>
        <dl>
          <div><dt>Política:</dt><dd>Tutor privado</dd></div>
          <div><dt>Turno:</dt><dd>{game.turn}</dd></div>
          <div><dt>Legal:</dt><dd>{game.legalMoveCount} jugadas</dd></div>
          <div><dt>Resultado:</dt><dd>{game.result}</dd></div>
          {game.pgnHeaders.Round && <div><dt>Ronda:</dt><dd>{game.pgnHeaders.Round}</dd></div>}
        </dl>
      </div>
      <div className="player-card bottom">
        <div className="avatar">B</div>
        <div><strong>{whitePlayer}</strong><span>{game.pgnHeaders.WhiteElo ?? 'PGN'}</span></div>
      </div>
      <div className="clock">24:17 <span>+0.3s</span></div>
    </section>
  );
}
