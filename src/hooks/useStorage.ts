import { useEffect, useLayoutEffect, useRef } from "react";
import { GAME_STATE_STORAGE_KEY, loadGameStateRaw, saveGameStateRaw } from "../storage/gameStorage";

export function useStorage({
  enabled = true,
  rev,
  onHydrate,
  getPersisted,
}: {
  enabled?: boolean;
  rev: number;
  onHydrate: (raw: unknown, meta: { perfNowMs: number; unixNowMs: number }) => void;
  getPersisted: (meta: { unixNowMs: number }) => unknown;
}): void {
  const getPersistedRef = useRef(getPersisted);
  useLayoutEffect(() => {
    getPersistedRef.current = getPersisted;
  }, [getPersisted]);

  const didHydrateRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const raw = loadGameStateRaw();
    if (raw !== null) {
      onHydrate(raw, { perfNowMs: performance.now(), unixNowMs: Date.now() });
    }
    didHydrateRef.current = true;
  }, [enabled, onHydrate]);

  useEffect(() => {
    if (!enabled) return;
    if (!didHydrateRef.current) return;
    if (rev === 0) return;

    const persisted = getPersistedRef.current({ unixNowMs: Date.now() });
    saveGameStateRaw(persisted);
  }, [enabled, rev]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key !== GAME_STATE_STORAGE_KEY) return;

      const raw = loadGameStateRaw();
      if (raw === null) return;
      onHydrate(raw, { perfNowMs: performance.now(), unixNowMs: Date.now() });
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [enabled, onHydrate]);
}

