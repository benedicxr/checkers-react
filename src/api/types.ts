export type ApiGameId = string | number;
export type ApiGameMode = "vs_ai" | "pvp";
export type ApiTaskStatus = "queued" | "started" | "finished" | "failed";

export type ApiPos = Readonly<{
  row: number;
  col: number;
}>;

export type ApiPath = ReadonlyArray<ApiPos>;

export type ApiAllowedMove = Readonly<{
  fromPos: ApiPos;
  toPos: ApiPos;
  isCapture?: boolean;
  isJump?: boolean;
  capturedPos?: ApiPos | null;
  path?: ApiPath;
  capturedPositions?: ReadonlyArray<ApiPos>;
}>;

export type BackendPiece = Readonly<{
  id: number;
  color: "white" | "black";
  isKing: boolean;
}>;

export type BackendBoard = ReadonlyArray<ReadonlyArray<BackendPiece | null>>;

export type ApiGame = Readonly<{
  id: ApiGameId;
  mode?: ApiGameMode;
  board: BackendBoard;
  currentTurn: "white" | "black";
  status: string;
  winner: "white" | "black" | null;
  moveCount: number;
  allowedMoves?: ReadonlyArray<ApiAllowedMove>;
  capturedByWhite?: number;
  capturedByBlack?: number;
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
  path?: ApiPath;
  capturedPositions?: ReadonlyArray<ApiPos>;
  isPromoted: boolean;
  createdAt: string;
}>;

export type ApiAsyncMoveAccepted = Readonly<{
  taskId: string;
  status: ApiTaskStatus;
  game: ApiGame;
}>;

export type ApiTaskResult = Readonly<{
  taskId: string;
  status: ApiTaskStatus;
  gameId?: ApiGameId;
  game?: ApiGame;
}>;
