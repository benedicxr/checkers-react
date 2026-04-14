import type { SerializableTimerState } from "./timer";

export type Player = 1 | 2;
export type Color = Player;

export interface Coords {
  r: number;
  c: number;
}

export interface QuietMove {
  r: number;
  c: number;
  type: "move";
}

export interface JumpMove {
  r: number;
  c: number;
  type: "jump";
  target: Coords;
}

export type Move = QuietMove | JumpMove;

export type CoreMove =
  | { type: "simple"; from: Coords; to: Coords }
  | { type: "capture"; from: Coords; to: Coords; captured: Coords };

export interface CheckerSnapshot {
  id: number;
  color: Player;
  isKing: boolean;
}

export type Piece = CheckerSnapshot;

export type BoardSnapshot = ReadonlyArray<ReadonlyArray<CheckerSnapshot | null>>;
export type SerializableBoardSnapshot = (CheckerSnapshot | null)[][];
export type Board = SerializableBoardSnapshot;

export interface PersistedUndoEntry {
  turn: Player;
  nextId: number;
  board: SerializableBoardSnapshot;
}

export interface PersistedModelState {
  turn: Player;
  nextId: number;
  board: SerializableBoardSnapshot;
}

export type PersistedPendingMove = Readonly<{
  id: number;
  player: Player;
  isCapture: boolean;
  path: Coords[];
}>;

export type PersistedMoveHistoryState = Readonly<{
  entries: ReadonlyArray<MoveHistoryEntry>;
  nextId: number;
  pending: PersistedPendingMove | null;
  activeId: number | null;
}>;

export type PersistedGameState = Readonly<{
  version: 2;
  model: PersistedModelState;
  controller?: Readonly<{
    undo?: ReadonlyArray<PersistedUndoEntry>;
    history?: PersistedMoveHistoryState;
    timer?: SerializableTimerState;
  }>;
}>;

export type MoveHistoryEntry = Readonly<{
  id: number;
  player: Player;
  text: string;
  path: Coords[];
}>;
