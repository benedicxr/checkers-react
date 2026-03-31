import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { Color, Player, SerializableClockSnapshot, SerializableClockState } from "../types";

export type ClockState = Readonly<{
  enabled: boolean;
  initialMs: number;
  whiteMs: number;
  blackMs: number;
  activePlayer: Player;
  running: boolean;
  lastPerfNowMs: number | null;
}>;

function clampNonNegativeInt(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  if (ms <= 0) return 0;
  return Math.floor(ms);
}

export function createClockState({
  enabled = CLOCK_CONFIG.ENABLED,
  initialMs = CLOCK_CONFIG.INITIAL_TIME_MS,
  activePlayer = GAME_CONFIG.WHITE_PLAYER,
}: {
  enabled?: boolean;
  initialMs?: number;
  activePlayer?: Player;
} = {}): ClockState {
  const initial = clampNonNegativeInt(initialMs);
  const en = Boolean(enabled);
  return {
    enabled: en,
    initialMs: initial,
    whiteMs: initial,
    blackMs: initial,
    activePlayer,
    running: en,
    lastPerfNowMs: null,
  };
}

export function resetClock(clock: ClockState, activePlayer: Player, perfNowMs: number): ClockState {
  if (!clock.enabled) {
    return { ...clock, activePlayer, whiteMs: clock.initialMs, blackMs: clock.initialMs, running: false, lastPerfNowMs: null };
  }
  return { ...clock, whiteMs: clock.initialMs, blackMs: clock.initialMs, activePlayer, running: true, lastPerfNowMs: perfNowMs };
}

export function tickClock(clock: ClockState, perfNowMs: number): ClockState {
  if (!clock.enabled || !clock.running) return clock;
  if (clock.lastPerfNowMs === null) return { ...clock, lastPerfNowMs: perfNowMs };

  const delta = perfNowMs - clock.lastPerfNowMs;
  if (!Number.isFinite(delta) || delta <= 0) return { ...clock, lastPerfNowMs: perfNowMs };

  if (clock.activePlayer === GAME_CONFIG.WHITE_PLAYER) {
    return {
      ...clock,
      whiteMs: clampNonNegativeInt(clock.whiteMs - delta),
      lastPerfNowMs: perfNowMs,
    };
  }
  return {
    ...clock,
    blackMs: clampNonNegativeInt(clock.blackMs - delta),
    lastPerfNowMs: perfNowMs,
  };
}

export function stopClock(clock: ClockState, perfNowMs: number): ClockState {
  const ticked = tickClock(clock, perfNowMs);
  return { ...ticked, running: false, lastPerfNowMs: null };
}

export function setActivePlayer(clock: ClockState, player: Player, perfNowMs: number): ClockState {
  if (!clock.enabled) return clock;
  const ticked = tickClock(clock, perfNowMs);
  return { ...ticked, activePlayer: player, lastPerfNowMs: perfNowMs };
}

export function getWinnerByTime(clock: ClockState): Color | null {
  if (!clock.enabled) return null;
  if (clock.whiteMs <= 0) return GAME_CONFIG.BLACK_PLAYER;
  if (clock.blackMs <= 0) return GAME_CONFIG.WHITE_PLAYER;
  return null;
}

export function getSerializableSnapshot(clock: ClockState): SerializableClockSnapshot {
  return {
    whiteMs: clampNonNegativeInt(clock.whiteMs),
    blackMs: clampNonNegativeInt(clock.blackMs),
    activePlayer: clock.activePlayer,
    running: Boolean(clock.running),
  };
}

export function exportClockState(clock: ClockState, unixNowMs: number): SerializableClockState {
  const snap = getSerializableSnapshot(clock);
  return {
    enabled: Boolean(clock.enabled),
    initialMs: clampNonNegativeInt(clock.initialMs),
    ...snap,
    lastUpdateUnixMs: clampNonNegativeInt(unixNowMs),
  };
}

export function importClockState(
  raw: unknown,
  perfNowMs: number,
  unixNowMs: number,
): ClockState | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const s = raw as Partial<SerializableClockState>;

    if (typeof s.enabled !== "boolean") return null;
    if (!s.enabled) {
      return {
        enabled: false,
        initialMs: clampNonNegativeInt(s.initialMs ?? CLOCK_CONFIG.INITIAL_TIME_MS),
        whiteMs: clampNonNegativeInt(s.whiteMs ?? 0),
        blackMs: clampNonNegativeInt(s.blackMs ?? 0),
        activePlayer: (s.activePlayer ?? GAME_CONFIG.WHITE_PLAYER) as Player,
        running: false,
        lastPerfNowMs: null,
      };
    }

    if (typeof s.initialMs !== "number" || !Number.isFinite(s.initialMs) || s.initialMs < 0) return null;
    if (typeof s.whiteMs !== "number" || !Number.isFinite(s.whiteMs) || s.whiteMs < 0) return null;
    if (typeof s.blackMs !== "number" || !Number.isFinite(s.blackMs) || s.blackMs < 0) return null;
    if (s.activePlayer !== GAME_CONFIG.WHITE_PLAYER && s.activePlayer !== GAME_CONFIG.BLACK_PLAYER) return null;
    if (typeof s.running !== "boolean") return null;
    if (typeof s.lastUpdateUnixMs !== "number" || !Number.isFinite(s.lastUpdateUnixMs) || s.lastUpdateUnixMs < 0) return null;

    let whiteMs = clampNonNegativeInt(s.whiteMs);
    let blackMs = clampNonNegativeInt(s.blackMs);

    if (s.running) {
      const elapsed = unixNowMs - s.lastUpdateUnixMs;
      if (Number.isFinite(elapsed) && elapsed > 0) {
        if (s.activePlayer === GAME_CONFIG.WHITE_PLAYER) whiteMs = clampNonNegativeInt(whiteMs - elapsed);
        else blackMs = clampNonNegativeInt(blackMs - elapsed);
      }
    }

    return {
      enabled: true,
      initialMs: clampNonNegativeInt(s.initialMs),
      whiteMs,
      blackMs,
      activePlayer: s.activePlayer,
      running: s.running,
      lastPerfNowMs: s.running ? perfNowMs : null,
    };
  } catch {
    return null;
  }
}
