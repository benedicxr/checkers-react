import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { Player, SerializableTimerState, TimerAction, TimerClockSnapshot, TimerState } from "../types";

function clampNonNegativeInt(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  if (ms <= 0) return 0;
  return Math.floor(ms);
}

export function createTimerState(clock: TimerClockSnapshot): TimerState {
  const base: TimerState = {
    enabled: Boolean(clock.enabled),
    initialMs: clampNonNegativeInt(clock.initialMs),
    whiteMs: clampNonNegativeInt(clock.whiteMs),
    blackMs: clampNonNegativeInt(clock.blackMs),
    activePlayer: clock.activePlayer,
    running: Boolean(clock.running),
    lastPerfNowMs: null,
    timeoutWinner: null,
  };
  const winner = winnerFromTimeout(base);
  return winner ? { ...base, running: false, timeoutWinner: winner } : base;
}

function winnerFromTimeout(state: TimerState): Player | null {
  if (!state.enabled) return null;
  if (state.whiteMs <= 0) return GAME_CONFIG.BLACK_PLAYER;
  if (state.blackMs <= 0) return GAME_CONFIG.WHITE_PLAYER;
  return null;
}

function tickInternal(state: TimerState, perfNowMs: number): TimerState {
  if (!state.enabled || !state.running) return state;
  if (state.lastPerfNowMs === null) return { ...state, lastPerfNowMs: perfNowMs };

  const delta = perfNowMs - state.lastPerfNowMs;
  if (!Number.isFinite(delta) || delta <= 0) return { ...state, lastPerfNowMs: perfNowMs };

  if (state.activePlayer === GAME_CONFIG.WHITE_PLAYER) {
    return { ...state, whiteMs: clampNonNegativeInt(state.whiteMs - delta), lastPerfNowMs: perfNowMs };
  }
  return { ...state, blackMs: clampNonNegativeInt(state.blackMs - delta), lastPerfNowMs: perfNowMs };
}

export function exportSerializableTimerState(state: TimerState, unixNowMs: number): SerializableTimerState {
  return {
    enabled: Boolean(state.enabled),
    initialMs: clampNonNegativeInt(state.initialMs),
    whiteMs: clampNonNegativeInt(state.whiteMs),
    blackMs: clampNonNegativeInt(state.blackMs),
    activePlayer: state.activePlayer,
    running: Boolean(state.running) && winnerFromTimeout(state) === null,
    lastUpdateUnixMs: clampNonNegativeInt(unixNowMs),
  };
}

export function importSerializableTimerState(
  raw: unknown,
  perfNowMs: number,
  unixNowMs: number,
): TimerState | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const s = raw as Partial<SerializableTimerState>;
    if (typeof s.enabled !== "boolean") return null;
    if (typeof s.initialMs !== "number" || !Number.isFinite(s.initialMs) || s.initialMs < 0) return null;
    if (typeof s.whiteMs !== "number" || !Number.isFinite(s.whiteMs) || s.whiteMs < 0) return null;
    if (typeof s.blackMs !== "number" || !Number.isFinite(s.blackMs) || s.blackMs < 0) return null;
    if (s.activePlayer !== GAME_CONFIG.WHITE_PLAYER && s.activePlayer !== GAME_CONFIG.BLACK_PLAYER) return null;
    if (typeof s.running !== "boolean") return null;
    if (typeof s.lastUpdateUnixMs !== "number" || !Number.isFinite(s.lastUpdateUnixMs) || s.lastUpdateUnixMs < 0)
      return null;

    let whiteMs = clampNonNegativeInt(s.whiteMs);
    let blackMs = clampNonNegativeInt(s.blackMs);

    if (s.enabled && s.running) {
      const elapsed = unixNowMs - s.lastUpdateUnixMs;
      if (Number.isFinite(elapsed) && elapsed > 0) {
        if (s.activePlayer === GAME_CONFIG.WHITE_PLAYER) whiteMs = clampNonNegativeInt(whiteMs - elapsed);
        else blackMs = clampNonNegativeInt(blackMs - elapsed);
      }
    }

    const base: TimerState = {
      enabled: s.enabled,
      initialMs: clampNonNegativeInt(s.initialMs),
      whiteMs,
      blackMs,
      activePlayer: s.activePlayer,
      running: Boolean(s.enabled && s.running),
      lastPerfNowMs: s.enabled && s.running ? perfNowMs : null,
      timeoutWinner: null,
    };

    const winner = winnerFromTimeout(base);
    if (winner) return { ...base, running: false, lastPerfNowMs: null, timeoutWinner: winner };
    return base;
  } catch {
    return null;
  }
}

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "LOAD": {
      const imported = importSerializableTimerState(action.timer, action.perfNowMs, action.unixNowMs);
      return imported ?? state;
    }
    case "SET_STATE": {
      return action.state;
    }
    case "RESET": {
      const next = createTimerState(action.timer);
      if (!next.enabled || !next.running) return { ...next, lastPerfNowMs: null };
      return { ...next, lastPerfNowMs: action.perfNowMs };
    }
    case "START": {
      if (!state.enabled) return state;
      const winner = winnerFromTimeout(state);
      if (winner !== null) return { ...state, running: false, lastPerfNowMs: null, timeoutWinner: winner };
      if (state.running) return state;
      return { ...state, running: true, lastPerfNowMs: action.perfNowMs, timeoutWinner: null };
    }
    case "SWITCH_PLAYER": {
      if (!state.enabled) return state;
      const ticked = tickInternal(state, action.perfNowMs);
      const winner = winnerFromTimeout(ticked);
      if (winner) return { ...ticked, running: false, lastPerfNowMs: null, timeoutWinner: winner };
      if (!ticked.running) return { ...ticked, activePlayer: action.nextPlayer, lastPerfNowMs: null };
      return { ...ticked, activePlayer: action.nextPlayer, lastPerfNowMs: action.perfNowMs };
    }
    case "STOP": {
      const ticked = tickInternal(state, action.perfNowMs);
      const winner = winnerFromTimeout(ticked);
      if (winner) return { ...ticked, running: false, lastPerfNowMs: null, timeoutWinner: winner };
      return { ...ticked, running: false, lastPerfNowMs: null };
    }
    case "ACK_TIMEOUT": {
      if (state.timeoutWinner === null) return state;
      return { ...state, timeoutWinner: null };
    }
    case "TICK": {
      const next = tickInternal(state, action.perfNowMs);
      if (next === state) return state;

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
