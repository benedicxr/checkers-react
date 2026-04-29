import { GAME_CONFIG, MOVE_ANIMATION_STEP_MS } from "../constants";
import type { BoardSnapshot, Coords, Move } from "../types";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Cell } from "./Cell";
import { Piece } from "./Piece";

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getPieceAt(board: BoardSnapshot, pos: Coords | null | undefined) {
  if (!pos) return null;
  return board[pos.r]?.[pos.c] ?? null;
}

export const Board = memo(function Board({
  board,
  interactive,
  selected,
  availableMoves,
  capturingPieces,
  activeMovePath,
  previewMoveId,
  previewMovePath,
  previewMoveCapturedPositions,
  latestMoveId,
  latestMovePath,
  latestMoveCapturedPositions,
  onCellClick,
}: {
  board: BoardSnapshot;
  interactive: boolean;
  selected: Coords | null;
  availableMoves: readonly Move[];
  capturingPieces: readonly Coords[];
  activeMovePath: readonly Coords[] | null;
  previewMoveId: number | null;
  previewMovePath: readonly Coords[] | null;
  previewMoveCapturedPositions: readonly Coords[];
  latestMoveId: number | null;
  latestMovePath: readonly Coords[] | null;
  latestMoveCapturedPositions: readonly Coords[];
  onCellClick: (row: number, col: number) => void;
}) {
  const [displayBoard, setDisplayBoard] = useState(board);
  const [pieceOverrides, setPieceOverrides] = useState<Map<number, Coords>>(new Map());
  const [hiddenPieceIds, setHiddenPieceIds] = useState<Set<number>>(new Set());

  const boardRef = useRef(board);
  const latestMoveIdRef = useRef<number | null>(latestMoveId);
  const previewMoveIdRef = useRef<number | null>(previewMoveId);
  const animatedPreviewMoveIdRef = useRef<number | null>(null);
  const animatedMoveIdRef = useRef<number | null>(null);
  const animationSeqRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const prevBoard = boardRef.current;
    const prevLatestMoveId = latestMoveIdRef.current;
    boardRef.current = board;
    latestMoveIdRef.current = latestMoveId;
    previewMoveIdRef.current = previewMoveId;

    const scheduleStateUpdate = (fn: () => void) => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        fn();
        frameRef.current = null;
      });
    };

    const nextAnimation =
      previewMoveId !== null &&
      previewMoveId !== animatedPreviewMoveIdRef.current &&
      previewMovePath !== null &&
      previewMovePath.length >= 2
        ? {
            kind: "preview" as const,
            id: previewMoveId,
            path: previewMovePath,
            capturedPositions: previewMoveCapturedPositions,
          }
        : latestMoveId !== null &&
            (prevLatestMoveId === null || latestMoveId > prevLatestMoveId) &&
            latestMoveId !== animatedMoveIdRef.current &&
            latestMovePath !== null &&
            latestMovePath.length >= 2
          ? {
              kind: "history" as const,
              id: latestMoveId,
              path: latestMovePath,
              capturedPositions: latestMoveCapturedPositions,
            }
          : null;

    const canAnimate =
      nextAnimation !== null &&
      prevBoard.length > 0 &&
      board.length > 0;

    if (!canAnimate) {
      animationSeqRef.current += 1;
      scheduleStateUpdate(() => {
        setPieceOverrides(new Map());
        setHiddenPieceIds(new Set());
        setDisplayBoard(board);
      });
      return () => {
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      };
    }

    const movePath = nextAnimation.path;
    const startPos = movePath[0] ?? null;
    const endPos = movePath[movePath.length - 1] ?? null;
    const movedPiece = getPieceAt(board, endPos);
    const startPiece = getPieceAt(prevBoard, startPos);

    if (!movedPiece || !startPiece || movedPiece.id !== startPiece.id) {
      animationSeqRef.current += 1;
      if (nextAnimation.kind === "preview") animatedPreviewMoveIdRef.current = nextAnimation.id;
      else animatedMoveIdRef.current = nextAnimation.id;
      scheduleStateUpdate(() => {
        setPieceOverrides(new Map());
        setHiddenPieceIds(new Set());
        setDisplayBoard(board);
      });
      return () => {
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      };
    }

    if (nextAnimation.kind === "preview") animatedPreviewMoveIdRef.current = nextAnimation.id;
    else animatedMoveIdRef.current = nextAnimation.id;
    const seq = animationSeqRef.current + 1;
    animationSeqRef.current = seq;

    const capturedPieceIds = nextAnimation.capturedPositions
      .map((pos) => getPieceAt(prevBoard, pos)?.id ?? null)
      .filter((id): id is number => id !== null);

    scheduleStateUpdate(() => {
      setDisplayBoard(prevBoard);
      setHiddenPieceIds(new Set());
      setPieceOverrides(new Map([[movedPiece.id, { ...movePath[0]! }]]));
    });

    void (async () => {
      for (let i = 1; i < movePath.length; i++) {
        if (animationSeqRef.current !== seq) return;
        const nextPos = movePath[i]!;
        setPieceOverrides(new Map([[movedPiece.id, { ...nextPos }]]));

        const capturedId = capturedPieceIds[i - 1];
        if (capturedId !== undefined) {
          window.setTimeout(() => {
            if (animationSeqRef.current !== seq) return;
            setHiddenPieceIds((prev) => {
              const next = new Set(prev);
              next.add(capturedId);
              return next;
            });
          }, Math.floor(MOVE_ANIMATION_STEP_MS / 2));
        }

        await sleep(MOVE_ANIMATION_STEP_MS);
      }

      if (animationSeqRef.current !== seq) return;
      setPieceOverrides(new Map());
      setHiddenPieceIds(new Set());
      setDisplayBoard(board);
    })();

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [
    board,
    latestMoveCapturedPositions,
    latestMoveId,
    latestMovePath,
    previewMoveCapturedPositions,
    previewMoveId,
    previewMovePath,
  ]);

  const availableByCell = useMemo(() => {
    const map = new Map<string, Move>();
    for (const m of availableMoves) map.set(cellKey(m.r, m.c), m);
    return map;
  }, [availableMoves]);

  const capturingSet = useMemo(() => {
    return new Set(capturingPieces.map((p) => cellKey(p.r, p.c)));
  }, [capturingPieces]);

  const history = useMemo(() => {
    const historySet = new Set<string>();
    let historyStart: string | null = null;
    let historyEnd: string | null = null;
    if (activeMovePath && activeMovePath.length > 0) {
      for (const p of activeMovePath) historySet.add(cellKey(p.r, p.c));
      historyStart = cellKey(activeMovePath[0]!.r, activeMovePath[0]!.c);
      historyEnd = cellKey(
        activeMovePath[activeMovePath.length - 1]!.r,
        activeMovePath[activeMovePath.length - 1]!.c,
      );
    }
    return { historySet, historyStart, historyEnd };
  }, [activeMovePath]);

  const pieces = useMemo(() => {
    const out: Array<{ id: number; r: number; c: number }> = [];
    const checkerById = new Map<number, NonNullable<BoardSnapshot[number][number]>>();
    for (let r = 0; r < displayBoard.length; r++) {
      const row = displayBoard[r]!;
      for (let c = 0; c < row.length; c++) {
        const p = row[c];
        if (!p || hiddenPieceIds.has(p.id)) continue;
        checkerById.set(p.id, p);
        out.push({ id: p.id, r, c });
      }
    }

    for (let i = 0; i < out.length; i++) {
      const override = pieceOverrides.get(out[i]!.id);
      if (!override) continue;
      out[i] = { ...out[i]!, r: override.r, c: override.c };
    }

    out.sort((a, b) => a.id - b.id);
    return { pieces: out, checkerById };
  }, [displayBoard, hiddenPieceIds, pieceOverrides]);

  return (
    <div id="board-game" role="grid" aria-label="Checkers board">
      {Array.from({ length: GAME_CONFIG.ROWS }, (_, row) =>
        Array.from({ length: GAME_CONFIG.COLS }, (_, col) => (
          <Cell
            key={`${row}-${col}`}
            row={row}
            col={col}
            availableMove={availableByCell.get(cellKey(row, col)) ?? null}
            historyMark={history.historySet.has(cellKey(row, col))}
            historyStart={history.historyStart === cellKey(row, col)}
            historyEnd={history.historyEnd === cellKey(row, col)}
            interactive={interactive}
            onClick={onCellClick}
          />
        )),
      )}
      <div className="pieces-layer" aria-hidden="true">
        {pieces.pieces.map(({ id, r, c }) => {
          const checker = pieces.checkerById.get(id) ?? null;
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
              onClick={interactive ? () => onCellClick(r, c) : undefined}
            >
              <Piece checker={checker} selected={isSelected} capturable={isCapturable} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
