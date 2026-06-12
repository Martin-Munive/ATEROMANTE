import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { moves, variations } from '../../data/session';

export function MoveList() {
  return (
    <section className="bottom-panel move-list">
      <div className="panel-heading">
        <span>Línea de jugadas</span>
        <div><button><ChevronLeft size={16} /></button><button><ChevronRight size={16} /></button></div>
      </div>
      <table>
        <tbody>
          {moves.map(([n, white, black]) => (
            <tr className={white === 'Cd5' ? 'current' : ''} key={n}>
              <td>{n}</td>
              <td>{white}</td>
              <td>{black}</td>
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

export function EnginePanel() {
  return (
    <section className="bottom-panel engine-panel">
      <div className="panel-heading">
        <span>Evaluación del motor</span>
        <strong>Profundidad: 22/28 · Stockfish</strong>
      </div>
      <div className="chart">
        <div className="score">+0.58</div>
        <svg viewBox="0 0 420 126" role="img" aria-label="Curva de evaluación">
          <polyline points="0,82 24,72 48,74 72,62 96,65 120,55 144,57 168,51 192,50 216,45 240,55 264,49 288,51 312,61 336,54 360,58 384,62 420,57" />
          <line x1="224" y1="12" x2="224" y2="116" />
        </svg>
      </div>
      <p><strong>Cd5 es excelente.</strong> Mejor jugada: 6... exd4 7. Cxd6+ Axd6 8. e5.</p>
    </section>
  );
}

export function VariationTree() {
  return (
    <section className="bottom-panel variation-tree">
      <div className="panel-heading"><span>Árbol de variantes</span></div>
      <div className="variation-list">
        {variations.map(([score, line], index) => (
          <div className={index === 0 ? 'variation selected' : 'variation'} key={line}>
            <strong>{score}</strong>
            <span>{line}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
