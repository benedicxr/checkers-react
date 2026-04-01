import { memo } from "react";
import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { TimerClockSnapshot } from "../logic/timerReducer";

function formatMs(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  const totalSec = Math.floor(safe / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export const TimerView = memo(
  function TimerView({
    clock,
  }: {
    clock: TimerClockSnapshot;
  }) {
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
  },
  (prev, next) => {
    const a = prev.clock;
    const b = next.clock;
    if (a.enabled !== b.enabled) return false;
    if (a.running !== b.running) return false;
    if (a.activePlayer !== b.activePlayer) return false;

    const aWhiteLow = a.whiteMs <= CLOCK_CONFIG.LOW_TIME_MS;
    const bWhiteLow = b.whiteMs <= CLOCK_CONFIG.LOW_TIME_MS;
    if (aWhiteLow !== bWhiteLow) return false;

    const aBlackLow = a.blackMs <= CLOCK_CONFIG.LOW_TIME_MS;
    const bBlackLow = b.blackMs <= CLOCK_CONFIG.LOW_TIME_MS;
    if (aBlackLow !== bBlackLow) return false;

    const aWhiteSec = Math.floor(a.whiteMs / 1000);
    const bWhiteSec = Math.floor(b.whiteMs / 1000);
    if (aWhiteSec !== bWhiteSec) return false;

    const aBlackSec = Math.floor(a.blackMs / 1000);
    const bBlackSec = Math.floor(b.blackMs / 1000);
    return aBlackSec === bBlackSec;
  },
);
