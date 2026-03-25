export type Player = 1 | 2;

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

export interface CheckerSnapshot {
  id: number;
  color: Player;
  isKing: boolean;
}

export type BoardSnapshot = ReadonlyArray<ReadonlyArray<CheckerSnapshot | null>>;

export type SerializableBoardSnapshot = (CheckerSnapshot | null)[][];

export interface SerializableHistoryEntry {
  turn: Player;
  nextId: number;
  board: SerializableBoardSnapshot;
}

export interface SerializableModelState {
  turn: Player;
  nextId: number;
  board: SerializableBoardSnapshot;
  history: SerializableHistoryEntry[];
}

export interface CaptureChainState {
  active: boolean;
  piece?: Coords;
}

export interface SerializableClockSnapshot {
  whiteMs: number;
  blackMs: number;
  activePlayer: Player;
  running: boolean;
}

export interface SerializableClockState extends SerializableClockSnapshot {
  enabled: boolean;
  initialMs: number;
  lastUpdateUnixMs: number;
  history?: SerializableClockSnapshot[];
}

export interface SerializableControllerState {
  captureChain?: CaptureChainState;
  clock?: SerializableClockState;
}

export type PersistedGameState = {
  version: 1;
  model: SerializableModelState;
  controller?: SerializableControllerState;
};

export type MoveHistoryEntry = Readonly <{
  id: number;
  player: Player;
  text: string;
  path: Coords[];
}>;