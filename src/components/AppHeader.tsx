import { Download, MoreHorizontal, Save, Sparkles } from 'lucide-react';
import { trainingSession } from '../data/session';
import type { useChessGame } from '../hooks/useChessGame';

interface AppHeaderProps {
  game: ReturnType<typeof useChessGame>;
}

export function AppHeader({ game }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark">♞</div>
        <div>
          <h1>ATEROMANTE</h1>
          <span>Laboratorio de entrenamiento</span>
        </div>
      </div>
      <div className="session-card wide">
        <span>Sesión actual</span>
        <strong>{trainingSession.mode}</strong>
        <small>{trainingSession.tutorPolicy}</small>
      </div>
      <div className="session-card">
        <span>Asistencia</span>
        <strong className="positive">{trainingSession.assistanceLevel}</strong>
        <small>LLM: {trainingSession.llmProviderId}</small>
      </div>
      <div className="session-card">
        <span>Estación</span>
        <strong>Cliente jugador</strong>
        <small>{trainingSession.moderatorState}</small>
      </div>
      <div className="mode-switch" aria-label="Modo tutor">
        <span>Modo tutor</span>
        <button>Silencio</button>
        <button>Pista</button>
        <button>Táctica</button>
        <button className="active">Clase</button>
      </div>
      <div className="header-actions" aria-label="Acciones">
        <button title="Nuevo"><Sparkles size={18} />Nuevo</button>
        <button title="Guardar"><Save size={18} />Guardar</button>
        <button
          disabled={game.loading}
          onClick={() => {
            void game.exportPgn();
          }}
          title="Exportar PGN"
          type="button"
        >
          <Download size={18} />Exportar
        </button>
        <button title="Más"><MoreHorizontal size={18} />Más</button>
      </div>
      <div className="creator-credit" aria-label="Autor de la aplicación">
        <div className="creator-copy">
          <strong>Martin Munive</strong>
          <span>Médico general</span>
          <span>Analista y programador de software</span>
        </div>
        <img className="creator-logo" src="/brand/Logofrontletra.svg" alt="ANASKAI" />
      </div>
    </header>
  );
}
