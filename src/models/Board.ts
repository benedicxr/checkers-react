import { GAME_CONFIG, GAME_RULES } from "../constants";
import type { BoardSnapshot, CheckerSnapshot, Coords } from "../types";
import type { Checker } from "./Checker";

export class Board {
  #grid: (Checker | null)[][];

  constructor() {
    this.#grid = Array.from({ length: GAME_CONFIG.ROWS }, () =>
      Array.from({ length: GAME_CONFIG.COLS }, () => null),
    );
  }

  isInside(row: number, col: number): boolean {
    return row >= 0 && row < GAME_CONFIG.ROWS && col >= 0 && col < GAME_CONFIG.COLS;
  }

  isDarkCell(row: number, col: number): boolean {
    return (row + col) % GAME_RULES.DARK_CELL_MOD === GAME_RULES.DARK_CELL_REMAINDER;
  }

  getPiece(row: number, col: number): Checker | null {
    if (!this.isInside(row, col)) return null;
    return this.#grid[row]![col]!;
  }

  setPiece(row: number, col: number, piece: Checker | null): void {
    if (!this.isInside(row, col)) return;
    this.#grid[row]![col] = piece;
  }

  removePiece(row: number, col: number): Checker | null {
    if (!this.isInside(row, col)) return null;
    const existing = this.#grid[row]![col]!;
    this.#grid[row]![col] = null;
    return existing;
  }

  movePiece(from: Coords, to: Coords): Checker | null {
    const piece = this.getPiece(from.r, from.c);
    this.setPiece(to.r, to.c, piece);
    this.setPiece(from.r, from.c, null);
    return piece;
  }

  toSnapshot(): BoardSnapshot {
    const snapshot = this.#grid.map((row) =>
      Object.freeze(
        row.map((cell): CheckerSnapshot | null => {
          if (!cell) return null;
          return Object.freeze({ id: cell.id, color: cell.color, isKing: cell.isKing });
        }),
      ),
    );
    return Object.freeze(snapshot) as BoardSnapshot;
  }
}

