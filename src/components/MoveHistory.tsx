export function MoveHistory({
  moves,
}: {
  moves: ReadonlyArray<{ id: number; text: string }>;
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
              <button type="button" className="history-move">
                {idx + 1}. {m.text}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

