import { CSS_CLASSES, GAME_CONFIG } from "../constants";
import type { CheckerSnapshot } from "../types";

export function Piece({ checker }: { checker: CheckerSnapshot }) {
  const colorClass =
    checker.color === GAME_CONFIG.WHITE_PLAYER ? CSS_CLASSES.WHITE_PIECE : CSS_CLASSES.BLACK_PIECE;

  return (
    <div
      className={[
        CSS_CLASSES.PIECE,
        colorClass,
        checker.isKing ? CSS_CLASSES.KING : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-id={String(checker.id)}
      aria-label={`${checker.color === GAME_CONFIG.WHITE_PLAYER ? "White" : "Black"} piece${
        checker.isKing ? " king" : ""
      }`}
    />
  );
}

