import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAME_CONFIG, GAME_RULES } from "../constants";
import type { Board, BoardSnapshot, CheckerSnapshot, Coords, Move, Player, TimerClockSnapshot } from "../types";
import { countPieces, getPiece } from "../logic/boardUtils";
import { getCapturesForPiece, getCapturingPieces, getValidMovesForPiece, playerHasCapture } from "../logic/gameRules";
import type { CoreMove } from "../types";
import type { ApiGame, ApiGameId, ApiMoveHistoryItem, BackendBoard, BackendPiece } from "../api/types";
import { createGame, getGame, getMoves, makeMove, restartGame, undoMove } from "../api/games";
import { ApiClientError } from "../api/client";

type RenderMove = Readonly<{ id: number; text: string }>;



export type CheckersSnapshot = Readonly<{
  gameId: ApiGameId | null;
  loading: boolean;
  error: string | null;

  board: BoardSnapshot;
  turn: Player;
  winner: Player | null;
  selected: Coords | null;
  availableMoves: readonly Move[];
  capturingPieces: readonly Coords[];
  capturedByWhite: number;
  capturedByBlack: number;
  canUndo: boolean;
  moves: ReadonlyArray<RenderMove>;
  activeMoveId: number | null;
  activeMovePath: readonly Coords[] | null;
  clock: TimerClockSnapshot;
}>;

const EMPTY_MOVES: readonly Move[] = Object.freeze([]);
const EMPTY_COORDS: readonly Coords[] = Object.freeze([]);
const EMPTY_RENDER_MOVES: ReadonlyArray<RenderMove> = Object.freeze([]);

const DISABLED_CLOCK: TimerClockSnapshot = Object.freeze({
  enabled: false,
  initialMs: 0,
  whiteMs: 0,
  blackMs: 0,
  activePlayer: GAME_CONFIG.WHITE_PLAYER,
  running: false,
});

const ACTIVE_GAME_ID_STORAGE_KEY = "checkers.activeGameId.v1";

function normalizeGameId(raw: string | null): ApiGameId | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  return s;
}

function readGameIdFromUrl(): ApiGameId | null {
  try {
    const url = new URL(window.location.href);
    return normalizeGameId(url.searchParams.get("gameId"));
  } catch {
    return null;
  }
}

function writeGameIdToUrl(id: ApiGameId | null) {
  try {
    const url = new URL(window.location.href);
    if (id === null) url.searchParams.delete("gameId");
    else url.searchParams.set("gameId", String(id));
    window.history.replaceState(null, "", url.toString());
  } catch { /* empty */ }
}

