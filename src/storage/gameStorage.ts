import type { PersistedGameState } from "../types";

const STORAGE_KEY = "checkers.gameState.v1";

export function loadGameState(): PersistedGameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if ((parsed as { version?: unknown }).version !== 1) return null;
    return parsed as PersistedGameState;
  } catch {
    return null;
  }
}

export function saveGameState(state: PersistedGameState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearGameState(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
