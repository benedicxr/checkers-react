import { CSS_CLASSES, GAME_RULES } from "../constants";
import type { Move } from "../types";
import { memo, useCallback } from "react";

export const Cell = memo(function Cell({
  row,
  col,
  availableMove,
  historyMark,
  historyStart,
  historyEnd,
  interactive,
  onClick,
}: {
  row: number;
  col: number;
  availableMove: Move | null;
  historyMark: boolean;
  historyStart: boolean;
  historyEnd: boolean;
  interactive: boolean;
  onClick: (row: number, col: number) => void;
}) {
  const isDark =
    (row + col) % GAME_RULES.DARK_CELL_MOD === GAME_RULES.DARK_CELL_REMAINDER;

  const handleClick = useCallback(() => {
    if (!interactive) return;
    onClick(row, col);
  }, [col, interactive, onClick, row]);

  const isAvailable = Boolean(availableMove);
  const isCapture = availableMove?.type === "jump";
  const cellClasses = [
    CSS_CLASSES.CELL,
    isDark ? CSS_CLASSES.BLACK_CELL : CSS_CLASSES.WHITE_CELL,
    isAvailable ? CSS_CLASSES.AVAILABLE_STEP : null,
    isAvailable ? (isCapture ? CSS_CLASSES.AVAILABLE_CAPTURE : CSS_CLASSES.AVAILABLE_MOVE) : null,
    historyMark ? "history-mark" : null,
    historyStart ? "history-start" : null,
    historyEnd ? "history-end" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cellClasses} data-row={row} data-col={col} role="gridcell" onClick={handleClick} />
  );
});
