import { GAME_CONFIG, GAME_RULES } from "../constants";
import type { Board, Color, Coords, CoreMove, Piece } from "../types";
import { getPiece, isInside, countPieces } from "./boardUtils";

type DiagonalDelta = Readonly<{ dr: -1 | 1; dc: -1 | 1 }>;

const DIAGONAL_DELTAS: readonly DiagonalDelta[] = Object.freeze([
  Object.freeze({ dr: -1, dc: -1 }),
  Object.freeze({ dr: -1, dc: 1 }),
  Object.freeze({ dr: 1, dc: -1 }),
  Object.freeze({ dr: 1, dc: 1 }),
]);

export function getValidMovesForPiece(
  board: Board,
  turn: Color,
  from: Coords,
  { capturesOnly = false }: { capturesOnly?: boolean } = {},
): CoreMove[] {
  const piece = getPiece(board, from.r, from.c);
  if (!piece || piece.color !== turn) return [];

  const captures = getCapturesForPiece(board, turn, from);
  if (capturesOnly) return captures;

  const quietMoves = getQuietMovesForPiece(board, turn, from);
  return [...captures, ...quietMoves];
}

export function getCapturesForPiece(board: Board, turn: Color, from: Coords): CoreMove[] {
  const piece = getPiece(board, from.r, from.c);
  if (!piece || piece.color !== turn) return [];

  if (piece.isKing && GAME_RULES.FLYING_KINGS) {
    return getFlyingKingCaptures(board, piece, from);
  }

  const directions = getCaptureDirections(piece);
  return getShortCaptures(board, piece, from, directions);
}

export function getQuietMovesForPiece(board: Board, turn: Color, from: Coords): CoreMove[] {
  const piece = getPiece(board, from.r, from.c);
  if (!piece || piece.color !== turn) return [];

  if (piece.isKing && GAME_RULES.FLYING_KINGS) {
    return getFlyingKingMoves(board, from);
  }

  const directions = piece.isKing
    ? [GAME_RULES.WHITE_DIRECTION, GAME_RULES.BLACK_DIRECTION]
    : [piece.color === GAME_CONFIG.WHITE_PLAYER ? GAME_RULES.WHITE_DIRECTION : GAME_RULES.BLACK_DIRECTION];

  const moves: CoreMove[] = [];
  for (const dir of directions) {
    for (const side of GAME_RULES.SIDES) {
      const to: Coords = { r: from.r + dir * GAME_RULES.MOVE_STEP, c: from.c + side };
      if (isInside(to.r, to.c) && !getPiece(board, to.r, to.c)) {
        moves.push({ type: "simple", from, to });
      }
    }
  }
  return moves;
}

export function playerHasCapture(board: Board, player: Color): boolean {
  for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
    for (let c = 0; c < GAME_CONFIG.COLS; c++) {
      const p = board[r]![c]!;
      if (!p || p.color !== player) continue;
      if (getCapturesForPiece(board, player, { r, c }).length > 0) return true;
    }
  }
  return false;
}

export function getCapturingPieces(board: Board, player: Color): Coords[] {
  const coords: Coords[] = [];
  for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
    for (let c = 0; c < GAME_CONFIG.COLS; c++) {
      const p = board[r]![c]!;
      if (!p || p.color !== player) continue;
      if (getCapturesForPiece(board, player, { r, c }).length > 0) coords.push({ r, c });
    }
  }
  return coords;
}

export function playerHasAnyMove(board: Board, player: Color): boolean {
  if (playerHasCapture(board, player)) return true;
  for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
    for (let c = 0; c < GAME_CONFIG.COLS; c++) {
      const p = board[r]![c]!;
      if (!p || p.color !== player) continue;
      if (getQuietMovesForPiece(board, player, { r, c }).length > 0) return true;
    }
  }
  return false;
}

export function getWinnerByBoard(board: Board, turn: Color): Color | null {
  const whiteCount = countPieces(board, GAME_CONFIG.WHITE_PLAYER);
  const blackCount = countPieces(board, GAME_CONFIG.BLACK_PLAYER);

  if (whiteCount === 0 && blackCount === 0) return null;
  if (whiteCount === 0) return GAME_CONFIG.BLACK_PLAYER;
  if (blackCount === 0) return GAME_CONFIG.WHITE_PLAYER;

  if (!playerHasAnyMove(board, turn)) {
    return turn === GAME_CONFIG.WHITE_PLAYER ? GAME_CONFIG.BLACK_PLAYER : GAME_CONFIG.WHITE_PLAYER;
  }

  return null;
}

function getCaptureDirections(piece: Piece): number[] {
  if (piece.isKing) return [GAME_RULES.WHITE_DIRECTION, GAME_RULES.BLACK_DIRECTION];
  if (GAME_RULES.MEN_CAN_CAPTURE_BACKWARDS) return [GAME_RULES.WHITE_DIRECTION, GAME_RULES.BLACK_DIRECTION];
  return [piece.color === GAME_CONFIG.WHITE_PLAYER ? GAME_RULES.WHITE_DIRECTION : GAME_RULES.BLACK_DIRECTION];
}

function getShortCaptures(board: Board, piece: Piece, from: Coords, directions: number[]): CoreMove[] {
  const captures: CoreMove[] = [];
  for (const dir of directions) {
    for (const side of GAME_RULES.SIDES) {
      const mid: Coords = { r: from.r + dir * GAME_RULES.MOVE_STEP, c: from.c + side };
      const to: Coords = { r: from.r + dir * GAME_RULES.JUMP_STEP, c: from.c + side * GAME_RULES.JUMP_STEP };

      if (!isInside(to.r, to.c)) continue;
      if (getPiece(board, to.r, to.c)) continue;

      const middlePiece = getPiece(board, mid.r, mid.c);
      if (middlePiece && middlePiece.color !== piece.color) {
        captures.push({ type: "capture", from, to, captured: mid });
      }
    }
  }
  return captures;
}

function getFlyingKingMoves(board: Board, from: Coords): CoreMove[] {
  const moves: CoreMove[] = [];
  for (const { dr, dc } of DIAGONAL_DELTAS) {
    let r = from.r + dr;
    let c = from.c + dc;
    while (isInside(r, c) && !getPiece(board, r, c)) {
      moves.push({ type: "simple", from, to: { r, c } });
      r += dr;
      c += dc;
    }
  }
  return moves;
}

function getFlyingKingCaptures(board: Board, piece: Piece, from: Coords): CoreMove[] {
  const captures: CoreMove[] = [];

  for (const { dr, dc } of DIAGONAL_DELTAS) {
    let r = from.r + dr;
    let c = from.c + dc;

    while (isInside(r, c) && !getPiece(board, r, c)) {
      r += dr;
      c += dc;
    }

    if (!isInside(r, c)) continue;
    const target = getPiece(board, r, c);
    if (!target || target.color === piece.color) continue;

    let landR = r + dr;
    let landC = c + dc;
    while (isInside(landR, landC) && !getPiece(board, landR, landC)) {
      captures.push({ type: "capture", from, to: { r: landR, c: landC }, captured: { r, c } });
      landR += dr;
      landC += dc;
    }
  }

  return captures;
}

