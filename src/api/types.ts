export type ApiGameId = string | number;

export type ApiPos = Readonly<{
  row: number;
  col: number;
}>;

export type ApiGame = Readonly<{
  id: ApiGameId;
  board: unknown;
  currentTurn: "white" | "black";
  status: string;
  winner: "white" | "black" | null;
  moveCount: number;
  createdAt: string;
  updatedAt: string;
}>;

export type ApiMoveHistoryItem = Readonly<{
  id: number;
  playerSide: "white" | "black";
  fromPos: ApiPos;
  toPos: ApiPos;
  isJump: boolean;
  capturedPos: ApiPos | null;
  isPromoted: boolean;
  createdAt: string;
}>;
