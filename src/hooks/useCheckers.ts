import { useCallback, useEffect, useRef, useState } from "react";
import { CLOCK_CONFIG, GAME_CONFIG } from "../constants";
import type { BoardSnapshot, Coords, Move, Player, SerializableClockSnapshot } from "../types";
import { CheckerModel } from "../models/CheckerModel";
import { GameClock } from "../models/GameClock";
import { MoveHistoryModel } from "../models/MoveHistoryModel";

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

type ControllerState = {
  selected: Coords | null;
  captureChainPiece: Coords | null;
  inTurnMove: boolean;
  initialWhite: number;
  initialBlack: number;
};

function sameCoords(a: Coords | null, b: Coords | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.r === b.r && a.c === b.c;
}

function isMoveAt(m: Move, r: number, c: number): boolean {
  return m.r === r && m.c === c;
}

function computeSnapshotFrom(
  model: CheckerModel,
  history: MoveHistoryModel,
  ctrl: ControllerState,
  clock: GameClock,
): CheckersSnapshot {
  const modelWinner = model.getWinner();
  const clockWinner = clock.getWinnerByTime();
  const winner = modelWinner ?? clockWinner;

  let mustCapture = false;
  if (winner !== null) {
    mustCapture = false;
  } else if (ctrl.captureChainPiece !== null) {
    mustCapture = true;
  } else {
    mustCapture = model.playerHasCapture(model.turn);
  }

  const selected =
    ctrl.captureChainPiece !== null ? ctrl.captureChainPiece : ctrl.selected;

  let availableMoves: Move[] = [];
  if (winner !== null || !selected) {
    availableMoves = [];
  } else if (ctrl.captureChainPiece !== null) {
    availableMoves = model.getValidMoves(selected.r, selected.c, { mustCapture: true });
  } else {
    availableMoves = model.getValidMoves(selected.r, selected.c, { mustCapture });
  }

  let capturingPieces: Coords[] = [];
  if (winner !== null || ctrl.captureChainPiece !== null) {
    capturingPieces = [];
  } else if (mustCapture) {
    capturingPieces = model.getCapturingPieces(model.turn);
  } else {
    capturingPieces = [];
  }

  const capturableTargets = availableMoves
    .filter((m): m is Extract<Move, { type: "jump" }> => m.type === "jump")
    .map((m) => ({ ...m.target }));

  const currentWhite = model.countPieces(GAME_CONFIG.WHITE_PLAYER);
  const currentBlack = model.countPieces(GAME_CONFIG.BLACK_PLAYER);

  const capturedByWhite = Math.max(0, ctrl.initialBlack - currentBlack);
  const capturedByBlack = Math.max(0, ctrl.initialWhite - currentWhite);

  const activeMoveId = history.activeId;
  const activeEntry = activeMoveId ? history.getEntry(activeMoveId) : undefined;
  const clockSnap = clock.getSnapshot();

  return {
    board: model.board,
    turn: model.turn,
    winner,
    mustCapture,
    captureChainPiece: ctrl.captureChainPiece,
    selected,
    availableMoves,
    capturingPieces,
    capturableTargets,
    capturedByWhite,
    capturedByBlack,
    canUndo: model.canUndo(),
    clock: { enabled: clock.enabled, ...clockSnap },
    moves: history.getRenderList(),
    activeMoveId,
    activeMovePath: activeEntry ? activeEntry.path : null,
  };
}

