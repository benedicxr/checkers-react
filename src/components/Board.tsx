import { GAME_CONFIG } from "../constants";
import type { BoardSnapshot } from "../types";
import { Cell } from "./Cell";

export function Board({ board }: { board: BoardSnapshot }) {
  return (
    <div id="board-game" role="grid" aria-label="Checkers board">
      {Array.from({ length: GAME_CONFIG.ROWS }, (_, row) =>
        Array.from({ length: GAME_CONFIG.COLS }, (_, col) => (
          <Cell key={`${row}-${col}`} row={row} col={col} checker={board[row]?.[col] ?? null} />
        )),
      )}
    </div>
  );
}

