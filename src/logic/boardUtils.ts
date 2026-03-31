import { GAME_CONFIG, GAME_RULES } from "../constants";
import type { Board, Color, Coords, Piece } from "../types";

export function isInside(r: number, c: number): boolean {
  return r >= 0 && r < GAME_CONFIG.ROWS && c >= 0 && c < GAME_CONFIG.COLS;
}

export function isDarkCell(r: number, c: number): boolean {
  return (r + c) % GAME_RULES.DARK_CELL_MOD === GAME_RULES.DARK_CELL_REMAINDER;
}

export function createEmptyBoard(): Board {
  return Array.from({ length: GAME_CONFIG.ROWS }, () => Array.from({ length: GAME_CONFIG.COLS }, () => null));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function getPiece(board: Board, r: number, c: number): Piece | null {
  if (!isInside(r, c)) return null;
  return board[r]![c]!;
}

function setCell(board: Board, r: number, c: number, value: Piece | null): Board {
  if (!isInside(r, c)) return board;
  const next = board.slice();
  const row = next[r]!.slice();
  row[c] = value;
  next[r] = row;
  return next;
}

export function setPiece(board: Board, at: Coords, piece: Piece | null): Board {
  return setCell(board, at.r, at.c, piece);
}

export function movePiece(board: Board, from: Coords, to: Coords): { board: Board; moved: Piece | null } {
  const piece = getPiece(board, from.r, from.c);
  let next = board;
  next = setCell(next, to.r, to.c, piece);
  next = setCell(next, from.r, from.c, null);
  return { board: next, moved: piece };
}

export function removePiece(board: Board, at: Coords): Board {
  return setCell(board, at.r, at.c, null);
}

export function maybePromote(piece: Piece | null, toRow: number): Piece | null {
  if (!piece || piece.isKing) return piece;
  if (piece.color === GAME_CONFIG.WHITE_PLAYER && toRow === 0) return { ...piece, isKing: true };
  if (piece.color === GAME_CONFIG.BLACK_PLAYER && toRow === GAME_CONFIG.ROWS - 1) return { ...piece, isKing: true };
  return piece;
}

export function createPiece(color: Color, id: number): Piece {
  return { id, color, isKing: false };
}

export function createInitialBoard(): { board: Board; nextId: number; initialWhite: number; initialBlack: number } {
  const board = createEmptyBoard();
  let nextId = 1;

  for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
    for (let c = 0; c < GAME_CONFIG.COLS; c++) {
      if (!isDarkCell(r, c)) continue;
      if (r < GAME_RULES.INITIAL_PIECE_ROWS) {
        board[r]![c] = createPiece(GAME_CONFIG.BLACK_PLAYER, nextId++);
      } else if (r >= GAME_CONFIG.ROWS - GAME_RULES.INITIAL_PIECE_ROWS) {
        board[r]![c] = createPiece(GAME_CONFIG.WHITE_PLAYER, nextId++);
      }
    }
  }

  const initialWhite = countPieces(board, GAME_CONFIG.WHITE_PLAYER);
  const initialBlack = countPieces(board, GAME_CONFIG.BLACK_PLAYER);
  return { board, nextId, initialWhite, initialBlack };
}

export function countPieces(board: Board, player: Color): number {
  let count = 0;
  for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
    for (let c = 0; c < GAME_CONFIG.COLS; c++) {
      const p = board[r]![c]!;
      if (p && p.color === player) count++;
    }
  }
  return count;
}
