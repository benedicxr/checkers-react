import { GAME_CONFIG } from "../constants";
import type { Player } from "../types";

export function GameInfo({ turn }: { turn: Player }) {
  return (
    <div id="turn-indicator" className="turn">
      {turn === GAME_CONFIG.WHITE_PLAYER ? "Turn: White" : "Turn: Black"}
    </div>
  );
}

