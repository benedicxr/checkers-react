import { CSS_CLASSES, GAME_CONFIG } from "../constants";
import type { CheckerSnapshot } from "../types";
import { memo } from "react";

export const Piece = memo(function Piece({
  checker,
  selected = false,
  capturable = false,
}: {
  checker: CheckerSnapshot;
  selected?: boolean;
  capturable?: boolean;
}) {
  const colorClass =
    checker.color === GAME_CONFIG.WHITE_PLAYER ? CSS_CLASSES.WHITE_PIECE : CSS_CLASSES.BLACK_PIECE;

  return (
    <div
      className={[
        CSS_CLASSES.PIECE,
        colorClass,
        checker.isKing ? CSS_CLASSES.KING : null,
        selected ? CSS_CLASSES.SELECTED : null,
        capturable ? CSS_CLASSES.CAPTURABLE : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-id={String(checker.id)}
      aria-label={`${checker.color === GAME_CONFIG.WHITE_PLAYER ? "White" : "Black"} piece${
        checker.isKing ? " king" : ""
      }`}
    />
  );
});