function readStoredGameId(): ApiGameId | null {
  try {
    return normalizeGameId(localStorage.getItem(ACTIVE_GAME_ID_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredGameId(id: ApiGameId | null) {
  writeGameIdToUrl(id);
  try {
    if (id === null) localStorage.removeItem(ACTIVE_GAME_ID_STORAGE_KEY);
    else localStorage.setItem(ACTIVE_GAME_ID_STORAGE_KEY, String(id));
  } catch { /* empty */ }
}

function readInitialGameId(): ApiGameId | null {
  return readGameIdFromUrl() ?? readStoredGameId();
}

function mapPiece(piece: BackendPiece | null): CheckerSnapshot | null {
  if (!piece) return null;
  return {
    id: piece.id,
    color: piece.color === "white" ? 1 : 2,
    isKing: Boolean(piece.isKing),
  };
}

function mapBoard(board: BackendBoard): BoardSnapshot {
  return board.map((row) => row.map(mapPiece));
}

function mapPlayerSide(x: unknown): Player | null {
  if (x === GAME_CONFIG.WHITE_PLAYER || x === GAME_CONFIG.BLACK_PLAYER) return x;
  if (x === "white") return GAME_CONFIG.WHITE_PLAYER;
  if (x === "black") return GAME_CONFIG.BLACK_PLAYER;
  return null;
}

function coreMovesToUi(moves: CoreMove[]): Move[] {
  return moves.map((m) => {
    if (m.type === "simple") return { r: m.to.r, c: m.to.c, type: "move" as const };
    return { r: m.to.r, c: m.to.c, type: "jump" as const, target: { ...m.captured } };
  });
}

function sameCoords(a: Coords | null, b: Coords | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.r === b.r && a.c === b.c;
}

function toAlg(p: Coords): string {
  const file = String.fromCharCode(97 + p.c);
  const rank = String(GAME_CONFIG.ROWS - p.r);
  return `${file}${rank}`;
}

function backendMoveToRenderText(m: ApiMoveHistoryItem): string {
  const from: Coords = { r: m.fromPos.row, c: m.fromPos.col };
  const to: Coords = { r: m.toPos.row, c: m.toPos.col };
  const sep = m.isJump ? "x" : "-";
  const promoted = m.isPromoted ? "=K" : "";
  return `${toAlg(from)}${sep}${toAlg(to)}${promoted}`;
}

function backendMoveToPath(m: ApiMoveHistoryItem): Coords[] {
  const path: Coords[] = [{ r: m.fromPos.row, c: m.fromPos.col }];
  if (m.capturedPos) path.push({ r: m.capturedPos.row, c: m.capturedPos.col });
  path.push({ r: m.toPos.row, c: m.toPos.col });
  return path;
}

function toUserMessage(e: unknown): string {
  if (e instanceof ApiClientError) return e.message;
  if (e instanceof Error) return e.message;
  return "Unexpected error";
}

export function useCheckers() {
  const [gameId, setGameId] = useState<ApiGameId | null>(() => readInitialGameId());
  const [game, setGame] = useState<ApiGame | null>(null);
  const [history, setHistory] = useState<ApiMoveHistoryItem[]>([]);

  const [selected, setSelected] = useState<Coords | null>(null);
  const [activeMoveId, setActiveMoveId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqSeq = useRef(0);
  const didHydrateRef = useRef(false);

  const board = useMemo((): BoardSnapshot => {
    if (!game?.board) return Object.freeze([]) as unknown as BoardSnapshot;
    return mapBoard(game.board);
  }, [game?.board]);

  const turn = useMemo((): Player => {
    return mapPlayerSide(game?.currentTurn) ?? GAME_CONFIG.WHITE_PLAYER;
  }, [game?.currentTurn]);

  const winner = useMemo((): Player | null => {
    if (!game) return null;
    return mapPlayerSide(game.winner) ?? null;
  }, [game]);

  const mustCapture = useMemo(() => {
    if (!game) return false;
    if (winner !== null) return false;
    return playerHasCapture(board as Board, turn);
  }, [board, game, turn, winner]);

  const availableMoves = useMemo((): readonly Move[] => {
    if (!game) return EMPTY_MOVES;
    if (winner !== null) return EMPTY_MOVES;
    if (!selected) return EMPTY_MOVES;
    const core = getValidMovesForPiece(board as Board, turn, selected, { capturesOnly: mustCapture });
    return coreMovesToUi(core);
  }, [board, game, mustCapture, selected, turn, winner]);

  const capturingPieces = useMemo((): readonly Coords[] => {
    if (!game) return EMPTY_COORDS;
    if (winner !== null) return EMPTY_COORDS;
    if (!mustCapture) return EMPTY_COORDS;
    return getCapturingPieces(board as Board, turn);
  }, [board, game, mustCapture, turn, winner]);

  const { capturedByWhite, capturedByBlack } = useMemo(() => {
    if (!game) return { capturedByWhite: 0, capturedByBlack: 0 };
    const b = board as Board;
    const currentWhite = countPieces(b, GAME_CONFIG.WHITE_PLAYER);
    const currentBlack = countPieces(b, GAME_CONFIG.BLACK_PLAYER);
    const initialCount = GAME_RULES.INITIAL_PIECE_ROWS * (GAME_CONFIG.COLS / 2);
    return {
      capturedByWhite: Math.max(0, initialCount - currentBlack),
      capturedByBlack: Math.max(0, initialCount - currentWhite),
    };
  }, [board, game]);

  const moves = useMemo((): ReadonlyArray<RenderMove> => {
    if (history.length === 0) return EMPTY_RENDER_MOVES;
    return history.map((m) => ({ id: m.id, text: backendMoveToRenderText(m) }));
  }, [history]);

  const activeMovePath = useMemo((): readonly Coords[] | null => {
    if (!activeMoveId) return null;
    const m = history.find((x) => x.id === activeMoveId);
    return m ? backendMoveToPath(m) : null;
  }, [activeMoveId, history]);

  const refresh = useCallback(async (id: ApiGameId) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const g = await getGame(id);
      let m: ApiMoveHistoryItem[] = [];
      try {
        m = await getMoves(id);
      } catch (e) {
        if (!(e instanceof ApiClientError && e.status === 404)) throw e;
        m = [];
      }

      if (seq !== reqSeq.current) return;
      writeStoredGameId(id);
      setGameId(id);
      setGame(g);
      setHistory(m);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      if (e instanceof ApiClientError && e.status === 404) {
        writeStoredGameId(null);
        setGameId(null);
        setGame(null);
        setHistory([]);
      }
      setError(toUserMessage(e));
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    setSelected(null);
    setActiveMoveId(null);
    try {
      const created = await createGame();
      if (seq !== reqSeq.current) return;
      writeStoredGameId(created.id);

      const g = await getGame(created.id);
      let m: ApiMoveHistoryItem[] = [];
      try {
        m = await getMoves(created.id);
      } catch (e) {
        if (!(e instanceof ApiClientError && e.status === 404)) throw e;
        m = [];
      }

      if (seq !== reqSeq.current) return;
      setGameId(created.id);
      setGame(g);
      setHistory(m);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setError(toUserMessage(e));
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, []);

  const undo = useCallback(async () => {
    if (!gameId) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      await undoMove(gameId);
      if (seq !== reqSeq.current) return;
      setSelected(null);
      setActiveMoveId(null);
      await refresh(gameId);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setError(toUserMessage(e));
      setLoading(false);
    }
  }, [gameId, refresh]);

  const restart = useCallback(async () => {
    if (!gameId) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      await restartGame(gameId);
      if (seq !== reqSeq.current) return;
      setSelected(null);
      setActiveMoveId(null);
      await refresh(gameId);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setError(toUserMessage(e));
      setLoading(false);
    }
  }, [gameId, refresh]);

  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    if (!gameId) return;
    setSelected(null);
    setActiveMoveId(null);
    void refresh(gameId);
  }, [gameId, refresh]);

  const onCellClick = useCallback(
    async (row: number, col: number) => {
      if (!gameId || !game) return;
      if (loading) return;
      if (winner !== null) return;

      setError(null);

      const at: Coords = { r: row, c: col };
      const b = board as Board;

      if (selected) {
        const coreMoves = getValidMovesForPiece(b, turn, selected, { capturesOnly: mustCapture });
        const chosen = coreMoves.find((m) => m.to.r === at.r && m.to.c === at.c);
        if (chosen) {
          const seq = ++reqSeq.current;
          setLoading(true);
          try {
            await makeMove(gameId, { row: selected.r, col: selected.c }, { row: at.r, col: at.c });
            if (seq !== reqSeq.current) return;
            setSelected(null);
            setActiveMoveId(null);
            await refresh(gameId);
          } catch (e) {
            if (seq !== reqSeq.current) return;
            setError(toUserMessage(e));
            setLoading(false);
          }
          return;
        }

        if (sameCoords(selected, at)) {
          setSelected(null);
          return;
        }
      }

      const piece = getPiece(b, at.r, at.c);
      if (!piece || piece.color !== turn) {
        setSelected(null);
        return;
      }

      if (mustCapture) {
        const captures = getCapturesForPiece(b, turn, at);
        if (captures.length === 0) return;
      }

      setSelected({ ...at });
      setActiveMoveId(null);
    },
    [board, game, gameId, loading, mustCapture, refresh, selected, turn, winner],
  );

  const setActiveMove = useCallback((id: number | null) => {
    setActiveMoveId((prev) => (prev === id ? null : id));
  }, []);

  const snapshot: CheckersSnapshot = useMemo(
    () => ({
      gameId,
      loading,
      error,
      board,
      turn,
      winner,
      selected,
      availableMoves,
      capturingPieces,
      capturedByWhite,
      capturedByBlack,
      canUndo: history.length > 0,
      moves,
      activeMoveId,
      activeMovePath,
      clock: DISABLED_CLOCK,
    }),
    [
      activeMoveId,
      activeMovePath,
      availableMoves,
      board,
      capturedByBlack,
      capturedByWhite,
      capturingPieces,
      error,
      gameId,
      history.length,
      loading,
      moves,
      selected,
      turn,
      winner,
    ],
  );

  return { snapshot, onCellClick, reset, undo, restart, setActiveMove, refresh };
}
