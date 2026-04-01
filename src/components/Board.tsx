import { GAME_CONFIG } from "../constants";
import type { BoardSnapshot, Coords, Move } from "../types";
import { memo, useMemo } from "react";
import { Cell } from "./Cell";
import { Piece } from "./Piece";

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

export const Board = memo(function Board({
  board,
  selected,
  availableMoves,
  capturingPieces,
  activeMovePath,
  onCellClick,
}: {
  board: BoardSnapshot;
  selected: Coords | null;
  availableMoves: readonly Move[];
  capturingPieces: readonly Coords[];
  activeMovePath: readonly Coords[] | null;
  onCellClick: (row: number, col: number) => void;
}) {
  const availableByCell = useMemo(() => {
    const map = new Map<string, Move>();
    for (const m of availableMoves) map.set(cellKey(m.r, m.c), m);
    return map;
  }, [availableMoves]);

  const capturingSet = new Set(capturingPieces.map((p) => cellKey(p.r, p.c)));

  const historySet = new Set<string>();
  let historyStart: string | null = null;
  let historyEnd: string | null = null;
  if (activeMovePath && activeMovePath.length > 0) {
    for (const p of activeMovePath) historySet.add(cellKey(p.r, p.c));
    historyStart = cellKey(activeMovePath[0]!.r, activeMovePath[0]!.c);
    historyEnd = cellKey(activeMovePath[activeMovePath.length - 1]!.r, activeMovePath[activeMovePath.length - 1]!.c);
  }

  const pieces = useMemo(() => {
    const out: Array<{ id: number; r: number; c: number }> = [];
    for (let r = 0; r < board.length; r++) {
      const row = board[r]!;
      for (let c = 0; c < row.length; c++) {
        const p = row[c];
        if (!p) continue;
        out.push({ id: p.id, r, c });
      }
    }
    return out;
  }, [board]);

  return (
    <div id="board-game" role="grid" aria-label="Checkers board">
      {Array.from({ length: GAME_CONFIG.ROWS }, (_, row) =>
        Array.from({ length: GAME_CONFIG.COLS }, (_, col) => (
          <Cell
            key={`${row}-${col}`}
            row={row}
            col={col}
            availableMove={availableByCell.get(cellKey(row, col)) ?? null}
            historyMark={historySet.has(cellKey(row, col))}
            historyStart={historyStart === cellKey(row, col)}
            historyEnd={historyEnd === cellKey(row, col)}
            onClick={onCellClick}
          />
        )),
      )}
      <div className="pieces-layer" aria-hidden="true">
        {pieces.map(({ id, r, c }) => {
          const checker = board[r]?.[c];
          if (!checker) return null;

          const isSelected = selected?.r === r && selected?.c === c;
          const isCapturable = capturingSet.has(cellKey(r, c));

          return (
            <div
              key={id}
              className="piece-wrap"
              style={{
                top: `calc(var(--cell-size) * ${r} + var(--checker-offset))`,
                left: `calc(var(--cell-size) * ${c} + var(--checker-offset))`,
                zIndex: isSelected ? 3 : 1,
              }}
              onClick={() => onCellClick(r, c)}
            >
              <Piece checker={checker} selected={isSelected} capturable={isCapturable} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
