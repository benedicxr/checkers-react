import type { Player } from "./game";

export interface Clock {
  now(): number;
}

export type TimerClockSnapshot = Readonly<{
  enabled: boolean;
  initialMs: number;
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

export type SerializableTimerState = Readonly<
  TimerClockSnapshot & {
    lastUpdateUnixMs: number;
  }
>;

export type TimerAction =
  | { type: "LOAD"; timer: SerializableTimerState; perfNowMs: number; unixNowMs: number }
  | { type: "SET_STATE"; state: TimerState }
  | { type: "RESET"; timer: TimerClockSnapshot; perfNowMs: number }
  | { type: "START"; perfNowMs: number }
  | { type: "SWITCH_PLAYER"; nextPlayer: Player; perfNowMs: number }
  | { type: "STOP"; perfNowMs: number }
  | { type: "TICK"; perfNowMs: number }
  | { type: "ACK_TIMEOUT" };
