import { GAME_CONFIG } from "../constants";
import type { CoreMove, Player } from "../types";
import { getCapturesForPiece } from "./gameRules";
import { appendStep, beginIfNeeded, finalizePending } from "./moveHistory";
import type { GameState, UndoEntry } from "./gameReducer";
import { cloneBoard, maybePromote, movePiece, removePiece, setPiece } from "./boardUtils";

function otherPlayer(p: Player): Player {
  return p === GAME_CONFIG.WHITE_PLAYER ? GAME_CONFIG.BLACK_PLAYER : GAME_CONFIG.WHITE_PLAYER;
}

function pushUndoIfNeeded(state: GameState): GameState {
  if (state.controller.inTurnMove) return state;
  const entry: UndoEntry = {
    turn: state.model.turn,
    nextId: state.model.nextId,
    board: cloneBoard(state.model.board),
  };
  return {
    ...state,
    controller: { ...state.controller, undo: [...state.controller.undo, entry], inTurnMove: true },
  };
}

export function applyMove(state: GameState, chosen: CoreMove): GameState {
  let next = pushUndoIfNeeded(state);

  const isCapture = chosen.type === "capture";
  next = {
    ...next,
    controller: {
      ...next.controller,
      history: appendStep(
        beginIfNeeded(next.controller.history, next.model.turn, chosen.from, { isCapture }),
        chosen.to,
        { isCapture },
      ),
    },
  };

  const movedRes = movePiece(next.model.board, chosen.from, chosen.to);
  let board = movedRes.board;
  if (chosen.type === "capture") {
    board = removePiece(board, chosen.captured);
  }
  const promoted = maybePromote(movedRes.moved, chosen.to.r);
  board = setPiece(board, chosen.to, promoted);

  if (chosen.type === "capture") {
    const moreCaptures = getCapturesForPiece(board, next.model.turn, chosen.to);
    if (moreCaptures.length > 0) {
      return {
        ...next,
        model: { ...next.model, board, selected: { ...chosen.to } },
        controller: { ...next.controller, captureChainPiece: { ...chosen.to } },
      };
    }
  }

  const nextTurn = otherPlayer(next.model.turn);

  return {
    ...next,
    model: { ...next.model, board, turn: nextTurn, selected: null },
    controller: {
      ...next.controller,
      captureChainPiece: null,
      inTurnMove: false,
      history: finalizePending(next.controller.history),
    },
  };
}

