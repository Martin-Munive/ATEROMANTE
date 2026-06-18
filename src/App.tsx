import { AppHeader } from './components/AppHeader';
import { Sidebar } from './components/Sidebar';
import { UtilityRail } from './components/UtilityRail';
import { EnginePanel, MoveList, VariationTree } from './features/analysis/AnalysisPanels';
import { ChessBoard } from './features/board/ChessBoard';
import { PlayerPanel } from './features/game/PlayerPanel';
import { TutorPanel } from './features/tutor/TutorPanel';
import { useChessGame } from './hooks/useChessGame';

export function App() {
  const game = useChessGame();

  return (
    <div className="app">
      <AppHeader />
      <Sidebar />
      <main className="workspace">
        <PlayerPanel game={game} />
        <ChessBoard game={game} />
        <TutorPanel game={game} />
        <UtilityRail />
        <MoveList moves={game.history} />
        <EnginePanel game={game} />
        <VariationTree />
      </main>
    </div>
  );
}
