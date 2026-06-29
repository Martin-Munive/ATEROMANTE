import { Brain, ChevronLeft, ChevronRight } from 'lucide-react';
import type { useChessGame } from '../../hooks/useChessGame';

interface TutorPanelProps {
  game: ReturnType<typeof useChessGame>;
}

export function TutorPanel({ game }: TutorPanelProps) {
  const lastMove = game.lastMove?.san ?? 'sin jugada';
  const verdict = game.lastError ?? (game.inCheck ? 'Jaque detectado: revisa la seguridad del rey.' : 'Movimiento legal registrado por el árbitro interno.');

  return (
    <section className="tutor-panel">
      <div className="panel-heading">
        <span>Tutor</span>
        <strong><Brain size={18} />Clase magistral</strong>
      </div>
      <div className="move-verdict">
        <div className="star">★</div>
        <div>
          <strong>{game.lastMove ? `${lastMove} registrada` : 'Partida lista'}</strong>
          <span>{game.turn} juegan</span>
        </div>
      </div>
      <p>
        {verdict}
      </p>
      <ul>
        <li>FEN actual disponible para motor, tutor y persistencia.</li>
        <li>PGN real generado por reglas determinísticas.</li>
        <li>El LLM todavía no valida reglas: solo explicará contexto preparado.</li>
      </ul>
      <div className="lesson-block">
        <h3>FEN</h3>
        <p>
          {game.fen}
        </p>
      </div>
      {game.pgnAnnotations.length > 0 && (
        <div className="lesson-block">
          <h3>Comentarios PGN</h3>
          <ul className="annotation-list">
            {game.pgnAnnotations.slice(0, 3).map((annotation) => (
              <li key={annotation.id}>
                <strong>{annotation.ply === 0 ? 'Inicio' : `Jugada ${annotation.ply ?? '-'}`}</strong>
                {annotation.annotationType === 'nag' ? `NAG ${annotation.value}` : annotation.value}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="lesson-block">
        <h3>PGN</h3>
        <p>{game.pgn || 'La partida aun no tiene movimientos.'}</p>
      </div>
      <div className="tutor-actions">
        <button><ChevronLeft size={16} />Anterior</button>
        <span>{game.history.length} jugadas</span>
        <button onClick={game.resetGame} type="button">Reiniciar <ChevronRight size={16} /></button>
      </div>
    </section>
  );
}
