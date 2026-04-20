import { Board } from "./components/Board";
import { GameInfo } from "./components/GameInfo";
import { MoveHistory } from "./components/MoveHistory";
import { TimerView } from "./components/TimerView";
import { useCheckers } from "./hooks/useCheckers";

function App() {
  const { snapshot, onCellClick, reset, undo, restart, setActiveMove } = useCheckers();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="title">Checkers</div>
          <div id="turn-indicator">
            {snapshot.gameId ? (
              <GameInfo
                turn={snapshot.turn}
                capturedByWhite={snapshot.capturedByWhite}
                capturedByBlack={snapshot.capturedByBlack}
                winner={snapshot.winner}
              />
            ) : (
              <div className="turn">Click "New game" to create a game.</div>
            )}
            <TimerView clock={snapshot.clock} />
          </div>
          {snapshot.error ? (
            <div className="error-banner" role="alert">
              {snapshot.error}
            </div>
          ) : null}
        </div>

        <div className="actions">
          <button
            className="btn"
            type="button"
            disabled={!snapshot.gameId || snapshot.loading || !snapshot.canUndo}
            onClick={() => undo()}
          >
            Undo
          </button>
          <button className="btn" type="button" disabled={snapshot.loading} onClick={() => reset()}>
            New game
          </button>
          <button className="btn" type="button" disabled={!snapshot.gameId || snapshot.loading} onClick={() => restart()}>
            Restart
          </button>
        </div>
      </header>

      <main className="main">
        {snapshot.gameId ? (
          <>
            <Board
              board={snapshot.board}
              selected={snapshot.selected}
              availableMoves={snapshot.availableMoves}
              capturingPieces={snapshot.capturingPieces}
              activeMovePath={snapshot.activeMovePath}
              onCellClick={onCellClick}
            />
            <MoveHistory moves={snapshot.moves} activeId={snapshot.activeMoveId} onSelect={setActiveMove} />
          </>
        ) : null}
      </main>
    </div>
  );
}

export default App;
