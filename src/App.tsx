import { AppHeader } from './components/AppHeader';
import { Sidebar } from './components/Sidebar';
import { UtilityRail } from './components/UtilityRail';
import { EnginePanel, MoveList, VariationTree } from './features/analysis/AnalysisPanels';
import { ChessBoard } from './features/board/ChessBoard';
import { PlayerPanel } from './features/game/PlayerPanel';
import { TutorPanel } from './features/tutor/TutorPanel';

export function App() {
  return (
    <div className="app">
      <AppHeader />
      <Sidebar />
      <main className="workspace">
        <PlayerPanel />
        <ChessBoard />
        <TutorPanel />
        <UtilityRail />
        <MoveList />
        <EnginePanel />
        <VariationTree />
      </main>
    </div>
  );
}
