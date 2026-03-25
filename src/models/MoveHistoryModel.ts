import { GAME_CONFIG } from "../constants";
import type { Coords, MoveHistoryEntry, Player } from "../types";

type PendingMove = Readonly<{
  id: number;
  player: Player;
  isCapture: boolean;
  path: Coords[];
}>;

export class MoveHistoryModel {
  #entries: MoveHistoryEntry[] = [];
  #nextId = 1;
  #pending: PendingMove | null = null;
  #activeId: number | null = null;

  reset(): void {
    this.#entries = [];
    this.#nextId = 1;
    this.#pending = null;
    this.#activeId = null;
  }

  get activeId(): number | null {
    return this.#activeId;
  }

  setActive(id: number | null): void {
    this.#activeId = id;
  }

  getEntry(id: number): MoveHistoryEntry | undefined {
    return this.#entries.find((e) => e.id === id);
  }

  getRenderList(): ReadonlyArray<{ id: number; text: string }> {
    return this.#entries.map((e) => ({ id: e.id, text: e.text }));
  }

  popLastEntry(): void {
    this.#entries.pop();
  }

  cancelPending(): boolean {
    const had = this.#pending !== null;
    this.#pending = null;
    return had;
  }

  beginIfNeeded(player: Player, from: Coords, { isCapture }: { isCapture: boolean }): void {
    if (this.#pending) return;
    this.#pending = Object.freeze({
      id: this.#nextId++,
      player,
      isCapture,
      path: [{ ...from }],
    });
  }

  appendStep(to: Coords, { isCapture }: { isCapture: boolean }): void {
    if (!this.#pending) return;

    const next: PendingMove = Object.freeze({
      ...this.#pending,
      isCapture: this.#pending.isCapture || isCapture,
      path: [...this.#pending.path, { ...to }],
    });
    this.#pending = next;
  }

  finalizePending(): MoveHistoryEntry | null {
    if (!this.#pending) return null;
    const p = this.#pending;
    this.#pending = null;

    const entry: MoveHistoryEntry = Object.freeze({
      id: p.id,
      player: p.player,
      text: this.#formatMove(p.path),
      path: p.path.map((c) => ({ ...c })),
    });

    this.#entries = [...this.#entries, entry];
    this.#activeId = null;
    return entry;
  }

  #coordToAlg(p: Coords): string {
    const file = String.fromCharCode(97 + p.c);
    const rank = String(GAME_CONFIG.ROWS - p.r);
    return `${file}${rank}`;
  }

  #formatMove(path: Coords[]): string {
    return path.map((p) => this.#coordToAlg(p)).join("-");
  }
}
