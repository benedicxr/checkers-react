import { memo } from "react";
import { GAME_CONFIG } from "../constants";
import type { Player } from "../types";

function playerLabel(p: Player): string {
  return p === GAME_CONFIG.WHITE_PLAYER ? "White" : "Black";
}

export const GameInfo = memo(function GameInfo({
  turn,
  capturedByWhite,
  capturedByBlack,
  winner,
}: {
  turn: Player;
  capturedByWhite: number;
  capturedByBlack: number;
  winner: Player | null;
}) {
  if (winner !== null) {
    return (
      <div className="turn winner">
        Game over: {playerLabel(winner)} wins{" "}
        <span style={{ color: "var(--muted)", fontWeight: 600 }}>
          {" "}
          Captured: White {capturedByWhite}, Black {capturedByBlack}
        </span>
      </div>
    );
  }

  return (
    <div className="turn">
      Turn: {playerLabel(turn)}{" "}
      <span style={{ color: "var(--muted)", fontWeight: 600 }}>
        {" "}
        Captured: White {capturedByWhite}, Black {capturedByBlack}
      </span>
    </div>
  );
});
