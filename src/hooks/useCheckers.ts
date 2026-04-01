import { useCallback, useEffect, useMemo, useReducer } from "react";
import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { Board, BoardSnapshot, Coords, Move, Player, SerializableClockSnapshot } from "../types";
import { getCapturingPieces, getValidMovesForPiece, getWinnerByBoard, playerHasCapture } from "../logic/gameRules";
import { getWinnerByTime } from "../logic/clock";
import { getActiveEntry, getRenderList } from "../logic/moveHistory";
import { useGameReducer } from "./useGameReducer";
import { useStorage } from "./useStorage";
import { useTimer } from "./useTimer";
import { createTimerState, timerReducer } from "../logic/timerReducer";

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

const EMPTY_MOVES: readonly Move[] = [];
const EMPTY_COORDS: readonly Coords[] = [];
const EMPTY_RENDER_MOVES: ReadonlyArray<{ id: number; text: string }> = [];

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

  const timeWinner = getWinnerByTime(state.clock);

  useStorage({ state, dispatch });

  const [timer, dispatchTimer] = useReducer(
    timerReducer,
    {
      enabled: state.clock.enabled,
      whiteMs: state.clock.whiteMs,
      blackMs: state.clock.blackMs,
      activePlayer: state.clock.activePlayer,
      running: state.clock.running,
    },
    createTimerState,
  );

  useEffect(() => {
    dispatchTimer({
      type: "SYNC_FROM_GAME",
      clock: {
        enabled: state.clock.enabled,
        whiteMs: state.clock.whiteMs,
        blackMs: state.clock.blackMs,
        activePlayer: state.clock.activePlayer,
        running: state.clock.running,
      },
      perfNowMs: performance.now(),
    });
  }, [state.clock.activePlayer, state.clock.blackMs, state.clock.enabled, state.clock.running, state.clock.whiteMs]);

  useTimer({
    enabled: timer.enabled && timer.running,
    intervalMs: CLOCK_CONFIG.TICK_INTERVAL_MS,
    onTick: (perfNowMs) => dispatchTimer({ type: "TICK", perfNowMs }),
  });

  useEffect(() => {
    if (timer.timeoutWinner === null) return;
    dispatch({ type: "TIME_OUT", winner: timer.timeoutWinner, perfNowMs: performance.now() });
    dispatchTimer({ type: "ACK_TIMEOUT" });
  }, [dispatch, timer.timeoutWinner]);

  const gameSnapshot = useMemo(() => {
    const boardWinner = getWinnerByBoard(state.board, state.turn);
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

    let availableMoves: readonly Move[] = EMPTY_MOVES;
    if (winner !== null || !selected) {
      availableMoves = EMPTY_MOVES;
    } else if (state.captureChainPiece !== null) {
      availableMoves = coreMovesToUi(getValidMovesForPiece(state.board, state.turn, selected, { capturesOnly: true }));
    } else {
      availableMoves = coreMovesToUi(
        getValidMovesForPiece(state.board, state.turn, selected, { capturesOnly: mustCapture }),
      );
    }

    let capturingPieces: readonly Coords[] = EMPTY_COORDS;
    if (winner !== null || state.captureChainPiece !== null) {
      capturingPieces = EMPTY_COORDS;
    } else if (mustCapture) {
      capturingPieces = getCapturingPieces(state.board, state.turn);
    } else {
      capturingPieces = EMPTY_COORDS;
    }

    const capturableTargets =
      availableMoves.length === 0
        ? EMPTY_COORDS
        : (availableMoves
            .filter((m): m is Extract<Move, { type: "jump" }> => m.type === "jump")
            .map((m) => ({ ...m.target })) as readonly Coords[]);

    const currentWhite = state.board.flat().filter((p) => p && p.color === GAME_CONFIG.WHITE_PLAYER).length;
    const currentBlack = state.board.flat().filter((p) => p && p.color === GAME_CONFIG.BLACK_PLAYER).length;

    const capturedByWhite = Math.max(0, state.initialBlack - currentBlack);
    const capturedByBlack = Math.max(0, state.initialWhite - currentWhite);

    const activeEntry = getActiveEntry(state.history);

    const moves = state.history.entries.length === 0 ? EMPTY_RENDER_MOVES : getRenderList(state.history);

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
      moves,
      activeMoveId: state.history.activeId,
      activeMovePath: activeEntry ? activeEntry.path : null,
    };
  }, [
    state.board,
    state.captureChainPiece,
    state.history,
    state.initialBlack,
    state.initialWhite,
    state.selected,
    state.turn,
    state.undo.length,
    timeWinner,
  ]);

  const clockSnapshot: ClockSnapshot = useMemo(() => {
    const clockSnap: SerializableClockSnapshot = {
      whiteMs: timer.whiteMs,
      blackMs: timer.blackMs,
      activePlayer: timer.activePlayer,
      running: timer.running,
    };
    return { enabled: timer.enabled, ...clockSnap };
  }, [timer]);

  const snapshot: CheckersSnapshot = { ...gameSnapshot, clock: clockSnapshot };

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
