import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { Board, BoardSnapshot, Clock, Coords, Move, Player, TimerClockSnapshot, TimerState } from "../types";
import { getActiveEntry, getRenderList } from "../logic/moveHistory";
import { getWinner, getValidMoves, getCapturedCounts } from "../logic/selectors";
import { createInitialGameState, gameReducer } from "../logic/gameReducer";
import type { GameState } from "../logic/gameReducer";
import { exportPersistedGameState, importPersistedGameState } from "../logic/persistence";
import { createTimerState, timerReducer } from "../logic/timerReducer";
import { useStorage } from "./useStorage";
import { useTimer } from "./useTimer";

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
  clock: TimerClockSnapshot;
  moves: ReadonlyArray<{ id: number; text: string }>;
  activeMoveId: number | null;
  activeMovePath: readonly Coords[] | null;
}>;

const EMPTY_RENDER_MOVES: ReadonlyArray<{ id: number; text: string }> = [];

function toBoardSnapshot(board: Board): BoardSnapshot {
  return board as unknown as BoardSnapshot;
}

function createDefaultTimerClockSnapshot(activePlayer: Player): TimerClockSnapshot {
  const initialMs = CLOCK_CONFIG.INITIAL_TIME_MS;
  return {
    enabled: CLOCK_CONFIG.ENABLED,
    initialMs,
    whiteMs: initialMs,
    blackMs: initialMs,
    activePlayer,
    running: CLOCK_CONFIG.ENABLED,
  };
}

export function useCheckers(clock: Clock = { now: () => performance.now() }) {
  const [persistRev, bumpPersist] = useReducer((x: number) => x + 1, 0);

  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const [timer, dispatchTimer] = useReducer(
    timerReducer,
    createDefaultTimerClockSnapshot(GAME_CONFIG.WHITE_PLAYER),
    createTimerState,
  );

  const stateRef = useRef<GameState>(state);
  const timerRef = useRef<TimerState>(timer);
  const snapshotRef = useRef<CheckersSnapshot | null>(null);
  const suppressTurnSyncRef = useRef(false);

  useLayoutEffect(() => {
    stateRef.current = state;
    timerRef.current = timer;
  }, [state, timer]);

  const onHydrate = useCallback((raw: unknown, meta: { perfNowMs: number; unixNowMs: number }) => {
    const imported = importPersistedGameState({ raw, perfNowMs: meta.perfNowMs, unixNowMs: meta.unixNowMs });
    if (!imported) return;
    suppressTurnSyncRef.current = true;
    dispatch({ type: "SET_STATE", state: imported.game });
    dispatchTimer({ type: "SET_STATE", state: imported.timer });
  }, []);

  useStorage({
    rev: persistRev,
    onHydrate,
    getPersisted: ({ unixNowMs }) => exportPersistedGameState({ game: stateRef.current, timer: timerRef.current, unixNowMs }),
  });

  useTimer({
    enabled: timer.enabled && timer.running,
    intervalMs: CLOCK_CONFIG.TICK_INTERVAL_MS,
    onTick: (perfNowMs) => dispatchTimer({ type: "TICK", perfNowMs }),
  });

  const timerStart = useCallback(() => dispatchTimer({ type: "START", perfNowMs: clock.now() }), [clock]);
  const timerStop = useCallback(() => dispatchTimer({ type: "STOP", perfNowMs: clock.now() }), [clock]);
  const timerSwitchPlayer = useCallback(
    (nextPlayer: Player) => dispatchTimer({ type: "SWITCH_PLAYER", nextPlayer, perfNowMs: clock.now() }),
    [clock],
  );
  const timerReset = useCallback(
    (next: TimerClockSnapshot) => dispatchTimer({ type: "RESET", timer: next, perfNowMs: clock.now() }),
    [clock],
  );

  useEffect(() => {
    if (timer.timeoutWinner === null) return;
    bumpPersist();
    dispatchTimer({ type: "ACK_TIMEOUT" });
  }, [timer.timeoutWinner]);

  useEffect(() => {
    if (suppressTurnSyncRef.current) {
      suppressTurnSyncRef.current = false;
      return;
    }
    if (!timer.enabled) return;
    if (timer.activePlayer === state.model.turn) return;
    timerSwitchPlayer(state.model.turn);
  }, [state.model.turn, timer.activePlayer, timer.enabled, timerSwitchPlayer]);

  useEffect(() => {
    if (!timer.enabled) return;
    const winner = getWinner(state, timer);

    if (winner !== null) {
      if (timer.running) timerStop();
      return;
    }

    if (!timer.running) {
      timerStart();
    }
  }, [state, timer, timer.enabled, timer.running, timer.timeoutWinner, timerStart, timerStop]);

  const snapshot = useMemo((): CheckersSnapshot => {
    const winner = getWinner(state, timer);
    const { mustCapture, availableMoves, capturingPieces, capturableTargets, selected } = getValidMoves(
      state,
      winner,
    );
    const { capturedByWhite, capturedByBlack } = getCapturedCounts(state);

    const activeEntry = getActiveEntry(state.controller.history);
    const moves = state.controller.history.entries.length === 0 ? EMPTY_RENDER_MOVES : getRenderList(state.controller.history);

    return {
      board: toBoardSnapshot(state.model.board),
      turn: state.model.turn,
      winner,
      mustCapture,
      captureChainPiece: state.controller.captureChainPiece,
      selected,
      availableMoves,
      capturingPieces,
      capturableTargets,
      capturedByWhite,
      capturedByBlack,
      canUndo: state.controller.undo.length > 0,
      clock: {
        enabled: timer.enabled,
        initialMs: timer.initialMs,
        whiteMs: timer.whiteMs,
        blackMs: timer.blackMs,
        activePlayer: timer.activePlayer,
        running: timer.running,
      },
      moves,
      activeMoveId: state.controller.history.activeId,
      activeMovePath: activeEntry ? activeEntry.path : null,
    };
  }, [state, timer]);

  useLayoutEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const onCellClick = useCallback((r: number, c: number) => {
    if (timerRef.current.timeoutWinner !== null) return;

    const snap = snapshotRef.current;
    const isMoveClick = Boolean(snap && snap.winner === null && snap.availableMoves.some((m) => m.r === r && m.c === c));

    dispatch({ type: "CELL_CLICK", at: { r, c } });
    if (isMoveClick) bumpPersist();
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    timerReset(createDefaultTimerClockSnapshot(GAME_CONFIG.WHITE_PLAYER));
    bumpPersist();
  }, [timerReset]);

  const undo = useCallback((): boolean => {
    if (stateRef.current.controller.undo.length === 0) return false;
    dispatch({ type: "UNDO" });
    bumpPersist();
    return true;
  }, []);

  const setActiveMove = useCallback((id: number | null) => {
    dispatch({ type: "SET_ACTIVE_MOVE", id });
  }, []);

  return { snapshot, onCellClick, reset, undo, setActiveMove };
}
