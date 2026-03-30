import { CSS_CLASSES, GAME_CONFIG } from "../constants";
import type { BoardSnapshot, Coords, Move } from "../types";
import { useLayoutEffect, useRef } from "react";
import { Cell } from "./Cell";

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

type PieceLayout = Readonly<{
  rect: DOMRect;
  className: string;
}>;

function boardSignature(board: BoardSnapshot): string {
  let out = "";
  for (let r = 0; r < board.length; r++) {
    const row = board[r]!;
    for (let c = 0; c < row.length; c++) {
      const p = row[c];
      if (!p) {
        out += ".";
        continue;
      }
      out += `${p.id}:${p.color}${p.isKing ? "K" : "M"};`;
    }
    out += "|";
  }
  return out;
}

export function Board({
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
  const boardRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const prevLayoutRef = useRef<Map<string, PieceLayout>>(new Map());

  const availableByCell = new Map<string, Move>();
  for (const m of availableMoves) {
    availableByCell.set(cellKey(m.r, m.c), m);
  }

  const capturingSet = new Set(capturingPieces.map((p) => cellKey(p.r, p.c)));

  const historySet = new Set<string>();
  let historyStart: string | null = null;
  let historyEnd: string | null = null;
  if (activeMovePath && activeMovePath.length > 0) {
    for (const p of activeMovePath) historySet.add(cellKey(p.r, p.c));
    historyStart = cellKey(activeMovePath[0]!.r, activeMovePath[0]!.c);
    historyEnd = cellKey(activeMovePath[activeMovePath.length - 1]!.r, activeMovePath[activeMovePath.length - 1]!.c);
  }

  const sig = boardSignature(board);

  useLayoutEffect(() => {
    const boardEl = boardRef.current;
    const overlayEl = overlayRef.current;
    if (!boardEl || !overlayEl) return;

    const prev = prevLayoutRef.current;
    const boardRect = boardEl.getBoundingClientRect();

    const pieces = [...boardEl.querySelectorAll<HTMLElement>(`.${CSS_CLASSES.PIECE}[data-id]`)];
    const next = new Map<string, PieceLayout>();
    const nextEls = new Map<string, HTMLElement>();
    for (const el of pieces) {
      const id = el.dataset.id;
      if (!id) continue;
      next.set(id, { rect: el.getBoundingClientRect(), className: el.className });
      nextEls.set(id, el);
    }

    overlayEl.replaceChildren();

    for (const [id, prevLayout] of prev) {
      if (next.has(id)) continue;

      const ghost = document.createElement("div");
      ghost.className = prevLayout.className;
      ghost.classList.add("ghost");
      ghost.style.left = `${prevLayout.rect.left - boardRect.left}px`;
      ghost.style.top = `${prevLayout.rect.top - boardRect.top}px`;
      ghost.style.width = `${prevLayout.rect.width}px`;
      ghost.style.height = `${prevLayout.rect.height}px`;
      overlayEl.appendChild(ghost);

      requestAnimationFrame(() => ghost.classList.add("ghost-out"));
      window.setTimeout(() => ghost.remove(), 800);
    }

    for (const [id, el] of nextEls) {
      const prevLayout = prev.get(id);
      if (!prevLayout) {
        el.classList.add("spawn");
        requestAnimationFrame(() => el.classList.remove("spawn"));
        continue;
      }

      const currRect = next.get(id)!.rect;
      const dx = prevLayout.rect.left - currRect.left;
      const dy = prevLayout.rect.top - currRect.top;
      if (dx === 0 && dy === 0) continue;

      el.style.transition = "transform 0s";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = "";
        el.style.transform = "";
      });
    }

    prevLayoutRef.current = next;
  }, [sig]);

  return (
    <div id="board-game" role="grid" aria-label="Checkers board" ref={boardRef}>
      {Array.from({ length: GAME_CONFIG.ROWS }, (_, row) =>
        Array.from({ length: GAME_CONFIG.COLS }, (_, col) => (
          <Cell
            key={`${row}-${col}`}
            row={row}
            col={col}
            checker={board[row]?.[col] ?? null}
            selected={selected?.r === row && selected?.c === col}
            capturingPiece={capturingSet.has(cellKey(row, col))}
            availableMove={availableByCell.get(cellKey(row, col)) ?? null}
            historyMark={historySet.has(cellKey(row, col))}
            historyStart={historyStart === cellKey(row, col)}
            historyEnd={historyEnd === cellKey(row, col)}
            onClick={onCellClick}
          />
        )),
      )}
      <div className="overlay" ref={overlayRef} aria-hidden="true" />
    </div>
  );
}
