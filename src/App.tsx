import { useCheckers } from "./hooks/useCheckers";
import { Board } from "./components/Board";
import { GameInfo } from "./components/GameInfo";
import { MoveHistory } from "./components/MoveHistory";

function App() {
  const { snapshot, onCellClick, reset, undo, setActiveMove } = useCheckers();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="title">Checkers</div>
          <GameInfo
            turn={snapshot.turn}
            capturedByWhite={snapshot.capturedByWhite}
            capturedByBlack={snapshot.capturedByBlack}
            winner={snapshot.winner}
            clock={snapshot.clock}
          />
        </div>

        <div className="actions">
          <button className="btn" type="button" disabled={!snapshot.canUndo} onClick={() => undo()}>
            Undo
          </button>
          <button className="btn" type="button" onClick={() => reset()}>
            New game
          </button>
        </div>
      </header>

      <main className="main">
        <Board
          board={snapshot.board}
          selected={snapshot.selected}
          availableMoves={snapshot.availableMoves}
          capturingPieces={snapshot.capturingPieces}
          activeMovePath={snapshot.activeMovePath}
          onCellClick={onCellClick}
        />
        <MoveHistory moves={snapshot.moves} activeId={snapshot.activeMoveId} onSelect={setActiveMove} />
      </main>
    </div>
  );
}

export default App;
