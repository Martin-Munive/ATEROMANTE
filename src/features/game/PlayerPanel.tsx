import type { useChessGame } from '../../hooks/useChessGame';

interface PlayerPanelProps {
  game: ReturnType<typeof useChessGame>;
}

export function PlayerPanel({ game }: PlayerPanelProps) {
  return (
    <section className="players">
      <div className="player-card top">
        <div className="avatar">MC</div>
        <div><strong>Carlsen, Magnus</strong><span>2835</span></div>
      </div>
      <div className="clock active">27:48 <span>+0.3s</span></div>
      <div className="opening">
        <strong>Siciliana Najdorf</strong>
        <span>Entrenamiento asistido</span>
        <dl>
          <div><dt>Política:</dt><dd>Tutor privado</dd></div>
          <div><dt>Turno:</dt><dd>{game.turn}</dd></div>
          <div><dt>Legal:</dt><dd>{game.legalMoveCount} jugadas</dd></div>
          <div><dt>Resultado:</dt><dd>{game.result}</dd></div>
        </dl>
      </div>
      <div className="player-card bottom">
        <div className="avatar">FC</div>
        <div><strong>Caruana, Fabiano</strong><span>2804</span></div>
      </div>
      <div className="clock">24:17 <span>+0.3s</span></div>
    </section>
  );
}
