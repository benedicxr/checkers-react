import { GAME_CONFIG, GAME_RULES } from "../constants";
import type { Coords, Move, Player } from "../types";
import type { Board } from "./Board";
import type { Checker } from "./Checker";

type DiagonalDelta = Readonly<{ dr: -1 | 1; dc: -1 | 1 }>;

export class MoveEngine {
  static #DIAGONAL_DELTAS: readonly DiagonalDelta[] = Object.freeze([
    Object.freeze({ dr: -1, dc: -1 }),
    Object.freeze({ dr: -1, dc: 1 }),
    Object.freeze({ dr: 1, dc: -1 }),
    Object.freeze({ dr: 1, dc: 1 }),
  ]);

  static getValidMoves(
    board: Board,
    turn: Player,
    row: number,
    col: number,
    { capturesOnly = false }: { capturesOnly?: boolean } = {},
  ): Move[] {
    const piece = board.getPiece(row, col);
    if (!piece || piece.color !== turn) return [];

    const captures = this.getCapturesForPiece(board, turn, row, col);
    if (capturesOnly) return captures;

    const quietMoves = this.getQuietMovesForPiece(board, turn, row, col);
    return [...captures, ...quietMoves];
  }

  static getCapturesForPiece(board: Board, turn: Player, row: number, col: number): Move[] {
    const piece = board.getPiece(row, col);
    if (!piece || piece.color !== turn) return [];

    if (piece.isKing && GAME_RULES.FLYING_KINGS) {
      return this.#getFlyingKingCaptures(board, piece, row, col);
    }

    const directions = this.#getCaptureDirections(piece);
    return this.#getShortCaptures(board, piece, row, col, directions);
  }

  static getQuietMovesForPiece(board: Board, turn: Player, row: number, col: number): Move[] {
    const piece = board.getPiece(row, col);
    if (!piece || piece.color !== turn) return [];

    if (piece.isKing && GAME_RULES.FLYING_KINGS) {
      return this.#getFlyingKingMoves(board, row, col);
    }

    const directions = piece.isKing
      ? [GAME_RULES.WHITE_DIRECTION, GAME_RULES.BLACK_DIRECTION]
      : [piece.color === GAME_CONFIG.WHITE_PLAYER ? GAME_RULES.WHITE_DIRECTION : GAME_RULES.BLACK_DIRECTION];

    const moves: Move[] = [];
    for (const dir of directions) {
      for (const side of GAME_RULES.SIDES) {
        const nextR = row + dir * GAME_RULES.MOVE_STEP;
        const nextC = col + side;
        if (board.isInside(nextR, nextC) && !board.getPiece(nextR, nextC)) {
          moves.push({ r: nextR, c: nextC, type: "move" });
        }
      }
    }
    return moves;
  }

  static playerHasCapture(board: Board, player: Player): boolean {
    for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
      for (let c = 0; c < GAME_CONFIG.COLS; c++) {
        const p = board.getPiece(r, c);
        if (!p || p.color !== player) continue;
        if (this.getCapturesForPiece(board, player, r, c).length > 0) return true;
      }
    }
    return false;
  }

  static getCapturingPieces(board: Board, player: Player): Coords[] {
    const coords: Coords[] = [];
    for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
      for (let c = 0; c < GAME_CONFIG.COLS; c++) {
        const p = board.getPiece(r, c);
        if (!p || p.color !== player) continue;
        if (this.getCapturesForPiece(board, player, r, c).length > 0) coords.push({ r, c });
      }
    }
    return coords;
  }

  static #getCaptureDirections(piece: Checker): number[] {
    if (piece.isKing) return [GAME_RULES.WHITE_DIRECTION, GAME_RULES.BLACK_DIRECTION];
    if (GAME_RULES.MEN_CAN_CAPTURE_BACKWARDS) return [GAME_RULES.WHITE_DIRECTION, GAME_RULES.BLACK_DIRECTION];
    return [piece.color === GAME_CONFIG.WHITE_PLAYER ? GAME_RULES.WHITE_DIRECTION : GAME_RULES.BLACK_DIRECTION];
  }

  static #getShortCaptures(board: Board, piece: Checker, row: number, col: number, directions: number[]): Move[] {
    const captures: Move[] = [];
    for (const dir of directions) {
      for (const side of GAME_RULES.SIDES) {
        const midR = row + dir * GAME_RULES.MOVE_STEP;
        const midC = col + side;
        const landR = row + dir * GAME_RULES.JUMP_STEP;
        const landC = col + side * GAME_RULES.JUMP_STEP;

        if (!board.isInside(landR, landC)) continue;
        if (board.getPiece(landR, landC)) continue;

        const middlePiece = board.getPiece(midR, midC);
        if (middlePiece && middlePiece.color !== piece.color) {
          captures.push({ r: landR, c: landC, type: "jump", target: { r: midR, c: midC } });
        }
      }
    }
    return captures;
  }

  static #getFlyingKingMoves(board: Board, row: number, col: number): Move[] {
    const moves: Move[] = [];

    for (const { dr, dc } of this.#DIAGONAL_DELTAS) {
      let r = row + dr;
      let c = col + dc;
      while (board.isInside(r, c) && !board.getPiece(r, c)) {
        moves.push({ r, c, type: "move" });
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  static #getFlyingKingCaptures(board: Board, piece: Checker, row: number, col: number): Move[] {
    const captures: Move[] = [];

    for (const { dr, dc } of this.#DIAGONAL_DELTAS) {
      let r = row + dr;
      let c = col + dc;

      while (board.isInside(r, c) && !board.getPiece(r, c)) {
        r += dr;
        c += dc;
      }

      if (!board.isInside(r, c)) continue;
      const target = board.getPiece(r, c);
      if (!target || target.color === piece.color) continue;

      let landR = r + dr;
      let landC = c + dc;
      while (board.isInside(landR, landC) && !board.getPiece(landR, landC)) {
        captures.push({ r: landR, c: landC, type: "jump", target: { r, c } });
        landR += dr;
        landC += dc;
      }
    }

    return captures;
  }
}
