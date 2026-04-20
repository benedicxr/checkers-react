export type ApiGameId = string | number;

export type ApiPos = Readonly<{
  row: number;
  col: number;
}>;

export type ApiGame = Readonly<{
  id: ApiGameId;
  board: unknown;
  currentTurn: number;
  status: string;
  winner: number | null;
  moveCount: number;
  createdAt: string;
  updatedAt: string;
}>;

export type ApiMoveHistoryItem = Readonly<{
  id: number;
  playerSide: number;
  fromPos: ApiPos;
  toPos: ApiPos;
  isJump: boolean;
  capturedPos: ApiPos | null;
  isPromoted: boolean;
  createdAt: string;
}>;
