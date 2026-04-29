import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAME_CONFIG, GAME_RULES, MOVE_ANIMATION_STEP_MS } from "../constants";
import type { Board, BoardSnapshot, CheckerSnapshot, Coords, Move, Player, TimerClockSnapshot } from "../types";
import { cloneBoard, countPieces, getPiece, maybePromote, movePiece, removePiece, setPiece } from "../logic/boardUtils";
import { getCapturesForPiece, getCapturingPieces, getValidMovesForPiece, playerHasCapture } from "../logic/gameRules";
import type { CoreMove } from "../types";
import type { ApiAllowedMove, ApiGame, ApiGameId, ApiGameMode, ApiMoveHistoryItem, ApiTaskStatus, BackendBoard, BackendPiece } from "../api/types";
import { createGame, getGame, getMoves, getTask, makeMove, restartGame, undoMove } from "../api/games";
import { ApiClientError } from "../api/client";

type RenderMove = Readonly<{ id: number; text: string }>;
type PendingPreviewMove = Readonly<{
  id: number;
  path: readonly Coords[];
  capturedPositions: readonly Coords[];
}>;
type OptimisticState = Readonly<{
  board: BoardSnapshot;
  turn: Player;
  capturedByWhite: number;
  capturedByBlack: number;
}>;



export type CheckersSnapshot = Readonly<{
  gameId: ApiGameId | null;
  mode: ApiGameMode;
  loading: boolean;
  error: string | null;
  aiTaskStatus: ApiTaskStatus | null;
  isBoardInteractive: boolean;

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
  previewMoveId: number | null;
  previewMovePath: readonly Coords[] | null;
  previewMoveCapturedPositions: readonly Coords[];
  latestMoveId: number | null;
  latestMovePath: readonly Coords[] | null;
  latestMoveCapturedPositions: readonly Coords[];
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
const DEFAULT_GAME_MODE: ApiGameMode = "vs_ai";

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

function normalizeGameMode(mode: unknown): ApiGameMode {
  return mode === "pvp" ? "pvp" : "vs_ai";
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

function isBackendCaptureMove(m: ApiAllowedMove): boolean {
  return Boolean(m.isCapture ?? m.isJump);
}

function backendAllowedMoveToUi(m: ApiAllowedMove): Move | null {
  if (!isBackendCaptureMove(m)) return { r: m.toPos.row, c: m.toPos.col, type: "move" as const };
  const cap = m.capturedPos ?? null;
  if (!cap) return null;
  return { r: m.toPos.row, c: m.toPos.col, type: "jump" as const, target: { r: cap.row, c: cap.col } };
}

function moveKey(from: Coords, to: Coords, captured: Coords | null): string {
  if (!captured) return `${from.r},${from.c}->${to.r},${to.c}`;
  return `${from.r},${from.c}->${to.r},${to.c}|x:${captured.r},${captured.c}`;
}

function sameCoordsApi(a: Coords, b: { row: number; col: number }): boolean {
  return a.r === b.row && a.c === b.col;
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
  if (Array.isArray(m.path) && m.path.length > 0) {
    return m.path.map((pos) => ({ r: pos.row, c: pos.col }));
  }
  const path: Coords[] = [{ r: m.fromPos.row, c: m.fromPos.col }];
  if (m.capturedPos) path.push({ r: m.capturedPos.row, c: m.capturedPos.col });
  path.push({ r: m.toPos.row, c: m.toPos.col });
  return path;
}

function backendMoveToCapturedPositions(m: ApiMoveHistoryItem): Coords[] {
  if (Array.isArray(m.capturedPositions) && m.capturedPositions.length > 0) {
    return m.capturedPositions.map((pos) => ({ r: pos.row, c: pos.col }));
  }
  if (!m.capturedPos) return [];
  return [{ r: m.capturedPos.row, c: m.capturedPos.col }];
}

function backendAllowedMoveToPath(m: ApiAllowedMove): Coords[] {
  if (Array.isArray(m.path) && m.path.length > 0) {
    return m.path.map((pos) => ({ r: pos.row, c: pos.col }));
  }
  return [
    { r: m.fromPos.row, c: m.fromPos.col },
    { r: m.toPos.row, c: m.toPos.col },
  ];
}

function backendAllowedMoveToCapturedPositions(m: ApiAllowedMove): Coords[] {
  if (Array.isArray(m.capturedPositions) && m.capturedPositions.length > 0) {
    return m.capturedPositions.map((pos) => ({ r: pos.row, c: pos.col }));
  }
  if (!m.capturedPos) return [];
  return [{ r: m.capturedPos.row, c: m.capturedPos.col }];
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function otherPlayer(p: Player): Player {
  return p === GAME_CONFIG.WHITE_PLAYER ? GAME_CONFIG.BLACK_PLAYER : GAME_CONFIG.WHITE_PLAYER;
}

function applyOptimisticMove(
  board: Board,
  from: Coords,
  to: Coords,
  capturedPositions: readonly Coords[],
): BoardSnapshot {
  let next = cloneBoard(board);
  const movedRes = movePiece(next, from, to);
  next = movedRes.board;
  for (const captured of capturedPositions) next = removePiece(next, captured);
  const promoted = maybePromote(movedRes.moved, to.r);
  next = setPiece(next, to, promoted);
  return next;
}

function toUserMessage(e: unknown): string {
  if (e instanceof ApiClientError) return e.message;
  if (e instanceof Error) return e.message;
  return "Unexpected error";
}

function extractGameFromError(e: unknown): ApiGame | null {
  if (!(e instanceof ApiClientError)) return null;
  const p = e.payload;
  if (!p || typeof p !== "object") return null;
  const maybe = (p as { game?: unknown }).game;
  if (!maybe || typeof maybe !== "object") return null;
  return maybe as ApiGame;
}

export function useCheckers() {
  const [mode, setMode] = useState<ApiGameMode>(DEFAULT_GAME_MODE);
  const [gameId, setGameId] = useState<ApiGameId | null>(() => readInitialGameId());
  const [game, setGame] = useState<ApiGame | null>(null);
  const [history, setHistory] = useState<ApiMoveHistoryItem[]>([]);

  const [selected, setSelected] = useState<Coords | null>(null);
  const [activeMoveId, setActiveMoveId] = useState<number | null>(null);
  const [previewMove, setPreviewMove] = useState<PendingPreviewMove | null>(null);
  const [optimisticState, setOptimisticState] = useState<OptimisticState | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiTaskStatus, setAiTaskStatus] = useState<ApiTaskStatus | null>(null);

  const reqSeq = useRef(0);
  const didHydrateRef = useRef(false);
  const previewSeq = useRef(0);

  const syncGameState = useCallback((nextGame: ApiGame, nextMoves?: ApiMoveHistoryItem[]) => {
    setMode(normalizeGameMode(nextGame.mode));
    setGame(nextGame);
    if (nextMoves) setHistory(nextMoves);
  }, []);

  const board = useMemo((): BoardSnapshot => {
    if (optimisticState) return optimisticState.board;
    if (!game?.board) return Object.freeze([]) as unknown as BoardSnapshot;
    return mapBoard(game.board);
  }, [game?.board, optimisticState]);

  const turn = useMemo((): Player => {
    if (optimisticState) return optimisticState.turn;
    return mapPlayerSide(game?.currentTurn) ?? GAME_CONFIG.WHITE_PLAYER;
  }, [game?.currentTurn, optimisticState]);

  const winner = useMemo((): Player | null => {
    if (!game) return null;
    return mapPlayerSide(game.winner) ?? null;
  }, [game]);

  const isBoardInteractive = useMemo(() => {
    if (!gameId || !game) return false;
    if (optimisticState) return false;
    if (loading) return false;
    if (winner !== null) return false;
    if (mode === "pvp") return true;
    return turn === GAME_CONFIG.WHITE_PLAYER;
  }, [game, gameId, loading, mode, optimisticState, turn, winner]);

  const serverAllowedMoves = useMemo((): readonly ApiAllowedMove[] | null => {
    if (optimisticState) return null;
    const ms = game?.allowedMoves;
    return Array.isArray(ms) ? ms : null;
  }, [game?.allowedMoves, optimisticState]);

  const localMustCapture = useMemo(() => {
    if (!game) return false;
    if (winner !== null) return false;
    return playerHasCapture(board as Board, turn);
  }, [board, game, turn, winner]);

  const serverMustCapture = useMemo((): boolean | null => {
    if (!game) return null;
    if (winner !== null) return null;
    if (!serverAllowedMoves) return null;
    return serverAllowedMoves.some(isBackendCaptureMove);
  }, [game, serverAllowedMoves, winner]);

  const mustCapture = serverMustCapture ?? localMustCapture;

  const availableMoves = useMemo((): readonly Move[] => {
    if (!game) return EMPTY_MOVES;
    if (winner !== null) return EMPTY_MOVES;
    if (!selected) return EMPTY_MOVES;

    if (serverAllowedMoves) {
      const ui: Move[] = [];
      for (const m of serverAllowedMoves) {
        if (m.fromPos.row !== selected.r || m.fromPos.col !== selected.c) continue;
        const converted = backendAllowedMoveToUi(m);
        if (converted) ui.push(converted);
      }
      return ui;
    }

    const core = getValidMovesForPiece(board as Board, turn, selected, { capturesOnly: mustCapture });
    return coreMovesToUi(core);
  }, [board, game, mustCapture, selected, serverAllowedMoves, turn, winner]);

  const capturingPieces = useMemo((): readonly Coords[] => {
    if (!game) return EMPTY_COORDS;
    if (winner !== null) return EMPTY_COORDS;
    if (!mustCapture) return EMPTY_COORDS;

    if (serverAllowedMoves) {
      const captureMoves = serverAllowedMoves.filter(isBackendCaptureMove);
      if (captureMoves.length === 0) return EMPTY_COORDS;

      const seen = new Set<string>();
      const out: Coords[] = [];
      for (const m of captureMoves) {
        const key = `${m.fromPos.row},${m.fromPos.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ r: m.fromPos.row, c: m.fromPos.col });
      }
      out.sort((a, b) => (a.r - b.r) || (a.c - b.c));
      return out;
    }

    return getCapturingPieces(board as Board, turn);
  }, [board, game, mustCapture, serverAllowedMoves, turn, winner]);

  const lastRulesDriftRef = useRef<string | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!game) return;
    if (winner !== null) return;
    if (!serverAllowedMoves) return;

    const serverSet = new Set<string>();
    for (const m of serverAllowedMoves) {
      const from: Coords = { r: m.fromPos.row, c: m.fromPos.col };
      const to: Coords = { r: m.toPos.row, c: m.toPos.col };
      const captured = isBackendCaptureMove(m) && m.capturedPos
        ? { r: m.capturedPos.row, c: m.capturedPos.col }
        : null;
      serverSet.add(moveKey(from, to, captured));
    }

    const localSet = new Set<string>();
    const b = board as Board;
    for (let r = 0; r < GAME_CONFIG.ROWS; r++) {
      for (let c = 0; c < GAME_CONFIG.COLS; c++) {
        const p = b[r]![c]!;
        if (!p || p.color !== turn) continue;
        const core = getValidMovesForPiece(b, turn, { r, c }, { capturesOnly: localMustCapture });
        for (const m of core) {
          if (m.type === "simple") localSet.add(moveKey(m.from, m.to, null));
          else localSet.add(moveKey(m.from, m.to, m.captured));
        }
      }
    }

    const onlyInServer: string[] = [];
    const onlyInLocal: string[] = [];
    for (const k of serverSet) if (!localSet.has(k)) onlyInServer.push(k);
    for (const k of localSet) if (!serverSet.has(k)) onlyInLocal.push(k);

    if (onlyInServer.length === 0 && onlyInLocal.length === 0) {
      lastRulesDriftRef.current = null;
      return;
    }

    const signature = `${String(game.id)}:${game.moveCount}:${turn}:${localMustCapture}:${serverSet.size}:${localSet.size}:${onlyInServer.length}:${onlyInLocal.length}`;
    if (lastRulesDriftRef.current === signature) return;
    lastRulesDriftRef.current = signature;

    console.warn("[checkers] Rules drift detected: backend allowedMoves != client gameRules", {
      gameId: game.id,
      moveCount: game.moveCount,
      turn,
      localMustCapture,
      serverAllowedMoves: Array.from(serverSet),
      localAllowedMoves: Array.from(localSet),
      onlyInServer: onlyInServer.slice(0, 12),
      onlyInLocal: onlyInLocal.slice(0, 12),
    });
  }, [board, game, localMustCapture, serverAllowedMoves, turn, winner]);

  const { capturedByWhite, capturedByBlack } = useMemo(() => {
    if (optimisticState) {
      return {
        capturedByWhite: optimisticState.capturedByWhite,
        capturedByBlack: optimisticState.capturedByBlack,
      };
    }
    if (!game) return { capturedByWhite: 0, capturedByBlack: 0 };
    if (Number.isFinite(game.capturedByWhite) && Number.isFinite(game.capturedByBlack)) {
      return {
        capturedByWhite: game.capturedByWhite as number,
        capturedByBlack: game.capturedByBlack as number,
      };
    }
    const b = board as Board;
    const currentWhite = countPieces(b, GAME_CONFIG.WHITE_PLAYER);
    const currentBlack = countPieces(b, GAME_CONFIG.BLACK_PLAYER);
    const initialCount = GAME_RULES.INITIAL_PIECE_ROWS * (GAME_CONFIG.COLS / 2);
    return {
      capturedByWhite: Math.max(0, initialCount - currentBlack),
      capturedByBlack: Math.max(0, initialCount - currentWhite),
    };
  }, [board, game, optimisticState]);

  const moves = useMemo((): ReadonlyArray<RenderMove> => {
    if (history.length === 0) return EMPTY_RENDER_MOVES;
    return history.map((m) => ({ id: m.id, text: backendMoveToRenderText(m) }));
  }, [history]);

  const activeMovePath = useMemo((): readonly Coords[] | null => {
    if (!activeMoveId) return null;
    const m = history.find((x) => x.id === activeMoveId);
    return m ? backendMoveToPath(m) : null;
  }, [activeMoveId, history]);

  const latestMove = history.length > 0 ? history[history.length - 1] : null;

  const latestMovePath = useMemo((): readonly Coords[] | null => {
    return latestMove ? backendMoveToPath(latestMove) : null;
  }, [latestMove]);

  const latestMoveCapturedPositions = useMemo((): readonly Coords[] => {
    return latestMove ? backendMoveToCapturedPositions(latestMove) : EMPTY_COORDS;
  }, [latestMove]);

  const fetchGameAndMoves = useCallback(
    async (id: ApiGameId): Promise<{ game: ApiGame; moves: ApiMoveHistoryItem[] } | null> => {
      const seq = reqSeq.current;

      const game = await getGame(id);
      if (seq !== reqSeq.current) return null;

      let moves: ApiMoveHistoryItem[] = [];
      try {
        moves = await getMoves(id);
      } catch (e) {
        if (!(e instanceof ApiClientError && e.status === 404)) throw e;
        moves = [];
      }

      if (seq !== reqSeq.current) return null;
      return { game, moves };
    },
    [],
  );

  const refresh = useCallback(async (id: ApiGameId) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGameAndMoves(id);
      if (!res) return;

      writeStoredGameId(id);
      setGameId(id);
      setAiTaskStatus(null);
      setOptimisticState(null);
      setPreviewMove(null);
      syncGameState(res.game, res.moves);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      if (e instanceof ApiClientError && e.status === 404) {
        writeStoredGameId(null);
        setGameId(null);
        setMode(DEFAULT_GAME_MODE);
        setGame(null);
        setHistory([]);
      }
      setAiTaskStatus(null);
      setOptimisticState(null);
      setPreviewMove(null);
      setError(toUserMessage(e));
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [fetchGameAndMoves, syncGameState]);

  const reset = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    setSelected(null);
    setActiveMoveId(null);
    setAiTaskStatus(null);
    setOptimisticState(null);
    setPreviewMove(null);
    try {
      const created = await createGame(mode);
      if (seq !== reqSeq.current) return;
      writeStoredGameId(created.id);

      const res = await fetchGameAndMoves(created.id);
      if (!res) return;
      setGameId(created.id);
      setAiTaskStatus(null);
      syncGameState(res.game, res.moves);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setError(toUserMessage(e));
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [fetchGameAndMoves, mode, syncGameState]);

  const runMutation = useCallback(
    async (apiCall: (id: ApiGameId) => Promise<unknown>) => {
      if (!gameId) return;
      const seq = ++reqSeq.current;
      setLoading(true);
      setError(null);
      setAiTaskStatus(null);
      setOptimisticState(null);
      setPreviewMove(null);
      try {
        await apiCall(gameId);
        if (seq !== reqSeq.current) return;
        setSelected(null);
        setActiveMoveId(null);
        await refresh(gameId);
      } catch (e) {
        if (seq !== reqSeq.current) return;
        const nextGame = extractGameFromError(e);
        if (nextGame) {
          syncGameState(nextGame);
          setSelected(null);
          setActiveMoveId(null);
        }
        setOptimisticState(null);
        setPreviewMove(null);
        setError(toUserMessage(e));
        setLoading(false);
      }
    },
    [gameId, refresh, syncGameState],
  );

  const undo = useCallback(async () => {
    await runMutation(undoMove);
  }, [runMutation]);

  const restart = useCallback(async () => {
    await runMutation(restartGame);
  }, [runMutation]);

  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    if (!gameId) return;
    setSelected(null);
    setActiveMoveId(null);
    void refresh(gameId);
  }, [gameId, refresh]);

  const pollAiTask = useCallback(
    async (taskId: string, currentGameId: ApiGameId, seq: number) => {
      while (seq === reqSeq.current) {
        await sleep(1200);
        if (seq !== reqSeq.current) return;

        const task = await getTask(taskId);
        if (seq !== reqSeq.current) return;

        setAiTaskStatus(task.status);

        if (task.status === "finished") {
          if (task.game) {
            let nextMoves: ApiMoveHistoryItem[] = [];
            try {
              nextMoves = await getMoves(currentGameId);
            } catch (e) {
              if (!(e instanceof ApiClientError && e.status === 404)) throw e;
            }
            if (seq !== reqSeq.current) return;
            syncGameState(task.game, nextMoves);
          } else {
            await refresh(currentGameId);
            if (seq !== reqSeq.current) return;
          }
          setOptimisticState(null);
          setPreviewMove(null);
          setSelected(null);
          setActiveMoveId(null);
          setAiTaskStatus(null);
          setLoading(false);
          return;
        }

        if (task.status === "failed") {
          setOptimisticState(null);
          setPreviewMove(null);
          setAiTaskStatus(null);
          setError("AI move failed");
          setLoading(false);
          return;
        }
      }
    },
    [refresh, syncGameState],
  );

  const onCellClick = useCallback(
    async (row: number, col: number) => {
      if (!gameId || !game) return;
      if (!isBoardInteractive) return;
      if (winner !== null) return;

      setError(null);

      const at: Coords = { r: row, c: col };
      const b = board as Board;

      if (selected) {
        const serverChosen = serverAllowedMoves
          ? serverAllowedMoves.find(
              (m) =>
                sameCoordsApi(selected, m.fromPos) &&
                m.toPos.row === at.r &&
                m.toPos.col === at.c,
            )
          : null;

        const localChosen = !serverAllowedMoves
          ? getValidMovesForPiece(b, turn, selected, { capturesOnly: mustCapture }).find(
              (m) => m.to.r === at.r && m.to.c === at.c,
            )
          : null;

        if (serverChosen || localChosen) {
          const movePath = serverChosen
            ? backendAllowedMoveToPath(serverChosen)
            : [{ ...selected }, { ...at }];
          const capturedPositions = serverChosen
            ? backendAllowedMoveToCapturedPositions(serverChosen)
            : localChosen && localChosen.type === "capture"
              ? [{ ...localChosen.captured }]
              : EMPTY_COORDS;
          const optimisticBoard = applyOptimisticMove(b, selected, at, capturedPositions);
          const previewId = ++previewSeq.current;
          const seq = ++reqSeq.current;
          setLoading(true);
          setOptimisticState({
            board: optimisticBoard,
            turn: otherPlayer(turn),
            capturedByWhite:
              capturedByWhite + capturedPositions.length,
            capturedByBlack,
          });
          setPreviewMove({
            id: previewId,
            path: movePath,
            capturedPositions,
          });
          setSelected(null);
          setActiveMoveId(null);
          try {
            await sleep(Math.max(0, (movePath.length - 1) * MOVE_ANIMATION_STEP_MS));
            const moveResult = await makeMove(gameId, { row: selected.r, col: selected.c }, { row: at.r, col: at.c });
            if (seq !== reqSeq.current) return;
            if (moveResult.status === 200) {
              let nextMoves: ApiMoveHistoryItem[] = [];
              try {
                nextMoves = await getMoves(gameId);
              } catch (e) {
                if (!(e instanceof ApiClientError && e.status === 404)) throw e;
              }
              if (seq !== reqSeq.current) return;
              setOptimisticState(null);
              setPreviewMove(null);
              syncGameState(moveResult.game, nextMoves);
              setLoading(false);
              return;
            }

            setOptimisticState(null);
            setPreviewMove(null);
            setAiTaskStatus(moveResult.taskStatus as ApiTaskStatus);
            syncGameState(moveResult.game);
            let nextMoves: ApiMoveHistoryItem[] = [];
            try {
              nextMoves = await getMoves(gameId);
            } catch (e) {
              if (!(e instanceof ApiClientError && e.status === 404)) throw e;
            }
            if (seq !== reqSeq.current) return;
            setHistory(nextMoves);
            await pollAiTask(moveResult.taskId, gameId, seq);
          } catch (e) {
            if (seq !== reqSeq.current) return;
            const nextGame = extractGameFromError(e);
            if (nextGame) {
              syncGameState(nextGame);
            }
            setAiTaskStatus(null);
            setOptimisticState(null);
            setPreviewMove(null);
            setSelected(null);
            setActiveMoveId(null);
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
        if (serverAllowedMoves) {
          const canCapture = serverAllowedMoves.some(
            (m) => isBackendCaptureMove(m) && sameCoordsApi(at, m.fromPos),
          );
          if (!canCapture) return;
        } else {
          const captures = getCapturesForPiece(b, turn, at);
          if (captures.length === 0) return;
        }
      }

      setSelected({ ...at });
      setActiveMoveId(null);
    },
    [
      board,
      capturedByBlack,
      capturedByWhite,
      game,
      gameId,
      isBoardInteractive,
      mustCapture,
      selected,
      serverAllowedMoves,
      syncGameState,
      turn,
      winner,
      pollAiTask,
    ],
  );

  const setActiveMove = useCallback((id: number | null) => {
    setActiveMoveId((prev) => (prev === id ? null : id));
  }, []);

  const snapshot: CheckersSnapshot = useMemo(
    () => ({
      gameId,
      mode,
      loading,
      error,
      aiTaskStatus,
      isBoardInteractive,
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
      previewMoveId: previewMove?.id ?? null,
      previewMovePath: previewMove?.path ?? null,
      previewMoveCapturedPositions: previewMove?.capturedPositions ?? EMPTY_COORDS,
      latestMoveId: latestMove?.id ?? null,
      latestMovePath,
      latestMoveCapturedPositions,
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
      latestMove,
      latestMoveCapturedPositions,
      latestMovePath,
      mode,
      previewMove,
      aiTaskStatus,
      isBoardInteractive,
      loading,
      moves,
      selected,
      turn,
      winner,
    ],
  );

  return { snapshot, onCellClick, reset, undo, restart, setActiveMove, refresh, setMode };
}
