import { memo } from "react";
import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { TimerClockSnapshot } from "../types";

function formatMs(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  const totalSec = Math.floor(safe / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export const TimerView = memo(function TimerView({ clock }: { clock: TimerClockSnapshot }) {
  if (!clock.enabled) return null;

  return (
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
  );
});
