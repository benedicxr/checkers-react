import { GAME_CONFIG, GAME_RULES } from "../constants";
import type {
  BoardSnapshot,
  Coords,
  Move,
  PersistedGameState,
  Player,
  SerializableBoardSnapshot,
  SerializableHistoryEntry,
} from "../types";
import { Checker } from "./Checker";
import { Board } from "./Board";
import { MoveEngine } from "./MoveEngine";

type HistoryState = Readonly<{
  turn: Player;
  nextId: number;
  board: SerializableBoardSnapshot;
}>;

export class CheckerModel {
  #board!: Board;
  #turn!: Player;
  #history!: HistoryState[];
  #nextId!: number;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.#board = new Board();
    this.#nextId = 1;
    this.#initializeModel();
    this.#turn = GAME_CONFIG.WHITE_PLAYER;
    this.#history = [];
  }

  exportState(): PersistedGameState {
    return {
      version: 1,
      model: {
        turn: this.#turn,
        nextId: this.#nextId,
        board: this.#board.toSnapshot().map((row) => row.map((cell) => (cell ? { ...cell } : null))),
        history: this.#history.map(
          (h): SerializableHistoryEntry => ({
            turn: h.turn,
            nextId: h.nextId,
            board: h.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
          }),
        ),
      },
    };
  }

  importState(state: unknown): boolean {
    try {
      if (!state || typeof state !== "object") return false;
      const s = state as Partial<PersistedGameState>;
      if (s.version !== 1) return false;
      if (!s.model || typeof s.model !== "object") return false;

      const model = s.model as Partial<PersistedGameState["model"]>;
      const { turn, nextId, board, history } = model;
      if (turn !== GAME_CONFIG.WHITE_PLAYER && turn !== GAME_CONFIG.BLACK_PLAYER) return false;
      if (typeof nextId !== "number" || !Number.isInteger(nextId) || nextId < 1) return false;
      if (!this.#isValidBoardSnapshot(board)) return false;

      const normalizedHistory = Array.isArray(history) ? history : [];
      for (const h of normalizedHistory) {
        if (!h || typeof h !== "object") return false;
        const entry = h as Partial<HistoryState>;
        if (entry.turn !== GAME_CONFIG.WHITE_PLAYER && entry.turn !== GAME_CONFIG.BLACK_PLAYER) return false;
        if (typeof entry.nextId !== "number" || !Number.isInteger(entry.nextId) || entry.nextId < 1) return false;
        if (!this.#isValidBoardSnapshot(entry.board)) return false;
      }

      this.#turn = turn as Player;
      this.#nextId = nextId;
      this.#board = this.#boardFromSnapshot(board);
      this.#history = normalizedHistory.map((h) => {
        const entry = h as HistoryState;
        return {
          turn: entry.turn,
          nextId: entry.nextId,
          board: entry.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
        };
      });
      return true;
    } catch {
      return false;
    }
  }

  #initializeModel(): void {
    const initialPieceRows = GAME_RULES.INITIAL_PIECE_ROWS;

    for (let row = 0; row < GAME_CONFIG.ROWS; row++) {
      for (let col = 0; col < GAME_CONFIG.COLS; col++) {
        if (!this.#board.isDarkCell(row, col)) continue;

        if (row < initialPieceRows) {
          this.#board.setPiece(row, col, new Checker(GAME_CONFIG.BLACK_PLAYER, { id: this.#nextId++ }));
        } else if (row >= GAME_CONFIG.ROWS - initialPieceRows) {
          this.#board.setPiece(row, col, new Checker(GAME_CONFIG.WHITE_PLAYER, { id: this.#nextId++ }));
        }
      }
    }
  }

  getPiece(row: number, col: number): Checker | null {
    return this.#board.getPiece(row, col);
  }

  get turn(): Player {
    return this.#turn;
  }

  countPieces(player: Player): number {
    let count = 0;
    for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
      for (let c = 0; c < GAME_CONFIG.COLS; c++) {
        const p = this.#board.getPiece(r, c);
        if (p && p.color === player) count++;
      }
    }
    return count;
  }

  playerHasAnyMove(player: Player): boolean {
    if (MoveEngine.playerHasCapture(this.#board, player)) return true;

    for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
      for (let c = 0; c < GAME_CONFIG.COLS; c++) {
        const p = this.#board.getPiece(r, c);
        if (!p || p.color !== player) continue;
        if (MoveEngine.getQuietMovesForPiece(this.#board, player, r, c).length > 0) return true;
      }
    }
    return false;
  }

  getWinner(): Player | null {
    const whiteCount = this.countPieces(GAME_CONFIG.WHITE_PLAYER);
    const blackCount = this.countPieces(GAME_CONFIG.BLACK_PLAYER);

    if (whiteCount === 0 && blackCount === 0) return null;
    if (whiteCount === 0) return GAME_CONFIG.BLACK_PLAYER;
    if (blackCount === 0) return GAME_CONFIG.WHITE_PLAYER;

    if (!this.playerHasAnyMove(this.#turn)) {
      return this.#turn === GAME_CONFIG.WHITE_PLAYER ? GAME_CONFIG.BLACK_PLAYER : GAME_CONFIG.WHITE_PLAYER;
    }

    return null;
  }

  playerHasCapture(player: Player = this.#turn): boolean {
    return MoveEngine.playerHasCapture(this.#board, player);
  }

  getCapturingPieces(player: Player = this.#turn): Coords[] {
    return MoveEngine.getCapturingPieces(this.#board, player);
  }

  getValidMoves(row: number, col: number, { mustCapture = false }: { mustCapture?: boolean } = {}): Move[] {
    const capturesOnly = mustCapture || this.playerHasCapture(this.#turn);
    return MoveEngine.getValidMoves(this.#board, this.#turn, row, col, { capturesOnly });
  }

  getCaptures(row: number, col: number): Move[] {
    return MoveEngine.getCapturesForPiece(this.#board, this.#turn, row, col);
  }

  applyMove(
    from: Coords,
    to: Coords,
    moveDetails: Move,
    { switchTurn = true }: { switchTurn?: boolean } = {},
  ): void {
    const movedPiece = this.#board.movePiece(from, to);

    if (moveDetails.type === "jump") {
      this.#board.removePiece(moveDetails.target.r, moveDetails.target.c);
    }

    this.#maybePromote(to.r, movedPiece);

    if (switchTurn) this.endTurn();
  }

  endTurn(): void {
    this.#turn = this.#turn === GAME_CONFIG.WHITE_PLAYER ? GAME_CONFIG.BLACK_PLAYER : GAME_CONFIG.WHITE_PLAYER;
  }

  pushHistory(): void {
    this.#history.push(this.#cloneState());
  }

  canUndo(): boolean {
    return this.#history.length > 0;
  }

  undo(): boolean {
    if (this.#history.length === 0) return false;
    const prev = this.#history.pop();
    if (!prev) return false;
    this.#turn = prev.turn;
    this.#nextId = prev.nextId;
    this.#board = this.#boardFromSnapshot(prev.board);
    return true;
  }

  #cloneState(): HistoryState {
    return {
      turn: this.#turn,
      nextId: this.#nextId,
      board: this.#board.toSnapshot().map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    };
  }

  #isValidBoardSnapshot(board: unknown): board is SerializableBoardSnapshot {
    if (!Array.isArray(board) || board.length !== GAME_CONFIG.ROWS) return false;
    for (const row of board) {
      if (!Array.isArray(row) || row.length !== GAME_CONFIG.COLS) return false;
      for (const cell of row) {
        if (cell === null) continue;
        if (!cell || typeof cell !== "object") return false;
        const c = cell as { id?: unknown; color?: unknown; isKing?: unknown };
        if (!Number.isInteger(c.id) || (c.id as number) < 1) return false;
        if (c.color !== GAME_CONFIG.WHITE_PLAYER && c.color !== GAME_CONFIG.BLACK_PLAYER) return false;
        if (typeof c.isKing !== "boolean") return false;
      }
    }
    return true;
  }

  #boardFromSnapshot(snapshot: SerializableBoardSnapshot): Board {
    const board = new Board();
    for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
      for (let c = 0; c < GAME_CONFIG.COLS; c++) {
        const cell = snapshot[r]![c]!;
        if (!cell) continue;
        board.setPiece(r, c, new Checker(cell.color, { id: cell.id, isKing: cell.isKing }));
      }
    }
    return board;
  }

  #maybePromote(row: number, piece: Checker | null): boolean {
    if (!piece || piece.isKing) return false;
    if (piece.color === GAME_CONFIG.WHITE_PLAYER && row === 0) return piece.promote();
    if (piece.color === GAME_CONFIG.BLACK_PLAYER && row === GAME_CONFIG.ROWS - 1) return piece.promote();
    return false;
  }

  get board(): BoardSnapshot {
    return this.#board.toSnapshot();
  }
}
