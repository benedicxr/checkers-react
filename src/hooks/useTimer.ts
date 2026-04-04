import { useEffect, useLayoutEffect, useRef } from "react";

export function useTimer({
  enabled,
  intervalMs,
  onTick,
}: {
  enabled: boolean;
  intervalMs: number;
  onTick: (perfNowMs: number) => void;
}): void {
  const onTickRef = useRef(onTick);

  useLayoutEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      onTickRef.current(performance.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
}
