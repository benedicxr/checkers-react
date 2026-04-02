import { GAME_CONFIG, GAME_RULES } from "../constants";
import type { Coords, Move, Player, Board } from "../types";
import type { TimerState } from "../types/timer";
import {
  getCapturingPieces,
  getValidMovesForPiece,
  getWinnerByBoard,
  playerHasCapture,
} from "./gameRules";
import { countPieces } from "./boardUtils";
import type { GameState } from "./gameReducer";

const EMPTY_COORDS: readonly Coords[] = [];
const EMPTY_MOVES: readonly Move[] = [];

function coreMovesToUi(moves: ReturnType<typeof getValidMovesForPiece>): Move[] {
  return moves.map((m) => {
    if (m.type === "simple") return { r: m.to.r, c: m.to.c, type: "move" as const };
    return { r: m.to.r, c: m.to.c, type: "jump" as const, target: { ...m.captured } };
  });
}

function getWinnerByTimer(timer: TimerState): Player | null {
  if (!timer.enabled) return null;
  if (timer.whiteMs <= 0) return GAME_CONFIG.BLACK_PLAYER;
  if (timer.blackMs <= 0) return GAME_CONFIG.WHITE_PLAYER;
  return null;
}

export function getWinner(state: GameState, timer: TimerState): Player | null {
  const timeWinner = timer.timeoutWinner ?? getWinnerByTimer(timer);
  const boardWinner = getWinnerByBoard(state.board, state.turn);
  return boardWinner ?? timeWinner;
}

export function getValidMoves(
  state: GameState,
  winner: Player | null,
): {
  mustCapture: boolean;
  availableMoves: readonly Move[];
  capturingPieces: readonly Coords[];
  capturableTargets: readonly Coords[];
  selected: Coords | null;
} {
  const captureChainPiece = state.captureChainPiece;

  let mustCapture = false;
  if (captureChainPiece !== null) {
    mustCapture = true;
  } else if (winner === null) {
    mustCapture = playerHasCapture(state.board, state.turn);
  }

  const selected = captureChainPiece !== null ? captureChainPiece : state.selected;

  let availableMoves: readonly Move[] = EMPTY_MOVES;
  if (winner === null && selected) {
    if (captureChainPiece !== null) {
      availableMoves = coreMovesToUi(
        getValidMovesForPiece(state.board, state.turn, selected, { capturesOnly: true }),
      );
    } else {
      availableMoves = coreMovesToUi(
        getValidMovesForPiece(state.board, state.turn, selected, { capturesOnly: mustCapture }),
      );
    }
  }

  let capturingPieces: readonly Coords[] = EMPTY_COORDS;
  if (winner !== null || captureChainPiece !== null) {
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

  return {
    mustCapture,
    availableMoves,
    capturingPieces,
    capturableTargets,
    selected,
  };
}

export function getCapturedCounts(state: GameState): {
  capturedByWhite: number;
  capturedByBlack: number;
} {
  const currentWhite = countPieces(state.board as unknown as Board, GAME_CONFIG.WHITE_PLAYER);
  const currentBlack = countPieces(state.board as unknown as Board, GAME_CONFIG.BLACK_PLAYER);

  const initialCount = GAME_RULES.INITIAL_PIECE_ROWS * (GAME_CONFIG.COLS / 2);
  const capturedByWhite = Math.max(0, initialCount - currentBlack);
  const capturedByBlack = Math.max(0, initialCount - currentWhite);

  return {
    capturedByWhite,
    capturedByBlack,
  };
}
