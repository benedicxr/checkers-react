import { GAME_CONFIG } from "../constants";
import type { Coords, MoveHistoryEntry, Player } from "../types";

export type PendingMove = Readonly<{
  id: number;
  player: Player;
  isCapture: boolean;
  path: Coords[];
}>;

export type MoveHistoryState = Readonly<{
  entries: ReadonlyArray<MoveHistoryEntry>;
  nextId: number;
  pending: PendingMove | null;
  activeId: number | null;
}>;

export function createMoveHistoryState(): MoveHistoryState {
  return { entries: [], nextId: 1, pending: null, activeId: null };
}

export function resetMoveHistory(): MoveHistoryState {
  return createMoveHistoryState();
}

export function setActiveMove(history: MoveHistoryState, id: number | null): MoveHistoryState {
  if (id !== null && !history.entries.some((e) => e.id === id)) return history;
  return { ...history, activeId: id };
}

export function getActiveEntry(history: MoveHistoryState): MoveHistoryEntry | undefined {
  const id = history.activeId;
  if (!id) return undefined;
  return history.entries.find((e) => e.id === id);
}

export function beginIfNeeded(
  history: MoveHistoryState,
  player: Player,
  from: Coords,
  { isCapture }: { isCapture: boolean },
): MoveHistoryState {
  if (history.pending) return history;
  return {
    ...history,
    pending: Object.freeze({ id: history.nextId, player, isCapture, path: [{ ...from }] }),
    nextId: history.nextId + 1,
  };
}

export function appendStep(history: MoveHistoryState, to: Coords, { isCapture }: { isCapture: boolean }): MoveHistoryState {
  const p = history.pending;
  if (!p) return history;
  const nextPending: PendingMove = Object.freeze({
    ...p,
    isCapture: p.isCapture || isCapture,
    path: [...p.path, { ...to }],
  });
  return { ...history, pending: nextPending };
}

export function cancelPending(history: MoveHistoryState): { history: MoveHistoryState; had: boolean } {
  const had = history.pending !== null;
  if (!had) return { history, had: false };
  return { history: { ...history, pending: null }, had: true };
}

export function popLastEntry(history: MoveHistoryState): MoveHistoryState {
  if (history.entries.length === 0) return history;
  return { ...history, entries: history.entries.slice(0, -1) };
}

export function finalizePending(history: MoveHistoryState): MoveHistoryState {
  const p = history.pending;
  if (!p) return history;

  const entry: MoveHistoryEntry = Object.freeze({
    id: p.id,
    player: p.player,
    text: formatMove(p.path),
    path: p.path.map((c) => ({ ...c })),
  });

  return { ...history, pending: null, entries: [...history.entries, entry], activeId: null };
}

export function getRenderList(history: MoveHistoryState): ReadonlyArray<{ id: number; text: string }> {
  return history.entries.map((e) => ({ id: e.id, text: e.text }));
}

function coordToAlg(p: Coords): string {
  const file = String.fromCharCode(97 + p.c);
  const rank = String(GAME_CONFIG.ROWS - p.r);
  return `${file}${rank}`;
}

function formatMove(path: Coords[]): string {
  return path.map((p) => coordToAlg(p)).join("-");
}

