import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type {
  Coords,
  PersistedGameState,
  PersistedModelState,
  PersistedMoveHistoryState,
  PersistedUndoEntry,
  SerializableBoardSnapshot,
  TimerState,
} from "../types";
import type { MoveHistoryEntry, PersistedPendingMove } from "../types";
import type { MoveHistoryState } from "./moveHistory";
import { createMoveHistoryState } from "./moveHistory";
import type { GameControllerState, GameModelState, GameState, UndoEntry } from "./gameReducer";
import { createInitialGameState } from "./gameReducer";
import { createTimerState, exportSerializableTimerState, importSerializableTimerState } from "./timerReducer";

function isValidCoords(x: unknown): x is Coords {
  if (!x || typeof x !== "object") return false;
  const c = x as { r?: unknown; c?: unknown };
  return Number.isInteger(c.r) && Number.isInteger(c.c);
}

function isValidMoveHistoryEntry(x: unknown): x is MoveHistoryEntry {
  if (!x || typeof x !== "object") return false;
  const e = x as { id?: unknown; player?: unknown; text?: unknown; path?: unknown };
  if (!Number.isInteger(e.id) || (e.id as number) < 1) return false;
  if (e.player !== GAME_CONFIG.WHITE_PLAYER && e.player !== GAME_CONFIG.BLACK_PLAYER) return false;
  if (typeof e.text !== "string") return false;
  if (!Array.isArray(e.path) || e.path.some((p) => !isValidCoords(p))) return false;
  return true;
}

function isValidBoardSnapshot(board: unknown): board is SerializableBoardSnapshot {
  if (!Array.isArray(board) || board.length !== 8) return false;
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== 8) return false;
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

function cloneBoard(board: SerializableBoardSnapshot): SerializableBoardSnapshot {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function exportPersistedModelState(model: GameModelState): PersistedModelState {
  return {
    turn: model.turn,
    nextId: model.nextId,
    board: cloneBoard(model.board),
  };
}

function importPersistedModelState(raw: unknown): Pick<GameModelState, "board" | "turn" | "nextId"> | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<PersistedModelState>;
  if (m.turn !== GAME_CONFIG.WHITE_PLAYER && m.turn !== GAME_CONFIG.BLACK_PLAYER) return null;
  if (typeof m.nextId !== "number" || !Number.isInteger(m.nextId) || m.nextId < 1) return null;
  if (!isValidBoardSnapshot(m.board)) return null;
  return { turn: m.turn, nextId: m.nextId, board: cloneBoard(m.board) };
}

function exportPersistedUndo(undo: ReadonlyArray<UndoEntry>): ReadonlyArray<PersistedUndoEntry> {
  return undo.map((u) => ({ turn: u.turn, nextId: u.nextId, board: cloneBoard(u.board) }));
}

function importPersistedUndo(raw: unknown): UndoEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: UndoEntry[] = [];
  for (const h of raw) {
    if (!h || typeof h !== "object") return null;
    const entry = h as Partial<PersistedUndoEntry>;
    if (entry.turn !== GAME_CONFIG.WHITE_PLAYER && entry.turn !== GAME_CONFIG.BLACK_PLAYER) return null;
    if (typeof entry.nextId !== "number" || !Number.isInteger(entry.nextId) || entry.nextId < 1) return null;
    if (!isValidBoardSnapshot(entry.board)) return null;
    out.push({ turn: entry.turn, nextId: entry.nextId, board: cloneBoard(entry.board) });
  }
  return out;
}

function exportPersistedHistory(history: MoveHistoryState): PersistedMoveHistoryState {
  return {
    entries: history.entries.map((e) => ({ ...e, path: e.path.map((p) => ({ ...p })) })),
    nextId: history.nextId,
    pending: history.pending
      ? {
          id: history.pending.id,
          player: history.pending.player,
          isCapture: history.pending.isCapture,
          path: history.pending.path.map((p) => ({ ...p })),
        }
      : null,
    activeId: history.activeId,
  };
}

