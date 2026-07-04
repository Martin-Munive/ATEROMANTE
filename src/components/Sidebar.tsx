import { useState } from 'react';
import { FileInput, Gauge } from 'lucide-react';
import { navigation } from '../data/session';
import type { useChessGame } from '../hooks/useChessGame';

interface SidebarProps {
  game: ReturnType<typeof useChessGame>;
}

function formatSessionLabel(value: string) {
  return value.replaceAll('-', ' ');
}

export function Sidebar({ game }: SidebarProps) {
  const [fenInput, setFenInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');

  async function handleFenImport() {
    const imported = await game.importFen(fenInput);
    if (imported) {
      setFenInput('');
    }
  }

  async function handlePgnImport() {
    const imported = await game.importPgn(pgnInput);
    if (imported) {
      setPgnInput('');
    }
  }

  async function handlePgnFileImport(file: File | null) {
    if (!file) {
      return;
    }
    const pgn = await file.text();
    const imported = await game.importPgn(pgn, {
      sourceType: 'file',
      fileName: file.name,
      mimeType: file.type || 'application/x-chess-pgn',
      byteSize: file.size,
    });
    if (imported) {
      setPgnInput('');
    }
  }

  return (
    <aside className="sidebar">
      <nav>
        {navigation.map(({ icon: Icon, label }) => (
          <button className={label === 'Partida' ? 'selected' : ''} key={label}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
      <div className="profile-panel">
        <div className="profile-title"><Gauge size={18} />Estado local</div>
        <dl>
          <div><dt>Partida</dt><dd>{game.history.length} jugadas</dd></div>
          <div><dt>Turno</dt><dd>{game.turn}</dd></div>
          <div><dt>Resultado</dt><dd>{game.result}</dd></div>
        </dl>
      </div>
      <section className="fen-import-panel" aria-label="Importar posición FEN">
        <div className="history-title"><FileInput size={18} />Importar FEN</div>
        <textarea
          aria-label="Posición FEN"
          onChange={(event) => setFenInput(event.target.value)}
          placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          rows={4}
          value={fenInput}
        />
        {game.fenImportError && <small className="history-error">{game.fenImportError}</small>}
        <button disabled={game.fenImportLoading} onClick={handleFenImport} type="button">
          {game.fenImportLoading ? 'Importando...' : 'Abrir posición'}
        </button>
      </section>
      <section className="pgn-import-panel" aria-label="Importar partida PGN">
        <div className="history-title"><FileInput size={18} />Importar PGN</div>
        <textarea
          aria-label="Partida PGN"
          onChange={(event) => setPgnInput(event.target.value)}
          placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"
          rows={5}
          value={pgnInput}
        />
        <input
          accept=".pgn,application/x-chess-pgn,text/plain"
          aria-label="Archivo PGN"
          disabled={game.pgnImportLoading}
          onChange={(event) => {
            void handlePgnFileImport(event.target.files?.[0] ?? null);
            event.target.value = '';
          }}
          type="file"
        />
        {game.pgnImportError && <small className="history-error">{game.pgnImportError}</small>}
        <button disabled={game.pgnImportLoading} onClick={handlePgnImport} type="button">
          {game.pgnImportLoading ? 'Importando...' : 'Abrir PGN'}
        </button>
      </section>
      <section className="history-panel" aria-label="Historial de sesiones">
        <div className="history-title"><Gauge size={18} />Historial</div>
        {game.sessionsLoading && <small>Cargando sesiones...</small>}
        {game.sessionsError && <small className="history-error">{game.sessionsError}</small>}
        {!game.sessionsLoading && game.recentSessions.length === 0 && <small>Sin sesiones guardadas.</small>}
        <div className="history-list">
          {game.recentSessions.map((session) => (
            <button
              className={session.gameId === game.currentGameId ? 'selected-session' : ''}
              key={session.gameId}
              onClick={() => game.loadGame(session.gameId)}
              type="button"
            >
              <span>{formatSessionLabel(session.mode)}</span>
              <strong>{session.moveCount} jugadas</strong>
              <small>{session.lastMove ? `Última: ${session.lastMove}` : 'Inicio'}</small>
            </button>
          ))}
        </div>
      </section>
      <small className="version">Versión 0.0.1</small>
    </aside>
  );
}
