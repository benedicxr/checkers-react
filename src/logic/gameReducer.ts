import type { CoreMove, Coords, PersistedGameState } from "../types";
import { cloneBoard } from "./boardUtils";
import { applyMove } from "./applyMove";
import { getValidMovesForPiece, getWinnerByBoard, playerHasCapture } from "./gameRules";
import { cancelPending, popLastEntry, setActiveMove } from "./moveHistory";
import type { GameCoreState } from "./persistence";
import { createInitialGameState, importPersistedGameState } from "./persistence";
import { getWinnerByTime, setActivePlayer, stopClock, tickClock } from "./clock";

export type GameAction =
  | { type: "CELL_CLICK"; at: Coords; perfNowMs: number }
  | { type: "SET_ACTIVE_MOVE"; id: number | null }
  | { type: "RESET"; perfNowMs: number }
  | { type: "UNDO"; perfNowMs: number }
  | { type: "TICK"; perfNowMs: number }
  | { type: "LOAD"; persisted: PersistedGameState; perfNowMs: number; unixNowMs: number };

function sameCoords(a: Coords | null, b: Coords | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.r === b.r && a.c === b.c;
}

function findCoreMoveByDestination(moves: CoreMove[], at: Coords): CoreMove | undefined {
  return moves.find((m) => m.to.r === at.r && m.to.c === at.c);
}

function withWinnerStop(state: GameCoreState, perfNowMs: number): GameCoreState {
  const boardWinner = getWinnerByBoard(state.board, state.turn);
  const timeWinner = getWinnerByTime(state.clock);
  if (boardWinner === null && timeWinner === null) return state;
  if (!state.clock.running) return state;
  return { ...state, clock: stopClock(state.clock, perfNowMs) };
}

function assertNever(x: never): never {
  throw new Error(`Unexpected action: ${String((x as { type?: unknown } | null)?.type)}`);
}

export function gameReducer(state: GameCoreState, action: GameAction): GameCoreState {
  switch (action.type) {
    case "CELL_CLICK": {
      const boardWinner = getWinnerByBoard(state.board, state.turn);
      const timeWinner = getWinnerByTime(state.clock);
      if (boardWinner !== null || timeWinner !== null) return state;

      const at = action.at;

      const selected = state.captureChainPiece ?? state.selected;
      if (selected) {
        const capturesOnly =
          state.captureChainPiece !== null ? true : playerHasCapture(state.board, state.turn);
        const coreMoves = getValidMovesForPiece(state.board, state.turn, selected, { capturesOnly });
        const chosen = findCoreMoveByDestination(coreMoves, at);
        if (chosen) {
          return withWinnerStop(applyMove(state, chosen, action.perfNowMs), action.perfNowMs);
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
    case "SET_ACTIVE_MOVE": {
      return { ...state, history: setActiveMove(state.history, action.id) };
    }
    case "RESET": {
      const base = createInitialGameState(action.perfNowMs);
      return { ...base, persistRev: state.persistRev + 1 };
    }
    case "UNDO": {
      if (state.undo.length === 0) return state;
      const prev = state.undo[state.undo.length - 1]!;
      const undo = state.undo.slice(0, -1);

      const canceled = cancelPending(state.history);
      const history = canceled.had ? canceled.history : popLastEntry(canceled.history);

      const clock = setActivePlayer(state.clock, prev.turn, action.perfNowMs);
      const next: GameCoreState = {
        ...state,
        board: cloneBoard(prev.board),
        turn: prev.turn,
        nextId: prev.nextId,
        undo,
        selected: null,
        captureChainPiece: null,
        inTurnMove: false,
        history: { ...history, activeId: null },
        clock,
        persistRev: state.persistRev + 1,
      };
      return withWinnerStop(next, action.perfNowMs);
    }
    case "TICK": {
      const clock = tickClock(state.clock, action.perfNowMs);
      if (clock === state.clock) return state;
      const next = { ...state, clock };
      return withWinnerStop(next, action.perfNowMs);
    }
    case "LOAD": {
      const next = importPersistedGameState(action.persisted, action.perfNowMs, action.unixNowMs);
      if (!next) return state;
      let clock = next.clock;
      if (next.clock.enabled && next.clock.running) {
        clock = { ...next.clock, lastPerfNowMs: action.perfNowMs };
      } else {
        clock = { ...next.clock, lastPerfNowMs: null };
      }
      return { ...next, clock, persistRev: state.persistRev + 1 };
    }
    default: {
      return assertNever(action);
    }
  }
}

export function createDefaultGameState(perfNowMs: number): GameCoreState {
  return createInitialGameState(perfNowMs);
}