function importPersistedHistory(raw: unknown): MoveHistoryState | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Partial<PersistedMoveHistoryState>;
  if (!Array.isArray(h.entries) || h.entries.some((e) => !isValidMoveHistoryEntry(e))) return null;
  if (typeof h.nextId !== "number" || !Number.isInteger(h.nextId) || h.nextId < 1) return null;
  if (h.activeId !== null && (typeof h.activeId !== "number" || !Number.isInteger(h.activeId) || h.activeId < 1))
    return null;

  const pendingRaw = h.pending as PersistedPendingMove | null | undefined;
  let pending: PersistedPendingMove | null = null;
  if (pendingRaw !== null && pendingRaw !== undefined) {
    if (!pendingRaw || typeof pendingRaw !== "object") return null;
    if (!Number.isInteger(pendingRaw.id) || pendingRaw.id < 1) return null;
    if (pendingRaw.player !== GAME_CONFIG.WHITE_PLAYER && pendingRaw.player !== GAME_CONFIG.BLACK_PLAYER) return null;
    if (!Array.isArray(pendingRaw.path) || pendingRaw.path.some((p) => !isValidCoords(p))) return null;
    pending = {
      id: pendingRaw.id,
      player: pendingRaw.player,
      isCapture: pendingRaw.isCapture,
      path: pendingRaw.path.map((p: Coords) => ({ ...p })),
    };
  }

  return {
    entries: h.entries.map((e) => ({ ...e, path: e.path.map((p: Coords) => ({ ...p })) })),
    nextId: h.nextId,
    pending,
    activeId: h.activeId ?? null,
  };
}

export function exportPersistedGameState({
  game,
  timer,
  unixNowMs,
}: {
  game: GameState;
  timer: TimerState;
  unixNowMs: number;
}): PersistedGameState {
  const controller: GameControllerState = game.controller;
  return {
    version: 2,
    model: exportPersistedModelState(game.model),
    controller: {
      undo: exportPersistedUndo(controller.undo),
      history: exportPersistedHistory(controller.history),
      timer: exportSerializableTimerState(timer, unixNowMs),
    },
  };
}

export function importPersistedGameState({
  raw,
  perfNowMs,
  unixNowMs,
}: {
  raw: unknown;
  perfNowMs: number;
  unixNowMs: number;
}): { game: GameState; timer: TimerState } | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<PersistedGameState>;
  if (s.version !== 2) return null;

  const importedModel = importPersistedModelState(s.model);
  if (!importedModel) return null;

  const controllerRaw =
    s.controller && typeof s.controller === "object" ? (s.controller as PersistedGameState["controller"]) : undefined;

  const undo = controllerRaw?.undo ? importPersistedUndo(controllerRaw.undo) : [];
  if (undo === null) return null;

  const history = controllerRaw?.history ? importPersistedHistory(controllerRaw.history) : createMoveHistoryState();
  if (!history) return null;

  const base = createInitialGameState();
  const game: GameState = {
    ...base,
    model: {
      ...base.model,
      board: importedModel.board,
      turn: importedModel.turn,
      nextId: importedModel.nextId,
      selected: null,
    },
    controller: {
      ...base.controller,
      captureChainPiece: null,
      undo,
      inTurnMove: false,
      history,
    },
  };

  const fallbackTimer = createTimerState({
    enabled: CLOCK_CONFIG.ENABLED,
    initialMs: CLOCK_CONFIG.INITIAL_TIME_MS,
    whiteMs: CLOCK_CONFIG.INITIAL_TIME_MS,
      blackMs: CLOCK_CONFIG.INITIAL_TIME_MS,
    activePlayer: game.model.turn,
    running: CLOCK_CONFIG.ENABLED,
  });
  const timer =
    controllerRaw?.timer ? importSerializableTimerState(controllerRaw.timer, perfNowMs, unixNowMs) ?? fallbackTimer : fallbackTimer;

  return { game, timer };
}

