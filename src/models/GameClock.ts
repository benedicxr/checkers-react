import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { Player, SerializableClockSnapshot, SerializableClockState } from "../types";

function clampNonNegativeInt(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  if (ms <= 0) return 0;
  return Math.floor(ms);
}

export class GameClock {
  #enabled: boolean;
  #initialMs: number;

  #whiteMs: number;
  #blackMs: number;

  #activePlayer: Player;
  #running: boolean;
  #lastPerfNowMs: number | null;

  constructor({
    enabled = CLOCK_CONFIG.ENABLED,
    initialMs = CLOCK_CONFIG.INITIAL_TIME_MS,
    activePlayer = GAME_CONFIG.WHITE_PLAYER,
  }: {
    enabled?: boolean;
    initialMs?: number;
    activePlayer?: Player;
  } = {}) {
    this.#enabled = Boolean(enabled);
    this.#initialMs = clampNonNegativeInt(initialMs);
    this.#activePlayer = activePlayer;
    this.#whiteMs = this.#initialMs;
    this.#blackMs = this.#initialMs;
    this.#running = false;
    this.#lastPerfNowMs = null;
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  reset(activePlayer: Player, perfNowMs: number = performance.now()): void {
    this.#whiteMs = this.#initialMs;
    this.#blackMs = this.#initialMs;
    this.#activePlayer = activePlayer;
    this.#running = this.#enabled;
    this.#lastPerfNowMs = this.#enabled ? perfNowMs : null;
  }

  start(activePlayer: Player, perfNowMs: number = performance.now()): void {
    if (!this.#enabled) return;
    this.#activePlayer = activePlayer;
    this.#running = true;
    this.#lastPerfNowMs = perfNowMs;
  }

  stop(perfNowMs: number = performance.now()): void {
    this.tick(perfNowMs);
    this.#running = false;
    this.#lastPerfNowMs = null;
  }

  tick(perfNowMs: number = performance.now()): void {
    if (!this.#enabled || !this.#running) return;
    if (this.#lastPerfNowMs === null) {
      this.#lastPerfNowMs = perfNowMs;
      return;
    }

    const delta = perfNowMs - this.#lastPerfNowMs;
    this.#lastPerfNowMs = perfNowMs;
    if (!Number.isFinite(delta) || delta <= 0) return;

    if (this.#activePlayer === GAME_CONFIG.WHITE_PLAYER) {
      this.#whiteMs = clampNonNegativeInt(this.#whiteMs - delta);
    } else {
      this.#blackMs = clampNonNegativeInt(this.#blackMs - delta);
    }
  }

  setActivePlayer(player: Player, perfNowMs: number = performance.now()): void {
    if (!this.#enabled) return;
    this.tick(perfNowMs);
    this.#activePlayer = player;
    this.#lastPerfNowMs = perfNowMs;
  }

  getSnapshot(): SerializableClockSnapshot {
    return {
      whiteMs: clampNonNegativeInt(this.#whiteMs),
      blackMs: clampNonNegativeInt(this.#blackMs),
      activePlayer: this.#activePlayer,
      running: this.#running,
    };
  }

  restoreSnapshot(snapshot: SerializableClockSnapshot, perfNowMs: number = performance.now()): void {
    if (!this.#enabled) return;
    this.#whiteMs = clampNonNegativeInt(snapshot.whiteMs);
    this.#blackMs = clampNonNegativeInt(snapshot.blackMs);
    this.#activePlayer = snapshot.activePlayer;
    this.#running = Boolean(snapshot.running);
    this.#lastPerfNowMs = this.#running ? perfNowMs : null;
  }

  getTimeLeftMs(player: Player): number {
    return player === GAME_CONFIG.WHITE_PLAYER ? this.#whiteMs : this.#blackMs;
  }

  get activePlayer(): Player {
    return this.#activePlayer;
  }

  get running(): boolean {
    return this.#running;
  }

  getWinnerByTime(): Player | null {
    if (!this.#enabled) return null;
    if (this.#whiteMs <= 0) return GAME_CONFIG.BLACK_PLAYER;
    if (this.#blackMs <= 0) return GAME_CONFIG.WHITE_PLAYER;
    return null;
  }

  exportState(unixNowMs: number = Date.now()): SerializableClockState {
    const snap = this.getSnapshot();
    return {
      enabled: this.#enabled,
      initialMs: this.#initialMs,
      ...snap,
      lastUpdateUnixMs: clampNonNegativeInt(unixNowMs),
    };
  }

  importState(state: unknown, perfNowMs: number = performance.now(), unixNowMs: number = Date.now()): boolean {
    try {
      if (!state || typeof state !== "object") return false;
      const s = state as Partial<SerializableClockState>;

      if (typeof s.enabled !== "boolean") return false;
      if (!s.enabled) {
        this.#enabled = false;
        this.#running = false;
        this.#lastPerfNowMs = null;
        return true;
      }

      if (typeof s.initialMs !== "number" || !Number.isFinite(s.initialMs) || s.initialMs < 0) return false;
      if (typeof s.whiteMs !== "number" || !Number.isFinite(s.whiteMs) || s.whiteMs < 0) return false;
      if (typeof s.blackMs !== "number" || !Number.isFinite(s.blackMs) || s.blackMs < 0) return false;
      if (s.activePlayer !== GAME_CONFIG.WHITE_PLAYER && s.activePlayer !== GAME_CONFIG.BLACK_PLAYER) return false;
      if (typeof s.running !== "boolean") return false;
      if (typeof s.lastUpdateUnixMs !== "number" || !Number.isFinite(s.lastUpdateUnixMs) || s.lastUpdateUnixMs < 0)
        return false;

      this.#enabled = true;
      this.#initialMs = clampNonNegativeInt(s.initialMs);
      this.#whiteMs = clampNonNegativeInt(s.whiteMs);
      this.#blackMs = clampNonNegativeInt(s.blackMs);
      this.#activePlayer = s.activePlayer;
      this.#running = s.running;

      if (this.#running) {
        const elapsed = unixNowMs - s.lastUpdateUnixMs;
        if (Number.isFinite(elapsed) && elapsed > 0) {
          if (this.#activePlayer === GAME_CONFIG.WHITE_PLAYER) {
            this.#whiteMs = clampNonNegativeInt(this.#whiteMs - elapsed);
          } else {
            this.#blackMs = clampNonNegativeInt(this.#blackMs - elapsed);
          }
        }
      }

      this.#lastPerfNowMs = this.#running ? perfNowMs : null;
      return true;
    } catch {
      return false;
    }
  }
}

