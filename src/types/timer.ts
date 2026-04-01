import type { Player } from "./game";

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

