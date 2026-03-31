import { GAME_CONFIG } from "../constants";
import type {
  Board,
  PersistedGameState,
  Player,
  SerializableBoardSnapshot,
  SerializableHistoryEntry,
} from "../types";
import { createInitialBoard, countPieces } from "./boardUtils";
import type { ClockState } from "./clock";
import { createClockState, exportClockState, importClockState, resetClock } from "./clock";
import type { MoveHistoryState } from "./moveHistory";
import { createMoveHistoryState } from "./moveHistory";

export type UndoEntry = Readonly<{
  turn: Player;
  nextId: number;
  board: SerializableBoardSnapshot;
}>;

export type GameCoreState = Readonly<{
  board: Board;
  turn: Player;
  nextId: number;
  undo: ReadonlyArray<UndoEntry>;
  selected: { r: number; c: number } | null;
  captureChainPiece: { r: number; c: number } | null;
  inTurnMove: boolean;
  initialWhite: number;
  initialBlack: number;
  clock: ClockState;
  history: MoveHistoryState;
  persistRev: number;
}>;

export function createInitialGameState(perfNowMs: number): GameCoreState {
  const init = createInitialBoard();
  const clock = resetClock(createClockState({ activePlayer: GAME_CONFIG.WHITE_PLAYER }), GAME_CONFIG.WHITE_PLAYER, perfNowMs);
  return {
    board: init.board,
    turn: GAME_CONFIG.WHITE_PLAYER,
    nextId: init.nextId,
    undo: [],
    selected: null,
    captureChainPiece: null,
    inTurnMove: false,
    initialWhite: init.initialWhite,
    initialBlack: init.initialBlack,
    clock,
    history: createMoveHistoryState(),
    persistRev: 0,
  };
}

function isValidBoardSnapshot(board: unknown): board is SerializableBoardSnapshot {
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

export function exportPersistedGameState(state: GameCoreState, unixNowMs: number): PersistedGameState {
  const board: SerializableBoardSnapshot = state.board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  const history: SerializableHistoryEntry[] = state.undo.map((h) => ({
    turn: h.turn,
    nextId: h.nextId,
    board: h.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
  }));

  return {
    version: 1,
    model: {
      turn: state.turn,
      nextId: state.nextId,
      board,
      history,
    },
    controller: {
      clock: exportClockState(state.clock, unixNowMs),
    },
  };
}

export function importPersistedGameState(
  raw: unknown,
  perfNowMs: number,
  unixNowMs: number,
): GameCoreState | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const s = raw as Partial<PersistedGameState>;
    if (s.version !== 1) return null;
    if (!s.model || typeof s.model !== "object") return null;

    const model = s.model as Partial<PersistedGameState["model"]>;
    const { turn, nextId, board, history } = model;
    if (turn !== GAME_CONFIG.WHITE_PLAYER && turn !== GAME_CONFIG.BLACK_PLAYER) return null;
    if (typeof nextId !== "number" || !Number.isInteger(nextId) || nextId < 1) return null;
    if (!isValidBoardSnapshot(board)) return null;

    const normalizedHistory = Array.isArray(history) ? history : [];
    const undo: UndoEntry[] = [];
    for (const h of normalizedHistory) {
      if (!h || typeof h !== "object") return null;
      const entry = h as Partial<UndoEntry>;
      if (entry.turn !== GAME_CONFIG.WHITE_PLAYER && entry.turn !== GAME_CONFIG.BLACK_PLAYER) return null;
      if (typeof entry.nextId !== "number" || !Number.isInteger(entry.nextId) || entry.nextId < 1) return null;
      if (!isValidBoardSnapshot(entry.board)) return null;
      undo.push({
        turn: entry.turn as Player,
        nextId: entry.nextId,
        board: entry.board!.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
      });
    }

    const controller =
      s.controller && typeof s.controller === "object" ? (s.controller as PersistedGameState["controller"]) : undefined;
    const clockRaw = controller?.clock;
    const importedClock = clockRaw ? importClockState(clockRaw, perfNowMs, unixNowMs) : null;
    const clock =
      importedClock ??
      resetClock(createClockState({ activePlayer: turn as Player }), turn as Player, perfNowMs);

    const init = createInitialBoard();

    const base: GameCoreState = {
      board: board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
      turn: turn as Player,
      nextId,
      undo,
      selected: null,
      captureChainPiece: null,
      inTurnMove: false,
      initialWhite: init.initialWhite,
      initialBlack: init.initialBlack,
      clock,
      history: createMoveHistoryState(),
      persistRev: 0,
    };

    const currentWhite = countPieces(base.board, GAME_CONFIG.WHITE_PLAYER);
    const currentBlack = countPieces(base.board, GAME_CONFIG.BLACK_PLAYER);
    return {
      ...base,
      initialWhite: Math.max(base.initialWhite, currentWhite),
      initialBlack: Math.max(base.initialBlack, currentBlack),
    };
  } catch {
    return null;
  }
}
