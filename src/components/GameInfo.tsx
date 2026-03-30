import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { Player } from "../types";

function playerLabel(p: Player): string {
  return p === GAME_CONFIG.WHITE_PLAYER ? "White" : "Black";
}

function formatMs(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  const totalSec = Math.floor(safe / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export function GameInfo({
  turn,
  capturedByWhite,
  capturedByBlack,
  winner,
  clock,
}: {
  turn: Player;
  capturedByWhite: number;
  capturedByBlack: number;
  winner: Player | null;
  clock: {
    enabled: boolean;
    whiteMs: number;
    blackMs: number;
    activePlayer: Player;
    running: boolean;
  };
}) {
  const isWinner = winner !== null;

  return (
    <div id="turn-indicator">
      <div className={["turn", isWinner ? "winner" : null].filter(Boolean).join(" ")}>
        {isWinner ? `Game over: ${playerLabel(winner!)} wins` : `Turn: ${playerLabel(turn)}`}{" "}
        <span style={{ color: "var(--muted)", fontWeight: 600 }}>
          {" "}
          Captured: White {capturedByWhite}, Black {capturedByBlack}
        </span>
      </div>

      {clock.enabled ? (
        <div className="clocks" aria-label="Game clock">
          <div
            className={[
              "clock",
              clock.running && clock.activePlayer === GAME_CONFIG.WHITE_PLAYER ? "active" : null,
              clock.whiteMs <= CLOCK_CONFIG.LOW_TIME_MS ? "low" : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            White {formatMs(clock.whiteMs)}
          </div>
          <div
            className={[
              "clock",
              clock.running && clock.activePlayer === GAME_CONFIG.BLACK_PLAYER ? "active" : null,
              clock.blackMs <= CLOCK_CONFIG.LOW_TIME_MS ? "low" : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Black {formatMs(clock.blackMs)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
