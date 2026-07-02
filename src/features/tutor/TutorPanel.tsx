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
        <li>El tutor explica contexto preparado; no valida reglas ni genera jugadas legales.</li>
      </ul>
      <div className="lesson-block">
        <h3>Explicación del tutor</h3>
        {game.tutorLoading && <p><strong>Preparando explicación…</strong></p>}
        {!game.tutorLoading && game.tutorError && <p><strong>{game.tutorError}</strong></p>}
        {!game.tutorLoading && game.tutorExplanation && (
          <>
            <p>{game.tutorExplanation.summary}</p>
            <ul className="annotation-list">
              <li><strong>Proveedor</strong>{game.tutorExplanation.provider.label}</li>
              <li><strong>Confianza</strong>{game.tutorExplanation.confidence}</li>
              {game.tutorExplanation.candidateMove && (
                <li><strong>Candidata</strong>{game.tutorExplanation.candidateMove}</li>
              )}
              {game.tutorExplanation.teachingFocus.slice(0, 3).map((focus) => (
                <li key={focus}><strong>Foco</strong>{focus}</li>
              ))}
            </ul>
          </>
        )}
        {!game.tutorLoading && !game.tutorExplanation && !game.tutorError && (
          <p>Solicita una explicación cuando quieras revisar la posición actual.</p>
        )}
      </div>
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
        <button
          disabled={game.tutorLoading}
          onClick={() => {
            void game.explainWithTutor('hint');
          }}
          type="button"
        >
          <ChevronLeft size={16} />Explicar
        </button>
        <span>{game.history.length} jugadas</span>
        <button onClick={game.resetGame} type="button">Reiniciar <ChevronRight size={16} /></button>
      </div>
    </section>
  );
}
