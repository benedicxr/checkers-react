import { useState } from "react";
import { CheckerModel } from "./models/CheckerModel";
import { Board } from "./components/Board";
import { GameInfo } from "./components/GameInfo";
import { MoveHistory } from "./components/MoveHistory";

function App() {
  const [model] = useState(() => new CheckerModel());

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="title">Checkers</div>
          <GameInfo turn={model.turn} />
        </div>

        <div className="actions">
          <button className="btn" type="button" disabled>
            Undo
          </button>
          <button className="btn" type="button" disabled>
            New game
          </button>
        </div>
      </header>

      <main className="main">
        <Board board={model.board} />
        <MoveHistory moves={[]} />
      </main>
    </div>
  );
}

export default App;
