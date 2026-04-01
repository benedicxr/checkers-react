import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { Player } from "../types";

export type TimerClockSnapshot = Readonly<{
  enabled: boolean;
  whiteMs: number;
  blackMs: number;
  activePlayer: Player;
  running: boolean;
}>;

export type TimerState = Readonly<
  TimerClockSnapshot & {
    lastPerfNowMs: number | null;
    timeoutWinner: Player | null;
  }
>;

export type TimerAction =
  | { type: "SYNC_FROM_GAME"; clock: TimerClockSnapshot; perfNowMs: number }
  | { type: "TICK"; perfNowMs: number }
  | { type: "ACK_TIMEOUT" };

function clampNonNegativeInt(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  if (ms <= 0) return 0;
  return Math.floor(ms);
}

export function createTimerState(clock: TimerClockSnapshot): TimerState {
  return {
    enabled: Boolean(clock.enabled),
    whiteMs: clampNonNegativeInt(clock.whiteMs),
    blackMs: clampNonNegativeInt(clock.blackMs),
    activePlayer: clock.activePlayer,
    running: Boolean(clock.running),
    lastPerfNowMs: null,
    timeoutWinner: null,
  };
}

function winnerFromTimeout(state: TimerState): Player | null {
  if (!state.enabled) return null;
  if (state.whiteMs <= 0) return GAME_CONFIG.BLACK_PLAYER;
  if (state.blackMs <= 0) return GAME_CONFIG.WHITE_PLAYER;
  return null;
}

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "SYNC_FROM_GAME": {
      const base: TimerState = {
        enabled: Boolean(action.clock.enabled),
        whiteMs: clampNonNegativeInt(action.clock.whiteMs),
        blackMs: clampNonNegativeInt(action.clock.blackMs),
        activePlayer: action.clock.activePlayer,
        running: Boolean(action.clock.running),
        lastPerfNowMs: action.clock.running ? action.perfNowMs : null,
        timeoutWinner: null,
      };
      const winner = winnerFromTimeout(base);
      if (winner !== null) return { ...base, running: false, lastPerfNowMs: null, timeoutWinner: winner };
      return base;
    }
    case "ACK_TIMEOUT": {
      if (state.timeoutWinner === null) return state;
      return { ...state, timeoutWinner: null };
    }
    case "TICK": {
      if (!state.enabled || !state.running) return state;
      if (state.lastPerfNowMs === null) return { ...state, lastPerfNowMs: action.perfNowMs };

      const delta = action.perfNowMs - state.lastPerfNowMs;
      if (!Number.isFinite(delta) || delta <= 0) return { ...state, lastPerfNowMs: action.perfNowMs };

      let next: TimerState;
      if (state.activePlayer === GAME_CONFIG.WHITE_PLAYER) {
        next = {
          ...state,
          whiteMs: clampNonNegativeInt(state.whiteMs - delta),
          lastPerfNowMs: action.perfNowMs,
        };
      } else {
        next = {
          ...state,
          blackMs: clampNonNegativeInt(state.blackMs - delta),
          lastPerfNowMs: action.perfNowMs,
        };
      }

      const winner = winnerFromTimeout(next);
      if (winner !== null) {
        return { ...next, running: false, lastPerfNowMs: null, timeoutWinner: winner };
      }

      const prevWhiteSec = Math.floor(state.whiteMs / 1000);
      const prevBlackSec = Math.floor(state.blackMs / 1000);
      const nextWhiteSec = Math.floor(next.whiteMs / 1000);
      const nextBlackSec = Math.floor(next.blackMs / 1000);

      const prevWhiteLow = state.whiteMs <= CLOCK_CONFIG.LOW_TIME_MS;
      const prevBlackLow = state.blackMs <= CLOCK_CONFIG.LOW_TIME_MS;
      const nextWhiteLow = next.whiteMs <= CLOCK_CONFIG.LOW_TIME_MS;
      const nextBlackLow = next.blackMs <= CLOCK_CONFIG.LOW_TIME_MS;

      if (
        prevWhiteSec === nextWhiteSec &&
        prevBlackSec === nextBlackSec &&
        prevWhiteLow === nextWhiteLow &&
        prevBlackLow === nextBlackLow
      ) {
        return state;
      }

      return next;
    }
    default:
      return state;
  }
}