export function useCheckers() {
  const [model] = useState(() => new CheckerModel());
  const [history] = useState(() => new MoveHistoryModel());
  const [clock] = useState(() => new GameClock({ activePlayer: model.turn }));
  const [ctrl] = useState<ControllerState>(() => ({
    selected: null,
    captureChainPiece: null,
    inTurnMove: false,
    initialWhite: model.countPieces(GAME_CONFIG.WHITE_PLAYER),
    initialBlack: model.countPieces(GAME_CONFIG.BLACK_PLAYER),
  }));

  const modelRef = useRef(model);
  const historyRef = useRef(history);
  const clockRef = useRef(clock);
  const controllerRef = useRef(ctrl);

  const [snapshot, setSnapshot] = useState<CheckersSnapshot>(() =>
    computeSnapshotFrom(model, history, ctrl, clock),
  );

  const refresh = useCallback(() => {
    setSnapshot(
      computeSnapshotFrom(
        modelRef.current,
        historyRef.current,
        controllerRef.current,
        clockRef.current,
      ),
    );
  }, []);

  const tickAndMaybeStop = useCallback(() => {
    const perfNow = performance.now();
    const c = clockRef.current;
    c.tick(perfNow);
    if (c.getWinnerByTime() !== null || modelRef.current.getWinner() !== null) {
      c.stop(perfNow);
    }
  }, []);

  const getWinnerNow = useCallback((): Player | null => {
    tickAndMaybeStop();
    return modelRef.current.getWinner() ?? clockRef.current.getWinnerByTime();
  }, [tickAndMaybeStop]);

  useEffect(() => {
    const perfNow = performance.now();
    clockRef.current.reset(modelRef.current.turn, perfNow);

    const id = window.setInterval(() => {
      tickAndMaybeStop();
      setSnapshot(
        computeSnapshotFrom(
          modelRef.current,
          historyRef.current,
          controllerRef.current,
          clockRef.current,
        ),
      );
    }, CLOCK_CONFIG.TICK_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [tickAndMaybeStop]);

  const clearSelection = useCallback(() => {
    const c = controllerRef.current;
    if (c.captureChainPiece) return;
    c.selected = null;
    refresh();
  }, [refresh]);

  const selectCell = useCallback(
    (r: number, c: number) => {
      const m = modelRef.current;
      const cst = controllerRef.current;
      const h = historyRef.current;

      if (getWinnerNow() !== null) return;

      h.setActive(null);

      if (cst.captureChainPiece && (cst.captureChainPiece.r !== r || cst.captureChainPiece.c !== c)) {
        return;
      }

      const piece = m.getPiece(r, c);
      if (!piece || piece.color !== m.turn) {
        cst.selected = null;
        refresh();
        return;
      }

      const mustCapture =
        cst.captureChainPiece !== null ? true : m.playerHasCapture(m.turn);

      const moves = m.getValidMoves(r, c, { mustCapture });
      if (mustCapture && moves.length === 0) return;

      cst.selected = { r, c };
      refresh();
    },
    [getWinnerNow, refresh],
  );

  const applyMove = useCallback(
    (from: Coords, to: Coords, details: Move) => {
      const m = modelRef.current;
      const cst = controllerRef.current;
      const h = historyRef.current;
      const clk = clockRef.current;

      if (getWinnerNow() !== null) return;

      if (!cst.inTurnMove) {
        m.pushHistory();
        cst.inTurnMove = true;
      }

      const isCapture = details.type === "jump";
      h.beginIfNeeded(m.turn, from, { isCapture });
      m.applyMove(from, to, details, { switchTurn: false });
      h.appendStep(to, { isCapture });

      if (details.type === "jump") {
        const nextCaptures = m.getValidMoves(to.r, to.c, { mustCapture: true });
        if (nextCaptures.length > 0) {
          cst.captureChainPiece = { ...to };
          cst.selected = { ...to };
          refresh();
          return;
        }
      }

      m.endTurn();
      clk.setActivePlayer(m.turn);
      h.finalizePending();
      cst.captureChainPiece = null;
      cst.selected = null;
      cst.inTurnMove = false;
      tickAndMaybeStop();
      refresh();
    },
    [getWinnerNow, refresh, tickAndMaybeStop],
  );

  const onCellClick = useCallback(
    (r: number, c: number) => {
      const model = modelRef.current;
      const cst = controllerRef.current;

      if (getWinnerNow() !== null) return;

      const selected = cst.captureChainPiece ?? cst.selected;
      if (selected) {
        const moves =
          cst.captureChainPiece !== null
            ? model.getValidMoves(selected.r, selected.c, { mustCapture: true })
            : model.getValidMoves(selected.r, selected.c, {
                mustCapture: model.playerHasCapture(model.turn),
              });

        const move = moves.find((mm) => isMoveAt(mm, r, c));
        if (move) {
          applyMove(selected, { r, c }, move);
          return;
        }

        if (sameCoords(selected, { r, c })) {
          clearSelection();
          return;
        }
      }

      selectCell(r, c);
    },
    [applyMove, clearSelection, getWinnerNow, selectCell],
  );

  const reset = useCallback(() => {
    const m = modelRef.current;
    const h = historyRef.current;
    const cst = controllerRef.current;
    const clk = clockRef.current;

    m.reset();
    h.reset();
    cst.selected = null;
    cst.captureChainPiece = null;
    cst.inTurnMove = false;
    cst.initialWhite = m.countPieces(GAME_CONFIG.WHITE_PLAYER);
    cst.initialBlack = m.countPieces(GAME_CONFIG.BLACK_PLAYER);
    clk.reset(m.turn);
    refresh();
  }, [refresh]);

  const undo = useCallback((): boolean => {
    const m = modelRef.current;
    const h = historyRef.current;
    const cst = controllerRef.current;
    const clk = clockRef.current;

    const ok = m.undo();
    if (!ok) return false;

    const hadPending = h.cancelPending();
    if (!hadPending) h.popLastEntry();
    h.setActive(null);
    cst.selected = null;
    cst.captureChainPiece = null;
    cst.inTurnMove = false;
    clk.setActivePlayer(m.turn);
    refresh();
    return true;
  }, [refresh]);

  const setActiveMove = useCallback(
    (id: number | null) => {
      const h = historyRef.current;
      if (id !== null && !h.getEntry(id)) return;
      h.setActive(id);
      refresh();
    },
    [refresh],
  );

  return {
    snapshot,
    onCellClick,
    reset,
    undo,
    setActiveMove,
  };
}
