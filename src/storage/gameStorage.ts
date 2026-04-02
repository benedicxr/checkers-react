export const GAME_STATE_STORAGE_KEY = "checkers.gameState.v2";

export function loadGameStateRaw(): unknown | null {
  try {
    const raw = localStorage.getItem(GAME_STATE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function saveGameStateRaw(state: unknown): boolean {
  try {
    localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
