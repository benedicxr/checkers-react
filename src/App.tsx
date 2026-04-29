import { Board } from "./components/Board";
import { GameInfo } from "./components/GameInfo";
import { MoveHistory } from "./components/MoveHistory";
import { TimerView } from "./components/TimerView";
import { useCheckers } from "./hooks/useCheckers";

function App() {
  const { snapshot, onCellClick, reset, undo, restart, setActiveMove, setMode } = useCheckers();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="title">Checkers</div>
          <div id="turn-indicator">
            {snapshot.gameId ? (
              <GameInfo
                mode={snapshot.mode}
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
          <div className="mode-switch" role="group" aria-label="Game mode">
            <button
              className={["mode-option", snapshot.mode === "vs_ai" ? "active" : null].filter(Boolean).join(" ")}
              type="button"
              disabled={snapshot.loading}
              onClick={() => setMode("vs_ai")}
            >
              Play vs AI
            </button>
            <button
              className={["mode-option", snapshot.mode === "pvp" ? "active" : null].filter(Boolean).join(" ")}
              type="button"
              disabled={snapshot.loading}
              onClick={() => setMode("pvp")}
            >
              Two players
            </button>
          </div>
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
              interactive={snapshot.isBoardInteractive}
              selected={snapshot.selected}
              availableMoves={snapshot.availableMoves}
              capturingPieces={snapshot.capturingPieces}
              activeMovePath={snapshot.activeMovePath}
              previewMoveId={snapshot.previewMoveId}
              previewMovePath={snapshot.previewMovePath}
              previewMoveCapturedPositions={snapshot.previewMoveCapturedPositions}
              latestMoveId={snapshot.latestMoveId}
              latestMovePath={snapshot.latestMovePath}
              latestMoveCapturedPositions={snapshot.latestMoveCapturedPositions}
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
