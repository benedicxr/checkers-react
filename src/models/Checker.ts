import type { Player } from "../types";

export class Checker {
  #id: number;
  #color: Player;
  #isKing: boolean;

  constructor(color: Player, { id, isKing = false }: { id: number; isKing?: boolean }) {
    this.#id = id;
    this.#color = color;
    this.#isKing = Boolean(isKing);
  }

  get id(): number {
    return this.#id;
  }

  get color(): Player {
    return this.#color;
  }

  get isKing(): boolean {
    return this.#isKing;
  }

  promote(): boolean {
    if (this.#isKing) return false;
    this.#isKing = true;
    return true;
  }
}
