import { GAME_CONFIG } from "../constants";
import type { CoreMove, Player } from "../types";
import { getCapturesForPiece } from "./gameRules";
import { beginIfNeeded, appendStep, finalizePending } from "./moveHistory";
import type { GameCoreState, UndoEntry } from "./persistence";
import { cloneBoard, maybePromote, movePiece, removePiece, setPiece } from "./boardUtils";
import { setActivePlayer } from "./clock";

function otherPlayer(p: Player): Player {
  return p === GAME_CONFIG.WHITE_PLAYER ? GAME_CONFIG.BLACK_PLAYER : GAME_CONFIG.WHITE_PLAYER;
}

function pushUndoIfNeeded(state: GameCoreState): GameCoreState {
  if (state.inTurnMove) return state;
  const entry: UndoEntry = {
    turn: state.turn,
    nextId: state.nextId,
    board: cloneBoard(state.board),
  };
  return { ...state, undo: [...state.undo, entry], inTurnMove: true };
}

export function applyMove(state: GameCoreState, chosen: CoreMove, perfNowMs: number): GameCoreState {
  let next = pushUndoIfNeeded(state);

  const isCapture = chosen.type === "capture";
  next = {
    ...next,
    history: appendStep(beginIfNeeded(next.history, next.turn, chosen.from, { isCapture }), chosen.to, { isCapture }),
  };

  const movedRes = movePiece(next.board, chosen.from, chosen.to);
  let board = movedRes.board;
  if (chosen.type === "capture") {
    board = removePiece(board, chosen.captured);
  }
  const promoted = maybePromote(movedRes.moved, chosen.to.r);
  board = setPiece(board, chosen.to, promoted);

  if (chosen.type === "capture") {
    const moreCaptures = getCapturesForPiece(board, next.turn, chosen.to);
    if (moreCaptures.length > 0) {
      return {
        ...next,
        board,
        captureChainPiece: { ...chosen.to },
        selected: { ...chosen.to },
      };
    }
  }

  const nextTurn = otherPlayer(next.turn);
  const clock = setActivePlayer(next.clock, nextTurn, perfNowMs);

  return {
    ...next,
    board,
    turn: nextTurn,
    captureChainPiece: null,
    selected: null,
    inTurnMove: false,
    history: finalizePending(next.history),
    clock,
    persistRev: next.persistRev + 1,
  };
}

