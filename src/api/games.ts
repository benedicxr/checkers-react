import { apiRequest } from "./client";
import type { ApiGame, ApiGameId, ApiGameMode, ApiMoveHistoryItem, ApiPos } from "./types";

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

export async function makeMove(gameId: ApiGameId, from: ApiPos, to: ApiPos): Promise<unknown> {
  return apiRequest(`/games/${gameId}/moves/`, {
    method: "POST",
    json: { from, to },
  });
}

export async function undoMove(gameId: ApiGameId): Promise<unknown> {
  return apiRequest(`/games/${gameId}/undo/`, { method: "POST" });
}

export async function restartGame(gameId: ApiGameId): Promise<unknown> {
  return apiRequest(`/games/${gameId}/restart/`, { method: "POST" });
}
