import type { CoreMove, Coords, Player, SerializableBoardSnapshot } from "../types";
import { GAME_CONFIG } from "../constants";
import { applyMove } from "./applyMove";
import { getValidMovesForPiece, getWinnerByBoard, playerHasCapture } from "./gameRules";
import { cancelPending, popLastEntry, setActiveMove } from "./moveHistory";
import { cloneBoard } from "./boardUtils";
import { createInitialBoard } from "./boardUtils";
import { createMoveHistoryState } from "./moveHistory";

export type UndoEntry = Readonly<{
  turn: Player;
  nextId: number;
  board: SerializableBoardSnapshot;
}>;

export type GameState = Readonly<{
  board: SerializableBoardSnapshot;
  turn: Player;
  nextId: number;
  selected: Coords | null;
  captureChainPiece: Coords | null;
  undo: ReadonlyArray<UndoEntry>;
  inTurnMove: boolean;
  history: ReturnType<typeof createMoveHistoryState>;
}>;

export type GameAction =
  | { type: "CELL_CLICK"; at: Coords }
  | { type: "SET_ACTIVE_MOVE"; id: number | null }
  | { type: "RESET" }
  | { type: "UNDO" }
  | { type: "SET_STATE"; state: GameState };

function sameCoords(a: Coords | null, b: Coords | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.r === b.r && a.c === b.c;
}

function findCoreMoveByDestination(moves: CoreMove[], at: Coords): CoreMove | undefined {
  return moves.find((m) => m.to.r === at.r && m.to.c === at.c);
}

function assertNever(x: never): never {
  throw new Error(`Unexpected action: ${String((x as { type?: unknown } | null)?.type)}`);
}

export function createInitialGameState(): GameState {
  const init = createInitialBoard();
  return {
    board: init.board,
    turn: GAME_CONFIG.WHITE_PLAYER,
    nextId: init.nextId,
    selected: null,
    captureChainPiece: null,
    undo: [],
    inTurnMove: false,
    history: createMoveHistoryState(),
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_STATE": {
      return action.state;
    }
    case "SET_ACTIVE_MOVE": {
      return { ...state, history: setActiveMove(state.history, action.id) };
    }
    case "RESET": {
      return createInitialGameState();
    }
    case "UNDO": {
      if (state.undo.length === 0) return state;
      const prev = state.undo[state.undo.length - 1]!;
      const undo = state.undo.slice(0, -1);

      const canceled = cancelPending(state.history);
      const history = canceled.had ? canceled.history : popLastEntry(canceled.history);

      const next: GameState = {
        ...state,
        board: cloneBoard(prev.board),
        turn: prev.turn,
        nextId: prev.nextId,
        undo,
        selected: null,
        captureChainPiece: null,
        inTurnMove: false,
        history: { ...history, activeId: null },
      };
      return next;
    }
    case "CELL_CLICK": {
      if (getWinnerByBoard(state.board, state.turn) !== null) return state;

      const at = action.at;
      const selected = state.captureChainPiece ?? state.selected;

      if (selected) {
        const capturesOnly = state.captureChainPiece !== null ? true : playerHasCapture(state.board, state.turn);
        const coreMoves = getValidMovesForPiece(state.board, state.turn, selected, { capturesOnly });
        const chosen = findCoreMoveByDestination(coreMoves, at);
        if (chosen) {
          return applyMove(state, chosen);
        }

        if (sameCoords(selected, at)) {
          if (state.captureChainPiece) return state;
          return { ...state, selected: null };
        }
      }

      if (state.captureChainPiece && !sameCoords(state.captureChainPiece, at)) return state;

      const piece = state.board[at.r]?.[at.c] ?? null;
      if (!piece || piece.color !== state.turn) {
        return { ...state, selected: null };
      }

      const mustCapture = state.captureChainPiece !== null ? true : playerHasCapture(state.board, state.turn);
      const coreMoves = getValidMovesForPiece(state.board, state.turn, at, { capturesOnly: mustCapture });
      if (mustCapture && coreMoves.length === 0) return state;

      return { ...state, selected: { ...at }, history: setActiveMove(state.history, null) };
    }
    default: {
      return assertNever(action);
    }
  }
}

