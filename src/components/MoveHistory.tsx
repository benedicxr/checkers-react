import { memo } from "react";

export const MoveHistory = memo(function MoveHistory({
  moves,
  activeId,
  onSelect,
}: {
  moves: ReadonlyArray<{ id: number; text: string }>;
  activeId: number | null;
  onSelect: (id: number | null) => void;
}) {
  return (
    <aside id="move-history" className="history" aria-label="Move history">
      <div className="history-title">Move history</div>
      {moves.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>
          No moves yet.
        </div>
      ) : (
        <ol className="history-list">
          {moves.map((m, idx) => (
            <li key={m.id}>
              <button
                type="button"
                className={["history-move", m.id === activeId ? "active" : null].filter(Boolean).join(" ")}
                onClick={() => onSelect(m.id === activeId ? null : m.id)}
              >
                {idx + 1}. {m.text}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
});
