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
  return (
    <section className="bottom-panel engine-panel">
      <div className="panel-heading">
        <span>Evaluación del motor</span>
        <strong>Stockfish pendiente</strong>
      </div>
      <div className="chart">
        <div className="score">--</div>
        <svg viewBox="0 0 420 126" role="img" aria-label="Curva de evaluación">
          <polyline points="0,64 420,64" />
        </svg>
      </div>
      <p><strong>{game.lastMove ? `${game.lastMove.san} registrada.` : 'Sin evaluación todavía.'}</strong> El motor UCI se conectará en un slice posterior.</p>
    </section>
  );
}

export function VariationTree() {
  return (
    <section className="bottom-panel variation-tree">
      <div className="panel-heading"><span>Árbol de variantes</span></div>
      <div className="variation-list">
        <div className="variation selected">
          <strong>--</strong>
          <span>Variantes del motor pendientes de conexión.</span>
        </div>
      </div>
    </section>
  );
}
