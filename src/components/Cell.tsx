import { CSS_CLASSES, GAME_RULES } from "../constants";
import type { CheckerSnapshot, Move } from "../types";
import { Piece } from "./Piece";

export function Cell({
  row,
  col,
  checker,
  selected,
  capturingPiece,
  availableMove,
  historyMark,
  historyStart,
  historyEnd,
  onClick,
}: {
  row: number;
  col: number;
  checker: CheckerSnapshot | null;
  selected: boolean;
  capturingPiece: boolean;
  availableMove: Move | null;
  historyMark: boolean;
  historyStart: boolean;
  historyEnd: boolean;
  onClick: (row: number, col: number) => void;
}) {
  const isDark =
    (row + col) % GAME_RULES.DARK_CELL_MOD === GAME_RULES.DARK_CELL_REMAINDER;

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
    <div
      className={cellClasses}
      data-row={row}
      data-col={col}
      role="gridcell"
      onClick={() => onClick(row, col)}
    >
      {checker ? (
        <Piece checker={checker} selected={selected} capturable={capturingPiece} />
      ) : null}
    </div>
  );
}
