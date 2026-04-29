import { memo } from "react";
import { GAME_CONFIG } from "../constants";
import type { Player } from "../types";
import type { ApiGameMode } from "../api/types";

function playerLabel(p: Player): string {
  return p === GAME_CONFIG.WHITE_PLAYER ? "White" : "Black";
}

function modeLabel(mode: ApiGameMode): string {
  return mode === "pvp" ? "Two players" : "Play vs AI";
}

export const GameInfo = memo(function GameInfo({
  mode,
  turn,
  capturedByWhite,
  capturedByBlack,
  winner,
}: {
  mode: ApiGameMode;
  turn: Player;
  capturedByWhite: number;
  capturedByBlack: number;
  winner: Player | null;
}) {
  if (winner !== null) {
    return (
      <div className="turn winner">
        {modeLabel(mode)}{" "}
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
      {modeLabel(mode)}{" "}
      Turn: {playerLabel(turn)}{" "}
      <span style={{ color: "var(--muted)", fontWeight: 600 }}>
        {" "}
        Captured: White {capturedByWhite}, Black {capturedByBlack}
      </span>
    </div>
  );
});
