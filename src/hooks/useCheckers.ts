import { useCallback } from "react";
import { GAME_CONFIG, CLOCK_CONFIG } from "../constants";
import type { Board, BoardSnapshot, Coords, Move, Player, SerializableClockSnapshot } from "../types";
import { getCapturingPieces, getValidMovesForPiece, getWinnerByBoard, playerHasCapture } from "../logic/gameRules";
import { getWinnerByTime, getSerializableSnapshot } from "../logic/clock";
import { getActiveEntry, getRenderList } from "../logic/moveHistory";
import { useGameReducer } from "./useGameReducer";
import { useTimer } from "./useTimer";

type ClockSnapshot = Readonly<
  SerializableClockSnapshot & {
    enabled: boolean;
  }
>;

type CheckersSnapshot = Readonly<{
  board: BoardSnapshot;
  turn: Player;
  winner: Player | null;
  mustCapture: boolean;
  captureChainPiece: Coords | null;
  selected: Coords | null;
  availableMoves: readonly Move[];
  capturingPieces: readonly Coords[];
  capturableTargets: readonly Coords[];
  capturedByWhite: number;
  capturedByBlack: number;
  canUndo: boolean;
  clock: ClockSnapshot;
  moves: ReadonlyArray<{ id: number; text: string }>;
  activeMoveId: number | null;
  activeMovePath: readonly Coords[] | null;
}>;

function coreMovesToUi(moves: ReturnType<typeof getValidMovesForPiece>): Move[] {
  return moves.map((m) => {
    if (m.type === "simple") return { r: m.to.r, c: m.to.c, type: "move" as const };
    return { r: m.to.r, c: m.to.c, type: "jump" as const, target: { ...m.captured } };
  });
}

function toBoardSnapshot(board: Board): BoardSnapshot {
  return board as unknown as BoardSnapshot;
}

export function useCheckers() {
  const { state, dispatch } = useGameReducer();

  useTimer({
    enabled: state.clock.enabled && state.clock.running,
    intervalMs: CLOCK_CONFIG.TICK_INTERVAL_MS,
    onTick: (perfNowMs) => dispatch({ type: "TICK", perfNowMs }),
  });

  const snapshot: CheckersSnapshot = (() => {
    const boardWinner = getWinnerByBoard(state.board, state.turn);
    const timeWinner = getWinnerByTime(state.clock);
    const winner = boardWinner ?? timeWinner;

    let mustCapture = false;
    if (winner !== null) {
      mustCapture = false;
    } else if (state.captureChainPiece !== null) {
      mustCapture = true;
    } else {
      mustCapture = playerHasCapture(state.board, state.turn);
    }

    const selected = state.captureChainPiece !== null ? state.captureChainPiece : state.selected;

    let availableMoves: Move[] = [];
    if (winner !== null || !selected) {
      availableMoves = [];
    } else if (state.captureChainPiece !== null) {
      availableMoves = coreMovesToUi(getValidMovesForPiece(state.board, state.turn, selected, { capturesOnly: true }));
    } else {
      availableMoves = coreMovesToUi(
        getValidMovesForPiece(state.board, state.turn, selected, { capturesOnly: mustCapture }),
      );
    }

    let capturingPieces: Coords[] = [];
    if (winner !== null || state.captureChainPiece !== null) {
      capturingPieces = [];
    } else if (mustCapture) {
      capturingPieces = getCapturingPieces(state.board, state.turn);
    } else {
      capturingPieces = [];
    }

    const capturableTargets = availableMoves
      .filter((m): m is Extract<Move, { type: "jump" }> => m.type === "jump")
      .map((m) => ({ ...m.target }));

    const currentWhite = state.board.flat().filter((p) => p && p.color === GAME_CONFIG.WHITE_PLAYER).length;
    const currentBlack = state.board.flat().filter((p) => p && p.color === GAME_CONFIG.BLACK_PLAYER).length;

    const capturedByWhite = Math.max(0, state.initialBlack - currentBlack);
    const capturedByBlack = Math.max(0, state.initialWhite - currentWhite);

    const activeEntry = getActiveEntry(state.history);
    const clockSnap = getSerializableSnapshot(state.clock);

    return {
      board: toBoardSnapshot(state.board),
      turn: state.turn,
      winner,
      mustCapture,
      captureChainPiece: state.captureChainPiece,
      selected,
      availableMoves,
      capturingPieces,
      capturableTargets,
      capturedByWhite,
      capturedByBlack,
      canUndo: state.undo.length > 0,
      clock: { enabled: state.clock.enabled, ...clockSnap },
      moves: getRenderList(state.history),
      activeMoveId: state.history.activeId,
      activeMovePath: activeEntry ? activeEntry.path : null,
    };
  })();

  const onCellClick = useCallback(
    (r: number, c: number) => {
      dispatch({ type: "CELL_CLICK", at: { r, c }, perfNowMs: performance.now() });
    },
    [dispatch],
  );

  const reset = useCallback(() => {
    dispatch({ type: "RESET", perfNowMs: performance.now() });
  }, [dispatch]);

  const undo = useCallback((): boolean => {
    if (state.undo.length === 0) return false;
    dispatch({ type: "UNDO", perfNowMs: performance.now() });
    return true;
  }, [dispatch, state.undo.length]);

  const setActiveMove = useCallback(
    (id: number | null) => {
      dispatch({ type: "SET_ACTIVE_MOVE", id });
    },
    [dispatch],
  );

  return {
    snapshot,
    onCellClick,
    reset,
    undo,
    setActiveMove,
  };
}
