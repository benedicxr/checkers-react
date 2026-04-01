import { useEffect, useLayoutEffect, useRef } from "react";
import type { GameAction } from "../logic/gameReducer";
import { exportPersistedGameState } from "../logic/persistence";
import type { GameCoreState } from "../logic/persistence";
import { GAME_STATE_STORAGE_KEY, loadGameState, saveGameState } from "../storage/gameStorage";

export function useStorage({
  state,
  dispatch,
  enabled = true,
}: {
  state: GameCoreState;
  dispatch: (action: GameAction) => void;
  enabled?: boolean;
}): void {
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const didHydrateRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const perfNowMs = performance.now();
    const unixNowMs = Date.now();
    const persisted = loadGameState();
    if (persisted) {
      dispatch({ type: "LOAD", persisted, perfNowMs, unixNowMs });
    }

    didHydrateRef.current = true;
  }, [dispatch, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!didHydrateRef.current) return;
    if (state.persistRev === 0) return;

    const persisted = exportPersistedGameState(stateRef.current, Date.now());
    saveGameState(persisted);
  }, [enabled, state.persistRev]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key !== GAME_STATE_STORAGE_KEY) return;

      const persisted = loadGameState();
      if (!persisted) return;
      dispatch({ type: "LOAD", persisted, perfNowMs: performance.now(), unixNowMs: Date.now() });
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [dispatch, enabled]);
}
