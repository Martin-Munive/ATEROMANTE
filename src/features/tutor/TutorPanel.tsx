import { BookOpenCheck, Brain, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { useChessGame } from '../../hooks/useChessGame';

interface TutorPanelProps {
  game: ReturnType<typeof useChessGame>;
}

export function TutorPanel({ game }: TutorPanelProps) {
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string>>({});
  const [traceQuery, setTraceQuery] = useState('');
  const lastMove = game.lastMove?.san ?? 'sin jugada';
  const verdict = game.lastError ?? (game.inCheck ? 'Jaque detectado: revisa la seguridad del rey.' : 'Movimiento legal registrado por el árbitro interno.');
  const tutorDepths = [
    { value: 'hint', label: 'Pista' },
    { value: 'tactical', label: 'Táctica' },
    { value: 'strategic', label: 'Plan' },
    { value: 'full-lesson', label: 'Clase' },
  ] as const;
  const reviewResultLabels = {
    again: 'Repetir',
    hard: 'Difícil',
    good: 'Bien',
    easy: 'Fácil',
  } as const;
  const masteryLabels = {
    new: 'nuevo',
    learning: 'en aprendizaje',
    reviewing: 'en revisión',
    stable: 'estable',
    weak: 'débil',
  } as const;

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
        <div className="tutor-controls">
          <label>
            <span>Proveedor</span>
            <select
              onChange={(event) => game.setSelectedTutorProviderId(event.target.value)}
              value={game.selectedTutorProviderId}
            >
              {game.tutorProviders.map((provider) => (
                <option disabled={!provider.enabled} key={provider.id} value={provider.id}>
                  {`${provider.label}${provider.enabled ? '' : ' (pendiente)'}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Modo</span>
            <select
              onChange={(event) => game.setSelectedTutorDepth(event.target.value as typeof game.selectedTutorDepth)}
              value={game.selectedTutorDepth}
            >
              {tutorDepths.map((depth) => (
                <option key={depth.value} value={depth.value}>{depth.label}</option>
              ))}
            </select>
          </label>
        </div>
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
      <div className="lesson-block report-block">
        <h3>Reporte post-partida</h3>
        {game.postGameReportLoading && <p><strong>Actualizando reporte…</strong></p>}
        {!game.postGameReportLoading && game.postGameReportError && <p><strong>{game.postGameReportError}</strong></p>}
        {!game.postGameReportLoading && game.postGameReport && (
          <>
            <dl className="report-grid">
              <div>
                <dt>Jugadas</dt>
                <dd>{game.postGameReport.summary.moveCount}</dd>
              </div>
              <div>
                <dt>Análisis</dt>
                <dd>{game.postGameReport.summary.analyzedPositions}</dd>
              </div>
              <div>
                <dt>Tutor</dt>
                <dd>{game.postGameReport.summary.tutorExplanations}</dd>
              </div>
              <div>
                <dt>Memoria</dt>
                <dd>{game.postGameReport.summary.learningEvents}</dd>
              </div>
              <div>
                <dt>Repasos</dt>
                <dd>{game.postGameReport.summary.reviewItems}</dd>
              </div>
            </dl>
            {game.postGameReport.latestEngine && (
              <p>
                <strong>Motor:</strong> {game.postGameReport.latestEngine.bestMove}
                {' · '}
                {game.postGameReport.latestEngine.scoreLabel}
                {' · '}
                d{game.postGameReport.latestEngine.depth}
              </p>
            )}
            {game.postGameReport.criticalPosition && (
              <>
                <p className="critical-position">
                  <strong>Crítica:</strong>
                  {' '}
                  {game.postGameReport.criticalPosition.san
                    ? `tras ${game.postGameReport.criticalPosition.san}`
                    : `ply ${game.postGameReport.criticalPosition.ply}`}
                  {' · '}
                  {game.postGameReport.criticalPosition.reason}
                  {' · '}
                  {game.postGameReport.criticalPosition.categoryLabel}
                  {' · '}
                  {`severidad ${game.postGameReport.criticalPosition.severityLabel}`}
                </p>
                {game.postGameReport.criticalPositions.length > 1 && (
                  <ul className="critical-list">
                    {game.postGameReport.criticalPositions.slice(1, 3).map((position) => (
                      <li key={position.positionId}>
                        <strong>{position.san ? `tras ${position.san}` : `ply ${position.ply}`}</strong>
                        {` ${position.categoryLabel} · severidad ${position.severityLabel}`}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {game.postGameReport.tutorFocus.length > 0 && (
              <ul className="annotation-list">
                {game.postGameReport.tutorFocus.slice(0, 2).map((focus) => (
                  <li key={focus.label}><strong>Foco x{focus.count}</strong>{focus.label}</li>
                ))}
              </ul>
            )}
            {game.postGameReport.reviewQueue.length > 0 && (
              <ul className="annotation-list review-list">
                {game.postGameReport.reviewQueue.slice(0, 2).map((item) => (
                  <li key={item.id}>
                    <strong>{item.theme}</strong>
                    {[
                      item.nextPromptType,
                      masteryLabels[item.masteryState],
                      item.lastResult ? reviewResultLabels[item.lastResult as keyof typeof reviewResultLabels] : 'pendiente',
                      new Date(item.dueAt).toLocaleDateString('es-CO'),
                    ].join(' · ')}
                    <p className="review-exercise">{item.exercisePrompt}</p>
                    {item.positionFen && (
                      <small className="review-fen">{item.positionFen}</small>
                    )}
                    <textarea
                      aria-label={`Respuesta de repaso ${item.theme}`}
                      onChange={(event) => {
                        setReviewAnswers((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }));
                      }}
                      placeholder="Escribe qué recuerdas, calculas o debes corregir en esta posición."
                      value={reviewAnswers[item.id] ?? item.latestAnswer ?? ''}
                    />
                    {item.latestAnswerAssessment && (
                      <small className="review-assessment">
                        {`Respuesta ${item.latestAnswerAssessment.label} · ${item.latestAnswerAssessment.wordCount} palabras`}
                        {item.latestAnswerAssessment.candidateSignal && (
                          <>
                            {' · '}
                            {`Motor ${item.latestAnswerAssessment.candidateSignal.expectedMove}`}
                            {item.expectedDepth ? ` d${item.expectedDepth}` : ''}
                            {` ${item.latestAnswerAssessment.candidateSignal.matched ? 'mencionado' : 'no mencionado'}`}
                          </>
                        )}
                      </small>
                    )}
                    <div className="review-actions">
                      {Object.entries(reviewResultLabels).map(([result, label]) => (
                        <button
                          disabled={game.reviewResultLoadingId === item.id}
                          key={result}
                          onClick={() => {
                            void game.recordReviewResult(
                              item.id,
                              result as 'again' | 'hard' | 'good' | 'easy',
                              reviewAnswers[item.id] ?? item.latestAnswer ?? '',
                            );
                          }}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p>{game.postGameReport.recommendations[0] ?? 'La partida ya tiene una base minima para revision.'}</p>
            <div className="report-actions">
              <button
                disabled={game.learningEventLoading || game.history.length === 0}
                onClick={() => {
                  void game.createLearningEventFromReport();
                }}
                type="button"
              >
                <BookOpenCheck size={16} />Guardar aprendizaje
              </button>
            </div>
            {game.learningEventError && <p><strong>{game.learningEventError}</strong></p>}
            {game.reviewResultError && <p><strong>{game.reviewResultError}</strong></p>}
            {game.lastLearningEvent && (
              <p className="learning-feedback">
                <strong>{game.lastLearningEvent.theme}</strong>
                {' · '}
                {game.lastLearningEvent.summary}
              </p>
            )}
            <form
              className="trace-search"
              onSubmit={(event) => {
                event.preventDefault();
                void game.searchLearningTrace(traceQuery);
              }}
            >
              <label htmlFor="trace-search-input">Buscar aprendizaje</label>
              <div>
                <input
                  id="trace-search-input"
                  onChange={(event) => setTraceQuery(event.target.value)}
                  placeholder="centro, d2d4, seguridad del rey..."
                  type="search"
                  value={traceQuery}
                />
                <button disabled={game.learningTraceLoading} type="submit">
                  Buscar
                </button>
              </div>
            </form>
            {game.learningTraceError && <p><strong>{game.learningTraceError}</strong></p>}
            {game.learningTraceResults.length > 0 && (
              <ul className="annotation-list trace-results">
                {game.learningTraceResults.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <strong>{item.theme}</strong>
                    {[
                      item.moveSan ? `tras ${item.moveSan}` : item.positionPly !== null ? `ply ${item.positionPly}` : null,
                      item.openingEco ?? item.openingName,
                      item.positionPhase,
                      item.materialSignature,
                      item.positionMatchScore !== null ? `similitud ${item.positionMatchScore}` : null,
                      item.expectedBestMove ? `candidata ${item.expectedBestMove}` : null,
                      item.reviewDueAt ? `repaso ${new Date(item.reviewDueAt).toLocaleDateString('es-CO')}` : null,
                    ].filter(Boolean).join(' · ')}
                    <p>{item.summary}</p>
                    {[...item.pawnStructureTags, ...item.tacticalMotifs, ...item.strategicThemes].length > 0 && (
                      <small className="review-assessment">
                        {[...item.pawnStructureTags, ...item.tacticalMotifs, ...item.strategicThemes].slice(0, 5).join(' · ')}
                      </small>
                    )}
                    {item.positionFen && <small className="review-fen">{item.positionFen}</small>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="lesson-block">
        <h3>PGN</h3>
        <p>{game.pgn || 'La partida aun no tiene movimientos.'}</p>
      </div>
      <div className="tutor-actions">
        <button
          disabled={game.tutorLoading}
          onClick={() => {
            void game.explainWithTutor();
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
