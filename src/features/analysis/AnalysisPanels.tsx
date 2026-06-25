import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { useChessGame } from '../../hooks/useChessGame';

interface MoveListProps {
  moves: ReturnType<typeof useChessGame>['history'];
}

export function MoveList({ moves }: MoveListProps) {
  const rows = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      number: `${Math.floor(index / 2) + 1}.`,
      white: moves[index]?.san ?? '',
      black: moves[index + 1]?.san ?? '',
      current: index + 1 >= moves.length - 1,
    });
  }

  return (
    <section className="bottom-panel move-list">
      <div className="panel-heading">
        <span>Línea de jugadas</span>
        <div><button><ChevronLeft size={16} /></button><button><ChevronRight size={16} /></button></div>
      </div>
      <table>
        <tbody>
          {(rows.length > 0 ? rows : [{ number: '1.', white: 'Inicio', black: '', current: true }]).map((row) => (
            <tr className={row.current ? 'current' : ''} key={row.number}>
              <td>{row.number}</td>
              <td>{row.white}</td>
              <td>{row.black}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="playback">
        <button>⏮</button><button>◀</button><button className="gold"><Play size={17} /></button><button>▶</button><button>⏭</button>
      </div>
    </section>
  );
}

interface EnginePanelProps {
  game: ReturnType<typeof useChessGame>;
}

export function EnginePanel({ game }: EnginePanelProps) {
  const score = game.analysis?.score.type === 'mate'
    ? `M${game.analysis.score.value}`
    : game.analysis?.score.value === null || game.analysis?.score.value === undefined
      ? '--'
      : `${game.analysis.score.value >= 0 ? '+' : ''}${(game.analysis.score.value / 100).toFixed(2)}`;

  return (
    <section className="bottom-panel engine-panel">
      <div className="panel-heading">
        <span>Evaluación del motor</span>
        <strong>{game.analysis?.engineName ?? 'Motor UCI externo'}</strong>
      </div>
      <div className="chart">
        <div className="score">{score}</div>
        <svg viewBox="0 0 420 126" role="img" aria-label="Curva de evaluación">
          <polyline points="0,64 420,64" />
        </svg>
      </div>
      <div className="engine-actions">
        <p aria-live="polite">
          {game.analysisLoading && <strong>Analizando la posición…</strong>}
          {!game.analysisLoading && game.analysis && (
            <><strong>Mejor jugada: {game.analysis.bestMove}</strong> Profundidad {game.analysis.depth}, perspectiva del lado al turno.</>
          )}
          {!game.analysisLoading && game.analysisError && <strong className="engine-error">{game.analysisError}</strong>}
          {!game.analysisLoading && !game.analysis && !game.analysisError && <strong>Sin evaluación todavía.</strong>}
        </p>
        <button
          disabled={game.loading || game.analysisLoading}
          onClick={() => game.analyzePosition()}
          type="button"
        >
          {game.analysisLoading ? 'Analizando…' : 'Analizar posición'}
        </button>
      </div>
    </section>
  );
}

interface VariationTreeProps {
  game: ReturnType<typeof useChessGame>;
}

export function VariationTree({ game }: VariationTreeProps) {
  const variation = game.analysis?.principalVariation.join(' ') ?? 'Variantes del motor pendientes de análisis.';

  return (
    <section className="bottom-panel variation-tree">
      <div className="panel-heading"><span>Árbol de variantes</span></div>
      <div className="variation-list">
        <div className="variation selected">
          <strong>{game.analysis ? `d${game.analysis.depth}` : '--'}</strong>
          <span>{variation}</span>
        </div>
      </div>
    </section>
  );
}
