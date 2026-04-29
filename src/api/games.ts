import { apiRequest, apiRequestWithMeta } from "./client";
import type { ApiAsyncMoveAccepted, ApiGame, ApiGameId, ApiGameMode, ApiMoveHistoryItem, ApiPos, ApiTaskResult } from "./types";

function normalizeMovesResponse(raw: unknown): ApiMoveHistoryItem[] {
  if (Array.isArray(raw)) return raw as ApiMoveHistoryItem[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { results?: unknown }).results)) {
    return (raw as { results: ApiMoveHistoryItem[] }).results;
  }
  return [];
}

export async function createGame(mode: ApiGameMode): Promise<ApiGame> {
  return apiRequest<ApiGame>("/games/", { method: "POST", json: { mode } });
}

export async function getGame(gameId: ApiGameId): Promise<ApiGame> {
  return apiRequest<ApiGame>(`/games/${gameId}/`, { method: "GET" });
}

export async function getMoves(gameId: ApiGameId): Promise<ApiMoveHistoryItem[]> {
  const raw = await apiRequest<unknown>(`/games/${gameId}/moves/`, { method: "GET" });
  return normalizeMovesResponse(raw);
}

export async function makeMove(gameId: ApiGameId, from: ApiPos, to: ApiPos): Promise<
  | { status: 200; game: ApiGame }
  | { status: 202; taskId: string; taskStatus: string; game: ApiGame }
> {
  const res = await apiRequestWithMeta<ApiGame | ApiAsyncMoveAccepted>(`/games/${gameId}/moves/`, {
    method: "POST",
    json: { from, to },
  });

  if (res.status === 202) {
    const payload = res.payload as ApiAsyncMoveAccepted;
    return { status: 202, taskId: payload.taskId, taskStatus: payload.status, game: payload.game };
  }

  return { status: 200, game: res.payload as ApiGame };
}

export async function getTask(taskId: string): Promise<ApiTaskResult> {
  return apiRequest<ApiTaskResult>(`/tasks/${taskId}/`, { method: "GET" });
}

export async function undoMove(gameId: ApiGameId): Promise<unknown> {
  return apiRequest(`/games/${gameId}/undo/`, { method: "POST" });
}

export async function restartGame(gameId: ApiGameId): Promise<unknown> {
  return apiRequest(`/games/${gameId}/restart/`, { method: "POST" });
}
