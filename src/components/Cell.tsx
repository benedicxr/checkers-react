import { CSS_CLASSES, GAME_RULES } from "../constants";
import type { CheckerSnapshot } from "../types";
import { Piece } from "./Piece";

export function Cell({
  row,
  col,
  checker,
}: {
  row: number;
  col: number;
  checker: CheckerSnapshot | null;
}) {
  const isDark =
    (row + col) % GAME_RULES.DARK_CELL_MOD === GAME_RULES.DARK_CELL_REMAINDER;

  return (
    <div
      className={`${CSS_CLASSES.CELL} ${
        isDark ? CSS_CLASSES.BLACK_CELL : CSS_CLASSES.WHITE_CELL
      }`}
      data-row={row}
      data-col={col}
      role="gridcell"
    >
      {checker ? <Piece checker={checker} /> : null}
    </div>
  );
}

