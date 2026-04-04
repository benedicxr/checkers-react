import type { CoreMove, Coords, Player, SerializableBoardSnapshot } from "../types";
import { GAME_CONFIG } from "../constants";
import { applyMove } from "./applyMove";
import { getValidMovesForPiece, getWinnerByBoard, playerHasCapture } from "./gameRules";
import { cancelPending, popLastEntry, setActiveMove } from "./moveHistory";
import { cloneBoard } from "./boardUtils";
import { createInitialBoard } from "./boardUtils";
import { createMoveHistoryState } from "./moveHistory";
import type { MoveHistoryState } from "./moveHistory";

export type UndoEntry = Readonly<{
  turn: Player;
  nextId: number;
  board: SerializableBoardSnapshot;
}>;

export type GameModelState = Readonly<{
  board: SerializableBoardSnapshot;
  turn: Player;
  selected: Coords | null;
  nextId: number;
}>;

export type GameControllerState = Readonly<{
  captureChainPiece: Coords | null;
  undo: ReadonlyArray<UndoEntry>;
  inTurnMove: boolean;
  history: MoveHistoryState;
}>;

export type GameState = Readonly<{
  model: GameModelState;
  controller: GameControllerState;
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
    model: {
      board: init.board,
      turn: GAME_CONFIG.WHITE_PLAYER,
      nextId: init.nextId,
      selected: null,
    },
    controller: {
      captureChainPiece: null,
      undo: [],
      inTurnMove: false,
      history: createMoveHistoryState(),
    },
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_STATE": {
      return action.state;
    }
    case "SET_ACTIVE_MOVE": {
      return {
        ...state,
        controller: { ...state.controller, history: setActiveMove(state.controller.history, action.id) },
      };
    }
    case "RESET": {
      return createInitialGameState();
    }
    case "UNDO": {
      if (state.controller.undo.length === 0) return state;
      const prev = state.controller.undo[state.controller.undo.length - 1]!;
      const undo = state.controller.undo.slice(0, -1);

      const canceled = cancelPending(state.controller.history);
      const history = canceled.had ? canceled.history : popLastEntry(canceled.history);

      return {
        ...state,
        model: {
          ...state.model,
          board: cloneBoard(prev.board),
          turn: prev.turn,
          nextId: prev.nextId,
          selected: null,
        },
        controller: {
          ...state.controller,
          undo,
          captureChainPiece: null,
          inTurnMove: false,
          history: { ...history, activeId: null },
        },
      };
    }
    case "CELL_CLICK": {
      if (getWinnerByBoard(state.model.board, state.model.turn) !== null) return state;

      const at = action.at;
      const selected = state.controller.captureChainPiece ?? state.model.selected;

      if (selected) {
        const capturesOnly =
          state.controller.captureChainPiece !== null
            ? true
            : playerHasCapture(state.model.board, state.model.turn);
        const coreMoves = getValidMovesForPiece(state.model.board, state.model.turn, selected, { capturesOnly });
        const chosen = findCoreMoveByDestination(coreMoves, at);
        if (chosen) {
          return applyMove(state, chosen);
        }

        if (sameCoords(selected, at)) {
          if (state.controller.captureChainPiece) return state;
          return { ...state, model: { ...state.model, selected: null } };
        }
      }

      if (state.controller.captureChainPiece && !sameCoords(state.controller.captureChainPiece, at)) return state;

      const piece = state.model.board[at.r]?.[at.c] ?? null;
      if (!piece || piece.color !== state.model.turn) {
        return { ...state, model: { ...state.model, selected: null } };
      }

      const mustCapture =
        state.controller.captureChainPiece !== null ? true : playerHasCapture(state.model.board, state.model.turn);
      const coreMoves = getValidMovesForPiece(state.model.board, state.model.turn, at, { capturesOnly: mustCapture });
      if (mustCapture && coreMoves.length === 0) return state;

      return {
        ...state,
        model: { ...state.model, selected: { ...at } },
        controller: { ...state.controller, history: setActiveMove(state.controller.history, null) },
      };
    }
    default: {
      return assertNever(action);
    }
  }
}

